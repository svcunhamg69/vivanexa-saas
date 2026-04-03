// pages/_app.js
import '../styles/globals.css';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';

function MyApp({ Component, pageProps }) {
  const [session, setSession] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [checkingKpi, setCheckingKpi] = useState(true);
  const router = useRouter();

  const publicPages = ['/', '/sign/[token]'];
  const isPublicPage = publicPages.some(p => router.pathname === p || router.pathname.startsWith('/sign/'));
  const kpiExemptPages = ['/kpi'];

  // Listener de autenticação
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (event === 'SIGNED_OUT') {
          router.push('/');
        } else if (event === 'SIGNED_IN' && router.pathname === '/') {
          router.push('/chat');
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  // Carrega configurações do usuário
  useEffect(() => {
    if (!session) return;
    const loadCfg = async () => {
      // Busca ou cria perfil automaticamente (corrigido: user_id)
      let { data: perfil, error } = await supabase
        .from('perfis')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!perfil) {
        const nome = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuário';
        const { data: novoPerfil } = await supabase
          .from('perfis')
          .insert({
            user_id: session.user.id,
            nome: nome,
            email: session.user.email,
            empresa_id: session.user.id,
            perfil: 'admin'
          })
          .select()
          .single();
        perfil = novoPerfil;
      }

      const empresaId = perfil?.empresa_id || session.user.id;
      const { data: row } = await supabase
        .from('vx_storage')
        .select('value')
        .eq('key', `cfg:${empresaId}`)
        .single();

      if (row?.value) {
        const loaded = JSON.parse(row.value);
        setCfg(loaded);
      } else {
        // Se não houver cfg, inicializa com um objeto vazio para evitar null
        setCfg({});
      }
      setCheckingKpi(false);
    };
    loadCfg();
  }, [session]); // Dependência apenas da sessão

  // Verifica KPI e redireciona
  useEffect(() => {
    // Só executa se houver sessão, as configurações já foram carregadas,
    // não estiver em uma página pública ou isenta de KPI.
    if (!session || checkingKpi || isPublicPage || kpiExemptPages.includes(router.pathname)) {
      return;
    }

    // Se cfg ainda for null ou kpiRequired não estiver definido, espera
    if (cfg === null || cfg.kpiRequired === undefined) {
      return;
    }

    // Se KPI não for obrigatório, não faz nada
    if (!cfg.kpiRequired) {
      return;
    }

    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(hoje.getDate() - 1);
    const ontemStr = ontem.toISOString().slice(0, 10); // Formato YYYY-MM-DD

    const logs = cfg.kpiLog || [];
    const userId = session.user.id;
    const hasYesterdayLog = logs.some(l => l.userId === userId && l.date === ontemStr);

    if (!hasYesterdayLog) {
      const currentPath = router.asPath;
      // Redireciona para a página de KPI, passando a data do KPI que precisa ser lançado
      router.push(`/kpi?redirect=${encodeURIComponent(currentPath)}&date=${ontemStr}`);
    }
  }, [session, cfg, checkingKpi, router.pathname, isPublicPage, kpiExemptPages, router]); // Adicionei router às dependências

  // Renderização condicional
  if (isPublicPage || (!session && !isPublicPage)) {
    return <Component {...pageProps} />;
  }

  if (checkingKpi) {
    return <p style={{ background: '#0a0f1e', color: '#fff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Carregando...</p>;
  }

  // Se estiver na página /kpi, sempre renderiza o componente KPI
  if (router.pathname === '/kpi') {
    return <Component {...pageProps} />;
  }

  // Se chegou até aqui, significa que a sessão está ativa, KPI foi verificado (ou não é obrigatório),
  // e não estamos em uma página pública ou /kpi.
  // Então, renderiza o componente da página atual.
  return <Component {...pageProps} />;
}

export default MyApp;
