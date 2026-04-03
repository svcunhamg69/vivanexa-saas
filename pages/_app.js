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

  // Função para carregar as configurações da empresa
  const loadCfg = useCallback(async (userId) => {
    if (!userId) return;
    setCheckingKpi(true); // Reativa o estado de checagem enquanto carrega
    try {
      // Busca ou cria perfil automaticamente
      let { data: perfil, error: perfilError } = await supabase
        .from('perfis')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (perfilError && perfilError.code !== 'PGRST116') { // PGRST116 é "no rows found"
        console.error('Erro ao buscar perfil:', perfilError);
        // Tratar erro, talvez redirecionar para login ou mostrar mensagem
        return;
      }

      if (!perfil) {
        const nome = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuário';
        const { data: novoPerfil, error: novoPerfilError } = await supabase
          .from('perfis')
          .insert({
            user_id: userId,
            nome: nome,
            email: session.user.email,
            empresa_id: userId, // Empresa ID é o próprio user_id para novos perfis
            perfil: 'admin'
          })
          .select()
          .single();
        if (novoPerfilError) {
          console.error('Erro ao criar perfil:', novoPerfilError);
          return;
        }
        perfil = novoPerfil;
      }

      const empresaId = perfil?.empresa_id || userId;
      const { data: row, error: cfgError } = await supabase
        .from('vx_storage')
        .select('value')
        .eq('key', `cfg:${empresaId}`)
        .single();

      if (cfgError && cfgError.code !== 'PGRST116') {
        console.error('Erro ao buscar configurações:', cfgError);
        return;
      }

      if (row?.value) {
        setCfg(JSON.parse(row.value));
      } else {
        // Se não houver cfg, inicializa com um objeto vazio ou padrão
        setCfg({});
      }
    } catch (err) {
      console.error('Erro geral ao carregar configurações:', err);
    } finally {
      setCheckingKpi(false); // Finaliza a checagem
    }
  }, [session]); // session é uma dependência para acessar session.user.email, etc.

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        loadCfg(session.user.id); // Carrega as configurações ao obter a sessão
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
          loadCfg(session.user.id); // Recarrega cfg ao fazer login
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router, loadCfg]); // Adicionado loadCfg como dependência

  useEffect(() => {
    // Este useEffect agora foca apenas na lógica de redirecionamento de KPI
    if (!session || checkingKpi || isPublicPage || kpiExemptPages.includes(router.pathname)) {
      return;
    }

    // Se o cfg ainda não carregou ou não tem a propriedade kpiRequired, não faz nada
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

    if (!hasYesterdayLog) {
      const currentPath = router.asPath;
      router.replace(`/kpi?redirect=${encodeURIComponent(currentPath)}&date=${ontemStr}`);
    }
  }, [session, cfg, checkingKpi, router.pathname, isPublicPage, kpiExemptPages]);

  // Adicionado um useEffect para recarregar o cfg quando o usuário volta da página /kpi
  useEffect(() => {
    const handleRouteChange = (url) => {
      // Se a rota anterior era /kpi e a nova rota não é /kpi, recarrega o cfg
      if (router.asPath.startsWith('/kpi') && !url.startsWith('/kpi') && session?.user?.id) {
        loadCfg(session.user.id);
      }
    };

    router.events.on('routeChangeComplete', handleRouteChange);
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router, session, loadCfg]);


  if (isPublicPage || (!session && !isPublicPage)) {
    return <Component {...pageProps} />;
  }

  if (checkingKpi) {
    return <p style={{ background: '#0a0f1e', color: '#fff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Carregando...</p>;
  }

  // Se a página atual é /kpi, renderiza o componente KPI
  if (router.pathname === '/kpi') {
    return <Component {...pageProps} />;
  }

  // Se o KPI é obrigatório e não foi lançado, e não estamos na página /kpi,
  // o useEffect acima já deveria ter redirecionado.
  // Este bloco final é um fallback, mas o ideal é que o useEffect cuide disso.
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  const ontemStr = ontem.toISOString().slice(0, 10);
  const logs = cfg?.kpiLog || [];
  const userId = session?.user?.id;
  const hasYesterdayLog = logs.some(l => l.userId === userId && l.date === ontemStr);

  if (cfg?.kpiRequired && !hasYesterdayLog) {
    // Se chegou aqui, algo deu errado no redirecionamento do useEffect.
    // Poderíamos forçar um redirecionamento aqui também, mas o ideal é que o useEffect seja o principal.
    // Por enquanto, vamos retornar null para evitar renderizar a página errada.
    // O useEffect deve ser o responsável por levar o usuário para /kpi.
    return null;
  }

  return <Component {...pageProps} />;
}

export default MyApp;
