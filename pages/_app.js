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
  const kpiExemptPages = ['/kpi']; // A página /kpi deve ser isenta da verificação de KPI

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
      }
      setCheckingKpi(false);
    };
    loadCfg();
  }, [session]);

  // Lógica de redirecionamento para KPI (este é o único lugar onde o redirecionamento deve ocorrer)
  useEffect(() => {
    // Só executa se houver sessão, não estiver verificando KPI, não for página pública ou isenta de KPI
    if (!session || checkingKpi || isPublicPage || kpiExemptPages.includes(router.pathname)) return;
    // Só executa se a configuração exigir KPI
    if (!cfg || !cfg.kpiRequired) return;

    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(hoje.getDate() - 1);
    const ontemStr = ontem.toISOString().slice(0,10);

    const logs = cfg.kpiLog || [];
    const userId = session.user.id;
    const hasYesterdayLog = logs.some(l => l.userId === userId && l.date === ontemStr);

    // Se não tem log do dia anterior E a página atual não é a de KPI, redireciona
    if (!hasYesterdayLog && !kpiExemptPages.includes(router.pathname)) {
      const currentPath = router.asPath;
      router.push(`/kpi?redirect=${encodeURIComponent(currentPath)}&date=${ontemStr}`);
    }
  }, [session, cfg, checkingKpi, router.pathname, isPublicPage, kpiExemptPages, router]); // Adicionado 'router' como dependência

  // Se for página pública ou não houver sessão e não for página pública, renderiza normalmente
  if (isPublicPage || (!session && !isPublicPage)) {
    return <Component {...pageProps} />;
  }

  // Mostra "Carregando..." enquanto busca as configurações
  if (checkingKpi) {
    return <p style={{ background: '#0a0f1e', color: '#fff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Carregando...</p>;
  }

  // Se chegou até aqui, significa que a sessão está ativa e o KPI foi verificado (ou não é obrigatório)
  // Ou que a página atual é a de KPI, que é tratada separadamente.
  // A lógica de redirecionamento no useEffect já cuidou de levar para /kpi se necessário.
  // Então, agora podemos simplesmente renderizar o componente.
  return <Component {...pageProps} />;
}

export default MyApp;
