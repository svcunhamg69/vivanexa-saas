// pages/_app.js — v2 com controle de acesso por módulo (tenant)
// CORREÇÃO: suporte a sub-usuários autenticados via sessionStorage (vx_subuser)
import '../styles/globals.css';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';

const MODULO_DA_PAGINA = {
  '/chat':           'chat',
  '/crm':            'crm',
  '/whatsapp-inbox': 'whatsapp_inbox',
  '/gerador-leads':  'gerador_leads',
  '/prospeccao':     'prospeccao',
  '/marketing':      'marketing',
  '/financeiro':     'financeiro',
  '/reports':        'reports',
  '/kpi':            'kpi',
  '/configuracoes':  'configuracoes',
}

function ultimoDiaUtilAnterior() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Lê o sub-usuário salvo pelo login customizado
function getSubUser() {
  try {
    const raw = sessionStorage.getItem('vx_subuser');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function MyApp({ Component, pageProps }) {
  const [session,     setSession]     = useState(null);
  const [subUser,     setSubUser]     = useState(null);   // sub-usuário de cfg.users
  const [checkingKpi, setCheckingKpi] = useState(true);
  const [semAcesso,   setSemAcesso]   = useState(false);
  const router = useRouter();
  const verificacaoFeita = useRef(false);

  const publicPages    = ['/', '/sign/[token]'];
  const isPublicPage   = publicPages.some(p => router.pathname === p || router.pathname.startsWith('/sign/'));
  const kpiExemptPages = ['/kpi', '/configuracoes', '/dashboard', '/reports', '/admin'];

  // Verifica sub-usuário no sessionStorage ao montar
  useEffect(() => {
    const su = getSubUser();
    if (su) setSubUser(su);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === 'SIGNED_OUT') {
        verificacaoFeita.current = false;
        sessionStorage.removeItem('vx_subuser');
        setSubUser(null);
        router.push('/');
      } else if (event === 'SIGNED_IN' && router.pathname === '/') {
        router.push('/dashboard');
      }
    });
    return () => authListener.subscription.unsubscribe();
  }, [router]);

  // Considera autenticado se tiver sessão Supabase OU sub-usuário válido
  const autenticado = !!(session || subUser);

  useEffect(() => {
    // Sub-usuário sem sessão Supabase: libera sem checar KPI
    if (subUser && !session) {
      setCheckingKpi(false);
      return;
    }
    if (!session) { setCheckingKpi(false); return; }
    if (isPublicPage) { setCheckingKpi(false); return; }
    if (verificacaoFeita.current) { setCheckingKpi(false); return; }
    verificacaoFeita.current = true;

    const verificar = async () => {
      try {
        let { data: perfil } = await supabase
          .from('perfis').select('*').eq('user_id', session.user.id).maybeSingle();

        if (!perfil) {
          const nome = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuário';
          const { data: novoPerfil } = await supabase
            .from('perfis')
            .insert({ user_id: session.user.id, nome, email: session.user.email, empresa_id: session.user.id, perfil: 'admin' })
            .select().single();
          perfil = novoPerfil;
        }

        const empresaId = perfil?.empresa_id || session.user.id;

        const { data: row } = await supabase
          .from('vx_storage').select('value').eq('key', `cfg:${empresaId}`).single();
        const cfg = row?.value ? JSON.parse(row.value) : {};

        // Verificar acesso ao módulo
        const moduloNecessario = MODULO_DA_PAGINA[router.pathname];
        if (moduloNecessario && cfg.modulosAtivos?.length) {
          const temAcesso = cfg.modulosAtivos.includes(moduloNecessario);
          if (!temAcesso) {
            setSemAcesso(true);
            setCheckingKpi(false);
            return;
          }
        }

        // Verificar tenant status
        if (cfg.tenant_status === 'suspenso' || cfg.tenant_status === 'cancelado') {
          if (router.pathname !== '/dashboard') {
            router.replace('/dashboard');
            setCheckingKpi(false);
            return;
          }
        }

        // Verificar KPI obrigatório
        const kpiTemplates = cfg.kpiTemplates || [];
        if (!cfg.kpiRequired || kpiTemplates.length === 0) {
          setCheckingKpi(false);
          return;
        }

        const diaVerificar = ultimoDiaUtilAnterior();
        const justSaved = sessionStorage.getItem('kpi_just_saved');
        if (justSaved === diaVerificar) {
          sessionStorage.removeItem('kpi_just_saved');
          setCheckingKpi(false);
          return;
        }

        const jaPreencheu = (cfg.kpiLog || []).some(
          l => l.userId === session.user.id && l.date === diaVerificar
        );

        if (!jaPreencheu && !kpiExemptPages.includes(router.pathname)) {
          router.replace(`/kpi?redirect=${encodeURIComponent(router.asPath)}&date=${diaVerificar}`);
          return;
        }

        setCheckingKpi(false);
      } catch (err) {
        console.error('Erro verificação:', err);
        setCheckingKpi(false);
      }
    };

    verificar();
  }, [session, subUser, router.pathname]);

  if (isPublicPage)                             return <Component {...pageProps} />;
  if (!autenticado)                             return <Component {...pageProps} />;
  if (kpiExemptPages.includes(router.pathname)) return <Component {...pageProps} />;

  if (semAcesso) return (
    <div style={{
      background: '#060c1a', color: '#64748b', minHeight: '100vh',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'DM Mono, monospace', gap: 12
    }}>
      <div style={{ fontSize: 48 }}>🔒</div>
      <div style={{ fontSize: 16, color: '#e2e8f0', fontFamily: 'Syne, sans-serif', fontWeight: 700 }}>Módulo não disponível</div>
      <div style={{ fontSize: 13 }}>Este módulo não está incluído no seu plano.</div>
      <button onClick={() => router.push('/dashboard')}
        style={{ marginTop: 16, padding: '10px 24px', background: '#00d4ff', border: 'none', borderRadius: 8, color: '#000', fontFamily: 'DM Mono, monospace', fontWeight: 700, cursor: 'pointer' }}>
        Voltar ao Dashboard
      </button>
    </div>
  );

  if (checkingKpi) return (
    <div style={{
      background: '#060c1a', color: '#64748b', minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'DM Mono, monospace', fontSize: 14
    }}>
      Carregando...
    </div>
  );

  return <Component {...pageProps} />;
}

export default MyApp;
