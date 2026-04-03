// pages/_app.js
import '../styles/globals.css';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';

// Retorna o último dia útil anterior a hoje (pula fins de semana)
function ultimoDiaUtilAnterior() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() - 1);
  }
  return d.toISOString().slice(0, 10);
}

function MyApp({ Component, pageProps }) {
  const [session,     setSession]     = useState(null);
  const [cfg,         setCfg]         = useState(null);
  const [checkingKpi, setCheckingKpi] = useState(true);
  const router = useRouter();

  const publicPages    = ['/', '/sign/[token]'];
  const isPublicPage   = publicPages.some(p => router.pathname === p || router.pathname.startsWith('/sign/'));
  const kpiExemptPages = ['/kpi'];

  // ── Auth listener ────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === 'SIGNED_OUT') {
        router.push('/');
      } else if (event === 'SIGNED_IN' && router.pathname === '/') {
        router.push('/chat');
      }
    });

    return () => { authListener.subscription.unsubscribe(); };
  }, [router]);

  // ── Carrega configuração da empresa ──────────────────────────────────────
  useEffect(() => {
    if (!session) { setCheckingKpi(false); return; }

    const loadCfg = async () => {
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

      setCfg(row?.value ? JSON.parse(row.value) : {});
      setCheckingKpi(false);
    };

    loadCfg();
  }, [session]);

  // ── ✅ Verificação de KPI do DIA ÚTIL ANTERIOR ───────────────────────────
  useEffect(() => {
    if (!session || !cfg || checkingKpi) return;
    if (kpiExemptPages.includes(router.pathname)) return;
    if (isPublicPage) return;

    const kpiTemplates = cfg.kpiTemplates || [];
    if (!cfg.kpiRequired || kpiTemplates.length === 0) return;

    const diaVerificar = ultimoDiaUtilAnterior();

    // ✅ FIX: Se o usuário acabou de salvar esse dia via kpi.js, não redireciona
    const kpiJustSaved = sessionStorage.getItem('kpi_just_saved');
    if (kpiJustSaved === diaVerificar) {
      sessionStorage.removeItem('kpi_just_saved');
      return;
    }

    const jaPreencheu = (cfg.kpiLog || []).some(
      l => l.userId === session.user.id && l.date === diaVerificar
    );

    if (!jaPreencheu) {
      router.push(`/kpi?redirect=${encodeURIComponent(router.asPath)}&date=${diaVerificar}`);
    }
  }, [session, cfg, router.pathname, checkingKpi]);

  if (isPublicPage || (!session && !isPublicPage)) {
    return <Component {...pageProps} />;
  }

  if (checkingKpi) {
    return (
      <p style={{ background: '#0a0f1e', color: '#fff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Mono, monospace', fontSize: 14 }}>
        Carregando...
      </p>
    );
  }

  return <Component {...pageProps} />;
}

export default MyApp;
