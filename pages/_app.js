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
        setCfg({}); // Garante que cfg não seja nulo se não houver configuração salva
      }
      setCheckingKpi(false);
    };
    loadCfg();
  }, [session]);

  useEffect(() => {
    if (!session || checkingKpi || isPublicPage || kpiExemptPages.includes(router.pathname)) return;
    if (!cfg || !cfg.kpiRequired) return;

    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(hoje.getDate() - 1);
    const ontemStr = ontem.toISOString().slice(0,10);

    const logs = cfg.kpiLog || [];
    const userId = session.user.id;
    const hasYesterdayLog = logs.some(l => l.userId === userId && l.date === ontemStr);

    if (!hasYesterdayLog && !kpiExemptPages.includes(router.pathname)) {
      const currentPath = router.asPath;
      router.push(`/kpi?redirect=${encodeURIComponent(currentPath)}&date=${ontemStr}`);
    }
  }, [session, cfg, checkingKpi, router.pathname, router.asPath, isPublicPage]); // Adicionado router.asPath e isPublicPage

  if (isPublicPage || (!session && !isPublicPage)) {
    return <Component {...pageProps} />;
  }

  if (checkingKpi) {
    return <p style={{ background: '#0a0f1e', color: '#fff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Carregando...</p>;
  }

  // Esta parte foi removida para evitar o "null" e permitir que o kpi.js renderize
  // if (router.pathname === '/kpi') {
  //   return <Component {...pageProps} />;
  // }

  // A lógica de bloqueio deve ser tratada pelo redirecionamento no useEffect
  // e não impedindo a renderização do componente.
  // Se o usuário está em /kpi, ele deve ver o componente KpiPage.
  // Se ele não está em /kpi e precisa preencher, o useEffect acima o redirecionará.

  return <Component {...pageProps} />;
}

export default MyApp;
