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
  const kpiExemptPages = ['/kpi']; // A página /kpi deve ser isenta da verificação para que possa carregar

  // Função para carregar as configurações
  const loadCfg = useCallback(async (userSession) => {
    if (!userSession) {
      setCfg(null);
      setCheckingKpi(false);
      return;
    }
    setCheckingKpi(true); // Reativa o estado de checagem ao carregar cfg

    // Busca ou cria perfil automaticamente
    let { data: perfil, error: perfilError } = await supabase
      .from('perfis')
      .select('*')
      .eq('user_id', userSession.user.id)
      .maybeSingle();

    if (perfilError) {
      console.error('Erro ao buscar perfil:', perfilError);
      // Tratar erro, talvez redirecionar para login ou mostrar mensagem
      setCheckingKpi(false);
      return;
    }

    if (!perfil) {
      const nome = userSession.user.user_metadata?.name || userSession.user.email?.split('@')[0] || 'Usuário';
      const { data: novoPerfil, error: novoPerfilError } = await supabase
        .from('perfis')
        .insert({
          user_id: userSession.user.id,
          nome: nome,
          email: userSession.user.email,
          empresa_id: userSession.user.id, // Assumindo que empresa_id é o user_id para novos perfis
          perfil: 'admin'
        })
        .select()
        .single();
      if (novoPerfilError) {
        console.error('Erro ao criar perfil:', novoPerfilError);
        setCheckingKpi(false);
        return;
      }
      perfil = novoPerfil;
    }

    const empresaId = perfil?.empresa_id || userSession.user.id;
    const { data: row, error: cfgError } = await supabase
      .from('vx_storage')
      .select('value')
      .eq('key', `cfg:${empresaId}`)
      .single();

    if (cfgError && cfgError.code !== 'PGRST116') { // PGRST116 = no rows found, o que é esperado
      console.error('Erro ao carregar cfg:', cfgError);
      // Tratar erro
    }

    if (row?.value) {
      const loaded = JSON.parse(row.value);
      setCfg(loaded);
    } else {
      setCfg({}); // Se não houver cfg, inicializa como objeto vazio
    }
    setCheckingKpi(false);
  }, []); // Dependências vazias para useCallback

  // Listener de autenticação
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      if (initialSession) {
        loadCfg(initialSession);
      } else {
        setCheckingKpi(false); // Se não há sessão, não precisa checar KPI
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        setSession(currentSession);
        if (event === 'SIGNED_OUT') {
          router.push('/');
          setCfg(null); // Limpa cfg ao deslogar
          setCheckingKpi(false);
        } else if (event === 'SIGNED_IN') {
          loadCfg(currentSession); // Recarrega cfg ao logar
          if (router.pathname === '/') {
            router.push('/chat');
          }
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router, loadCfg]); // Adicionado loadCfg como dependência

  // Listener para recarregar CFG ao sair da página /kpi
  useEffect(() => {
    const handleRouteChangeComplete = (url) => {
      // Se a rota anterior era /kpi e a nova não é /kpi, recarrega o cfg
      if (router.asPath.startsWith('/kpi') && !url.startsWith('/kpi') && session) {
        loadCfg(session);
      }
    };

    router.events.on('routeChangeComplete', handleRouteChangeComplete);
    return () => {
      router.events.off('routeChangeComplete', handleRouteChangeComplete);
    };
  }, [router, session, loadCfg]);

  // Lógica de verificação de KPI para redirecionamento
  useEffect(() => {
    // Só verifica se há sessão, se já terminou de checar KPI, se não é página pública
    // e se a página atual não é a página de KPI (para evitar loop)
    if (!session || checkingKpi || isPublicPage || kpiExemptPages.includes(router.pathname)) {
      return;
    }

    // Se não há cfg ou KPI não é obrigatório, não precisa verificar
    if (!cfg || !cfg.kpiRequired) {
      return;
    }

    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(hoje.getDate() - 1);
    const ontemStr = ontem.toISOString().slice(0, 10);

    const logs = cfg.kpiLog || [];
    const userId = session.user.id;
    const hasYesterdayLog = logs.some(l => l.userId === userId && l.date === ontemStr);

    // Se não tem log de ontem e a página atual não é a de KPI, redireciona
    if (!hasYesterdayLog) {
      const currentPath = router.asPath;
      router.replace(`/kpi?redirect=${encodeURIComponent(currentPath)}&date=${ontemStr}`);
    }
  }, [session, cfg, checkingKpi, router, isPublicPage, kpiExemptPages]);


  // Renderização condicional
  if (isPublicPage || (!session && !isPublicPage)) {
    return <Component {...pageProps} />;
  }

  if (checkingKpi) {
    return <p style={{ background: '#0a0f1e', color: '#fff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Carregando...</p>;
  }

  // Se chegou até aqui, significa que a sessão está ativa e o KPI foi checado (ou não é obrigatório).
  // A página /kpi sempre deve renderizar para permitir o input do usuário.
  // As outras páginas só renderizam se o KPI estiver ok.
  // A lógica de redirecionamento no useEffect acima já cuida de enviar para /kpi se necessário.
  // Então, se não estamos em /kpi e o KPI é obrigatório e não foi preenchido, o useEffect já teria redirecionado.
  // Se estamos em /kpi, queremos que ela renderize.
  // Se não estamos em /kpi e o KPI está ok, queremos que a Component renderize.
  return <Component {...pageProps} />;
}

export default MyApp;
