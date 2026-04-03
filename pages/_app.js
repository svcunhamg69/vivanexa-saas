// pages/_app.js
import '../styles/globals.css';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';

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
  const [checkingKpi, setCheckingKpi] = useState(true);
  const [kpiOk,       setKpiOk]       = useState(false);
  const router = useRouter();
  const verificacaoFeita = useRef(false);

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
        verificacaoFeita.current = false;
        router.push('/');
      } else if (event === 'SIGNED_IN' && router.pathname === '/') {
        router.push('/chat');
      }
    });

    return () => { authListener.subscription.unsubscribe(); };
  }, [router]);

  // ── Verifica KPI buscando DIRETAMENTE do banco (uma única vez por sessão) ──
  useEffect(() => {
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

        // Busca cfg FRESCO direto do banco
        const { data: row } = await supabase
          .from('vx_storage').select('value').eq('key', `cfg:${empresaId}`).single();

        const cfg = row?.value ? JSON.parse(row.value) : {};
        const kpiTemplates = cfg.kpiTemplates || [];

        if (!cfg.kpiRequired || kpiTemplates.length === 0) {
          setKpiOk(true);
          setCheckingKpi(false);
          return;
        }

        const diaVerificar = ultimoDiaUtilAnterior();

        // ✅ Verifica se acabou de salvar este mesmo dia (sessionStorage)
        const justSaved = sessionStorage.getItem('kpi_just_saved');
        if (justSaved === diaVerificar) {
          // Remove a flag para não interferir em futuras verificações
          sessionStorage.removeItem('kpi_just_saved');
          setKpiOk(true);
          setCheckingKpi(false);
          return;
        }

        const jaPreencheu = (cfg.kpiLog || []).some(
          l => l.userId === session.user.id && l.date === diaVerificar
        );

        if (!jaPreencheu) {
          router.replace(`/kpi?redirect=${encodeURIComponent('/chat')}&date=${diaVerificar}`);
          // Não seta checkingKpi(false) aqui — mantém tela de loading até redirecionar
          return;
        }

        setKpiOk(true);
        setCheckingKpi(false);

      } catch (err) {
        console.error('Erro na verificação de KPI:', err);
        // Em erro, libera para não travar o usuário
        setKpiOk(true);
        setCheckingKpi(false);
      }
    };

    verificar();
  }, [session]); // ✅ Só roda quando a session muda — NÃO re-executa a cada rota

  // ── Renderização ─────────────────────────────────────────────────────────

  if (isPublicPage) return <Component {...pageProps} />;
  if (!session)     return <Component {...pageProps} />;

  // Página /kpi: sempre renderiza, sem bloqueio
  if (kpiExemptPages.includes(router.pathname)) return <Component {...pageProps} />;

  if (checkingKpi) {
    return (
      <div style={{ background: '#0a0f1e', color: '#64748b', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Mono, monospace', fontSize: 14 }}>
        Carregando...
      </div>
    );
  }

  return <Component {...pageProps} />;
}

export default MyApp;
