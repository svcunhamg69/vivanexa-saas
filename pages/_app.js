// pages/_app.js
import '../styles/globals.css';
import { useEffect, useState, useCallback } from 'react'; // Adicionado useCallback
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

  // Função para carregar a configuração, memoizada com useCallback
  const loadCfg = useCallback(async (userId) => {
    if (!userId) return;

    let { data: perfil, error: perfilError } = await supabase
      .from('perfis')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (perfilError || !perfil) {
      const nome = session?.user?.user_metadata?.name || session?.user?.email?.split('@')[0] || 'Usuário';
      const { data: novoPerfil } = await supabase
        .from('perfis')
        .insert({
          user_id: userId,
          nome: nome,
          email: session?.user?.email,
          empresa_id: userId,
          perfil: 'admin'
        })
        .select()
        .single();
      perfil = novoPerfil;
    }

    const empresaId = perfil?.empresa_id || userId;
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
  }, [session]); // Dependência do session para acessar session.user

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        loadCfg(session.user.id); // Carrega a cfg inicial
      } else {
        setCheckingKpi(false); // Se não há sessão, não precisa checar KPI
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (event === 'SIGNED_OUT') {
          router.push('/');
        } else if (event === 'SIGNED_IN' && router.pathname === '/') {
          router.push('/chat');
        }
        if (session) {
          loadCfg(session.user.id); // Recarrega cfg ao fazer login
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router, loadCfg]); // Adicionado loadCfg como dependência

  // Efeito para verificar KPI
  useEffect(() => {
    // Se não há sessão, ainda está verificando KPI, é uma página pública ou isenta, ou não há cfg, não faz nada.
    if (!session || checkingKpi || isPublicPage || kpiExemptPages.includes(router.pathname) || !cfg) return;

    // Se a obrigatoriedade de KPI não está ativada, não faz nada.
    if (!cfg.kpiRequired) return;

    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(hoje.getDate() - 1);
    const ontemStr = ontem.toISOString().slice(0,10);

    const logs = cfg.kpiLog || [];
    const userId = session.user.id;
    const hasYesterdayLog = logs.some(l => l.userId === userId && l.date === ontemStr);

    // Se não tem log de ontem e não estamos na página de KPI, redireciona.
    if (!hasYesterdayLog && router.pathname !== '/kpi') {
      const currentPath = router.asPath;
      router.push(`/kpi?redirect=${encodeURIComponent(currentPath)}&date=${ontemStr}`);
    }
  }, [session, cfg, checkingKpi, router.pathname, isPublicPage, kpiExemptPages, router]);

  // Se for uma página pública ou não houver sessão, renderiza o componente normalmente.
  if (isPublicPage || (!session && !isPublicPage)) {
    return <Component {...pageProps} />;
  }

  // Enquanto estiver verificando o KPI, mostra "Carregando..."
  if (checkingKpi) {
    return <p style={{ background: '#0a0f1e', color: '#fff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Carregando...</p>;
  }

  // Se estiver na página de KPI, renderiza o componente de KPI.
  if (router.pathname === '/kpi') {
    return <Component {...pageProps} />;
  }

  // Se a obrigatoriedade de KPI estiver ativada e não houver log de ontem,
  // e não fomos redirecionados para /kpi (o que já deveria ter acontecido no useEffect),
  // então algo está errado ou o redirecionamento está pendente.
  // Neste ponto, o useEffect de KPI já deveria ter redirecionado se necessário.
  // Se chegamos aqui e o KPI é obrigatório e não foi preenchido, significa que o useEffect
  // ainda não agiu ou a rota está em transição.
  // Para evitar um loop ou tela em branco, vamos renderizar o componente.
  // O useEffect acima é o responsável por iniciar o redirecionamento.
  return <Component {...pageProps} />;
}

export default MyApp;
