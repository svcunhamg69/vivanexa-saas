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

  // Páginas públicas (que não exigem login)
  const publicPages = ['/', '/sign/[token]'];
  const isPublicPage = publicPages.some(p => router.pathname === p || router.pathname.startsWith('/sign/'));

  // Páginas que não devem ser bloqueadas por KPI (como a própria página de KPI)
  const kpiExemptPages = ['/kpi'];

  useEffect(() => {
    // Verifica sessão
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

  // Carregar configuração da empresa quando sessão existir
  useEffect(() => {
    if (!session) return;
    const loadCfg = async () => {
      const { data: profile } = await supabase
        .from('perfis')
        .select('empresa_id')
        .eq('id', session.user.id)
        .single();
      const empresaId = profile?.empresa_id || session.user.id;
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

  // Verificar obrigatoriedade de KPI
  useEffect(() => {
    if (!session || checkingKpi || isPublicPage || kpiExemptPages.includes(router.pathname)) return;
    if (!cfg || !cfg.kpiRequired) return;

    // Verificar se o usuário já lançou KPIs do dia anterior
    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(hoje.getDate() - 1);
    const ontemStr = ontem.toISOString().slice(0,10);

    const logs = cfg.kpiLog || [];
    const userId = session.user.id;
    const hasYesterdayLog = logs.some(l => l.userId === userId && l.date === ontemStr);

    if (!hasYesterdayLog && !kpiExemptPages.includes(router.pathname)) {
      // Guarda a rota de destino
      const currentPath = router.asPath;
      router.push(`/kpi?redirect=${encodeURIComponent(currentPath)}`);
    }
  }, [session, cfg, checkingKpi, router.pathname]);

  // Páginas públicas ou sem sessão
  if (isPublicPage || (!session && !isPublicPage)) {
    return <Component {...pageProps} />;
  }

  // Se não carregou configuração ainda, mostrar loading
  if (checkingKpi) {
    return <p style={{ background: '#0a0f1e', color: '#fff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Carregando...</p>;
  }

  // Se está na página de KPI, renderiza normalmente
  if (router.pathname === '/kpi') {
    return <Component {...pageProps} />;
  }

  // Se KPI obrigatório e não preenchido, não renderiza nada (já redirecionou)
  if (cfg && cfg.kpiRequired) {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    const ontemStr = ontem.toISOString().slice(0,10);
    const logs = cfg.kpiLog || [];
    const userId = session.user.id;
    const hasYesterdayLog = logs.some(l => l.userId === userId && l.date === ontemStr);
    if (!hasYesterdayLog) {
      return null; // Aguardando redirecionamento
    }
  }

  return <Component {...pageProps} />;
}

export default MyApp;
