// pages/_app.js
import '../styles/globals.css';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';

function MyApp({ Component, pageProps }) {
  const [session, setSession] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [loadingApp, setLoadingApp] = useState(true); // Novo estado para controlar o carregamento inicial do app
  const router = useRouter();

  const publicPages = ['/', '/sign/[token]'];
  const isPublicPage = publicPages.some(p => router.pathname === p || router.pathname.startsWith('/sign/'));
  const kpiExemptPages = ['/kpi', '/configuracoes']; // Adicionei /configuracoes para evitar loop

  // Listener de autenticação
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingApp(false); // Termina o carregamento inicial após verificar a sessão
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
    if (!userId) return;

    let { data: perfil } = await supabase
      .from('perfis')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!perfil) {
      const nome = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuário';
      const { data: novoPerfil } = await supabase
        .from('perfis')
        .insert({
          user_id: userId,
          nome: nome,
          email: session.user.email,
          empresa_id: userId, // Empresa ID inicial é o próprio user_id
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
      setCfg(JSON.parse(row.value));
    } else {
      setCfg({}); // Inicializa cfg como objeto vazio se não houver configuração
    }
  }, [session]); // Depende da sessão para pegar o user.id

  // Carrega a configuração da empresa quando a sessão muda
  useEffect(() => {
    if (session?.user) {
      loadCompanyConfig(session.user.id);
    } else if (!isPublicPage) {
      setCfg(null); // Limpa a configuração se não houver sessão e não for página pública
    }
  }, [session, isPublicPage, loadCompanyConfig]);

  // Lógica de verificação de KPI e redirecionamento
  useEffect(() => {
    // Só executa se houver sessão, o app não estiver carregando, não for página pública
    // e a página atual não for uma página isenta de KPI
    if (!session || loadingApp || isPublicPage || kpiExemptPages.includes(router.pathname)) {
      return;
    }

    // Se cfg ainda não foi carregado, espera
    if (cfg === null) {
      return;
    }

    // Se KPI não é obrigatório, não faz nada
    if (!cfg.kpiRequired) {
      return;
    }

    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(hoje.getDate() - 1);
    const ontemStr = ontem.toISOString().slice(0, 10);

    const logs = cfg.kpiLog || [];
    const userId = session.user.id;
    const hasYesterdayLog = logs.some(l => l.userId === userId && l.date === ontemStr);

    // Se KPI é obrigatório e não há log para ontem, redireciona para /kpi
    if (!hasYesterdayLog && router.pathname !== '/kpi') {
      const currentPath = router.asPath;
      router.replace(`/kpi?redirect=${encodeURIComponent(currentPath)}&date=${ontemStr}`);
    }
  }, [session, cfg, loadingApp, isPublicPage, kpiExemptPages, router]);

  // Exibe tela de carregamento inicial do app
  if (loadingApp) {
    return <p style={{ background: '#0a0f1e', color: '#fff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Carregando sistema...</p>;
  }

  // Permite renderizar páginas públicas ou a página de KPI
  if (isPublicPage || router.pathname === '/kpi') {
    return <Component {...pageProps} />;
  }

  // Se não há sessão e não é página pública, redireciona para login (já tratado pelo authListener)
  if (!session && !isPublicPage) {
    return null; // Ou um spinner, mas o listener já deve ter redirecionado
  }

  // Se a configuração ainda não foi carregada para uma página autenticada
  if (cfg === null) {
    return <p style={{ background: '#0a0f1e', color: '#fff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Carregando configurações...</p>;
  }

  // Renderiza o componente normalmente
  return <Component {...pageProps} />;
}

export default MyApp;
