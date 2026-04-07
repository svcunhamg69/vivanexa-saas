// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO: Gestão MEI — Vivanexa SaaS v6
// Arquivo: components/GestaoMEI.js
//
// Subabas disponíveis (controladas via ?aba=mei&sub=XXX no router):
//   dashboard   → Visão geral: faturamento, limite, alertas, status DAS
//   receitas    → Controle mensal de receitas brutas (com geração de relatório)
//   das         → Controle de DAS-MEI (boleto mensal, vencimento dia 20)
//   documentos  → Upload e gestão de documentos (CCMEI, DAS pagos, notas)
//   dasn        → DASN-SIMEI Anual (pré-preenchimento automático)
//   portais     → Links para portais governamentais
//   alertas     → Painel de alertas (limite faturamento, DAS vencendo, multas)
//
// Props:
//   empresaId   → ID da empresa no Supabase
//   sub         → Subaba ativa (string)
//   supabase    → Cliente Supabase já inicializado
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react'

// ─── Constantes ───────────────────────────────────────────────────────────────
const LIMITE_MEI_ANUAL = 81000   // R$ 81.000 (2024/2025)
const MESES_FULL = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
]
const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

const PORTAIS_GOV = [
  {
    nome: 'Portal do Empreendedor (Gov.br)',
    desc: 'Abertura, alteração, CCMEI e baixa do MEI',
    url: 'https://www.gov.br/empresas-e-negocios/pt-br/empreendedor',
    icon: '🏛️', cor: '#00d4ff',
  },
  {
    nome: 'PGMEI — Emissão de DAS',
    desc: 'Emitir boleto DAS-MEI mensal (venc. dia 20)',
    url: 'https://www.gov.br/receitafederal/pt-br/servicos/simples-nacional/mei',
    icon: '💰', cor: '#10b981',
  },
  {
    nome: 'DASN-SIMEI — Declaração Anual',
    desc: 'Entregar declaração anual (prazo: 31/05)',
    url: 'https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATBHE/dasnsimeihood.app.aspx',
    icon: '📋', cor: '#f59e0b',
  },
  {
    nome: 'NFS-e — Nota Fiscal de Serviço',
    desc: 'Portal Nacional de emissão de NFS-e MEI',
    url: 'https://www.nfse.gov.br',
    icon: '🧾', cor: '#7c3aed',
  },
  {
    nome: 'e-CAC (Receita Federal)',
    desc: 'Regularidade fiscal, CND e consultas',
    url: 'https://cav.receita.fazenda.gov.br',
    icon: '🔍', cor: '#ec4899',
  },
  {
    nome: 'SEBRAE — Suporte ao MEI',
    desc: 'Orientações, cursos e suporte gratuito',
    url: 'https://www.sebrae.com.br/sites/PortalSebrae/sebraeaz/mei-microempreendedor-individual',
    icon: '📚', cor: '#06b6d4',
  },
]

// ─── Subabas ──────────────────────────────────────────────────────────────────
const SUBABAS = [
  { id: 'dashboard',  label: 'Dashboard',      icon: '🏪' },
  { id: 'receitas',   label: 'Receitas',        icon: '📊' },
  { id: 'das',        label: 'Controle DAS',    icon: '💰' },
  { id: 'documentos', label: 'Documentos',      icon: '📁' },
  { id: 'dasn',       label: 'DASN Anual',      icon: '📋' },
  { id: 'portais',    label: 'Portais Gov',     icon: '🏛️' },
  { id: 'alertas',    label: 'Alertas',         icon: '🔔' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(n) {
  return 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function pct(val, total) {
  if (!total) return 0
  return Math.min(100, (val / total) * 100)
}
function corLimite(p) {
  if (p >= 100) return '#ef4444'
  if (p >= 80)  return '#f59e0b'
  if (p >= 60)  return '#eab308'
  return '#10b981'
}
function anoAtual()  { return new Date().getFullYear() }
function mesAtual()  { return new Date().getMonth() + 1 }

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function GestaoMEI({ empresaId, sub = 'dashboard', supabase }) {
  const [subAba, setSubAba] = useState(sub)
  const [dados,  setDados]  = useState(null)   // dados MEI do Supabase
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState(null)  // { tipo: 'ok'|'erro', texto }

  // ── Carrega dados do Supabase (chave mei:<empresaId>) ──
  const loadDados = useCallback(async () => {
    if (!empresaId || !supabase) return
    setLoading(true)
    try {
      const { data: row } = await supabase
        .from('vx_storage')
        .select('value')
        .eq('key', `mei:${empresaId}`)
        .maybeSingle()

      const d = row?.value ? JSON.parse(row.value) : gerarDadosIniciais()
      setDados(d)
    } catch (e) {
      setDados(gerarDadosIniciais())
    } finally {
      setLoading(false)
    }
  }, [empresaId, supabase])

  useEffect(() => { loadDados() }, [loadDados])
  useEffect(() => { setSubAba(sub) }, [sub])

  async function salvar(novosDados) {
    if (!empresaId || !supabase) return
    setSaving(true)
    try {
      const { error } = await supabase.from('vx_storage').upsert(
        { key: `mei:${empresaId}`, value: JSON.stringify(novosDados), updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
      if (error) throw error
      setDados(novosDados)
      setMsg({ tipo: 'ok', texto: 'Salvo com sucesso!' })
      setTimeout(() => setMsg(null), 3000)
    } catch (e) {
      setMsg({ tipo: 'erro', texto: 'Erro ao salvar: ' + e.message })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Carregando />

  return (
    <div style={{ fontFamily: "'DM Mono', monospace" }}>

      {/* ── Cabeçalho ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <span style={{ fontSize: 28 }}>🏪</span>
        <div>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, color: '#06b6d4', margin: 0 }}>
            Gestão MEI
          </h2>
          <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
            Controle completo do Microempreendedor Individual
          </p>
        </div>
      </div>

      {/* ── Subabas ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
        {SUBABAS.map(s => (
          <button
            key={s.id}
            onClick={() => setSubAba(s.id)}
            style={{
              padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontFamily: "'DM Mono', monospace", fontSize: 12,
              background: subAba === s.id ? 'rgba(6,182,212,.2)' : 'rgba(255,255,255,.04)',
              color: subAba === s.id ? '#06b6d4' : '#64748b',
              outline: subAba === s.id ? '1px solid rgba(6,182,212,.4)' : '1px solid transparent',
              transition: 'all .15s',
            }}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {/* ── Mensagem de feedback ── */}
      {msg && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 12,
          background: msg.tipo === 'ok' ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.1)',
          border: `1px solid ${msg.tipo === 'ok' ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.3)'}`,
          color: msg.tipo === 'ok' ? '#10b981' : '#ef4444',
        }}>
          {msg.tipo === 'ok' ? '✅' : '⚠️'} {msg.texto}
        </div>
      )}

      {/* ── Conteúdo da subaba ── */}
      {subAba === 'dashboard'  && <SubDashboard  dados={dados} onSalvar={salvar} saving={saving} />}
      {subAba === 'receitas'   && <SubReceitas   dados={dados} onSalvar={salvar} saving={saving} />}
      {subAba === 'das'        && <SubDAS        dados={dados} onSalvar={salvar} saving={saving} />}
      {subAba === 'documentos' && <SubDocumentos dados={dados} onSalvar={salvar} saving={saving} empresaId={empresaId} supabase={supabase} />}
      {subAba === 'dasn'       && <SubDASN       dados={dados} onSalvar={salvar} saving={saving} />}
      {subAba === 'portais'    && <SubPortais />}
      {subAba === 'alertas'    && <SubAlertas   dados={dados} />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBABA: DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function SubDashboard({ dados, onSalvar, saving }) {
  const ano  = anoAtual()
  const mes  = mesAtual()

  const receitaAno = calcReceitaAno(dados, ano)
  const p = pct(receitaAno, LIMITE_MEI_ANUAL)
  const cor = corLimite(p)

  const dasAtrasados = (dados.das?.[ano] || []).filter(d =>
    d.status !== 'pago' && d.mes < mes
  ).length

  const docsObrigatorios = ['ccmei', 'das_ultimo', 'dasn_ultimo']
  const docsFaltando = docsObrigatorios.filter(k => !dados.documentos?.[k]).length

  // Salvar dados básicos da empresa MEI
  const [edit, setEdit] = useState(false)
  const [form, setForm] = useState({
    nomeEmpresa:  dados.nomeEmpresa  || '',
    cnpj:         dados.cnpj         || '',
    atividade:    dados.atividade     || '',
    dataAbertura: dados.dataAbertura  || '',
    tipoAtividade: dados.tipoAtividade || 'servico',
  })

  function salvarDados() {
    onSalvar({ ...dados, ...form })
    setEdit(false)
  }

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 24 }}>
        <Card titulo="Faturamento no Ano" valor={fmt(receitaAno)} sub={`de ${fmt(LIMITE_MEI_ANUAL)}`} cor={cor} icon="💰" />
        <Card titulo="Limite Utilizado" valor={p.toFixed(1) + '%'} sub={p >= 80 ? '⚠️ Atenção!' : 'Dentro do limite'} cor={cor} icon="📊" />
        <Card titulo="DAS em Atraso" valor={dasAtrasados} sub={dasAtrasados > 0 ? 'Regularize agora' : 'Em dia ✓'} cor={dasAtrasados > 0 ? '#ef4444' : '#10b981'} icon="📅" />
        <Card titulo="Docs Faltando" valor={docsFaltando} sub={docsFaltando > 0 ? 'Faça upload' : 'Todos ok ✓'} cor={docsFaltando > 0 ? '#f59e0b' : '#10b981'} icon="📁" />
      </div>

      {/* Barra de progresso do limite */}
      <div style={{ background: '#111827', border: '1px solid #1e2d4a', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>📈 Limite de Faturamento Anual {ano}</span>
          <span style={{ fontSize: 13, color: cor, fontWeight: 700 }}>{p.toFixed(1)}%</span>
        </div>
        <div style={{ height: 12, background: '#1a2540', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: p + '%', background: `linear-gradient(90deg, ${cor}cc, ${cor})`, borderRadius: 6, transition: 'width .4s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: '#64748b' }}>
          <span>{fmt(receitaAno)} faturado</span>
          <span>{fmt(LIMITE_MEI_ANUAL - receitaAno)} restante</span>
        </div>
        {p >= 80 && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, fontSize: 12, color: '#ef4444' }}>
            ⚠️ Você ultrapassou 80% do limite anual. Avalie a migração para Simples Nacional antes de atingir R$ 81.000.
          </div>
        )}
      </div>

      {/* Dados da empresa */}
      <div style={{ background: '#111827', border: '1px solid #1e2d4a', borderRadius: 12, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 600 }}>🏪 Dados do MEI</span>
          <button onClick={() => setEdit(!edit)} style={btnSec}>
            {edit ? '✕ Cancelar' : '✏️ Editar'}
          </button>
        </div>
        {edit ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Campo label="Nome / Razão Social" value={form.nomeEmpresa} onChange={v => setForm(f => ({ ...f, nomeEmpresa: v }))} />
            <Campo label="CNPJ" value={form.cnpj} onChange={v => setForm(f => ({ ...f, cnpj: v }))} mask="cnpj" />
            <Campo label="Atividade Principal" value={form.atividade} onChange={v => setForm(f => ({ ...f, atividade: v }))} />
            <Campo label="Data de Abertura" value={form.dataAbertura} onChange={v => setForm(f => ({ ...f, dataAbertura: v }))} type="date" />
            <div style={{ gridColumn: '1/-1' }}>
              <label style={labelStyle}>Tipo de Atividade</label>
              <select value={form.tipoAtividade} onChange={e => setForm(f => ({ ...f, tipoAtividade: e.target.value }))} style={inputStyle}>
                <option value="servico">Serviços</option>
                <option value="comercio">Comércio / Indústria</option>
                <option value="misto">Misto (Serviços + Comércio)</option>
              </select>
            </div>
            <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={salvarDados} disabled={saving} style={btnPri}>{saving ? '⏳' : '💾 Salvar'}</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Info label="Razão Social" valor={dados.nomeEmpresa || '—'} />
            <Info label="CNPJ" valor={dados.cnpj || '—'} />
            <Info label="Atividade" valor={dados.atividade || '—'} />
            <Info label="Abertura" valor={dados.dataAbertura ? new Date(dados.dataAbertura + 'T12:00').toLocaleDateString('pt-BR') : '—'} />
            <Info label="Tipo" valor={{ servico: 'Serviços', comercio: 'Comércio/Indústria', misto: 'Misto' }[dados.tipoAtividade] || '—'} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBABA: RECEITAS MENSAIS
// ─────────────────────────────────────────────────────────────────────────────
function SubReceitas({ dados, onSalvar, saving }) {
  const ano = anoAtual()
  const [anoSel, setAnoSel] = useState(ano)
  const [receitasMes, setReceitasMes] = useState(() => inicializarReceitas(dados, anoSel))

  useEffect(() => {
    setReceitasMes(inicializarReceitas(dados, anoSel))
  }, [anoSel, dados])

  function atualizarMes(mes, campo, valor) {
    setReceitasMes(prev => prev.map(r => r.mes === mes ? { ...r, [campo]: valor } : r))
  }

  function salvarReceitas() {
    const receitasAtuais = { ...(dados.receitas || {}), [anoSel]: receitasMes }
    onSalvar({ ...dados, receitas: receitasAtuais })
  }

  function gerarRelatorio() {
    const total = receitasMes.reduce((acc, r) => acc + Number(r.servico || 0) + Number(r.comercio || 0), 0)
    const linhas = receitasMes.map(r => {
      const tot = Number(r.servico || 0) + Number(r.comercio || 0)
      return `${MESES_FULL[r.mes - 1].padEnd(12)} | Serviços: ${fmt(r.servico || 0).padStart(14)} | Comércio: ${fmt(r.comercio || 0).padStart(14)} | Total: ${fmt(tot).padStart(14)}`
    }).join('\n')

    const rel = `RELATÓRIO MENSAL DE RECEITAS BRUTAS - MEI\n` +
      `Empresa: ${dados.nomeEmpresa || '—'}  |  CNPJ: ${dados.cnpj || '—'}\n` +
      `Ano-Calendário: ${anoSel}\n` +
      `Gerado em: ${new Date().toLocaleDateString('pt-BR')}\n` +
      `${'─'.repeat(70)}\n` +
      `Mês          | Receita de Serviços   | Receita de Comércio   | Total\n` +
      `${'─'.repeat(70)}\n` +
      linhas + '\n' +
      `${'─'.repeat(70)}\n` +
      `TOTAL ANUAL                                                   ${fmt(total).padStart(14)}\n` +
      `Limite MEI: ${fmt(LIMITE_MEI_ANUAL)}   Utilizado: ${pct(total, LIMITE_MEI_ANUAL).toFixed(1)}%\n\n` +
      `Assinatura do Responsável: _______________________________\n` +
      `Data: ___/___/${anoSel}`

    const blob = new Blob([rel], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio-receitas-mei-${anoSel}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalAnual = receitasMes.reduce((acc, r) => acc + Number(r.servico || 0) + Number(r.comercio || 0), 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 600 }}>📊 Receitas Brutas</span>
          <select value={anoSel} onChange={e => setAnoSel(Number(e.target.value))} style={{ ...inputStyle, width: 100, padding: '6px 10px' }}>
            {[ano - 1, ano, ano + 1].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={gerarRelatorio} style={btnSec}>📄 Gerar Relatório</button>
          <button onClick={salvarReceitas} disabled={saving} style={btnPri}>{saving ? '⏳' : '💾 Salvar'}</button>
        </div>
      </div>

      {/* Tabela */}
      <div style={{ background: '#111827', border: '1px solid #1e2d4a', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 120px', padding: '10px 16px', borderBottom: '1px solid #1e2d4a', background: 'rgba(255,255,255,.03)', fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
          <span>Mês</span><span>Serviços (R$)</span><span>Comércio/Ind. (R$)</span><span>Total</span>
        </div>
        {receitasMes.map(r => {
          const tot = Number(r.servico || 0) + Number(r.comercio || 0)
          const isAtual = r.mes === mesAtual() && anoSel === ano
          return (
            <div key={r.mes} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 120px', padding: '8px 16px', borderBottom: '1px solid #0f1929', alignItems: 'center', background: isAtual ? 'rgba(6,182,212,.05)' : 'transparent' }}>
              <span style={{ fontSize: 13, color: isAtual ? '#06b6d4' : '#94a3b8', fontWeight: isAtual ? 700 : 400 }}>
                {isAtual ? '▶ ' : ''}{MESES_ABREV[r.mes - 1]}
              </span>
              <input
                type="number" min="0" step="0.01"
                value={r.servico || ''}
                onChange={e => atualizarMes(r.mes, 'servico', e.target.value)}
                placeholder="0,00"
                style={{ ...inputStyle, padding: '6px 10px', width: '90%' }}
              />
              <input
                type="number" min="0" step="0.01"
                value={r.comercio || ''}
                onChange={e => atualizarMes(r.mes, 'comercio', e.target.value)}
                placeholder="0,00"
                style={{ ...inputStyle, padding: '6px 10px', width: '90%' }}
              />
              <span style={{ fontSize: 13, color: tot > 0 ? '#10b981' : '#374151', fontWeight: 600 }}>
                {fmt(tot)}
              </span>
            </div>
          )
        })}
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 120px', padding: '12px 16px', background: 'rgba(255,255,255,.04)', borderTop: '1px solid #1e2d4a' }}>
          <span style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 700 }}>TOTAL {anoSel}</span>
          <span />
          <span />
          <span style={{ fontSize: 14, color: corLimite(pct(totalAnual, LIMITE_MEI_ANUAL)), fontWeight: 700 }}>{fmt(totalAnual)}</span>
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: '#64748b' }}>
        💡 Guarde este relatório assinado — é obrigatório pelo SEBRAE para comprovação de faturamento.
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBABA: CONTROLE DAS-MEI
// ─────────────────────────────────────────────────────────────────────────────
function SubDAS({ dados, onSalvar, saving }) {
  const ano = anoAtual()
  const [anoSel, setAnoSel] = useState(ano)
  const [das, setDas] = useState(() => inicializarDAS(dados, anoSel))

  useEffect(() => {
    setDas(inicializarDAS(dados, anoSel))
  }, [anoSel, dados])

  function toggleStatus(mes) {
    setDas(prev => prev.map(d => d.mes === mes
      ? { ...d, status: d.status === 'pago' ? 'pendente' : 'pago', dataPagamento: d.status !== 'pago' ? new Date().toISOString().slice(0, 10) : null }
      : d
    ))
  }

  function salvarDAS() {
    const dasAtual = { ...(dados.das || {}), [anoSel]: das }
    onSalvar({ ...dados, das: dasAtual })
  }

  const pagos    = das.filter(d => d.status === 'pago').length
  const atrasados = das.filter(d => d.status !== 'pago' && d.mes < mesAtual() && anoSel <= ano).length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 600 }}>💰 Controle DAS-MEI</span>
          <select value={anoSel} onChange={e => setAnoSel(Number(e.target.value))} style={{ ...inputStyle, width: 100, padding: '6px 10px' }}>
            {[ano - 1, ano].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <button onClick={salvarDAS} disabled={saving} style={btnPri}>{saving ? '⏳' : '💾 Salvar'}</button>
      </div>

      {/* Resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        <Card titulo="Pagos"    valor={pagos}    sub="guias"    cor="#10b981" icon="✅" small />
        <Card titulo="Atrasados" valor={atrasados} sub={atrasados > 0 ? 'regularize!' : 'nenhum'} cor={atrasados > 0 ? '#ef4444' : '#10b981'} icon="⚠️" small />
        <Card titulo="Pendentes" valor={12 - pagos - atrasados} sub="do ano" cor="#f59e0b" icon="⏳" small />
      </div>

      {/* Grid de meses */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 10 }}>
        {das.map(d => {
          const isAtrasado = d.status !== 'pago' && d.mes < mesAtual() && anoSel <= ano
          const isAtual    = d.mes === mesAtual() && anoSel === ano
          return (
            <div
              key={d.mes}
              style={{
                background: '#111827', border: `1px solid ${d.status === 'pago' ? 'rgba(16,185,129,.3)' : isAtrasado ? 'rgba(239,68,68,.3)' : '#1e2d4a'}`,
                borderRadius: 10, padding: 14, cursor: 'pointer', transition: 'all .15s',
              }}
              onClick={() => toggleStatus(d.mes)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: isAtual ? '#06b6d4' : '#e2e8f0' }}>
                  {MESES_FULL[d.mes - 1]}
                </span>
                <span style={{ fontSize: 18 }}>
                  {d.status === 'pago' ? '✅' : isAtrasado ? '🔴' : isAtual ? '🟡' : '⚪'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                Venc. 20/{String(d.mes).padStart(2,'0')}/{anoSel}
              </div>
              {d.status === 'pago' && d.dataPagamento && (
                <div style={{ fontSize: 11, color: '#10b981', marginTop: 4 }}>
                  Pago em {new Date(d.dataPagamento + 'T12:00').toLocaleDateString('pt-BR')}
                </div>
              )}
              {isAtrasado && (
                <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4, fontWeight: 600 }}>
                  EM ATRASO
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(6,182,212,.06)', border: '1px solid rgba(6,182,212,.2)', borderRadius: 10, fontSize: 12, color: '#64748b', lineHeight: 1.8 }}>
        💡 <strong style={{ color: '#06b6d4' }}>DAS-MEI</strong> vence sempre no <strong style={{ color: '#e2e8f0' }}>dia 20 de cada mês</strong>.<br />
        Clique no mês para marcar como pago. Emita o boleto em: <a href="https://www.gov.br/receitafederal" target="_blank" rel="noreferrer" style={{ color: '#06b6d4' }}>gov.br/receitafederal</a>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBABA: DOCUMENTOS
// ─────────────────────────────────────────────────────────────────────────────
function SubDocumentos({ dados, onSalvar, saving, empresaId, supabase }) {
  const DOCS = [
    { id: 'ccmei',       label: 'CCMEI',                   desc: 'Certificado da Condição de MEI',             icon: '📜', obrigatorio: true },
    { id: 'das_ultimo',  label: 'DAS Último Mês',           desc: 'Comprovante de pagamento do DAS mais recente',icon: '💰', obrigatorio: true },
    { id: 'dasn_ultimo', label: 'DASN-SIMEI Último Ano',    desc: 'Declaração anual mais recente entregue',      icon: '📋', obrigatorio: true },
    { id: 'notas_comp',  label: 'Notas Fiscais de Compra',  desc: 'NFs de aquisição (guardar 5 anos)',           icon: '🧾', obrigatorio: false },
    { id: 'notas_venda', label: 'Notas Fiscais de Venda',   desc: 'NFs emitidas para clientes',                 icon: '🧾', obrigatorio: false },
    { id: 'outros',      label: 'Outros Documentos',        desc: 'Contratos, alvarás, etc.',                   icon: '📁', obrigatorio: false },
  ]

  const documentos = dados.documentos || {}

  function marcarDocumento(id, valor) {
    const novosDocs = { ...documentos, [id]: valor }
    onSalvar({ ...dados, documentos: novosDocs })
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 600 }}>📁 Gestão de Documentos</span>
        <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
          Registre e controle os documentos obrigatórios do MEI. Guarde os originais por no mínimo 5 anos.
        </p>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {DOCS.map(doc => {
          const temDoc = !!documentos[doc.id]
          return (
            <div key={doc.id} style={{
              background: '#111827', border: `1px solid ${temDoc ? 'rgba(16,185,129,.25)' : '#1e2d4a'}`,
              borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <span style={{ fontSize: 24, flex: '0 0 auto' }}>{doc.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{doc.label}</span>
                  {doc.obrigatorio && (
                    <span style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(239,68,68,.15)', color: '#ef4444', borderRadius: 4, fontWeight: 600 }}>OBRIGATÓRIO</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{doc.desc}</div>
                {temDoc && documentos[doc.id + '_data'] && (
                  <div style={{ fontSize: 11, color: '#10b981', marginTop: 3 }}>
                    ✅ Registrado em {new Date(documentos[doc.id + '_data'] + 'T12:00').toLocaleDateString('pt-BR')}
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  if (temDoc) {
                    marcarDocumento(doc.id, false)
                    marcarDocumento(doc.id + '_data', null)
                  } else {
                    marcarDocumento(doc.id, true)
                    marcarDocumento(doc.id + '_data', new Date().toISOString().slice(0, 10))
                  }
                }}
                style={{
                  padding: '7px 14px', border: 'none', borderRadius: 8, cursor: 'pointer',
                  fontFamily: "'DM Mono', monospace", fontSize: 12,
                  background: temDoc ? 'rgba(239,68,68,.1)' : 'rgba(16,185,129,.1)',
                  color: temDoc ? '#ef4444' : '#10b981',
                  outline: `1px solid ${temDoc ? 'rgba(239,68,68,.3)' : 'rgba(16,185,129,.3)'}`,
                }}
              >
                {temDoc ? '✕ Remover' : '✓ Registrar'}
              </button>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 10, fontSize: 12, color: '#64748b', lineHeight: 1.8 }}>
        ⚠️ <strong style={{ color: '#f59e0b' }}>Prazo legal:</strong> Documentos fiscais devem ser guardados por <strong style={{ color: '#e2e8f0' }}>5 anos</strong>.<br />
        O CCMEI é obrigatório para abertura de conta bancária PJ e emissão de notas fiscais.
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBABA: DASN-SIMEI ANUAL
// ─────────────────────────────────────────────────────────────────────────────
function SubDASN({ dados, onSalvar, saving }) {
  const ano = anoAtual()
  const [anoRef, setAnoRef] = useState(ano - 1)

  const receitas = dados.receitas?.[anoRef] || gerarReceitasVazias()
  const totalServicos = receitas.reduce((a, r) => a + Number(r.servico || 0), 0)
  const totalComercio = receitas.reduce((a, r) => a + Number(r.comercio || 0), 0)
  const totalGeral    = totalServicos + totalComercio

  const dasnEntregues = dados.dasnEntregues || {}

  function marcarEntregue() {
    const novo = { ...dasnEntregues, [anoRef]: { entregue: true, data: new Date().toISOString().slice(0, 10) } }
    onSalvar({ ...dados, dasnEntregues: novo })
  }

  const entregue = dasnEntregues[anoRef]?.entregue

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 600 }}>📋 DASN-SIMEI — Declaração Anual</span>
          <select value={anoRef} onChange={e => setAnoRef(Number(e.target.value))} style={{ ...inputStyle, width: 100, padding: '6px 10px' }}>
            {[ano - 2, ano - 1].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* Prazo */}
      <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 10, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>📅 Prazo de Entrega</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>DASN-SIMEI {anoRef}: até 31 de Maio de {anoRef + 1}</div>
        </div>
        <span style={{ fontSize: 28 }}>{entregue ? '✅' : '⏳'}</span>
      </div>

      {/* Pré-preenchimento automático */}
      <div style={{ background: '#111827', border: '1px solid #1e2d4a', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600, marginBottom: 16 }}>
          📊 Resumo para Declaração — Ano-Calendário {anoRef}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
          <div style={{ background: '#0d1829', borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Receita de Serviços</div>
            <div style={{ fontSize: 22, color: '#06b6d4', fontWeight: 700 }}>{fmt(totalServicos)}</div>
          </div>
          <div style={{ background: '#0d1829', borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Receita de Comércio/Indústria</div>
            <div style={{ fontSize: 22, color: '#7c3aed', fontWeight: 700 }}>{fmt(totalComercio)}</div>
          </div>
        </div>
        <div style={{ background: '#0d1829', borderRadius: 8, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Receita Bruta Total</div>
          <div style={{ fontSize: 26, color: corLimite(pct(totalGeral, LIMITE_MEI_ANUAL)), fontWeight: 700 }}>{fmt(totalGeral)}</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{pct(totalGeral, LIMITE_MEI_ANUAL).toFixed(1)}% do limite de {fmt(LIMITE_MEI_ANUAL)}</div>
        </div>
        <div style={{ fontSize: 12, color: '#64748b', padding: '10px 14px', background: 'rgba(16,185,129,.06)', borderRadius: 8, border: '1px solid rgba(16,185,129,.15)' }}>
          💡 Use estes valores ao preencher a DASN-SIMEI no portal do Gov.br. Informe separadamente serviços e comércio/indústria.
        </div>
      </div>

      {/* Status de entrega */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {!entregue ? (
          <>
            <a href="https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATBHE/dasnsimeihood.app.aspx" target="_blank" rel="noreferrer" style={{ ...btnPri, textDecoration: 'none', display: 'inline-block' }}>
              🏛️ Acessar Portal DASN
            </a>
            <button onClick={marcarEntregue} disabled={saving} style={btnSec}>
              ✅ Marcar como Entregue
            </button>
          </>
        ) : (
          <div style={{ padding: '10px 16px', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.3)', borderRadius: 8, fontSize: 13, color: '#10b981', fontWeight: 600 }}>
            ✅ DASN {anoRef} entregue em {new Date(dasnEntregues[anoRef].data + 'T12:00').toLocaleDateString('pt-BR')}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBABA: PORTAIS GOVERNAMENTAIS
// ─────────────────────────────────────────────────────────────────────────────
function SubPortais() {
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 600 }}>🏛️ Portais e Ferramentas Governamentais</span>
        <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
          Acesso rápido a todos os portais obrigatórios para o MEI.
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
        {PORTAIS_GOV.map(p => (
          <a key={p.url} href={p.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
            <div style={{
              background: '#111827', border: '1px solid #1e2d4a', borderRadius: 12, padding: 18,
              transition: 'all .15s', cursor: 'pointer',
              ':hover': { borderColor: p.cor },
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = p.cor}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#1e2d4a'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 24 }}>{p.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: p.cor }}>{p.nome}</span>
              </div>
              <p style={{ fontSize: 12, color: '#64748b', margin: 0, lineHeight: 1.5 }}>{p.desc}</p>
              <div style={{ marginTop: 10, fontSize: 11, color: p.cor, opacity: .7 }}>
                🔗 {p.url.replace('https://', '').slice(0, 40)}...
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBABA: ALERTAS
// ─────────────────────────────────────────────────────────────────────────────
function SubAlertas({ dados }) {
  const ano = anoAtual()
  const mes = mesAtual()
  const alertas = []

  // 1. Limite de faturamento
  const receitaAno = calcReceitaAno(dados, ano)
  const p = pct(receitaAno, LIMITE_MEI_ANUAL)
  if (p >= 100) alertas.push({ nivel: 'critico', titulo: 'Limite MEI Ultrapassado!', desc: `Faturamento anual (${fmt(receitaAno)}) excede o limite de ${fmt(LIMITE_MEI_ANUAL)}. Migre para Simples Nacional imediatamente.`, icon: '🚨' })
  else if (p >= 80) alertas.push({ nivel: 'atencao', titulo: 'Limite MEI Acima de 80%', desc: `${fmt(receitaAno)} faturado (${p.toFixed(1)}%). Acompanhe de perto e planeje a migração para Simples Nacional.`, icon: '⚠️' })
  else if (p >= 60) alertas.push({ nivel: 'info', titulo: 'Faturamento em 60%+ do Limite', desc: `${fmt(receitaAno)} faturado (${p.toFixed(1)}%). Ainda há margem, mas fique atento.`, icon: 'ℹ️' })

  // 2. DAS atrasados
  const dasAno = dados.das?.[ano] || []
  const dasAtrasados = dasAno.filter(d => d.status !== 'pago' && d.mes < mes)
  if (dasAtrasados.length > 0) {
    alertas.push({
      nivel: 'critico',
      titulo: `${dasAtrasados.length} DAS em Atraso`,
      desc: `Meses sem pagamento: ${dasAtrasados.map(d => MESES_ABREV[d.mes - 1]).join(', ')}. Multa de 2% + juros de 1%/mês. Regularize pelo PGMEI.`,
      icon: '🔴',
    })
  }

  // 3. DAS do mês atual
  const dasAtual = dasAno.find(d => d.mes === mes)
  if (!dasAtual || dasAtual.status !== 'pago') {
    const hoje = new Date().getDate()
    if (hoje >= 15) alertas.push({ nivel: 'atencao', titulo: `DAS de ${MESES_FULL[mes - 1]} Pendente`, desc: `Vence dia 20/${String(mes).padStart(2,'0')}/${ano}. Emita pelo PGMEI antes do prazo.`, icon: '📅' })
  }

  // 4. DASN-SIMEI
  const dasnAnoAnterior = dados.dasnEntregues?.[ano - 1]
  if (!dasnAnoAnterior?.entregue && mes <= 5) {
    alertas.push({ nivel: 'atencao', titulo: `DASN-SIMEI ${ano - 1} Pendente`, desc: `Prazo: 31/05/${ano}. A declaração anual é obrigatória e o atraso gera multa mínima de R$ 50.`, icon: '📋' })
  }

  // 5. Documentos faltando
  const docsFaltando = ['ccmei', 'das_ultimo', 'dasn_ultimo'].filter(k => !dados.documentos?.[k]).length
  if (docsFaltando > 0) alertas.push({ nivel: 'info', titulo: `${docsFaltando} Documento(s) Obrigatório(s) Faltando`, desc: 'Acesse a aba Documentos e registre o CCMEI, comprovante de DAS e DASN mais recentes.', icon: '📁' })

  // Sem alertas
  if (alertas.length === 0) alertas.push({ nivel: 'ok', titulo: 'Tudo em Dia! 🎉', desc: 'Nenhum alerta ativo. Continue monitorando seu faturamento e obrigações mensalmente.', icon: '✅' })

  const corNivel = { critico: '#ef4444', atencao: '#f59e0b', info: '#06b6d4', ok: '#10b981' }
  const bgNivel  = { critico: 'rgba(239,68,68,.08)', atencao: 'rgba(245,158,11,.08)', info: 'rgba(6,182,212,.08)', ok: 'rgba(16,185,129,.08)' }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 600 }}>🔔 Painel de Alertas MEI</span>
        <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Situação atual baseada nos dados registrados no sistema.</p>
      </div>
      <div style={{ display: 'grid', gap: 12 }}>
        {alertas.map((a, i) => (
          <div key={i} style={{ background: bgNivel[a.nivel], border: `1px solid ${corNivel[a.nivel]}44`, borderLeft: `4px solid ${corNivel[a.nivel]}`, borderRadius: 10, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 24, flex: '0 0 auto' }}>{a.icon}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: corNivel[a.nivel], marginBottom: 4 }}>{a.titulo}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>{a.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTES AUXILIARES
// ─────────────────────────────────────────────────────────────────────────────
function Card({ titulo, valor, sub, cor, icon, small }) {
  return (
    <div style={{ background: '#111827', border: '1px solid #1e2d4a', borderRadius: 10, padding: small ? '12px 14px' : '16px 18px' }}>
      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>{icon} {titulo}</div>
      <div style={{ fontSize: small ? 24 : 28, fontWeight: 700, color: cor, lineHeight: 1 }}>{valor}</div>
      {sub && <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}
function Info({ label, valor }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#e2e8f0' }}>{valor}</div>
    </div>
  )
}
function Campo({ label, value, onChange, type = 'text', mask }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} style={inputStyle} />
    </div>
  )
}
function Carregando() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, color: '#64748b', fontFamily: "'DM Mono', monospace" }}>
      ⏳ Carregando dados MEI...
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNÇÕES DE INICIALIZAÇÃO
// ─────────────────────────────────────────────────────────────────────────────
function gerarDadosIniciais() {
  return { nomeEmpresa: '', cnpj: '', atividade: '', dataAbertura: '', tipoAtividade: 'servico', receitas: {}, das: {}, documentos: {}, dasnEntregues: {} }
}
function gerarReceitasVazias() {
  return Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, servico: '', comercio: '' }))
}
function inicializarReceitas(dados, ano) {
  const base = gerarReceitasVazias()
  const salvo = dados.receitas?.[ano] || []
  return base.map(b => salvo.find(s => s.mes === b.mes) || b)
}
function inicializarDAS(dados, ano) {
  const base = Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, status: 'pendente', dataPagamento: null }))
  const salvo = dados.das?.[ano] || []
  return base.map(b => salvo.find(s => s.mes === b.mes) || b)
}
function calcReceitaAno(dados, ano) {
  const receitas = dados.receitas?.[ano] || []
  return receitas.reduce((acc, r) => acc + Number(r.servico || 0) + Number(r.comercio || 0), 0)
}

// ─── Estilos compartilhados ──
const inputStyle = {
  width: '100%', background: '#1a2540', border: '1px solid #1e2d4a', borderRadius: 8,
  padding: '9px 12px', color: '#e2e8f0', fontFamily: "'DM Mono', monospace", fontSize: 13,
  boxSizing: 'border-box',
}
const labelStyle = { fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }
const btnPri = {
  padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
  fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600,
  background: 'linear-gradient(135deg,#06b6d4,#0088aa)', color: '#fff',
}
const btnSec = {
  padding: '8px 14px', borderRadius: 8, border: '1px solid #1e2d4a', cursor: 'pointer',
  fontFamily: "'DM Mono', monospace", fontSize: 12,
  background: 'rgba(255,255,255,.04)', color: '#94a3b8',
}
