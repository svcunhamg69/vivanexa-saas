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
  const kpiExemptPages = ['/kpi']; // A página de KPI é isenta da verificação de redirecionamento para ela mesma

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

  useEffect(() => {
    if (!session) return;
    const loadCfg = async () => {
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
        // Se não houver cfg, inicializa com um objeto vazio para evitar erros de acesso a propriedades
        setCfg({});
      }
      setCheckingKpi(false);
    };
    loadCfg();
  }, [session]);

  useEffect(() => {
    // Só executa se houver sessão, a verificação de KPI estiver completa, não for página pública ou isenta
    if (!session || checkingKpi || isPublicPage || kpiExemptPages.includes(router.pathname)) {
      return;
    }

    // Se cfg ainda não foi carregado ou kpiRequired não está definido, espera
    if (cfg === null || cfg.kpiRequired === undefined) {
      return;
    }

    if (cfg.kpiRequired) {
      const hoje = new Date();
      const ontem = new Date(hoje);
      ontem.setDate(hoje.getDate() - 1);
      const ontemStr = ontem.toISOString().slice(0,10);

      const logs = cfg.kpiLog || [];
      const userId = session.user.id;
      const hasYesterdayLog = logs.some(l => l.userId === userId && l.date === ontemStr);

      if (!hasYesterdayLog) {
        const currentPath = router.asPath;
        // Redireciona apenas se não estiver já na página de KPI para evitar loop
        if (router.pathname !== '/kpi') {
          router.push(`/kpi?redirect=${encodeURIComponent(currentPath)}&date=${ontemStr}`);
        }
      }
    }
  }, [session, cfg, checkingKpi, router.pathname, isPublicPage, kpiExemptPages, router]); // Adicionado router às dependências

  // Se for uma página pública ou não houver sessão e não for página pública, renderiza o componente
  if (isPublicPage || (!session && !isPublicPage)) {
    return <Component {...pageProps} />;
  }

  // Se estiver verificando KPI, mostra "Carregando..."
  if (checkingKpi) {
    return <p style={{ background: '#0a0f1e', color: '#fff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Carregando...</p>;
  }

  // Se chegou até aqui, significa que a sessão está ativa, a verificação de KPI foi feita
  // e não houve redirecionamento forçado (ou já está na página de KPI).
  // Então, renderiza o componente da página atual.
  return <Component {...pageProps} />;
}

export default MyApp;
