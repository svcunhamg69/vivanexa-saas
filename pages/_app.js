// pages/_app.js
import '../styles/globals.css';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';

function MyApp({ Component, pageProps }) {
  const [session, setSession] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [loadingApp, setLoadingApp] = useState(true); // Novo estado para controlar o carregamento inicial
  const router = useRouter();

  const publicPages = ['/', '/sign/[token]'];
  const isPublicPage = publicPages.some(p => router.pathname === p || router.pathname.startsWith('/sign/'));
  const kpiExemptPages = ['/kpi']; // Mantém /kpi como página isenta da verificação

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

  // Função para carregar a configuração da empresa
  const loadCompanyConfig = useCallback(async (userId) => {
    // Busca ou cria perfil automaticamente
    let { data: perfil, error: perfilError } = await supabase
      .from('perfis')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (perfilError && perfilError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Erro ao buscar perfil:', perfilError);
      return null;
    }

    if (!perfil) {
      const nome = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuário';
      const { data: novoPerfil, error: novoPerfilError } = await supabase
        .from('perfis')
        .insert({
          user_id: userId,
          nome: nome,
          email: session.user.email,
          empresa_id: userId, // Cada usuário começa com sua própria empresa_id
          perfil: 'admin'
        })
        .select()
        .single();
      if (novoPerfilError) {
        console.error('Erro ao criar novo perfil:', novoPerfilError);
        return null;
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
      console.error('Erro ao buscar configuração:', cfgError);
      return {}; // Retorna objeto vazio em caso de erro
    }

    if (row?.value) {
      return JSON.parse(row.value);
    }
    return {}; // Retorna objeto vazio se não houver configuração
  }, [session]); // Depende da sessão para acessar session.user

  // Carrega a configuração da empresa quando a sessão muda
  useEffect(() => {
    if (!session) {
      setLoadingApp(false);
      return;
    }

    const fetchCfg = async () => {
      const loadedCfg = await loadCompanyConfig(session.user.id);
      setCfg(loadedCfg);
      setLoadingApp(false);
    };
    fetchCfg();
  }, [session, loadCompanyConfig]);

  // Lógica de redirecionamento de KPI (DESATIVADA TEMPORARIAMENTE)
  useEffect(() => {
    // Esta lógica está desativada para permitir a navegação livre.
    // Para reativar, remova este comentário e o `return` abaixo.
    return;

    // if (!session || loadingApp || isPublicPage || kpiExemptPages.includes(router.pathname)) return;
    // if (!cfg || !cfg.kpiRequired) return;

    // const hoje = new Date();
    // const ontem = new Date(hoje);
    // ontem.setDate(hoje.getDate() - 1);
    // const ontemStr = ontem.toISOString().slice(0,10);

    // const logs = cfg.kpiLog || [];
    // const userId = session.user.id;
    // const hasYesterdayLog = logs.some(l => l.userId === userId && l.date === ontemStr);

    // if (!hasYesterdayLog && !kpiExemptPages.includes(router.pathname)) {
    //   const currentPath = router.asPath;
    //   router.replace(`/kpi?redirect=${encodeURIComponent(currentPath)}&date=${ontemStr}`);
    // }
  }, [session, cfg, loadingApp, isPublicPage, kpiExemptPages, router]);

  // Renderização condicional
  if (isPublicPage || (!session && !isPublicPage)) {
    return <Component {...pageProps} />;
  }

  if (loadingApp) {
    return <p style={{ background: '#0a0f1e', color: '#fff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Carregando aplicativo...</p>;
  }

  // Se a página atual for /kpi, sempre renderiza o componente KPI
  if (router.pathname === '/kpi') {
    return <Component {...pageProps} />;
  }

  // Com a lógica de KPI desativada no useEffect, o app sempre renderiza o componente
  return <Component {...pageProps} />;
}

export default MyApp;
