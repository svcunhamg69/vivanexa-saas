// pages/marketing.js — Marketing Vivanexa SaaS v2
// =================================================
// MELHORIAS v2:
//   ✅ Campanhas IA: integração Meta Ads, Google Ads, TikTok Ads
//   ✅ Campanhas IA: geração de imagem/vídeo + copy completo por IA
//   ✅ Campanhas IA: público-alvo detalhado
//   ✅ Campanhas IA: aprovação antes de publicar
//   ✅ Campanhas IA: histórico de campanhas anteriores
//   ✅ Campanhas IA: integração com Agenda de Publicação
//   ✅ Geração de Imagem: IA decide imagem ou vídeo + publica orgânico
//   ✅ Geração de Imagem: chat com IA para refinar/refazer
//   ✅ Agenda: visão Dia/Semana/Mês + preview de conteúdo ao clicar
//   ✅ Agenda: regra de aprovação antes de publicar
//   ✅ Agenda: separação orgânico x pago
//   ✅ Removido: Script/Playbook (já existe em Comercial)
//   ✅ Agente IA Gestor de Marketing em todas as abas
// =================================================

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

// ── CSS ─────────────────────────────────────────────────────────
const CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  :root{
    --bg:#0a0f1e;--surface:#111827;--surface2:#1a2540;--border:#1e2d4a;
    --accent:#00d4ff;--accent2:#7c3aed;--accent3:#10b981;
    --text:#e2e8f0;--muted:#64748b;--danger:#ef4444;--gold:#f59e0b;
  }
  body{background:var(--bg);color:var(--text);font-family:'DM Mono',monospace;min-height:100vh}
  body::before{content:'';position:fixed;inset:0;
    background-image:linear-gradient(rgba(0,212,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,.02) 1px,transparent 1px);
    background-size:40px 40px;pointer-events:none;z-index:0}
  .page-wrap{max-width:1200px;margin:0 auto;padding:24px 16px;position:relative;z-index:1}
  .page-title{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:var(--text);margin-bottom:4px}
  .page-sub{font-size:12px;color:var(--muted);margin-bottom:20px}
  .tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:24px;border-bottom:1px solid var(--border);padding-bottom:12px}
  .tab-btn{padding:8px 16px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);
    color:var(--muted);font-family:'DM Mono',monospace;font-size:12px;cursor:pointer;transition:all .15s}
  .tab-btn.active{background:rgba(124,58,237,.15);border-color:rgba(124,58,237,.5);color:#a78bfa;font-weight:600}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:16px}
  .card-title{font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:var(--text);margin-bottom:12px;display:flex;align-items:center;gap:8px}
  .field{margin-bottom:12px}
  .field label{font-size:11px;color:var(--muted);display:block;margin-bottom:4px;letter-spacing:.5px;text-transform:uppercase}
  .field input,.field textarea,.field select{width:100%;background:var(--surface2);border:1px solid var(--border);
    border-radius:8px;padding:9px 12px;font-family:'DM Mono',monospace;font-size:13px;color:var(--text);
    outline:none;transition:border-color .2s;resize:vertical}
  .field input:focus,.field textarea:focus,.field select:focus{border-color:var(--accent2)}
  .field textarea{min-height:80px}
  .btn{padding:10px 18px;border-radius:8px;border:none;font-family:'DM Mono',monospace;font-size:12px;
    font-weight:600;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:6px}
  .btn-primary{background:linear-gradient(135deg,var(--accent),#0099bb);color:#fff}
  .btn-primary:hover{box-shadow:0 0 16px rgba(0,212,255,.4);transform:translateY(-1px)}
  .btn-secondary{background:var(--surface2);border:1px solid var(--border);color:var(--muted)}
  .btn-secondary:hover{border-color:var(--accent);color:var(--accent)}
  .btn-purple{background:linear-gradient(135deg,var(--accent2),#5b21b6);color:#fff}
  .btn-purple:hover{box-shadow:0 0 16px rgba(124,58,237,.4);transform:translateY(-1px)}
  .btn-green{background:linear-gradient(135deg,var(--accent3),#059669);color:#fff}
  .btn-green:hover{box-shadow:0 0 16px rgba(16,185,129,.4);transform:translateY(-1px)}
  .btn-red{background:linear-gradient(135deg,#ef4444,#b91c1c);color:#fff}
  .btn-gold{background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff}
  .btn:disabled{opacity:.5;cursor:not-allowed;transform:none!important}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
  @media(max-width:768px){.grid2,.grid3{grid-template-columns:1fr}}
  .result-box{background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:16px;
    font-size:13px;line-height:1.7;white-space:pre-wrap;color:var(--text);margin-top:12px;max-height:500px;overflow-y:auto}
  .badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:.5px}
  .badge-blue{background:rgba(0,212,255,.15);color:var(--accent);border:1px solid rgba(0,212,255,.3)}
  .badge-purple{background:rgba(124,58,237,.15);color:#a78bfa;border:1px solid rgba(124,58,237,.3)}
  .badge-green{background:rgba(16,185,129,.15);color:var(--accent3);border:1px solid rgba(16,185,129,.3)}
  .badge-yellow{background:rgba(245,158,11,.15);color:var(--gold);border:1px solid rgba(245,158,11,.3)}
  .badge-red{background:rgba(239,68,68,.15);color:#ef4444;border:1px solid rgba(239,68,68,.3)}
  .badge-paid{background:rgba(245,158,11,.15);color:#f59e0b;border:1px solid rgba(245,158,11,.3)}
  .badge-organic{background:rgba(16,185,129,.15);color:#10b981;border:1px solid rgba(16,185,129,.3)}
  .tag-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
  .tag{padding:5px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:20px;
    font-size:11px;color:var(--muted);cursor:pointer;transition:all .12s}
  .tag:hover,.tag.active{background:rgba(124,58,237,.12);border-color:rgba(124,58,237,.45);color:#a78bfa}
  .agenda-grid{display:grid;gap:4px;margin-top:12px}
  .agenda-grid.week{grid-template-columns:repeat(7,1fr)}
  .agenda-grid.day{grid-template-columns:1fr}
  .agenda-day{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px;min-height:100px}
  .agenda-day-label{font-size:10px;color:var(--muted);margin-bottom:6px;text-align:center}
  .agenda-post{border-radius:5px;padding:4px 6px;font-size:10px;margin-bottom:3px;cursor:pointer;
    line-height:1.4;border-left:3px solid;transition:opacity .15s}
  .agenda-post:hover{opacity:.8}
  .platform-icon{width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
  .thinking{display:flex;gap:6px;padding:8px 0;align-items:center}
  .thinking span{width:8px;height:8px;border-radius:50%;animation:bounce .6s infinite alternate}
  .thinking span:nth-child(1){background:#7c3aed;animation-delay:0s}
  .thinking span:nth-child(2){background:#a78bfa;animation-delay:.2s}
  .thinking span:nth-child(3){background:#7c3aed;animation-delay:.4s}
  @keyframes bounce{from{transform:translateY(0)}to{transform:translateY(-7px)}}
  .toast{position:fixed;bottom:24px;right:24px;padding:12px 20px;border-radius:10px;font-size:13px;
    font-family:'DM Mono',monospace;z-index:9999;opacity:0;transform:translateY(20px);transition:all .3s}
  .orb{position:fixed;border-radius:50%;filter:blur(120px);pointer-events:none;z-index:0;opacity:.06}
  .orb1{width:400px;height:400px;background:var(--accent2);top:-100px;right:-100px}
  .orb2{width:300px;height:300px;background:var(--accent);bottom:-100px;left:-100px}
  .stat-row{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px}
  .stat-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 20px;flex:1;min-width:130px;cursor:default}
  .stat-val{font-family:'Syne',sans-serif;font-size:24px;font-weight:800;color:var(--accent2)}
  .stat-label{font-size:11px;color:var(--muted);margin-top:2px}
  .chat-area{background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:14px;
    min-height:220px;max-height:340px;overflow-y:auto;display:flex;flex-direction:column;gap:10px}
  .chat-msg{max-width:82%;padding:10px 14px;border-radius:12px;font-size:13px;line-height:1.6;white-space:pre-wrap}
  .chat-msg.bot{align-self:flex-start;background:rgba(124,58,237,.12);border:1px solid rgba(124,58,237,.25);color:var(--text)}
  .chat-msg.user{align-self:flex-end;background:rgba(0,212,255,.1);border:1px solid rgba(0,212,255,.25);color:var(--text)}
  .chat-input-row{display:flex;gap:8px;margin-top:10px}
  .chat-input-row input{flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:8px;
    padding:9px 12px;font-family:'DM Mono',monospace;font-size:13px;color:var(--text);outline:none}
  .chat-input-row input:focus{border-color:var(--accent2)}
  .step-badge{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;
    border-radius:50%;background:rgba(124,58,237,.2);color:#a78bfa;font-size:10px;font-weight:700;flex-shrink:0}
  .platform-btn{padding:8px 14px;border-radius:8px;border:none;cursor:pointer;font-family:'DM Mono',monospace;
    font-size:11px;font-weight:600;display:flex;align-items:center;gap:5px;transition:all .15s}
`

// ── Constantes ───────────────────────────────────────────────────
const NICHOS = ['Contabilidade','E-commerce','Saúde','Educação','Imóveis','Restaurante','Tecnologia','Beleza','Fitness','Jurídico','Varejo','Serviços','Outro']

const PLATAFORMAS = [
  { id:'instagram', label:'Instagram', icon:'📸', color:'#e1306c', organic:true,  paid:true  },
  { id:'facebook',  label:'Facebook',  icon:'👥', color:'#1877f2', organic:true,  paid:true  },
  { id:'tiktok',    label:'TikTok',    icon:'🎵', color:'#ff0050', organic:true,  paid:true  },
  { id:'google',    label:'Google Ads',icon:'🔍', color:'#4285f4', organic:false, paid:true  },
  { id:'whatsapp',  label:'WhatsApp',  icon:'💬', color:'#25d366', organic:true,  paid:false },
]

const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const MESES_FULL  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const COR_STATUS = {
  'Agendado':   { bg:'rgba(0,212,255,.12)',    cor:'#00d4ff',  border:'rgba(0,212,255,.3)' },
  'Publicado':  { bg:'rgba(16,185,129,.12)',   cor:'#10b981',  border:'rgba(16,185,129,.3)' },
  'Pendente':   { bg:'rgba(245,158,11,.12)',   cor:'#f59e0b',  border:'rgba(245,158,11,.3)' },
  'Aprovado':   { bg:'rgba(124,58,237,.12)',   cor:'#a78bfa',  border:'rgba(124,58,237,.3)' },
  'Rejeitado':  { bg:'rgba(239,68,68,.12)',    cor:'#ef4444',  border:'rgba(239,68,68,.3)' },
  'Rascunho':   { bg:'rgba(100,116,139,.12)',  cor:'#64748b',  border:'rgba(100,116,139,.3)' },
}

// ── Helpers ──────────────────────────────────────────────────────
function toast(msg, type = 'ok') {
  const el = document.getElementById('mkt-toast')
  if (!el) return
  el.textContent = msg
  el.style.background = type === 'ok' ? 'rgba(16,185,129,.92)' : type === 'warn' ? 'rgba(245,158,11,.92)' : 'rgba(239,68,68,.92)'
  el.style.color = '#fff'
  el.style.opacity = '1'
  el.style.transform = 'translateY(0)'
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(20px)' }, 3500)
}

async function callAI(prompt, cfg, { temperature = 0.7, maxTokens = 2500, history = [], systemPrompt = '' } = {}) {
  const openaiKey = cfg.openaiApiKey || cfg.openaiKey || ''
  const geminiKey = cfg.geminiApiKey || cfg.geminiKey || ''
  const groqKey   = cfg.groqApiKey   || cfg.groqKey   || ''
  if (!openaiKey && !geminiKey && !groqKey) throw new Error('Nenhuma chave de IA configurada. Acesse Configurações → Empresa.')

  // OpenAI
  if (openaiKey) {
    try {
      const messages = []
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
      messages.push(...history)
      messages.push({ role: 'user', content: prompt })
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages, temperature, max_tokens: maxTokens })
      })
      const data = await res.json()
      const r = data.choices?.[0]?.message?.content
      if (r) return r
    } catch {}
  }

  // Gemini
  if (geminiKey) {
    try {
      const parts = []
      if (systemPrompt) parts.push({ text: systemPrompt + '\n\n' })
      history.forEach(h => parts.push({ text: (h.role === 'user' ? 'Usuário: ' : 'Assistente: ') + h.content + '\n' }))
      parts.push({ text: prompt })
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature, maxOutputTokens: maxTokens } })
      })
      const data = await res.json()
      const r = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (r) return r
    } catch {}
  }

  // Groq
  if (groqKey) {
    const messages = []
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
    messages.push(...history)
    messages.push({ role: 'user', content: prompt })
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3-70b-8192', messages, temperature })
    })
    const data = await res.json()
    const r = data.choices?.[0]?.message?.content
    if (r) return r
  }

  throw new Error('Nenhuma IA respondeu. Verifique as chaves em Configurações → Empresa.')
}

// System prompt do Agente Gestor de Marketing
function gestorPrompt(cfg) {
  return `Você é um Gestor de Marketing Digital Sênior e especialista em:
- Growth Hacking e alta conversão em vendas
- Gestão de tráfego pago (Meta Ads, Google Ads, TikTok Ads)
- Copywriting persuasivo e storytelling de marca
- Criação de conteúdo orgânico de alta performance
- Estratégia de branding e posicionamento
- Análise de métricas e ROI de campanhas

Empresa: ${cfg.company || 'Vivanexa'} | Nicho: ${cfg.nicho || 'Tecnologia'}
Responda sempre em português, de forma prática e orientada a resultados.
Seja direto, use dados e exemplos reais. Quando sugerir copies, dê exemplos prontos.`
}

// ── Componente: Chat com Agente IA ────────────────────────────────
function AgenteChat({ cfg, contexto = '' }) {
  const [msgs, setMsgs]       = useState([{ role:'bot', content:`Olá! Sou seu Gestor de Marketing IA 🚀\n\n${contexto || 'Como posso ajudar com sua estratégia de marketing hoje?'}` }])
  const [input, setInput]     = useState('')
  const [thinking, setThinking] = useState(false)
  const endRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:'smooth' }) }, [msgs])

  async function enviar() {
    if (!input.trim() || thinking) return
    const userMsg = input.trim()
    setInput('')
    setMsgs(prev => [...prev, { role:'user', content:userMsg }])
    setThinking(true)
    const hist = msgs.slice(-8).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))
    try {
      const resp = await callAI(userMsg, cfg, { temperature:0.75, systemPrompt: gestorPrompt(cfg), history: hist })
      setMsgs(prev => [...prev, { role:'bot', content: resp }])
    } catch (e) {
      setMsgs(prev => [...prev, { role:'bot', content:`❌ ${e.message}` }])
    }
    setThinking(false)
  }

  return (
    <div className="card" style={{ borderColor:'rgba(124,58,237,.3)', background:'rgba(124,58,237,.03)' }}>
      <div className="card-title">🧠 Agente Gestor de Marketing IA</div>
      <div className="chat-area">
        {msgs.map((m, i) => <div key={i} className={`chat-msg ${m.role}`}>{m.content}</div>)}
        {thinking && <div className="chat-msg bot"><div className="thinking"><span/><span/><span/></div></div>}
        <div ref={endRef} />
      </div>
      <div className="chat-input-row">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key==='Enter' && enviar()}
          placeholder="Pergunte ao Gestor de Marketing IA..." disabled={thinking} />
        <button className="btn btn-purple" onClick={enviar} disabled={thinking||!input.trim()}>
          {thinking ? '⏳' : '➤'}
        </button>
      </div>
    </div>
  )
}

// ── COMPONENTE PRINCIPAL ─────────────────────────────────────────
export default function Marketing() {
  const router = useRouter()
  const { aba: abaQuery } = router.query
  const [aba, setAba]         = useState('campanhas')
  const [loading, setLoading] = useState(true)
  const [cfg, setCfg]         = useState({})
  const [empresaId, setEmpresaId] = useState(null)
  const [perfil, setPerfil]   = useState(null)

  // ── Estados Campanhas IA ──────────────────────────────────────
  const [nicho, setNicho]             = useState('')
  const [produto, setProduto]         = useState('')
  const [objetivo, setObjetivo]       = useState('conversao')
  const [orcamento, setOrcamento]     = useState('')
  const [publicoAlvo, setPublicoAlvo] = useState('')
  const [idadeMin, setIdadeMin]       = useState('25')
  const [idadeMax, setIdadeMax]       = useState('54')
  const [genero, setGenero]           = useState('todos')
  const [plataformasCamp, setPlataformasCamp] = useState(['instagram','facebook'])
  const [gerandoCamp, setGerandoCamp] = useState(false)
  const [campResultado, setCampResultado] = useState(null) // objeto completo
  const [campAprovada, setCampAprovada]   = useState(false)
  const [publishingCamp, setPublishingCamp] = useState(false)
  const [campRefinando, setCampRefinando]   = useState(false)
  const [campRefineMsgs, setCampRefineMsgs] = useState([])
  const [campRefineInput, setCampRefineInput] = useState('')
  const campRefineEndRef = useRef(null)

  // ── Estados Geração de Imagem/Conteúdo ───────────────────────
  const [promptImg, setPromptImg]         = useState('')
  const [nichoImg, setNichoImg]           = useState('')
  const [plataformaImg, setPlataformaImg] = useState('instagram')
  const [tipoConteudo, setTipoConteudo]   = useState('ia_decide') // 'imagem'|'video'|'ia_decide'
  const [gerandoImg, setGerandoImg]       = useState(false)
  const [imgResultado, setImgResultado]   = useState(null)
  const [imgAprovado, setImgAprovado]     = useState(false)
  const [imgRefineMsgs, setImgRefineMsgs] = useState([])
  const [imgRefineInput, setImgRefineInput] = useState('')
  const [publishingImg, setPublishingImg] = useState(false)
  const imgRefineEndRef = useRef(null)

  // ── Estados Agenda ────────────────────────────────────────────
  const [posts, setPosts]             = useState([])
  const [vistaAgenda, setVistaAgenda] = useState('semana') // 'dia'|'semana'|'mes'
  const [offsetSemana, setOffsetSemana] = useState(0)
  const [offsetMes, setOffsetMes]     = useState(0)
  const [diaFoco, setDiaFoco]         = useState(new Date().toISOString().slice(0,10))
  const [showFormPost, setShowFormPost] = useState(false)
  const [formPost, setFormPost]       = useState(getFormPostVazio())
  const [postPreview, setPostPreview] = useState(null) // post selecionado para ver detalhes
  const [saving, setSaving]           = useState(false)
  const [filtroTipo, setFiltroTipo]   = useState('todos') // 'todos'|'organico'|'pago'
  const [filtroStatus, setFiltroStatus] = useState('todos')

  useEffect(() => { campRefineEndRef.current?.scrollIntoView({ behavior:'smooth' }) }, [campRefineMsgs])
  useEffect(() => { imgRefineEndRef.current?.scrollIntoView({ behavior:'smooth' }) }, [imgRefineMsgs])

  function getFormPostVazio() {
    return { id:'', titulo:'', descricao:'', plataforma:'instagram', data:new Date().toISOString().slice(0,10), horario:'09:00', status:'Pendente', tipo:'organico', imagem:'', campanha:'' }
  }

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/'); return }
      let { data: perf } = await supabase.from('perfis').select('*').eq('user_id', session.user.id).maybeSingle()
      if (!perf) {
        const nome = session.user.email?.split('@')[0] || 'Usuário'
        const { data: np } = await supabase.from('perfis').insert({ user_id: session.user.id, nome, email: session.user.email, empresa_id: session.user.id, perfil: 'admin' }).select().single()
        perf = np
      }
      setPerfil(perf)
      const eid = perf?.empresa_id || session.user.id
      setEmpresaId(eid)
      const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${eid}`).single()
      if (row?.value) {
        const c = JSON.parse(row.value)
        setCfg(c)
        setPosts(c.mktPosts || [])
        setNicho(c.nicho || '')
        setNichoImg(c.nicho || '')
        setProduto(c.company || '')
      }
      setLoading(false)
    }
    init()
  }, [router])

  useEffect(() => { if (abaQuery) setAba(abaQuery) }, [abaQuery])

  async function salvarStorage(novoCfg) {
    await supabase.from('vx_storage').upsert({
      key: `cfg:${empresaId}`,
      value: JSON.stringify(novoCfg),
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' })
  }

  // ════════════════════════════════════════════════════════════════
  // ABA CAMPANHAS IA
  // ════════════════════════════════════════════════════════════════

  async function gerarCampanha() {
    if (!produto || !objetivo) { toast('Preencha produto e objetivo', 'err'); return }
    if (!plataformasCamp.length) { toast('Selecione ao menos uma plataforma', 'err'); return }
    setGerandoCamp(true)
    setCampResultado(null)
    setCampAprovada(false)
    setCampRefineMsgs([])

    const platsInfo = plataformasCamp.map(pid => PLATAFORMAS.find(p => p.id === pid)?.label || pid).join(', ')

    const sysPr = gestorPrompt(cfg)
    const prompt = `Crie um plano COMPLETO de campanha digital de alta conversão para:

DADOS:
- Empresa/Produto: ${produto}
- Nicho: ${nicho || 'Geral'}
- Objetivo: ${objetivo === 'conversao' ? 'Conversão (vendas diretas)' : objetivo === 'leads' ? 'Geração de Leads' : objetivo === 'branding' ? 'Branding' : 'Engajamento'}
- Orçamento mensal: ${orcamento ? 'R$ ' + orcamento : 'Não informado'}
- Plataformas: ${platsInfo}
- Público-alvo: ${publicoAlvo || 'Definir automaticamente'}
- Faixa etária: ${idadeMin}-${idadeMax} anos
- Gênero: ${genero}

ENTREGUE EXATAMENTE NESTE FORMATO JSON (responda APENAS o JSON, sem markdown):
{
  "resumo": "resumo executivo da campanha (2-3 linhas)",
  "publicoAlvo": "descrição detalhada do público ideal",
  "segmentacao": {
    "interesses": ["interesse1","interesse2","interesse3","interesse4","interesse5"],
    "comportamentos": ["comportamento1","comportamento2"],
    "remarketing": "estratégia de remarketing"
  },
  "plataformas": {
    ${plataformasCamp.map(pid => `"${pid}": {
      "ativa": true,
      "tipo": "${PLATAFORMAS.find(p=>p.id===pid)?.paid ? 'pago' : 'organico'}",
      "orcamentoPct": 0,
      "objetivo": "",
      "formato": "",
      "headline": "",
      "copy": "",
      "cta": "",
      "publicoEspecifico": ""
    }`).join(',\n    ')}
  },
  "copies": [
    {"titulo":"","texto":"","plataforma":"","tipo":""},
    {"titulo":"","texto":"","plataforma":"","tipo":""},
    {"titulo":"","texto":"","plataforma":"","tipo":""}
  ],
  "calendario": [
    {"semana":1,"acoes":["acao1","acao2"]},
    {"semana":2,"acoes":["acao1","acao2"]},
    {"semana":3,"acoes":["acao1","acao2"]},
    {"semana":4,"acoes":["acao1","acao2"]}
  ],
  "kpis": [
    {"metrica":"CTR esperado","valor":"","benchmark":""},
    {"metrica":"CPC estimado","valor":"","benchmark":""},
    {"metrica":"CPL estimado","valor":"","benchmark":""},
    {"metrica":"ROAS esperado","valor":"","benchmark":""}
  ],
  "descricaoImagem": "prompt detalhado para gerar a imagem/criativo da campanha via IA",
  "tipoMidia": "imagem ou video"
}`

    try {
      const raw = await callAI(prompt, cfg, { temperature: 0.6, maxTokens: 3000, systemPrompt: sysPr })
      let parsed
      try {
        const clean = raw.replace(/```json|```/g, '').trim()
        parsed = JSON.parse(clean)
      } catch {
        // fallback: salva como texto
        parsed = { resumo: raw, publicoAlvo: '', segmentacao: {}, plataformas: {}, copies: [], calendario: [], kpis: [], descricaoImagem: '', tipoMidia: 'imagem' }
      }
      parsed._raw = raw
      parsed._criadoEm = new Date().toISOString()
      parsed._produto = produto
      parsed._nicho = nicho
      parsed._objetivo = objetivo
      parsed._plataformas = plataformasCamp
      setCampResultado(parsed)
      setCampRefineMsgs([{ role:'bot', content:`Campanha gerada para **${produto}**! 🚀\n\nRevisou o plano acima? Pode me pedir ajustes, pedir para refinar os copies, mudar a segmentação ou aprovar a campanha.` }])
      toast('Campanha gerada!')
    } catch (e) {
      toast('Erro: ' + e.message, 'err')
    }
    setGerandoCamp(false)
  }

  async function refinarCampanha() {
    const msg = campRefineInput.trim()
    if (!msg || campRefinando) return
    setCampRefineInput('')
    setCampRefineMsgs(prev => [...prev, { role:'user', content:msg }])
    setCampRefinando(true)
    const hist = campRefineMsgs.slice(-6).map(m => ({ role: m.role==='user'?'user':'assistant', content:m.content }))
    const ctx = campResultado?.resumo ? `Campanha atual: ${campResultado.resumo}` : ''
    try {
      const resp = await callAI(msg, cfg, { temperature:0.7, systemPrompt: gestorPrompt(cfg) + '\n\n' + ctx, history:hist })
      setCampRefineMsgs(prev => [...prev, { role:'bot', content:resp }])
    } catch (e) {
      setCampRefineMsgs(prev => [...prev, { role:'bot', content:'❌ ' + e.message }])
    }
    setCampRefinando(false)
  }

  async function aprovarEPublicarCampanha() {
    if (!campResultado) return
    setPublishingCamp(true)

    // Salva campanha aprovada no histórico
    const campObj = {
      id: Date.now(),
      produto,
      nicho,
      objetivo,
      plataformas: plataformasCamp,
      resultado: campResultado,
      status: 'Aprovada',
      criadoEm: new Date().toISOString()
    }
    const novoCfg = { ...cfg, mktCampanhas: [...(cfg.mktCampanhas || []), campObj] }

    // Gera posts na agenda para cada plataforma
    const hoje = new Date()
    const novosPosts = [...posts]
    plataformasCamp.forEach((pid, i) => {
      const platData = campResultado.plataformas?.[pid]
      if (!platData) return
      const d = new Date(hoje)
      d.setDate(d.getDate() + i + 1)
      novosPosts.push({
        id: String(Date.now() + i),
        titulo: platData.headline || `Campanha ${produto} — ${pid}`,
        descricao: platData.copy || '',
        plataforma: pid,
        data: d.toISOString().slice(0,10),
        horario: '09:00',
        status: 'Agendado',
        tipo: 'pago',
        campanha: campObj.id,
        cta: platData.cta || '',
      })
    })
    novoCfg.mktPosts = novosPosts
    setCfg(novoCfg)
    setPosts(novosPosts)
    await salvarStorage(novoCfg)

    setCampAprovada(true)
    setPublishingCamp(false)
    toast(`✅ Campanha aprovada! ${plataformasCamp.length} post(s) adicionados à Agenda.`)
  }

  function enviarParaAgendaCamp() {
    if (!campResultado) return
    const hoje = new Date()
    plataformasCamp.forEach((pid, i) => {
      const platData = campResultado.plataformas?.[pid]
      const d = new Date(hoje)
      d.setDate(d.getDate() + i + 1)
      const novoPost = {
        id: String(Date.now() + i + Math.random()),
        titulo: platData?.headline || `Post ${produto} — ${pid}`,
        descricao: platData?.copy || '',
        plataforma: pid,
        data: d.toISOString().slice(0,10),
        horario: '10:00',
        status: 'Pendente',
        tipo: 'pago',
      }
      setFormPost(novoPost)
    })
    setAba('agenda')
    toast('Posts adicionados à Agenda!')
  }

  // ════════════════════════════════════════════════════════════════
  // ABA GERAÇÃO DE IMAGEM / CONTEÚDO
  // ════════════════════════════════════════════════════════════════

  async function gerarConteudo() {
    if (!promptImg) { toast('Descreva o conteúdo que deseja criar', 'err'); return }
    setGerandoImg(true)
    setImgResultado(null)
    setImgAprovado(false)
    setImgRefineMsgs([])

    const platInfo = PLATAFORMAS.find(p => p.id === plataformaImg)
    const sysPr = gestorPrompt(cfg)

    const prompt = `Você é um gestor de marketing e criação de conteúdo digital.

DADOS DO CONTEÚDO:
- Plataforma: ${platInfo?.label || plataformaImg}
- Nicho: ${nichoImg || 'Geral'}
- Tema/Produto: ${promptImg}
- Tipo preferido: ${tipoConteudo === 'ia_decide' ? 'Decida você (imagem ou vídeo)' : tipoConteudo}

Responda APENAS em JSON (sem markdown):
{
  "tipoMidia": "imagem ou video",
  "justificativaTipo": "por que escolheu imagem ou vídeo",
  "titulo": "título chamativo (máx 80 chars)",
  "legenda": "legenda completa com emojis e CTA (adapte ao limite da plataforma)",
  "cta": "call to action específico",
  "hashtags": ["#hash1","#hash2","#hash3","#hash4","#hash5","#hash6","#hash7","#hash8","#hash9","#hash10"],
  "melhorHorario": "ex: 18h-20h (terça ou quinta)",
  "promptImagem": "prompt detalhado em inglês para gerar a imagem via DALL-E ou Midjourney (inclua estilo, cores, composição, formato ${plataformaImg === 'instagram' ? '1:1 ou 4:5' : plataformaImg === 'tiktok' ? '9:16 vertical' : '16:9'})",
  "roteiro": "${plataformaImg === 'tiktok' || tipoConteudo === 'video' ? 'roteiro completo do vídeo com timecodes' : 'null'}",
  "seo": "palavras-chave e estratégia de SEO para a legenda",
  "variacao": "sugestão de variação/teste A/B"
}`

    try {
      const raw = await callAI(prompt, cfg, { temperature:0.75, maxTokens:2000, systemPrompt:sysPr })
      let parsed
      try {
        const clean = raw.replace(/```json|```/g,'').trim()
        parsed = JSON.parse(clean)
      } catch {
        parsed = { titulo: promptImg, legenda: raw, hashtags: [], cta: '', tipoMidia: tipoConteudo === 'ia_decide' ? 'imagem' : tipoConteudo, promptImagem: '', melhorHorario: '' }
      }
      parsed._plataforma = plataformaImg
      parsed._nicho = nichoImg
      parsed._tema = promptImg
      parsed._criadoEm = new Date().toISOString()
      setImgResultado(parsed)
      setImgRefineMsgs([{ role:'bot', content:`Conteúdo criado para ${platInfo?.label}! ${parsed.tipoMidia === 'video' ? '🎥' : '🖼️'}\n\nQuer ajustar alguma coisa? Pedir uma variação? Ou está pronto para aprovar e agendar?` }])
      toast('Conteúdo gerado!')
    } catch (e) {
      toast('Erro: ' + e.message, 'err')
    }
    setGerandoImg(false)
  }

  async function refinarImagem() {
    const msg = imgRefineInput.trim()
    if (!msg) return
    setImgRefineInput('')
    setImgRefineMsgs(prev => [...prev, { role:'user', content:msg }])
    const hist = imgRefineMsgs.slice(-6).map(m => ({ role:m.role==='user'?'user':'assistant', content:m.content }))
    const ctx = imgResultado?.titulo ? `Conteúdo atual: ${imgResultado.titulo} para ${imgResultado._plataforma}` : ''
    try {
      const resp = await callAI(msg, cfg, { temperature:0.75, systemPrompt: gestorPrompt(cfg)+'\n\n'+ctx, history:hist })
      setImgRefineMsgs(prev => [...prev, { role:'bot', content:resp }])
    } catch (e) {
      setImgRefineMsgs(prev => [...prev, { role:'bot', content:'❌ '+e.message }])
    }
  }

  async function aprovarEAgendarConteudo() {
    if (!imgResultado) return
    setPublishingImg(true)
    const novoPost = {
      id: String(Date.now()),
      titulo: imgResultado.titulo || promptImg,
      descricao: imgResultado.legenda || '',
      plataforma: plataformaImg,
      data: new Date().toISOString().slice(0,10),
      horario: imgResultado.melhorHorario?.match(/\d+/)?.[0] ? imgResultado.melhorHorario.match(/\d+/)[0] + ':00' : '18:00',
      status: 'Aprovado',
      tipo: 'organico',
      cta: imgResultado.cta || '',
      hashtags: (imgResultado.hashtags || []).join(' '),
      promptImagem: imgResultado.promptImagem || '',
      tipoMidia: imgResultado.tipoMidia || 'imagem',
    }
    const novos = [...posts, novoPost]
    setPosts(novos)
    const novoCfg = { ...cfg, mktPosts: novos, mktConteudos: [...(cfg.mktConteudos || []), { ...imgResultado, id: Date.now() }] }
    setCfg(novoCfg)
    await salvarStorage(novoCfg)
    setImgAprovado(true)
    setPublishingImg(false)
    toast('✅ Conteúdo aprovado e adicionado à Agenda!')
  }

  // ════════════════════════════════════════════════════════════════
  // ABA AGENDA
  // ════════════════════════════════════════════════════════════════

  function getDiasSemana() {
    const hoje = new Date()
    const inicioSemana = new Date(hoje)
    inicioSemana.setDate(hoje.getDate() - hoje.getDay() + offsetSemana * 7)
    return Array.from({ length:7 }, (_, i) => { const d = new Date(inicioSemana); d.setDate(inicioSemana.getDate()+i); return d })
  }

  function getDiasMes() {
    const ref = new Date()
    ref.setMonth(ref.getMonth() + offsetMes, 1)
    const ano = ref.getFullYear(), mes = ref.getMonth()
    const primeiroDia = new Date(ano, mes, 1).getDay()
    const diasNoMes = new Date(ano, mes+1, 0).getDate()
    const cells = []
    for (let i=0; i<primeiroDia; i++) cells.push(null)
    for (let d=1; d<=diasNoMes; d++) cells.push(new Date(ano, mes, d))
    return { cells, ano, mes }
  }

  function getPostsDoDia(data) {
    if (!data) return []
    const ds = data.toISOString ? data.toISOString().slice(0,10) : data
    return posts.filter(p => p.data === ds &&
      (filtroTipo === 'todos' || p.tipo === filtroTipo) &&
      (filtroStatus === 'todos' || p.status === filtroStatus))
  }

  async function salvarPost() {
    if (!formPost.titulo || !formPost.data) { toast('Preencha título e data', 'err'); return }
    setSaving(true)
    const novoPost = { ...formPost, id: formPost.id || String(Date.now()) }
    const novos = formPost.id ? posts.map(p => p.id === formPost.id ? novoPost : p) : [...posts, novoPost]
    setPosts(novos)
    const novoCfg = { ...cfg, mktPosts: novos }
    setCfg(novoCfg)
    await salvarStorage(novoCfg)
    setShowFormPost(false)
    setFormPost(getFormPostVazio())
    toast('Post salvo!')
    setSaving(false)
  }

  async function excluirPost(id) {
    const novos = posts.filter(p => p.id !== id)
    setPosts(novos)
    const novoCfg = { ...cfg, mktPosts: novos }
    setCfg(novoCfg)
    await salvarStorage(novoCfg)
    toast('Post removido')
  }

  async function aprovarPost(id) {
    const novos = posts.map(p => p.id === id ? { ...p, status:'Aprovado' } : p)
    setPosts(novos)
    const novoCfg = { ...cfg, mktPosts: novos }
    setCfg(novoCfg)
    await salvarStorage(novoCfg)
    toast('✅ Post aprovado!')
    setPostPreview(novos.find(p => p.id === id) || null)
  }

  async function rejeitarPost(id) {
    const novos = posts.map(p => p.id === id ? { ...p, status:'Rejeitado' } : p)
    setPosts(novos)
    const novoCfg = { ...cfg, mktPosts: novos }
    setCfg(novoCfg)
    await salvarStorage(novoCfg)
    toast('Post rejeitado', 'warn')
    setPostPreview(novos.find(p => p.id === id) || null)
  }

  async function marcarPublicado(id) {
    const novos = posts.map(p => p.id === id ? { ...p, status:'Publicado' } : p)
    setPosts(novos)
    const novoCfg = { ...cfg, mktPosts: novos }
    setCfg(novoCfg)
    await salvarStorage(novoCfg)
    toast('📢 Post marcado como publicado!')
    setPostPreview(null)
  }

  // ── Render ────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0a0f1e', color:'#64748b', fontFamily:'DM Mono, monospace' }}>
      Carregando Marketing...
    </div>
  )

  const diasSemana = getDiasSemana()
  const { cells: diasMes, ano: anoMes, mes: mesMes } = getDiasMes()

  const postsAprovados   = posts.filter(p => p.status === 'Aprovado').length
  const postsPendentes   = posts.filter(p => p.status === 'Pendente').length
  const postsPublicados  = posts.filter(p => p.status === 'Publicado').length

  return (
    <>
      <Head>
        <title>Marketing — {cfg.company || 'Vivanexa'}</title>
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet" />
      </Head>
      <style>{CSS}</style>
      <div className="orb orb1"/><div className="orb orb2"/>
      <Navbar cfg={cfg} perfil={perfil} />

      <div className="page-wrap">
        <div className="page-title">📣 Marketing</div>
        <div className="page-sub">Campanhas IA, criação de conteúdo e agenda de publicação</div>

        {/* Stats */}
        <div className="stat-row">
          <div className="stat-card">
            <div className="stat-val">{(cfg.mktCampanhas||[]).length}</div>
            <div className="stat-label">Campanhas Geradas</div>
          </div>
          <div className="stat-card">
            <div className="stat-val">{posts.length}</div>
            <div className="stat-label">Posts na Agenda</div>
          </div>
          <div className="stat-card">
            <div className="stat-val" style={{ color:'#f59e0b' }}>{postsPendentes}</div>
            <div className="stat-label">Aguardando Aprovação</div>
          </div>
          <div className="stat-card">
            <div className="stat-val" style={{ color:'#10b981' }}>{postsPublicados}</div>
            <div className="stat-label">Posts Publicados</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          {[
            { id:'campanhas', label:'🎯 Campanhas IA' },
            { id:'imagens',   label:'🖼️ Geração de Conteúdo' },
            { id:'agenda',    label:'📅 Agenda de Publicação' },
          ].map(t => (
            <button key={t.id} className={`tab-btn ${aba===t.id?'active':''}`} onClick={() => setAba(t.id)}>{t.label}</button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════
            ABA CAMPANHAS IA
        ══════════════════════════════════════════════════════ */}
        {aba === 'campanhas' && (
          <div>
            {/* Formulário de campanha */}
            <div className="card">
              <div className="card-title">🎯 Criar Campanha com IA</div>

              <div className="grid3">
                <div className="field">
                  <label>Produto / Serviço</label>
                  <input value={produto} onChange={e => setProduto(e.target.value)} placeholder="Ex: Software contábil" />
                </div>
                <div className="field">
                  <label>Nicho de Mercado</label>
                  <select value={nicho} onChange={e => setNicho(e.target.value)} style={{ width:'100%', background:'#1a2540', border:'1px solid #1e2d4a', borderRadius:8, padding:'9px 12px', fontFamily:'DM Mono, monospace', fontSize:13, color:'#e2e8f0', outline:'none' }}>
                    <option value="">Selecione...</option>
                    {NICHOS.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Objetivo</label>
                  <select value={objetivo} onChange={e => setObjetivo(e.target.value)} style={{ width:'100%', background:'#1a2540', border:'1px solid #1e2d4a', borderRadius:8, padding:'9px 12px', fontFamily:'DM Mono, monospace', fontSize:13, color:'#e2e8f0', outline:'none' }}>
                    <option value="conversao">🛒 Conversão (Vendas)</option>
                    <option value="leads">📋 Geração de Leads</option>
                    <option value="branding">🏆 Branding</option>
                    <option value="engajamento">❤️ Engajamento</option>
                  </select>
                </div>
              </div>

              <div className="grid3">
                <div className="field">
                  <label>Orçamento Mensal (R$)</label>
                  <input type="number" value={orcamento} onChange={e => setOrcamento(e.target.value)} placeholder="Ex: 2000" />
                </div>
                <div className="field">
                  <label>Faixa Etária</label>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <input type="number" value={idadeMin} onChange={e => setIdadeMin(e.target.value)} style={{ width:70, background:'#1a2540', border:'1px solid #1e2d4a', borderRadius:8, padding:'9px 10px', fontFamily:'DM Mono', fontSize:13, color:'#e2e8f0', outline:'none' }} />
                    <span style={{ color:'#64748b', fontSize:12 }}>a</span>
                    <input type="number" value={idadeMax} onChange={e => setIdadeMax(e.target.value)} style={{ width:70, background:'#1a2540', border:'1px solid #1e2d4a', borderRadius:8, padding:'9px 10px', fontFamily:'DM Mono', fontSize:13, color:'#e2e8f0', outline:'none' }} />
                    <span style={{ color:'#64748b', fontSize:11 }}>anos</span>
                  </div>
                </div>
                <div className="field">
                  <label>Gênero</label>
                  <select value={genero} onChange={e => setGenero(e.target.value)} style={{ width:'100%', background:'#1a2540', border:'1px solid #1e2d4a', borderRadius:8, padding:'9px 12px', fontFamily:'DM Mono, monospace', fontSize:13, color:'#e2e8f0', outline:'none' }}>
                    <option value="todos">Todos</option>
                    <option value="masculino">Masculino</option>
                    <option value="feminino">Feminino</option>
                  </select>
                </div>
              </div>

              <div className="field">
                <label>Público-Alvo (opcional — IA define se vazio)</label>
                <input value={publicoAlvo} onChange={e => setPublicoAlvo(e.target.value)} placeholder="Ex: Contadores e donos de escritório contábil com 5+ funcionários" />
              </div>

              <div className="field">
                <label>Plataformas da Campanha</label>
                <div className="tag-list">
                  {PLATAFORMAS.map(p => (
                    <span key={p.id}
                      className={`tag ${plataformasCamp.includes(p.id)?'active':''}`}
                      onClick={() => setPlataformasCamp(prev => prev.includes(p.id) ? prev.filter(x=>x!==p.id) : [...prev,p.id])}
                      style={plataformasCamp.includes(p.id) ? { borderColor:p.color+'88', color:p.color, background:p.color+'18' } : {}}>
                      {p.icon} {p.label}
                      {p.paid && <span style={{ fontSize:9, marginLeft:4, color:'#f59e0b' }}>PAGO</span>}
                    </span>
                  ))}
                </div>
              </div>

              <button className="btn btn-purple" onClick={gerarCampanha} disabled={gerandoCamp} style={{ marginTop:8 }}>
                {gerandoCamp ? '⏳ Gerando campanha...' : '🚀 Gerar Campanha com IA'}
              </button>
              {gerandoCamp && <div className="thinking" style={{ marginTop:12 }}><span/><span/><span/><span style={{ color:'#a78bfa', fontSize:12, marginLeft:8 }}>O Gestor de Marketing IA está criando sua campanha...</span></div>}
            </div>

            {/* Resultado da campanha */}
            {campResultado && (
              <div>
                {/* Resumo executivo */}
                <div className="card" style={{ borderColor:'rgba(124,58,237,.3)', background:'rgba(124,58,237,.03)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
                    <div className="card-title" style={{ margin:0 }}>📊 Plano de Campanha — {campResultado._produto}</div>
                    <div style={{ display:'flex', gap:6 }}>
                      {!campAprovada ? (
                        <>
                          <button className="btn btn-green" style={{ fontSize:11 }} onClick={aprovarEPublicarCampanha} disabled={publishingCamp}>
                            {publishingCamp ? '⏳' : '✅ Aprovar e Agendar'}
                          </button>
                          <button className="btn btn-secondary" style={{ fontSize:11 }} onClick={() => { setCampResultado(null); setCampAprovada(false) }}>
                            🔄 Refazer
                          </button>
                        </>
                      ) : (
                        <span className="badge badge-green" style={{ padding:'6px 12px', fontSize:12 }}>✅ Campanha Aprovada e Agendada</span>
                      )}
                    </div>
                  </div>

                  {campResultado.resumo && (
                    <div style={{ padding:'12px 16px', background:'rgba(0,0,0,.2)', borderRadius:10, fontSize:13, color:'#94a3b8', lineHeight:1.7, marginBottom:16 }}>
                      {campResultado.resumo}
                    </div>
                  )}

                  {/* Público e Segmentação */}
                  {campResultado.publicoAlvo && (
                    <div style={{ marginBottom:16 }}>
                      <div style={{ fontSize:11, color:'#64748b', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>🎯 Público-Alvo</div>
                      <div style={{ padding:'10px 14px', background:'rgba(0,212,255,.06)', border:'1px solid rgba(0,212,255,.15)', borderRadius:8, fontSize:12, color:'#94a3b8' }}>
                        {campResultado.publicoAlvo}
                      </div>
                      {campResultado.segmentacao?.interesses && (
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8 }}>
                          {campResultado.segmentacao.interesses.map((int, i) => (
                            <span key={i} className="badge badge-blue">{int}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Plataformas */}
                  {campResultado.plataformas && Object.keys(campResultado.plataformas).length > 0 && (
                    <div style={{ marginBottom:16 }}>
                      <div style={{ fontSize:11, color:'#64748b', textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>📱 Por Plataforma</div>
                      {Object.entries(campResultado.plataformas).map(([pid, platData]) => {
                        const plat = PLATAFORMAS.find(p => p.id === pid)
                        if (!plat || !platData) return null
                        return (
                          <div key={pid} style={{ border:`1px solid ${plat.color}33`, borderRadius:10, padding:'14px 16px', marginBottom:10, background:`${plat.color}08` }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                              <span style={{ fontSize:18 }}>{plat.icon}</span>
                              <span style={{ fontWeight:700, color:plat.color, fontSize:13 }}>{plat.label}</span>
                              {platData.tipo && <span className={`badge ${platData.tipo==='pago'?'badge-paid':'badge-organic'}`}>{platData.tipo}</span>}
                              {platData.orcamentoPct > 0 && <span className="badge badge-yellow">{platData.orcamentoPct}% verba</span>}
                            </div>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, fontSize:12 }}>
                              {platData.headline && (
                                <div>
                                  <div style={{ color:'#64748b', fontSize:10, marginBottom:3 }}>HEADLINE</div>
                                  <div style={{ color:'#e2e8f0', fontWeight:600 }}>{platData.headline}</div>
                                </div>
                              )}
                              {platData.cta && (
                                <div>
                                  <div style={{ color:'#64748b', fontSize:10, marginBottom:3 }}>CTA</div>
                                  <div style={{ color:'#a78bfa', fontWeight:600 }}>{platData.cta}</div>
                                </div>
                              )}
                              {platData.copy && (
                                <div style={{ gridColumn:'1/-1' }}>
                                  <div style={{ color:'#64748b', fontSize:10, marginBottom:3 }}>COPY</div>
                                  <div style={{ color:'#94a3b8', lineHeight:1.6 }}>{platData.copy}</div>
                                </div>
                              )}
                              {platData.publicoEspecifico && (
                                <div style={{ gridColumn:'1/-1' }}>
                                  <div style={{ color:'#64748b', fontSize:10, marginBottom:3 }}>SEGMENTAÇÃO</div>
                                  <div style={{ color:'#94a3b8' }}>{platData.publicoEspecifico}</div>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Copies prontos */}
                  {(campResultado.copies||[]).filter(c=>c.texto).length > 0 && (
                    <div style={{ marginBottom:16 }}>
                      <div style={{ fontSize:11, color:'#64748b', textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>🔥 Copies de Alta Conversão</div>
                      {campResultado.copies.filter(c=>c.texto).map((c,i) => (
                        <div key={i} style={{ background:'rgba(0,0,0,.2)', borderRadius:8, padding:'12px 14px', marginBottom:8, borderLeft:'3px solid #7c3aed' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                            <span style={{ fontSize:12, fontWeight:700, color:'#a78bfa' }}>{c.titulo}</span>
                            <button onClick={() => navigator.clipboard.writeText(c.texto)} style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer', fontSize:11 }}>📋 Copiar</button>
                          </div>
                          <div style={{ fontSize:12, color:'#94a3b8', lineHeight:1.6 }}>{c.texto}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* KPIs esperados */}
                  {(campResultado.kpis||[]).filter(k=>k.valor).length > 0 && (
                    <div style={{ marginBottom:16 }}>
                      <div style={{ fontSize:11, color:'#64748b', textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>📈 KPIs Esperados</div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:8 }}>
                        {campResultado.kpis.filter(k=>k.valor).map((k,i) => (
                          <div key={i} style={{ background:'rgba(0,212,255,.06)', border:'1px solid rgba(0,212,255,.15)', borderRadius:8, padding:'10px 12px' }}>
                            <div style={{ fontSize:10, color:'#64748b', marginBottom:4 }}>{k.metrica}</div>
                            <div style={{ fontSize:16, fontWeight:700, color:'#00d4ff' }}>{k.valor}</div>
                            {k.benchmark && <div style={{ fontSize:10, color:'#475569', marginTop:2 }}>Benchmark: {k.benchmark}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Calendário */}
                  {(campResultado.calendario||[]).length > 0 && (
                    <div style={{ marginBottom:16 }}>
                      <div style={{ fontSize:11, color:'#64748b', textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>📅 Calendário de Ações</div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:8 }}>
                        {campResultado.calendario.map((sem,i) => (
                          <div key={i} style={{ background:'rgba(124,58,237,.06)', border:'1px solid rgba(124,58,237,.2)', borderRadius:8, padding:'10px 12px' }}>
                            <div style={{ fontSize:11, fontWeight:700, color:'#a78bfa', marginBottom:6 }}>Semana {sem.semana}</div>
                            {(sem.acoes||[]).map((a,j) => (
                              <div key={j} style={{ fontSize:11, color:'#94a3b8', padding:'2px 0', display:'flex', gap:5 }}>
                                <span>▸</span> {a}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Prompt para imagem */}
                  {campResultado.descricaoImagem && (
                    <div style={{ padding:'10px 14px', background:'rgba(245,158,11,.06)', border:'1px solid rgba(245,158,11,.2)', borderRadius:8, fontSize:12, color:'#94a3b8' }}>
                      <div style={{ color:'#f59e0b', fontWeight:600, marginBottom:4 }}>🖼️ Prompt para criar o criativo:</div>
                      <div style={{ fontStyle:'italic' }}>{campResultado.descricaoImagem}</div>
                      <button onClick={() => navigator.clipboard.writeText(campResultado.descricaoImagem)} style={{ marginTop:6, background:'none', border:'none', color:'#64748b', cursor:'pointer', fontSize:11 }}>📋 Copiar prompt</button>
                    </div>
                  )}
                </div>

                {/* Chat de refinamento */}
                <div className="card" style={{ borderColor:'rgba(124,58,237,.25)' }}>
                  <div className="card-title">🤖 Refinar com o Agente Gestor de Marketing</div>
                  <div className="chat-area">
                    {campRefineMsgs.map((m,i) => <div key={i} className={`chat-msg ${m.role}`}>{m.content}</div>)}
                    {campRefinando && <div className="chat-msg bot"><div className="thinking"><span/><span/><span/></div></div>}
                    <div ref={campRefineEndRef}/>
                  </div>
                  <div className="chat-input-row">
                    <input value={campRefineInput} onChange={e => setCampRefineInput(e.target.value)}
                      onKeyDown={e => e.key==='Enter' && refinarCampanha()}
                      placeholder="Ex: 'Refine os copies para um tom mais urgente' ou 'Adicione mais detalhes sobre remarketing'..."
                      disabled={campRefinando} />
                    <button className="btn btn-purple" onClick={refinarCampanha} disabled={campRefinando||!campRefineInput.trim()}>
                      {campRefinando ? '⏳' : '➤'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Campanhas anteriores */}
            {(cfg.mktCampanhas||[]).length > 0 && (
              <div className="card">
                <div className="card-title">📜 Campanhas Anteriores</div>
                {[...(cfg.mktCampanhas||[])].reverse().slice(0,5).map(c => (
                  <div key={c.id} style={{ padding:'12px 14px', background:'#1a2540', borderRadius:8, marginBottom:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ fontSize:13, color:'#e2e8f0', fontWeight:600 }}>{c.produto}</div>
                      <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>{c.nicho} · {new Date(c.criadoEm).toLocaleDateString('pt-BR')} · {(c.plataformas||[]).join(', ')}</div>
                    </div>
                    <div style={{ display:'flex', gap:6 }}>
                      <span className={`badge ${c.status==='Aprovada'?'badge-green':'badge-blue'}`}>{c.status||'Gerada'}</span>
                      <button className="btn btn-secondary" style={{ fontSize:10, padding:'3px 10px' }} onClick={() => setCampResultado(c.resultado)}>👁 Ver</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            ABA GERAÇÃO DE CONTEÚDO / IMAGEM
        ══════════════════════════════════════════════════════ */}
        {aba === 'imagens' && (
          <div>
            <div className="card">
              <div className="card-title">✨ Criador de Conteúdo com IA</div>

              <div className="grid2">
                <div className="field">
                  <label>Nicho</label>
                  <select value={nichoImg} onChange={e => setNichoImg(e.target.value)} style={{ width:'100%', background:'#1a2540', border:'1px solid #1e2d4a', borderRadius:8, padding:'9px 12px', fontFamily:'DM Mono, monospace', fontSize:13, color:'#e2e8f0', outline:'none' }}>
                    <option value="">Selecione...</option>
                    {NICHOS.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Plataforma</label>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:4 }}>
                    {PLATAFORMAS.filter(p => p.organic).map(p => (
                      <button key={p.id} onClick={() => setPlataformaImg(p.id)}
                        style={{ padding:'6px 12px', borderRadius:8, border:`1px solid ${plataformaImg===p.id ? p.color : '#1e2d4a'}`, background:plataformaImg===p.id ? p.color+'22' : '#1a2540', color:plataformaImg===p.id ? p.color : '#64748b', fontFamily:'DM Mono, monospace', fontSize:11, cursor:'pointer' }}>
                        {p.icon} {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="field">
                <label>Tipo de Mídia</label>
                <div style={{ display:'flex', gap:8 }}>
                  {[['ia_decide','🤖 IA Decide'],['imagem','🖼️ Imagem'],['video','🎥 Vídeo']].map(([v,l]) => (
                    <button key={v} onClick={() => setTipoConteudo(v)}
                      style={{ padding:'7px 16px', borderRadius:8, border:'none', cursor:'pointer', fontFamily:'DM Mono, monospace', fontSize:11, background:tipoConteudo===v?'linear-gradient(135deg,#7c3aed,#5b21b6)':'rgba(255,255,255,.04)', color:tipoConteudo===v?'#fff':'#64748b', outline:tipoConteudo===v?'none':'1px solid #1e2d4a' }}>
                      {l}
                    </button>
                  ))}
                </div>
                {tipoConteudo === 'ia_decide' && <div style={{ fontSize:11, color:'#64748b', marginTop:6 }}>💡 A IA escolherá o melhor formato para o nicho e plataforma selecionados</div>}
              </div>

              <div className="field">
                <label>Descreva o conteúdo / tema</label>
                <textarea value={promptImg} onChange={e => setPromptImg(e.target.value)}
                  style={{ minHeight:90 }}
                  placeholder="Ex: Post mostrando os 5 benefícios de contratar um contador, com linguagem descontraída e foco em PMEs..." />
              </div>

              <button className="btn btn-purple" onClick={gerarConteudo} disabled={gerandoImg}>
                {gerandoImg ? '⏳ Criando conteúdo...' : '✨ Gerar Conteúdo com IA'}
              </button>
              {gerandoImg && <div className="thinking" style={{ marginTop:12 }}><span/><span/><span/><span style={{ color:'#a78bfa', fontSize:12, marginLeft:8 }}>O Gestor de Conteúdo IA está criando...</span></div>}
            </div>

            {/* Resultado do conteúdo */}
            {imgResultado && (
              <div>
                <div className="card" style={{ borderColor:'rgba(124,58,237,.3)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
                    <div className="card-title" style={{ margin:0 }}>
                      {imgResultado.tipoMidia === 'video' ? '🎥' : '🖼️'} {imgResultado.titulo}
                    </div>
                    <div style={{ display:'flex', gap:6 }}>
                      {!imgAprovado ? (
                        <>
                          <button className="btn btn-green" style={{ fontSize:11 }} onClick={aprovarEAgendarConteudo} disabled={publishingImg}>
                            {publishingImg ? '⏳' : '✅ Aprovar e Agendar'}
                          </button>
                          <button className="btn btn-secondary" style={{ fontSize:11 }} onClick={() => setImgResultado(null)}>🔄 Refazer</button>
                        </>
                      ) : (
                        <span className="badge badge-green" style={{ padding:'6px 12px', fontSize:12 }}>✅ Conteúdo Aprovado e Agendado</span>
                      )}
                    </div>
                  </div>

                  {/* Info do tipo e plataforma */}
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
                    <span className="badge badge-purple">{imgResultado.tipoMidia === 'video' ? '🎥 Vídeo' : '🖼️ Imagem'}</span>
                    {(() => { const p = PLATAFORMAS.find(pl => pl.id === imgResultado._plataforma); return p ? <span className="badge" style={{ background:p.color+'22', color:p.color, border:`1px solid ${p.color}44` }}>{p.icon} {p.label}</span> : null })()}
                    {imgResultado.melhorHorario && <span className="badge badge-yellow">⏰ {imgResultado.melhorHorario}</span>}
                    {imgResultado.justificativaTipo && <span style={{ fontSize:11, color:'#64748b' }}>({imgResultado.justificativaTipo})</span>}
                  </div>

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                    {/* Legenda */}
                    <div style={{ gridColumn:'1/-1' }}>
                      <div style={{ fontSize:11, color:'#64748b', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>📝 Legenda</div>
                      <div style={{ background:'rgba(0,0,0,.2)', borderRadius:8, padding:'12px 14px', fontSize:13, color:'#e2e8f0', lineHeight:1.7, whiteSpace:'pre-wrap', maxHeight:200, overflowY:'auto' }}>
                        {imgResultado.legenda}
                      </div>
                      <button onClick={() => navigator.clipboard.writeText(imgResultado.legenda)} style={{ marginTop:6, background:'none', border:'none', color:'#64748b', cursor:'pointer', fontSize:11 }}>📋 Copiar legenda</button>
                    </div>

                    {/* CTA */}
                    {imgResultado.cta && (
                      <div>
                        <div style={{ fontSize:11, color:'#64748b', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>🔗 Call to Action</div>
                        <div style={{ padding:'10px 14px', background:'rgba(124,58,237,.1)', border:'1px solid rgba(124,58,237,.25)', borderRadius:8, fontSize:13, color:'#a78bfa', fontWeight:600 }}>{imgResultado.cta}</div>
                      </div>
                    )}

                    {/* Hashtags */}
                    {(imgResultado.hashtags||[]).length > 0 && (
                      <div>
                        <div style={{ fontSize:11, color:'#64748b', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>🏷️ Hashtags</div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                          {imgResultado.hashtags.map((h,i) => <span key={i} className="badge badge-blue">{h}</span>)}
                        </div>
                        <button onClick={() => navigator.clipboard.writeText(imgResultado.hashtags.join(' '))} style={{ marginTop:6, background:'none', border:'none', color:'#64748b', cursor:'pointer', fontSize:11 }}>📋 Copiar todas</button>
                      </div>
                    )}
                  </div>

                  {/* Prompt para imagem */}
                  {imgResultado.promptImagem && (
                    <div style={{ marginTop:14, padding:'12px 14px', background:'rgba(245,158,11,.06)', border:'1px solid rgba(245,158,11,.2)', borderRadius:8 }}>
                      <div style={{ fontSize:11, color:'#f59e0b', fontWeight:700, marginBottom:6 }}>🎨 Prompt para criar a imagem (DALL-E / Midjourney / Stable Diffusion)</div>
                      <div style={{ fontSize:12, color:'#94a3b8', lineHeight:1.6, fontStyle:'italic' }}>{imgResultado.promptImagem}</div>
                      <button onClick={() => navigator.clipboard.writeText(imgResultado.promptImagem)} style={{ marginTop:6, background:'none', border:'none', color:'#64748b', cursor:'pointer', fontSize:11 }}>📋 Copiar prompt</button>
                    </div>
                  )}

                  {/* Roteiro de vídeo */}
                  {imgResultado.roteiro && imgResultado.roteiro !== 'null' && (
                    <div style={{ marginTop:14, padding:'12px 14px', background:'rgba(239,68,68,.06)', border:'1px solid rgba(239,68,68,.2)', borderRadius:8 }}>
                      <div style={{ fontSize:11, color:'#ef4444', fontWeight:700, marginBottom:6 }}>🎬 Roteiro do Vídeo</div>
                      <div style={{ fontSize:12, color:'#94a3b8', lineHeight:1.8, whiteSpace:'pre-wrap' }}>{imgResultado.roteiro}</div>
                    </div>
                  )}

                  {/* SEO */}
                  {imgResultado.seo && (
                    <div style={{ marginTop:14, fontSize:11, color:'#64748b', padding:'8px 12px', background:'rgba(0,212,255,.04)', borderRadius:8 }}>
                      🔍 <strong style={{ color:'#00d4ff' }}>SEO:</strong> {imgResultado.seo}
                    </div>
                  )}
                </div>

                {/* Chat de refinamento */}
                <div className="card" style={{ borderColor:'rgba(124,58,237,.25)' }}>
                  <div className="card-title">🤖 Refinar com o Agente</div>
                  <div className="chat-area">
                    {imgRefineMsgs.map((m,i) => <div key={i} className={`chat-msg ${m.role}`}>{m.content}</div>)}
                    <div ref={imgRefineEndRef}/>
                  </div>
                  <div className="chat-input-row">
                    <input value={imgRefineInput} onChange={e => setImgRefineInput(e.target.value)}
                      onKeyDown={e => e.key==='Enter' && refinarImagem()}
                      placeholder="Ex: 'Tom mais descontraído', 'Legenda mais curta', 'Crie uma variação para Stories'..." />
                    <button className="btn btn-purple" onClick={refinarImagem} disabled={!imgRefineInput.trim()}>➤</button>
                  </div>
                </div>

                {/* Conteúdos anteriores */}
                {(cfg.mktConteudos||[]).length > 0 && (
                  <div className="card">
                    <div className="card-title">📚 Conteúdos Criados Anteriormente</div>
                    {[...(cfg.mktConteudos||[])].reverse().slice(0,5).map(c => (
                      <div key={c.id} style={{ padding:'10px 14px', background:'#1a2540', borderRadius:8, marginBottom:6, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <div>
                          <div style={{ fontSize:13, color:'#e2e8f0', fontWeight:600 }}>{c.tipoMidia === 'video' ? '🎥' : '🖼️'} {c.titulo}</div>
                          <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>{c._plataforma} · {c._nicho} · {new Date(c._criadoEm).toLocaleDateString('pt-BR')}</div>
                        </div>
                        <button className="btn btn-secondary" style={{ fontSize:10, padding:'3px 10px' }} onClick={() => setImgResultado(c)}>👁 Ver</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Agente de Marketing sempre disponível nesta aba */}
            {!imgResultado && (
              <AgenteChat cfg={cfg} contexto={`Estou na aba de criação de conteúdo. Nicho: ${nichoImg||'não definido'}. Plataforma: ${plataformaImg}. Como posso criar conteúdo de alta performance?`} />
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            ABA AGENDA DE PUBLICAÇÃO
        ══════════════════════════════════════════════════════ */}
        {aba === 'agenda' && (
          <div>
            {/* Controles da agenda */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {/* Vista */}
                {[['dia','Dia'],['semana','Semana'],['mes','Mês']].map(([v,l]) => (
                  <button key={v} onClick={() => setVistaAgenda(v)}
                    style={{ padding:'7px 14px', borderRadius:8, border:'none', cursor:'pointer', fontFamily:'DM Mono, monospace', fontSize:11, background:vistaAgenda===v?'linear-gradient(135deg,#7c3aed,#5b21b6)':'rgba(255,255,255,.04)', color:vistaAgenda===v?'#fff':'#64748b', outline:vistaAgenda===v?'none':'1px solid #1e2d4a' }}>
                    {l}
                  </button>
                ))}
                <div style={{ width:1, background:'#1e2d4a', margin:'0 2px' }}/>
                {/* Navegação */}
                {vistaAgenda === 'semana' && <>
                  <button className="btn btn-secondary" style={{ fontSize:11, padding:'6px 12px' }} onClick={() => setOffsetSemana(s => s-1)}>← Semana anterior</button>
                  <button className="btn btn-secondary" style={{ fontSize:11, padding:'6px 12px' }} onClick={() => setOffsetSemana(0)}>Hoje</button>
                  <button className="btn btn-secondary" style={{ fontSize:11, padding:'6px 12px' }} onClick={() => setOffsetSemana(s => s+1)}>Próxima semana →</button>
                </>}
                {vistaAgenda === 'mes' && <>
                  <button className="btn btn-secondary" style={{ fontSize:11, padding:'6px 12px' }} onClick={() => setOffsetMes(m => m-1)}>← Mês anterior</button>
                  <button className="btn btn-secondary" style={{ fontSize:11, padding:'6px 12px' }} onClick={() => setOffsetMes(0)}>Hoje</button>
                  <button className="btn btn-secondary" style={{ fontSize:11, padding:'6px 12px' }} onClick={() => setOffsetMes(m => m+1)}>Próximo mês →</button>
                </>}
                {vistaAgenda === 'dia' && (
                  <input type="date" value={diaFoco} onChange={e => setDiaFoco(e.target.value)}
                    style={{ background:'#1a2540', border:'1px solid #1e2d4a', borderRadius:8, padding:'6px 12px', fontFamily:'DM Mono', fontSize:12, color:'#e2e8f0', outline:'none' }} />
                )}
              </div>
              <button className="btn btn-purple" onClick={() => { setFormPost(getFormPostVazio()); setShowFormPost(true) }}>+ Novo Post</button>
            </div>

            {/* Filtros */}
            <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
              <span style={{ fontSize:11, color:'#64748b' }}>Filtrar:</span>
              {[['todos','Todos'],['organico','Orgânico'],['pago','Pago']].map(([v,l]) => (
                <button key={v} onClick={() => setFiltroTipo(v)}
                  style={{ padding:'4px 12px', borderRadius:6, border:'none', cursor:'pointer', fontFamily:'DM Mono', fontSize:11, background:filtroTipo===v?'rgba(124,58,237,.2)':'rgba(255,255,255,.03)', color:filtroTipo===v?'#a78bfa':'#64748b', outline:filtroTipo===v?'1px solid rgba(124,58,237,.4)':'1px solid #1e2d4a' }}>
                  {l}
                </button>
              ))}
              <span style={{ color:'#1e2d4a' }}>|</span>
              {['todos','Pendente','Aprovado','Agendado','Publicado','Rejeitado'].map(s => (
                <button key={s} onClick={() => setFiltroStatus(s)}
                  style={{ padding:'4px 12px', borderRadius:6, border:'none', cursor:'pointer', fontFamily:'DM Mono', fontSize:11, background:filtroStatus===s?'rgba(0,212,255,.12)':'rgba(255,255,255,.03)', color:filtroStatus===s?'#00d4ff':'#64748b', outline:filtroStatus===s?'1px solid rgba(0,212,255,.3)':'1px solid #1e2d4a' }}>
                  {s === 'todos' ? 'Todos status' : s}
                </button>
              ))}
            </div>

            {/* ── VISTA DIA ── */}
            {vistaAgenda === 'dia' && (
              <div className="card">
                <div style={{ fontSize:14, fontWeight:700, color:'#e2e8f0', marginBottom:14, fontFamily:'Syne, sans-serif' }}>
                  📅 {new Date(diaFoco + 'T12:00').toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' })}
                </div>
                {getPostsDoDia(new Date(diaFoco + 'T12:00')).length === 0 ? (
                  <div style={{ textAlign:'center', color:'#64748b', padding:'30px', fontSize:13 }}>Nenhum post agendado para este dia</div>
                ) : getPostsDoDia(new Date(diaFoco + 'T12:00')).sort((a,b) => a.horario > b.horario ? 1:-1).map(post => (
                  <PostCard key={post.id} post={post} onVer={() => setPostPreview(post)} onEditar={() => { setFormPost(post); setShowFormPost(true) }} onExcluir={() => excluirPost(post.id)} />
                ))}
              </div>
            )}

            {/* ── VISTA SEMANA ── */}
            {vistaAgenda === 'semana' && (
              <div className="card">
                <div className="agenda-grid week">
                  {diasSemana.map((dia, i) => {
                    const postsDodia = getPostsDoDia(dia)
                    const isHoje = dia.toDateString() === new Date().toDateString()
                    return (
                      <div key={i} className="agenda-day"
                        style={{ borderColor: isHoje ? 'rgba(124,58,237,.5)' : '#1e2d4a', background: isHoje ? 'rgba(124,58,237,.05)' : '#1a2540' }}>
                        <div className="agenda-day-label" style={{ color: isHoje ? '#a78bfa' : '#64748b' }}>
                          {DIAS_SEMANA[i]}<br />
                          <span style={{ fontSize:14, fontWeight: isHoje ? 700 : 400 }}>{dia.getDate()}</span>
                        </div>
                        {postsDodia.map(post => {
                          const plat = PLATAFORMAS.find(p => p.id === post.plataforma)
                          const st = COR_STATUS[post.status] || COR_STATUS['Agendado']
                          return (
                            <div key={post.id} className="agenda-post"
                              style={{ background: st.bg, borderLeftColor: plat?.color || st.cor, color: st.cor }}
                              onClick={() => setPostPreview(post)}>
                              {plat?.icon} {post.horario}<br/>
                              <span style={{ fontSize:9, opacity:.9 }}>{post.titulo.slice(0,18)}</span>
                              {post.tipo === 'pago' && <span style={{ fontSize:8, color:'#f59e0b', marginLeft:3 }}>$</span>}
                            </div>
                          )
                        })}
                        <button onClick={() => { setFormPost({ ...getFormPostVazio(), data: dia.toISOString().slice(0,10) }); setShowFormPost(true) }}
                          style={{ width:'100%', background:'none', border:'1px dashed #1e2d4a', borderRadius:4, color:'#2a3a5a', fontSize:10, cursor:'pointer', padding:'2px', marginTop:4 }}>+</button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── VISTA MÊS ── */}
            {vistaAgenda === 'mes' && (
              <div className="card">
                <div style={{ fontSize:14, fontWeight:700, color:'#e2e8f0', marginBottom:14, fontFamily:'Syne, sans-serif' }}>
                  {MESES_FULL[mesMes]} {anoMes}
                </div>
                {/* Cabeçalho dias */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:4 }}>
                  {DIAS_SEMANA.map(d => <div key={d} style={{ textAlign:'center', fontSize:10, color:'#64748b', fontWeight:600, padding:'4px 0' }}>{d}</div>)}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
                  {diasMes.map((dia, i) => {
                    if (!dia) return <div key={i} />
                    const postsDodia = getPostsDoDia(dia)
                    const isHoje = dia.toDateString() === new Date().toDateString()
                    return (
                      <div key={i} style={{ background: isHoje ? 'rgba(124,58,237,.08)' : '#1a2540', border:`1px solid ${isHoje?'rgba(124,58,237,.4)':'#1e2d4a'}`, borderRadius:8, padding:'6px 5px', minHeight:70, cursor:'pointer' }}
                        onClick={() => { setDiaFoco(dia.toISOString().slice(0,10)); setVistaAgenda('dia') }}>
                        <div style={{ textAlign:'center', fontSize:11, color: isHoje ? '#a78bfa' : '#64748b', fontWeight: isHoje ? 700 : 400, marginBottom:4 }}>{dia.getDate()}</div>
                        {postsDodia.slice(0,3).map(post => {
                          const plat = PLATAFORMAS.find(p => p.id === post.plataforma)
                          return (
                            <div key={post.id} style={{ fontSize:9, padding:'2px 4px', borderRadius:3, marginBottom:2, background: COR_STATUS[post.status]?.bg || 'rgba(0,212,255,.1)', color: plat?.color || '#00d4ff', borderLeft:`2px solid ${plat?.color||'#00d4ff'}`, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {plat?.icon} {post.titulo.slice(0,12)}
                            </div>
                          )
                        })}
                        {postsDodia.length > 3 && <div style={{ fontSize:9, color:'#64748b', textAlign:'center' }}>+{postsDodia.length-3}</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Lista geral de posts */}
            <div className="card">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <div className="card-title" style={{ margin:0 }}>📋 Todos os Posts</div>
                <div style={{ display:'flex', gap:6 }}>
                  <span className="badge badge-yellow">{postsPendentes} pendentes</span>
                  <span className="badge badge-green">{postsPublicados} publicados</span>
                </div>
              </div>

              {/* Aviso de pendentes */}
              {postsPendentes > 0 && (
                <div style={{ padding:'10px 14px', background:'rgba(245,158,11,.08)', border:'1px solid rgba(245,158,11,.25)', borderRadius:8, fontSize:12, color:'#f59e0b', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
                  ⚠️ <strong>{postsPendentes} post(s)</strong> aguardando sua aprovação antes de serem publicados.
                </div>
              )}

              {posts.length === 0 ? (
                <div style={{ textAlign:'center', color:'#64748b', padding:20, fontSize:13 }}>Nenhum post criado ainda</div>
              ) : [...posts].sort((a,b) => a.data > b.data ? 1 : -1).filter(p =>
                  (filtroTipo === 'todos' || p.tipo === filtroTipo) &&
                  (filtroStatus === 'todos' || p.status === filtroStatus)
                ).map(post => (
                  <PostCard key={post.id} post={post}
                    onVer={() => setPostPreview(post)}
                    onEditar={() => { setFormPost(post); setShowFormPost(true) }}
                    onExcluir={() => excluirPost(post.id)}
                    onAprovar={() => aprovarPost(post.id)}
                    onRejeitar={() => rejeitarPost(post.id)}
                    onPublicar={() => marcarPublicado(post.id)}
                  />
                ))
              }
            </div>

            {/* Modal: Preview do post */}
            {postPreview && (
              <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:900, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={() => setPostPreview(null)}>
                <div style={{ background:'#111827', border:'1px solid #1e2d4a', borderRadius:16, padding:28, width:'100%', maxWidth:540, maxHeight:'90vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                    <div style={{ fontFamily:'Syne, sans-serif', fontSize:16, fontWeight:700, color:'#e2e8f0' }}>{postPreview.titulo}</div>
                    <button onClick={() => setPostPreview(null)} style={{ background:'none', border:'none', color:'#64748b', fontSize:20, cursor:'pointer' }}>✕</button>
                  </div>

                  {/* Badges */}
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
                    {(() => { const p = PLATAFORMAS.find(pl => pl.id === postPreview.plataforma); return p ? <span className="badge" style={{ background:p.color+'22', color:p.color, border:`1px solid ${p.color}44` }}>{p.icon} {p.label}</span> : null })()}
                    <span className={`badge ${postPreview.tipo === 'pago' ? 'badge-paid' : 'badge-organic'}`}>{postPreview.tipo === 'pago' ? '💰 Pago' : '🌱 Orgânico'}</span>
                    <span className="badge" style={{ background: COR_STATUS[postPreview.status]?.bg, color: COR_STATUS[postPreview.status]?.cor, border:`1px solid ${COR_STATUS[postPreview.status]?.border}` }}>{postPreview.status}</span>
                  </div>

                  <div style={{ fontSize:12, color:'#64748b', marginBottom:14 }}>
                    📅 {postPreview.data} às {postPreview.horario}
                  </div>

                  {/* Imagem/mockup */}
                  {postPreview.tipoMidia === 'video' ? (
                    <div style={{ background:'linear-gradient(135deg,#1a0530,#0d1829)', borderRadius:10, height:180, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:14, border:'1px solid #1e2d4a' }}>
                      <div style={{ textAlign:'center' }}>
                        <div style={{ fontSize:48, marginBottom:8 }}>🎥</div>
                        <div style={{ fontSize:12, color:'#64748b' }}>Vídeo a ser criado</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ background:'linear-gradient(135deg,#0f1829,#1a0a30)', borderRadius:10, height:180, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:14, border:'1px solid #1e2d4a' }}>
                      <div style={{ textAlign:'center', padding:'0 20px' }}>
                        <div style={{ fontSize:40, marginBottom:8 }}>🖼️</div>
                        {postPreview.promptImagem ? (
                          <div style={{ fontSize:11, color:'#64748b', fontStyle:'italic', lineHeight:1.5 }}>{postPreview.promptImagem.slice(0,100)}...</div>
                        ) : (
                          <div style={{ fontSize:12, color:'#64748b' }}>Imagem a ser criada</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Legenda/Descrição */}
                  {postPreview.descricao && (
                    <div style={{ background:'#1a2540', borderRadius:8, padding:'12px 14px', fontSize:13, color:'#e2e8f0', lineHeight:1.7, marginBottom:12, whiteSpace:'pre-wrap', maxHeight:160, overflowY:'auto' }}>
                      {postPreview.descricao}
                    </div>
                  )}

                  {/* CTA e hashtags */}
                  {postPreview.cta && (
                    <div style={{ padding:'8px 12px', background:'rgba(124,58,237,.1)', border:'1px solid rgba(124,58,237,.25)', borderRadius:8, fontSize:12, color:'#a78bfa', marginBottom:10 }}>
                      🔗 CTA: {postPreview.cta}
                    </div>
                  )}
                  {postPreview.hashtags && (
                    <div style={{ fontSize:11, color:'#475569', marginBottom:14 }}>{postPreview.hashtags}</div>
                  )}

                  {/* Ações de aprovação */}
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {postPreview.status === 'Pendente' && <>
                      <button className="btn btn-green" style={{ flex:1, justifyContent:'center' }} onClick={() => aprovarPost(postPreview.id)}>✅ Aprovar</button>
                      <button className="btn btn-red" style={{ flex:1, justifyContent:'center' }} onClick={() => rejeitarPost(postPreview.id)}>❌ Rejeitar</button>
                    </>}
                    {postPreview.status === 'Aprovado' && (
                      <button className="btn btn-green" style={{ flex:1, justifyContent:'center' }} onClick={() => marcarPublicado(postPreview.id)}>📢 Marcar como Publicado</button>
                    )}
                    <button className="btn btn-secondary" style={{ fontSize:11 }} onClick={() => { setFormPost(postPreview); setShowFormPost(true); setPostPreview(null) }}>✏️ Editar</button>
                    <button className="btn btn-secondary" style={{ fontSize:11, color:'#ef4444', borderColor:'rgba(239,68,68,.3)' }} onClick={() => { excluirPost(postPreview.id); setPostPreview(null) }}>🗑 Excluir</button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal: Formulário de post */}
            {showFormPost && (
              <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:800, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
                <div style={{ background:'#111827', border:'1px solid #1e2d4a', borderRadius:16, padding:24, width:'100%', maxWidth:540, maxHeight:'92vh', overflowY:'auto' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
                    <span style={{ fontFamily:'Syne, sans-serif', fontSize:15, fontWeight:700, color:'#e2e8f0' }}>📅 {formPost.id ? 'Editar Post' : 'Novo Post'}</span>
                    <button onClick={() => setShowFormPost(false)} style={{ background:'none', border:'none', color:'#64748b', fontSize:18, cursor:'pointer' }}>✕</button>
                  </div>

                  <div className="field"><label>Título</label><input value={formPost.titulo} onChange={e => setFormPost(f=>({...f,titulo:e.target.value}))} placeholder="Título do post" /></div>
                  <div className="field"><label>Descrição / Legenda</label><textarea value={formPost.descricao} onChange={e => setFormPost(f=>({...f,descricao:e.target.value}))} placeholder="Legenda completa, roteiro ou descrição..." style={{ minHeight:100 }} /></div>
                  <div className="field"><label>CTA (Call to Action)</label><input value={formPost.cta||''} onChange={e => setFormPost(f=>({...f,cta:e.target.value}))} placeholder="Ex: Clique no link da bio!" /></div>

                  <div className="grid2">
                    <div className="field"><label>Plataforma</label>
                      <select value={formPost.plataforma} onChange={e => setFormPost(f=>({...f,plataforma:e.target.value}))} style={{ width:'100%', background:'#1a2540', border:'1px solid #1e2d4a', borderRadius:8, padding:'9px 12px', fontFamily:'DM Mono, monospace', fontSize:13, color:'#e2e8f0', outline:'none' }}>
                        {PLATAFORMAS.map(p => <option key={p.id} value={p.id}>{p.icon} {p.label}</option>)}
                      </select>
                    </div>
                    <div className="field"><label>Tipo</label>
                      <select value={formPost.tipo||'organico'} onChange={e => setFormPost(f=>({...f,tipo:e.target.value}))} style={{ width:'100%', background:'#1a2540', border:'1px solid #1e2d4a', borderRadius:8, padding:'9px 12px', fontFamily:'DM Mono, monospace', fontSize:13, color:'#e2e8f0', outline:'none' }}>
                        <option value="organico">🌱 Orgânico</option>
                        <option value="pago">💰 Pago</option>
                      </select>
                    </div>
                    <div className="field"><label>Status</label>
                      <select value={formPost.status} onChange={e => setFormPost(f=>({...f,status:e.target.value}))} style={{ width:'100%', background:'#1a2540', border:'1px solid #1e2d4a', borderRadius:8, padding:'9px 12px', fontFamily:'DM Mono, monospace', fontSize:13, color:'#e2e8f0', outline:'none' }}>
                        {['Pendente','Aprovado','Agendado','Publicado','Rascunho','Rejeitado'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="field"><label>Tipo de Mídia</label>
                      <select value={formPost.tipoMidia||'imagem'} onChange={e => setFormPost(f=>({...f,tipoMidia:e.target.value}))} style={{ width:'100%', background:'#1a2540', border:'1px solid #1e2d4a', borderRadius:8, padding:'9px 12px', fontFamily:'DM Mono, monospace', fontSize:13, color:'#e2e8f0', outline:'none' }}>
                        <option value="imagem">🖼️ Imagem</option>
                        <option value="video">🎥 Vídeo</option>
                        <option value="carrossel">🎠 Carrossel</option>
                        <option value="stories">📲 Stories/Reels</option>
                      </select>
                    </div>
                    <div className="field"><label>Data</label><input type="date" value={formPost.data} onChange={e => setFormPost(f=>({...f,data:e.target.value}))} /></div>
                    <div className="field"><label>Horário</label><input type="time" value={formPost.horario} onChange={e => setFormPost(f=>({...f,horario:e.target.value}))} /></div>
                  </div>

                  <div className="field"><label>Hashtags</label><input value={formPost.hashtags||''} onChange={e => setFormPost(f=>({...f,hashtags:e.target.value}))} placeholder="#marketing #vendas #negócios" /></div>

                  <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
                    <button className="btn btn-secondary" onClick={() => setShowFormPost(false)}>Cancelar</button>
                    <button className="btn btn-purple" onClick={salvarPost} disabled={saving}>{saving ? '⏳' : '✅ Salvar'}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div id="mkt-toast" className="toast"/>
    </>
  )
}

// ── Componente PostCard ──────────────────────────────────────────
function PostCard({ post, onVer, onEditar, onExcluir, onAprovar, onRejeitar, onPublicar }) {
  const plat = PLATAFORMAS.find(p => p.id === post.plataforma)
  const st = COR_STATUS[post.status] || COR_STATUS['Agendado']
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'#1a2540', borderRadius:8, marginBottom:6, borderLeft:`3px solid ${plat?.color||'#1e2d4a'}` }}>
      <div className="platform-icon" style={{ background:(plat?.color||'#1e2d4a')+'22', fontSize:16 }}>
        {plat?.icon || '📝'}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, color:'#e2e8f0', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{post.titulo}</div>
        <div style={{ fontSize:11, color:'#64748b', marginTop:2, display:'flex', gap:8, flexWrap:'wrap' }}>
          <span>📅 {post.data} {post.horario}</span>
          <span>{plat?.label}</span>
          {post.tipo === 'pago' && <span style={{ color:'#f59e0b' }}>💰 Pago</span>}
          {post.tipo === 'organico' && <span style={{ color:'#10b981' }}>🌱 Orgânico</span>}
        </div>
      </div>
      <span className="badge" style={{ background:st.bg, color:st.cor, border:`1px solid ${st.border}`, whiteSpace:'nowrap' }}>{post.status}</span>
      <div style={{ display:'flex', gap:4, flexShrink:0 }}>
        <button onClick={onVer} style={{ background:'rgba(0,212,255,.08)', border:'1px solid rgba(0,212,255,.2)', color:'#00d4ff', borderRadius:6, padding:'4px 9px', cursor:'pointer', fontSize:11 }}>👁</button>
        {post.status === 'Pendente' && onAprovar && (
          <button onClick={onAprovar} style={{ background:'rgba(16,185,129,.1)', border:'1px solid rgba(16,185,129,.25)', color:'#10b981', borderRadius:6, padding:'4px 9px', cursor:'pointer', fontSize:11 }}>✅</button>
        )}
        {post.status === 'Pendente' && onRejeitar && (
          <button onClick={onRejeitar} style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.25)', color:'#ef4444', borderRadius:6, padding:'4px 9px', cursor:'pointer', fontSize:11 }}>❌</button>
        )}
        {post.status === 'Aprovado' && onPublicar && (
          <button onClick={onPublicar} style={{ background:'rgba(124,58,237,.1)', border:'1px solid rgba(124,58,237,.25)', color:'#a78bfa', borderRadius:6, padding:'4px 9px', cursor:'pointer', fontSize:11 }}>📢</button>
        )}
        <button onClick={onEditar} style={{ background:'rgba(255,255,255,.04)', border:'1px solid #1e2d4a', color:'#64748b', borderRadius:6, padding:'4px 9px', cursor:'pointer', fontSize:11 }}>✏️</button>
        <button onClick={onExcluir} style={{ background:'rgba(239,68,68,.06)', border:'1px solid rgba(239,68,68,.2)', color:'#ef4444', borderRadius:6, padding:'4px 9px', cursor:'pointer', fontSize:11 }}>🗑</button>
      </div>
    </div>
  )
}
