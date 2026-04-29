// pages/marketing.js — Marketing Vivanexa SaaS v3
// =================================================
// ✅ FIX: botão "Ver" campanhas anteriores agora exibe o conteúdo corretamente
// ✅ NOVO: Integração Meta Ads API (campanha paga Instagram/Facebook)
// ✅ NOVO: Integração Google Ads API (campanha paga Google)
// ✅ NOVO: Integração TikTok Ads API (campanha paga TikTok)
// ✅ NOVO: Geração de imagem real via Stable Diffusion / Hugging Face (grátis)
// ✅ NOVO: Publicação orgânica Instagram via Graph API
// ✅ NOVO: Publicação orgânica Facebook via Graph API
// ✅ NOVO: Publicação orgânica TikTok via Content Posting API
// ✅ NOVO: Fluxo completo Aprovar / Recriar / Editar em todas as etapas 
// ✅ NOVO: Campanhas exibem imagem gerada + todos os dados
// ✅ NOVO: Agenda integrada com campanhas e imagens geradas
// ✅ Agente Gestor de Marketing IA em todas as abas
// =================================================

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

// ─────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────
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
  .btn-green:hover{box-shadow:0 0 16px rgba(16,185,129,.4)}
  .btn-red{background:linear-gradient(135deg,#ef4444,#b91c1c);color:#fff}
  .btn-gold{background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff}
  .btn-meta{background:linear-gradient(135deg,#1877f2,#0d4fa8);color:#fff}
  .btn-google{background:linear-gradient(135deg,#4285f4,#2b5fbb);color:#fff}
  .btn-tiktok{background:linear-gradient(135deg,#ff0050,#c0003d);color:#fff}
  .btn:disabled{opacity:.5;cursor:not-allowed;transform:none!important}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
  @media(max-width:768px){.grid2,.grid3{grid-template-columns:1fr}}
  .badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:.5px}
  .badge-blue{background:rgba(0,212,255,.15);color:var(--accent);border:1px solid rgba(0,212,255,.3)}
  .badge-purple{background:rgba(124,58,237,.15);color:#a78bfa;border:1px solid rgba(124,58,237,.3)}
  .badge-green{background:rgba(16,185,129,.15);color:var(--accent3);border:1px solid rgba(16,185,129,.3)}
  .badge-yellow{background:rgba(245,158,11,.15);color:var(--gold);border:1px solid rgba(245,158,11,.3)}
  .badge-red{background:rgba(239,68,68,.15);color:#ef4444;border:1px solid rgba(239,68,68,.3)}
  .tag-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
  .tag{padding:5px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:20px;
    font-size:11px;color:var(--muted);cursor:pointer;transition:all .12s}
  .tag:hover,.tag.active{background:rgba(124,58,237,.12);border-color:rgba(124,58,237,.45);color:#a78bfa}
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
  .stat-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 20px;flex:1;min-width:130px}
  .stat-val{font-family:'Syne',sans-serif;font-size:24px;font-weight:800;color:var(--accent2)}
  .stat-label{font-size:11px;color:var(--muted);margin-top:2px}
  .chat-area{background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:14px;
    min-height:200px;max-height:320px;overflow-y:auto;display:flex;flex-direction:column;gap:10px}
  .chat-msg{max-width:84%;padding:10px 14px;border-radius:12px;font-size:13px;line-height:1.6;white-space:pre-wrap}
  .chat-msg.bot{align-self:flex-start;background:rgba(124,58,237,.12);border:1px solid rgba(124,58,237,.25);color:var(--text)}
  .chat-msg.user{align-self:flex-end;background:rgba(0,212,255,.1);border:1px solid rgba(0,212,255,.25);color:var(--text)}
  .chat-input-row{display:flex;gap:8px;margin-top:10px}
  .chat-input-row input{flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:8px;
    padding:9px 12px;font-family:'DM Mono',monospace;font-size:13px;color:var(--text);outline:none}
  .chat-input-row input:focus{border-color:var(--accent2)}
  .img-preview{width:100%;max-height:280px;object-fit:cover;border-radius:10px;border:1px solid var(--border)}
  .img-placeholder{width:100%;height:220px;border-radius:10px;border:1px dashed var(--border);
    display:flex;align-items:center;justify-content:center;font-size:40px;background:linear-gradient(135deg,#0f1829,#1a0a30)}
  .platform-pill{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:20px;
    font-size:11px;font-weight:600;cursor:pointer;border:1px solid transparent;transition:all .14s}
  .agenda-grid-week{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
  .agenda-grid-month{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}
  .agenda-day{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:7px;min-height:90px}
  .agenda-post-pill{border-radius:4px;padding:3px 6px;font-size:9px;margin-bottom:2px;cursor:pointer;
    border-left:2px solid;line-height:1.4;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
  .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:800;display:flex;align-items:center;justify-content:center;padding:16px}
  .modal-box{background:#111827;border:1px solid #1e2d4a;border-radius:16px;padding:28px;width:100%;max-width:560px;max-height:92vh;overflow-y:auto}
  .section-sep{height:1px;background:var(--border);margin:20px 0}
  .info-box{padding:12px 16px;border-radius:10px;font-size:12px;line-height:1.7;margin-bottom:12px}
`

// ─────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────
const NICHOS = ['Contabilidade','E-commerce','Saúde','Educação','Imóveis','Restaurante','Tecnologia','Beleza','Fitness','Jurídico','Varejo','Serviços','Outro']
const PLATAFORMAS = [
  { id:'instagram', label:'Instagram', icon:'📸', color:'#e1306c', organic:true,  paid:true  },
  { id:'facebook',  label:'Facebook',  icon:'👥', color:'#1877f2', organic:true,  paid:true  },
  { id:'tiktok',    label:'TikTok',    icon:'🎵', color:'#ff0050', organic:true,  paid:true  },
  { id:'google',    label:'Google Ads',icon:'🔍', color:'#4285f4', organic:false, paid:true  },
  { id:'whatsapp',  label:'WhatsApp',  icon:'💬', color:'#25d366', organic:true,  paid:false },
]
const DIAS_SEMANA  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const MESES_FULL   = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const COR_STATUS   = {
  'Agendado':  { bg:'rgba(0,212,255,.1)',   cor:'#00d4ff',  border:'rgba(0,212,255,.3)' },
  'Publicado': { bg:'rgba(16,185,129,.1)',  cor:'#10b981',  border:'rgba(16,185,129,.3)' },
  'Pendente':  { bg:'rgba(245,158,11,.1)',  cor:'#f59e0b',  border:'rgba(245,158,11,.3)' },
  'Aprovado':  { bg:'rgba(124,58,237,.1)',  cor:'#a78bfa',  border:'rgba(124,58,237,.3)' },
  'Rejeitado': { bg:'rgba(239,68,68,.1)',   cor:'#ef4444',  border:'rgba(239,68,68,.3)' },
  'Rascunho':  { bg:'rgba(100,116,139,.1)', cor:'#64748b',  border:'rgba(100,116,139,.3)' },
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
function toast(msg, type = 'ok') {
  const el = document.getElementById('mkt-toast')
  if (!el) return
  el.textContent = msg
  el.style.background = type === 'ok' ? 'rgba(16,185,129,.92)' : type === 'warn' ? 'rgba(245,158,11,.92)' : 'rgba(239,68,68,.92)'
  el.style.color = '#fff'; el.style.opacity = '1'; el.style.transform = 'translateY(0)'
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(20px)' }, 3500)
}

async function callAI(prompt, cfg, { temperature=0.7, maxTokens=2500, history=[], systemPrompt='' }={}) {
  const openaiKey = cfg.openaiApiKey || cfg.openaiKey || ''
  const geminiKey = cfg.geminiApiKey || cfg.geminiKey || ''
  const groqKey   = cfg.groqApiKey   || cfg.groqKey   || ''
  if (!openaiKey && !geminiKey && !groqKey) throw new Error('Nenhuma chave de IA configurada. Acesse Configurações → Empresa.')

  if (openaiKey) {
    try {
      const messages = []
      if (systemPrompt) messages.push({ role:'system', content:systemPrompt })
      messages.push(...history)
      messages.push({ role:'user', content:prompt })
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method:'POST', headers:{ 'Authorization':`Bearer ${openaiKey}`, 'Content-Type':'application/json' },
        body:JSON.stringify({ model:'gpt-4o-mini', messages, temperature, max_tokens:maxTokens })
      })
      const d = await res.json(); const r = d.choices?.[0]?.message?.content; if (r) return r
    } catch {}
  }
  if (geminiKey) {
    try {
      const parts = []
      if (systemPrompt) parts.push({ text:systemPrompt+'\n\n' })
      history.forEach(h => parts.push({ text:(h.role==='user'?'Usuário: ':'Assistente: ')+h.content+'\n' }))
      parts.push({ text:prompt })
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ contents:[{ parts }], generationConfig:{ temperature, maxOutputTokens:maxTokens } })
      })
      const d = await res.json(); const r = d.candidates?.[0]?.content?.parts?.[0]?.text; if (r) return r
    } catch {}
  }
  if (groqKey) {
    const messages = []; if (systemPrompt) messages.push({ role:'system', content:systemPrompt })
    messages.push(...history); messages.push({ role:'user', content:prompt })
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:'POST', headers:{ 'Authorization':`Bearer ${groqKey}`, 'Content-Type':'application/json' },
      body:JSON.stringify({ model:'llama3-70b-8192', messages, temperature })
    })
    const d = await res.json(); const r = d.choices?.[0]?.message?.content; if (r) return r
  }
  throw new Error('Nenhuma IA respondeu. Verifique as chaves em Configurações → Empresa.')
}

// ─────────────────────────────────────────────────────────────────
// Geração de imagem via Cloudflare Workers AI (sem CORS, gratuito)
// Configure em: Configurações → Integrações → cloudflareImageWorkerUrl
// Modelo padrão: FLUX.1 schnell (rápido e grátis)
// Fallback: OpenAI DALL-E 3 (se houver openaiApiKey)
// ─────────────────────────────────────────────────────────────────
async function gerarImagemHF(prompt, cfg) {
  // ── 1. Cloudflare Workers AI (preferencial — sem CORS) ────────
  const workerUrl = (cfg.cloudflareImageWorkerUrl || '').trim()
  if (workerUrl) {
    try {
      const headers = { 'Content-Type': 'application/json' }
      const apiSecret = cfg.cloudflareWorkerSecret || ''
      if (apiSecret) headers['X-Api-Key'] = apiSecret
      const res = await fetch(workerUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt, model: 'flux', steps: 6 })
      })
      if (res.ok) {
        const d = await res.json()
        if (d?.image) return d.image   // data:image/png;base64,...
      }
    } catch { /* tenta próximo */ }
  }
  // ── 2. OpenAI DALL-E 3 (fallback, usa créditos da conta) ──────
  const openaiKey = cfg.openaiApiKey || cfg.openaiKey || ''
  if (openaiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'dall-e-3', prompt: prompt.slice(0, 1000), n: 1, size: '1024x1024', response_format: 'b64_json' })
      })
      if (res.ok) {
        const d = await res.json()
        const b64 = d?.data?.[0]?.b64_json
        if (b64) return `data:image/png;base64,${b64}`
      }
    } catch { /* sem fallback */ }
  }
  return null   // nenhum gerador disponível
}

// System prompt do Agente Gestor de Marketing
function gestorPrompt(cfg, cores) {
  const paleta = cores
    ? `Paleta de cores da marca: Primária ${cores.primaria}, Secundária ${cores.secundaria}, Acento ${cores.acento}.`
    : ''
  return `Você é um Gestor de Marketing Digital Sênior e especialista em:
- Growth Hacking e alta conversão em vendas
- Gestão de tráfego pago (Meta Ads, Google Ads, TikTok Ads)
- Copywriting persuasivo e storytelling
- Criação de conteúdo orgânico de alta performance
- Estratégia de branding e posicionamento
- Análise de métricas e ROI

Empresa: ${cfg.company||'Vivanexa'} | Nicho: ${cfg.nicho||'Tecnologia'}
${paleta}
Sempre use a identidade visual e paleta de cores da empresa nos criativos sugeridos.
Responda sempre em português, de forma prática e orientada a resultados.`
}

// ─────────────────────────────────────────────────────────────────
// Componente: Chat com Agente IA de Marketing
// ─────────────────────────────────────────────────────────────────
function AgenteChat({ cfg, contexto='', cores }) {
  const [msgs, setMsgs] = useState([{ role:'bot', content:`Olá! Sou seu Gestor de Marketing IA 🚀\n\n${contexto||'Como posso ajudar com sua estratégia hoje?'}` }])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const endRef = useRef(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior:'smooth' }) }, [msgs])
  async function enviar() {
    if (!input.trim()||thinking) return
    const msg = input.trim(); setInput('')
    setMsgs(p => [...p, { role:'user', content:msg }])
    setThinking(true)
    const hist = msgs.slice(-8).map(m => ({ role:m.role==='user'?'user':'assistant', content:m.content }))
    try {
      const r = await callAI(msg, cfg, { temperature:0.75, systemPrompt:gestorPrompt(cfg, cores), history:hist })
      setMsgs(p => [...p, { role:'bot', content:r }])
    } catch(e) { setMsgs(p => [...p, { role:'bot', content:`❌ ${e.message}` }]) }
    setThinking(false)
  }
  return (
    <div className="card" style={{ borderColor:'rgba(124,58,237,.3)', background:'rgba(124,58,237,.03)' }}>
      <div className="card-title">🧠 Agente Gestor de Marketing IA</div>
      <div className="chat-area">
        {msgs.map((m,i) => <div key={i} className={`chat-msg ${m.role}`}>{m.content}</div>)}
        {thinking && <div className="chat-msg bot"><div className="thinking"><span/><span/><span/></div></div>}
        <div ref={endRef}/>
      </div>
      <div className="chat-input-row">
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&enviar()}
          placeholder="Pergunte ao Gestor de Marketing IA..." disabled={thinking}/>
        <button className="btn btn-purple" onClick={enviar} disabled={thinking||!input.trim()}>{thinking?'⏳':'➤'}</button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Componente: Card de campanha anterior com visualização correta
// ─────────────────────────────────────────────────────────────────
function CampanhaAnteriorCard({ c, onVer, onDuplicar }) {
  const plats = (c.plataformas||[]).map(pid => PLATAFORMAS.find(p=>p.id===pid)).filter(Boolean)
  return (
    <div style={{ padding:'14px 16px', background:'#1a2540', borderRadius:10, marginBottom:8, border:'1px solid #1e2d4a' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, color:'#e2e8f0', fontWeight:700, marginBottom:4 }}>{c.produto||c._produto||'Campanha'}</div>
          <div style={{ fontSize:11, color:'#64748b', display:'flex', gap:10, flexWrap:'wrap' }}>
            <span>📅 {c.criadoEm ? new Date(c.criadoEm).toLocaleDateString('pt-BR') : '—'}</span>
            <span>{c.nicho||c._nicho||''}</span>
            <span>{c.objetivo||c._objetivo||''}</span>
          </div>
          <div style={{ display:'flex', gap:5, marginTop:6, flexWrap:'wrap' }}>
            {plats.map(p => <span key={p.id} style={{ padding:'2px 8px', borderRadius:20, fontSize:9, fontWeight:700, background:p.color+'22', color:p.color, border:`1px solid ${p.color}44` }}>{p.icon} {p.label}</span>)}
            <span className={`badge ${c.status==='Aprovada'?'badge-green':'badge-blue'}`}>{c.status||'Gerada'}</span>
          </div>
          {/* Thumbnail da imagem se existir */}
          {(c.imagemUrl||c.resultado?.imagemUrl) && (
            <img src={c.imagemUrl||c.resultado?.imagemUrl} alt="criativo"
              style={{ height:50, borderRadius:6, marginTop:8, border:'1px solid #1e2d4a', objectFit:'cover' }}
              onError={e=>e.target.style.display='none'} />
          )}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:6, flexShrink:0 }}>
          <button className="btn btn-secondary" style={{ fontSize:10, padding:'5px 12px' }} onClick={() => onVer(c)}>👁 Ver</button>
          <button className="btn btn-secondary" style={{ fontSize:10, padding:'5px 12px' }} onClick={() => onDuplicar(c)}>🔄 Duplicar</button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Componente: Modal de visualização completa da campanha
// ─────────────────────────────────────────────────────────────────
function CampanhaModal({ campanha, onClose, onAprovar, onRecriar, onEditar }) {
  if (!campanha) return null
  // Suporta tanto o formato antigo (resultado=string) quanto novo (resultado=objeto)
  const res = campanha.resultado
  const isString = typeof res === 'string'
  const resumo      = isString ? res : (res?.resumo || '')
  const publicoAlvo = isString ? '' : (res?.publicoAlvo || '')
  const copies      = isString ? [] : (res?.copies || []).filter(c=>c?.texto)
  const kpis        = isString ? [] : (res?.kpis || []).filter(k=>k?.valor)
  const calendario  = isString ? [] : (res?.calendario || [])
  const imagemUrl   = campanha.imagemUrl || res?.imagemUrl || ''
  const plataformas = isString ? {} : (res?.plataformas || {})

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal-box" onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div style={{ fontFamily:'Syne,sans-serif', fontSize:16, fontWeight:700, color:'#e2e8f0' }}>
            {campanha.produto||campanha._produto||'Campanha'}
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#64748b', fontSize:20, cursor:'pointer' }}>✕</button>
        </div>

        {/* Badges */}
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
          {(campanha.plataformas||[]).map(pid => { const p=PLATAFORMAS.find(x=>x.id===pid); return p ? <span key={pid} style={{ padding:'3px 9px', borderRadius:20, fontSize:10, fontWeight:700, background:p.color+'22', color:p.color, border:`1px solid ${p.color}44` }}>{p.icon} {p.label}</span> : null })}
          <span className={`badge ${campanha.status==='Aprovada'?'badge-green':'badge-blue'}`}>{campanha.status||'Gerada'}</span>
          {campanha.nicho && <span className="badge badge-purple">{campanha.nicho}</span>}
        </div>

        {/* Imagem do criativo se existir */}
        {imagemUrl && (
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, color:'#64748b', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>🖼️ Criativo Gerado</div>
            <img src={imagemUrl} alt="criativo" className="img-preview" onError={e=>e.target.style.display='none'} />
          </div>
        )}

        {/* Resumo / conteúdo */}
        {resumo && (
          <div>
            <div style={{ fontSize:11, color:'#64748b', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>📊 Plano da Campanha</div>
            <div style={{ background:'rgba(0,0,0,.2)', borderRadius:10, padding:'14px 16px', fontSize:13, color:'#94a3b8', lineHeight:1.8, whiteSpace:'pre-wrap', maxHeight:300, overflowY:'auto' }}>
              {resumo}
            </div>
          </div>
        )}

        {/* Público */}
        {publicoAlvo && (
          <div style={{ marginTop:14 }}>
            <div style={{ fontSize:11, color:'#64748b', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>🎯 Público-Alvo</div>
            <div style={{ padding:'10px 14px', background:'rgba(0,212,255,.06)', border:'1px solid rgba(0,212,255,.15)', borderRadius:8, fontSize:12, color:'#94a3b8' }}>{publicoAlvo}</div>
          </div>
        )}

        {/* Por plataforma */}
        {Object.keys(plataformas).length > 0 && (
          <div style={{ marginTop:14 }}>
            <div style={{ fontSize:11, color:'#64748b', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>📱 Por Plataforma</div>
            {Object.entries(plataformas).map(([pid, pd]) => {
              const plat = PLATAFORMAS.find(p=>p.id===pid)
              if (!plat||!pd) return null
              return (
                <div key={pid} style={{ border:`1px solid ${plat.color}33`, borderRadius:8, padding:'12px 14px', marginBottom:8, background:`${plat.color}08` }}>
                  <div style={{ fontWeight:700, color:plat.color, fontSize:12, marginBottom:8 }}>{plat.icon} {plat.label}</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:12 }}>
                    {pd.headline && <div><div style={{ color:'#64748b', fontSize:10 }}>HEADLINE</div><div style={{ color:'#e2e8f0' }}>{pd.headline}</div></div>}
                    {pd.cta && <div><div style={{ color:'#64748b', fontSize:10 }}>CTA</div><div style={{ color:'#a78bfa', fontWeight:600 }}>{pd.cta}</div></div>}
                    {pd.copy && <div style={{ gridColumn:'1/-1' }}><div style={{ color:'#64748b', fontSize:10 }}>COPY</div><div style={{ color:'#94a3b8', lineHeight:1.6 }}>{pd.copy}</div></div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Copies */}
        {copies.length > 0 && (
          <div style={{ marginTop:14 }}>
            <div style={{ fontSize:11, color:'#64748b', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>🔥 Copies de Alta Conversão</div>
            {copies.map((c,i) => (
              <div key={i} style={{ background:'rgba(124,58,237,.08)', borderRadius:8, padding:'10px 12px', marginBottom:6, borderLeft:'3px solid #7c3aed' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#a78bfa', marginBottom:4 }}>{c.titulo}</div>
                <div style={{ fontSize:12, color:'#94a3b8' }}>{c.texto}</div>
                <button onClick={()=>navigator.clipboard.writeText(c.texto)} style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer', fontSize:10, marginTop:4 }}>📋 Copiar</button>
              </div>
            ))}
          </div>
        )}

        {/* KPIs */}
        {kpis.length > 0 && (
          <div style={{ marginTop:14 }}>
            <div style={{ fontSize:11, color:'#64748b', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>📈 KPIs Esperados</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8 }}>
              {kpis.map((k,i) => (
                <div key={i} style={{ background:'rgba(0,212,255,.06)', border:'1px solid rgba(0,212,255,.15)', borderRadius:8, padding:'8px 12px' }}>
                  <div style={{ fontSize:10, color:'#64748b' }}>{k.metrica}</div>
                  <div style={{ fontSize:16, fontWeight:700, color:'#00d4ff' }}>{k.valor}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ações */}
        <div style={{ display:'flex', gap:8, marginTop:20, flexWrap:'wrap' }}>
          {campanha.status !== 'Aprovada' && (
            <button className="btn btn-green" style={{ flex:1, justifyContent:'center' }} onClick={() => onAprovar(campanha)}>✅ Aprovar</button>
          )}
          <button className="btn btn-purple" style={{ flex:1, justifyContent:'center' }} onClick={() => onRecriar(campanha)}>🔄 Recriar</button>
          <button className="btn btn-secondary" style={{ flex:1, justifyContent:'center' }} onClick={() => onEditar(campanha)}>✏️ Editar</button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Componente: PostCard na lista da agenda
// ─────────────────────────────────────────────────────────────────
function PostCard({ post, onVer, onEditar, onExcluir, onAprovar, onRejeitar, onPublicar }) {
  const plat = PLATAFORMAS.find(p=>p.id===post.plataforma)
  const st = COR_STATUS[post.status] || COR_STATUS['Agendado']
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'#1a2540', borderRadius:8, marginBottom:6, borderLeft:`3px solid ${plat?.color||'#1e2d4a'}` }}>
      <div style={{ width:28, height:28, borderRadius:6, background:(plat?.color||'#1e2d4a')+'22', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15 }}>
        {plat?.icon||'📝'}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, color:'#e2e8f0', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{post.titulo}</div>
        <div style={{ fontSize:11, color:'#64748b', marginTop:2, display:'flex', gap:8 }}>
          <span>📅 {post.data} {post.horario}</span>
          <span>{plat?.label}</span>
          {post.tipo==='pago' && <span style={{ color:'#f59e0b' }}>💰</span>}
          {post.tipo==='organico' && <span style={{ color:'#10b981' }}>🌱</span>}
        </div>
      </div>
      {post.imagemUrl && <img src={post.imagemUrl} alt="" style={{ height:36, width:36, borderRadius:6, objectFit:'cover' }} onError={e=>e.target.style.display='none'} />}
      <span className="badge" style={{ background:st.bg, color:st.cor, border:`1px solid ${st.border}`, whiteSpace:'nowrap', flexShrink:0 }}>{post.status}</span>
      <div style={{ display:'flex', gap:4, flexShrink:0 }}>
        <button onClick={onVer} style={{ background:'rgba(0,212,255,.08)', border:'1px solid rgba(0,212,255,.2)', color:'#00d4ff', borderRadius:6, padding:'4px 9px', cursor:'pointer', fontSize:11 }}>👁</button>
        {post.status==='Pendente' && onAprovar && <button onClick={onAprovar} style={{ background:'rgba(16,185,129,.1)', border:'1px solid rgba(16,185,129,.25)', color:'#10b981', borderRadius:6, padding:'4px 9px', cursor:'pointer', fontSize:11 }}>✅</button>}
        {post.status==='Pendente' && onRejeitar && <button onClick={onRejeitar} style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.25)', color:'#ef4444', borderRadius:6, padding:'4px 9px', cursor:'pointer', fontSize:11 }}>❌</button>}
        {post.status==='Aprovado' && onPublicar && <button onClick={onPublicar} style={{ background:'rgba(124,58,237,.1)', border:'1px solid rgba(124,58,237,.25)', color:'#a78bfa', borderRadius:6, padding:'4px 9px', cursor:'pointer', fontSize:11 }}>📢</button>}
        <button onClick={onEditar} style={{ background:'rgba(255,255,255,.04)', border:'1px solid #1e2d4a', color:'#64748b', borderRadius:6, padding:'4px 9px', cursor:'pointer', fontSize:11 }}>✏️</button>
        <button onClick={onExcluir} style={{ background:'rgba(239,68,68,.06)', border:'1px solid rgba(239,68,68,.2)', color:'#ef4444', borderRadius:6, padding:'4px 9px', cursor:'pointer', fontSize:11 }}>🗑</button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Integrações com APIs de Ads
// ─────────────────────────────────────────────────────────────────

// ── Meta Ads API ──────────────────────────────────────────────────
async function criarCampanhaMetaAds({ cfg, campanha, imagemUrl }) {
  const token    = cfg.metaAdsToken || ''
  const adAccId  = cfg.metaAdAccountId || ''
  const pageId   = cfg.metaPageId || ''
  if (!token || !adAccId) return { ok:false, erro:'Token Meta Ads ou Ad Account ID não configurados em Config → Integrações.' }

  try {
    // 1. Criar Campanha
    const campRes = await fetch(`https://graph.facebook.com/v19.0/act_${adAccId}/campaigns`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({
        name: `[Vivanexa] ${campanha.produto} — ${new Date().toLocaleDateString('pt-BR')}`,
        objective: campanha.objetivo === 'conversao' ? 'OUTCOME_SALES'
                 : campanha.objetivo === 'leads'     ? 'OUTCOME_LEADS'
                 : campanha.objetivo === 'branding'  ? 'OUTCOME_AWARENESS'
                 : 'OUTCOME_ENGAGEMENT',
        status: 'PAUSED',
        special_ad_categories: [],
        access_token: token
      })
    })
    const campData = await campRes.json()
    if (campData.error) return { ok:false, erro:`Meta Ads: ${campData.error.message}` }

    const campId = campData.id

    // 2. Criar Ad Set
    const adSetRes = await fetch(`https://graph.facebook.com/v19.0/act_${adAccId}/adsets`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({
        name: `AdSet ${campanha.produto}`,
        campaign_id: campId,
        daily_budget: Math.max(1000, (Number(campanha.orcamento)||2000) * 100 / 30), // centavos
        billing_event: 'IMPRESSIONS',
        optimization_goal: campanha.objetivo === 'leads' ? 'LEAD_GENERATION' : 'REACH',
        targeting: {
          age_min: Number(campanha.idadeMin||25),
          age_max: Number(campanha.idadeMax||54),
          geo_locations: { countries:['BR'] },
        },
        status: 'PAUSED',
        access_token: token
      })
    })
    const adSetData = await adSetRes.json()
    if (adSetData.error) return { ok:false, erro:`Meta Ads AdSet: ${adSetData.error.message}` }

    return { ok:true, campanhaId:campId, adSetId:adSetData.id, plataforma:'Meta Ads' }
  } catch(e) {
    return { ok:false, erro:`Erro Meta Ads: ${e.message}` }
  }
}

// ── Google Ads API (via backend) ──────────────────────────────────
async function criarCampanhaGoogleAds({ cfg, campanha }) {
  // Google Ads exige autenticação OAuth2 server-side
  // Aqui chamamos nossa própria API que faz a chamada com as credenciais do cfg
  const googleAdsToken = cfg.googleAdsToken || ''
  const customerId     = cfg.googleAdsCustomerId || ''
  if (!googleAdsToken || !customerId) return { ok:false, erro:'Credenciais Google Ads não configuradas em Config → Integrações.' }

  try {
    const res = await fetch('/api/marketing/google-ads-campaign', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ token:googleAdsToken, customerId, campanha })
    })
    const data = await res.json()
    return res.ok ? { ok:true, ...data, plataforma:'Google Ads' } : { ok:false, erro:data.error||'Erro Google Ads' }
  } catch(e) {
    return { ok:false, erro:`Erro Google Ads: ${e.message}` }
  }
}

// ── TikTok Ads API ────────────────────────────────────────────────
async function criarCampanhaTikTokAds({ cfg, campanha }) {
  const token      = cfg.tiktokAdsToken || ''
  const advertiserId = cfg.tiktokAdvertiserId || ''
  if (!token || !advertiserId) return { ok:false, erro:'Token TikTok Ads não configurado em Config → Integrações.' }

  try {
    const res = await fetch('https://business-api.tiktok.com/open_api/v1.3/campaign/create/', {
      method:'POST',
      headers:{ 'Access-Token':token, 'Content-Type':'application/json' },
      body: JSON.stringify({
        advertiser_id: advertiserId,
        campaign_name: `[Vivanexa] ${campanha.produto} — ${new Date().toLocaleDateString('pt-BR')}`,
        objective_type: campanha.objetivo==='conversao' ? 'CONVERSIONS'
                      : campanha.objetivo==='leads'     ? 'LEAD_GENERATION'
                      : 'REACH',
        budget_mode: 'BUDGET_MODE_TOTAL',
        budget: Math.max(50, Number(campanha.orcamento||500)),
        operation_status: 'DISABLE',
      })
    })
    const data = await res.json()
    if (data.code !== 0) return { ok:false, erro:`TikTok Ads: ${data.message}` }
    return { ok:true, campanhaId:data.data?.campaign_id, plataforma:'TikTok Ads' }
  } catch(e) {
    return { ok:false, erro:`Erro TikTok Ads: ${e.message}` }
  }
}

// ── Publicação Orgânica Instagram / Facebook ──────────────────────
async function publicarInstagram({ cfg, post, imagemUrl }) {
  const token  = cfg.instagramToken || cfg.metaAdsToken || ''
  const igUserId = cfg.instagramUserId || ''
  if (!token||!igUserId) return { ok:false, erro:'Instagram Token / User ID não configurados em Config → Integrações.' }
  if (!imagemUrl) return { ok:false, erro:'Nenhuma imagem disponível para publicar. Gere uma imagem primeiro.' }

  try {
    // Passo 1: Criar container de mídia
    const containerRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({
        image_url: imagemUrl,
        caption: `${post.descricao||post.titulo}\n\n${post.hashtags||''}`.trim(),
        access_token: token
      })
    })
    const containerData = await containerRes.json()
    if (containerData.error) return { ok:false, erro:`IG Container: ${containerData.error.message}` }

    // Passo 2: Publicar
    const publishRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media_publish`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ creation_id:containerData.id, access_token:token })
    })
    const publishData = await publishRes.json()
    if (publishData.error) return { ok:false, erro:`IG Publish: ${publishData.error.message}` }
    return { ok:true, postId:publishData.id, plataforma:'Instagram' }
  } catch(e) {
    return { ok:false, erro:`Erro Instagram: ${e.message}` }
  }
}

async function publicarFacebook({ cfg, post, imagemUrl }) {
  const token  = cfg.facebookPageToken || cfg.metaAdsToken || ''
  const pageId = cfg.metaPageId || ''
  if (!token||!pageId) return { ok:false, erro:'Facebook Page Token / Page ID não configurados em Config → Integrações.' }

  try {
    const endpoint = imagemUrl ? `/${pageId}/photos` : `/${pageId}/feed`
    const body = imagemUrl
      ? { url:imagemUrl, caption:`${post.descricao||post.titulo}\n\n${post.hashtags||''}`.trim(), access_token:token }
      : { message:`${post.descricao||post.titulo}\n\n${post.hashtags||''}`.trim(), access_token:token }

    const res = await fetch(`https://graph.facebook.com/v19.0${endpoint}`, {
      method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(body)
    })
    const data = await res.json()
    if (data.error) return { ok:false, erro:`Facebook: ${data.error.message}` }
    return { ok:true, postId:data.id, plataforma:'Facebook' }
  } catch(e) {
    return { ok:false, erro:`Erro Facebook: ${e.message}` }
  }
}

async function publicarTikTok({ cfg, post }) {
  const token  = cfg.tiktokContentToken || ''
  const openId = cfg.tiktokOpenId || ''
  if (!token||!openId) return { ok:false, erro:'TikTok Content Token / Open ID não configurados em Config → Integrações.' }

  try {
    const res = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
      method:'POST',
      headers:{ 'Authorization':`Bearer ${token}`, 'Content-Type':'application/json; charset=UTF-8' },
      body: JSON.stringify({
        post_info: {
          title: `${post.titulo} ${post.hashtags||''}`.slice(0,100),
          privacy_level: 'PUBLIC_TO_EVERYONE',
          disable_comment: false,
        },
        source_info: { source:'PULL_FROM_URL' }
      })
    })
    const data = await res.json()
    if (data.error?.code !== 'ok') return { ok:false, erro:`TikTok: ${data.error?.message||'Erro'}` }
    return { ok:true, publishId:data.data?.publish_id, plataforma:'TikTok' }
  } catch(e) {
    return { ok:false, erro:`Erro TikTok: ${e.message}` }
  }
}

// ─────────────────────────────────────────────────────────────────
// Upload de imagem: local (base64 temporário) → ImgBB (URL pública gratuita)
// ─────────────────────────────────────────────────────────────────
async function uploadImgBB(file, imgbbKey) {
  // ImgBB free — https://api.imgbb.com  (chave gratuita em imgbb.com/api)
  if (!imgbbKey) return null
  const form = new FormData()
  form.append('image', file)
  try {
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, { method:'POST', body:form })
    const d = await res.json()
    return d?.data?.url || null
  } catch { return null }
}

// Campo inteligente de imagem: upload local ou URL manual
function ImageUploadField({ value, onChange, cfg }) {
  const [modo, setModo]     = useState(value && value.startsWith('http') ? 'url' : 'upload')
  const [preview, setPreview] = useState(value||'')
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef(null)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    // Preview local imediato (base64)
    const reader = new FileReader()
    reader.onload = async ev => {
      const b64url = ev.target.result
      setPreview(b64url)

      const imgbbKey = cfg?.imgbbApiKey || ''
      if (imgbbKey) {
        // Tentar fazer upload para ImgBB e obter URL pública
        setUploading(true)
        const publicUrl = await uploadImgBB(file, imgbbKey)
        setUploading(false)
        if (publicUrl) {
          setPreview(publicUrl)
          onChange(publicUrl)
          return
        }
      }
      // Sem chave ImgBB: usa base64 diretamente (funciona para pré-visualização, mas pesa mais no BD)
      onChange(b64url)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="field">
      <label>Imagem do Post</label>
      {/* Toggle Modo */}
      <div style={{ display:'flex',gap:6,marginBottom:8 }}>
        {[['upload','📎 Upload'],['url','🔗 URL']].map(([v,l])=>(
          <button key={v} onClick={()=>setModo(v)}
            style={{ padding:'4px 14px',borderRadius:20,border:'1px solid rgba(124,58,237,.3)',background:modo===v?'rgba(124,58,237,.2)':'transparent',color:modo===v?'#a78bfa':'#64748b',fontFamily:'DM Mono',fontSize:10,cursor:'pointer' }}>
            {l}
          </button>
        ))}
      </div>

      {modo==='upload' ? (
        <div>
          <div onClick={()=>inputRef.current?.click()}
            style={{ border:'2px dashed #1e2d4a',borderRadius:10,padding:'16px',textAlign:'center',cursor:'pointer',background:'#0f1829',transition:'border-color .2s' }}
            onMouseEnter={e=>e.currentTarget.style.borderColor='rgba(124,58,237,.5)'}
            onMouseLeave={e=>e.currentTarget.style.borderColor='#1e2d4a'}>
            {preview ? (
              <img src={preview} alt="preview" style={{ maxHeight:120,borderRadius:8,objectFit:'cover',maxWidth:'100%' }} onError={()=>setPreview('')}/>
            ) : (
              <div>
                <div style={{ fontSize:28,marginBottom:6 }}>🖼️</div>
                <div style={{ fontSize:11,color:'#64748b' }}>Clique ou arraste PNG, JPG, WEBP</div>
                <div style={{ fontSize:10,color:'#475569',marginTop:3 }}>
                  {cfg?.imgbbApiKey ? 'Será enviado para ImgBB → URL pública' : 'Sem chave ImgBB: salvo como base64 (configure em Config → Integrações)'}
                </div>
              </div>
            )}
          </div>
          <input ref={inputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleFile}/>
          {uploading && <div style={{ fontSize:11,color:'#a78bfa',marginTop:6 }}>⏳ Enviando para ImgBB...</div>}
          {preview && (
            <div style={{ display:'flex',gap:6,marginTop:6 }}>
              <button onClick={()=>inputRef.current?.click()} style={{ background:'none',border:'none',color:'#64748b',cursor:'pointer',fontSize:10 }}>🔄 Trocar imagem</button>
              <button onClick={()=>{setPreview('');onChange('')}} style={{ background:'none',border:'none',color:'#ef4444',cursor:'pointer',fontSize:10 }}>🗑 Remover</button>
            </div>
          )}
        </div>
      ) : (
        <input value={value||''} onChange={e=>{onChange(e.target.value);setPreview(e.target.value)}} placeholder="https://exemplo.com/imagem.jpg"
          style={{ width:'100%',background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:8,padding:'9px 12px',fontFamily:'DM Mono',fontSize:13,color:'#e2e8f0',outline:'none' }}/>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────
// ── Estilos visuais disponíveis para geração de imagem ──────────────────────
const ESTILOS_VISUAIS = [
  {
    id: 'ia_decide',
    label: '🤖 IA Decide',
    desc: 'A IA escolhe o estilo ideal para o nicho e plataforma',
    promptSuffix: '',
    color: '#7c3aed',
  },
  {
    id: 'realista',
    label: '📸 Realista',
    desc: 'Fotografia profissional, pessoas reais, cenários autênticos',
    promptSuffix: 'photorealistic, professional photography, Canon EOS R5, 85mm lens, natural lighting, authentic scene, high detail, 8k resolution',
    color: '#0ea5e9',
  },
  {
    id: '3d',
    label: '🎲 3D / CGI',
    desc: 'Renderização 3D profissional, produto em destaque, luxuoso',
    promptSuffix: '3D render, CGI, octane render, studio lighting, product visualization, cinematic quality, ultra realistic materials, depth of field, 8k',
    color: '#10b981',
  },
  {
    id: 'animacao',
    label: '🎨 Animação / Ilustração',
    desc: 'Estilo cartoon, ilustração digital, personagens, didático',
    promptSuffix: 'digital illustration, flat design animation style, vibrant colors, character design, clean lines, modern graphic design, vector art style',
    color: '#f59e0b',
  },
  {
    id: 'minimalista',
    label: '◻️ Minimalista',
    desc: 'Limpo, tipografia forte, espaço em branco, premium',
    promptSuffix: 'minimalist design, clean white background, bold typography, simple geometric shapes, premium look, luxury branding, negative space, sophisticated',
    color: '#e2e8f0',
  },
  {
    id: 'infografico',
    label: '📊 Infográfico',
    desc: 'Dados visuais, comparações, listas, educativo',
    promptSuffix: 'infographic design, data visualization, modern chart layout, icons and numbers, educational content, clean grid layout, professional business design',
    color: '#00d4ff',
  },
]

// Recomendação de estilo por nicho — o que gera mais engajamento
const ESTILO_RECOMENDADO_POR_NICHO = {
  'Contabilidade':    { estilo: 'infografico', motivo: 'Infográficos com dados e listas geram +40% de engajamento no nicho contábil' },
  'Advocacia':        { estilo: 'minimalista', motivo: 'Visual premium e limpo transmite autoridade e confiança jurídica' },
  'Saúde / Medicina': { estilo: 'realista',    motivo: 'Fotos reais de profissionais e consultórios geram mais confiança' },
  'Odontologia':      { estilo: 'realista',    motivo: 'Antes/depois e fotos reais têm alto engajamento no nicho odontológico' },
  'Imobiliário':      { estilo: '3d',          motivo: 'Renderização 3D de imóveis gera desejo e visualização do espaço' },
  'Tecnologia':       { estilo: '3d',          motivo: 'CGI e 3D transmitem inovação e modernidade para produtos tech' },
  'Educação':         { estilo: 'animacao',    motivo: 'Ilustrações e personagens aumentam 60% o engajamento em conteúdo educacional' },
  'Restaurante':      { estilo: 'realista',    motivo: 'Fotografia gastronômica realista desperta desejo e gera compartilhamentos' },
  'Beleza / Estética':{ estilo: 'realista',    motivo: 'Fotos de transformação e resultados reais são o conteúdo que mais converte' },
  'Moda / Vestuário': { estilo: 'realista',    motivo: 'Editorial de moda com fotografia profissional gera maior conversão' },
  'Fitness / Academia':{ estilo: 'realista',   motivo: 'Fotos de transformação e treinos reais geram alta identificação' },
  'Financeiro':       { estilo: 'infografico', motivo: 'Dados, gráficos e comparativos educam o público e viralizam no LinkedIn' },
  'E-commerce':       { estilo: '3d',          motivo: 'Visualização 3D do produto aumenta a taxa de clique em até 50%' },
  'Construção Civil': { estilo: '3d',          motivo: 'Renderização 3D de projetos gera desejo e visualização do resultado final' },
  'Pet':              { estilo: 'animacao',    motivo: 'Ilustrações fofas e personagens pet geram enorme engajamento orgânico' },
  'Marketing / Agências':{ estilo: 'minimalista', motivo: 'Visual clean e criativo demonstra expertise e atrai clientes B2B' },
}


  const router = useRouter()
  const { aba: abaQuery } = router.query
  const [aba, setAba]         = useState('campanhas')
  const [loading, setLoading] = useState(true)
  const [cfg, setCfg]         = useState({})
  const [empresaId, setEmpresaId] = useState(null)
  const [perfil, setPerfil]   = useState(null)
  const [logoB64, setLogoB64] = useState('')   // logo da empresa (base64)
  const [cores, setCores]     = useState({     // paleta de cores da empresa
    primaria:   '#00d4ff',
    secundaria: '#7c3aed',
    acento:     '#10b981',
    texto:      '#e2e8f0',
    fundo:      '#0a0f1e',
  })

  // ── Campanhas IA ──────────────────────────────────────────────
  const [produto, setProduto]           = useState('')
  const [nicho, setNicho]               = useState('')
  const [objetivo, setObjetivo]         = useState('conversao')
  const [orcamento, setOrcamento]       = useState('')
  const [publicoAlvo, setPublicoAlvo]   = useState('')
  const [idadeMin, setIdadeMin]         = useState('25')
  const [idadeMax, setIdadeMax]         = useState('54')
  const [genero, setGenero]             = useState('todos')
  const [plataformasCamp, setPlataformasCamp] = useState(['instagram','facebook'])
  const [gerandoCamp, setGerandoCamp]   = useState(false)
  const [gerandoImgCamp, setGerandoImgCamp] = useState(false)
  const [campResultado, setCampResultado]   = useState(null)
  const [campImagemUrl, setCampImagemUrl]   = useState('')
  const [campStatus, setCampStatus]         = useState('rascunho') // rascunho | aprovada | recriando | editando
  const [campRefineMsgs, setCampRefineMsgs] = useState([])
  const [campRefineInput, setCampRefineInput] = useState('')
  const [campRefinando, setCampRefinando]   = useState(false)
  const [publicandoAds, setPublicandoAds]   = useState(false)
  const [adsResultados, setAdsResultados]   = useState([])
  // ✅ FIX: modal de campanha anterior
  const [campModalAberta, setCampModalAberta] = useState(null)
  const campRefineEndRef = useRef(null)

  // ── Geração de Conteúdo / Imagem ─────────────────────────────
  const [promptImg, setPromptImg]         = useState('')
  const [nichoImg, setNichoImg]           = useState('')
  const [plataformaImg, setPlataformaImg] = useState('instagram')
  const [tipoConteudo, setTipoConteudo]   = useState('ia_decide')
  const [estiloVisual, setEstiloVisual]   = useState('ia_decide')
  const [recEstilo,    setRecEstilo]      = useState(null) // recomendação automática por nicho
  const [gerandoImg, setGerandoImg]       = useState(false)
  const [gerandoImagemReal, setGerandoImagemReal] = useState(false)
  const [imgResultado, setImgResultado]   = useState(null)
  const [imgUrl, setImgUrl]               = useState('')
  const [imgStatus, setImgStatus]         = useState('rascunho')
  const [imgRefineMsgs, setImgRefineMsgs] = useState([])
  const [imgRefineInput, setImgRefineInput] = useState('')
  const [publicandoOrg, setPublicandoOrg] = useState(false)
  const [orgResultados, setOrgResultados] = useState([])
  const imgRefineEndRef = useRef(null)

  // ── Agenda ────────────────────────────────────────────────────
  const [posts, setPosts]             = useState([])
  const [vistaAgenda, setVistaAgenda] = useState('semana')
  const [offsetSemana, setOffsetSemana] = useState(0)
  const [offsetMes, setOffsetMes]     = useState(0)
  const [diaFoco, setDiaFoco]         = useState(new Date().toISOString().slice(0,10))
  const [showFormPost, setShowFormPost] = useState(false)
  const [formPost, setFormPost]       = useState(getFormPostVazio())
  const [postPreview, setPostPreview] = useState(null)
  const [saving, setSaving]           = useState(false)
  const [filtroTipo, setFiltroTipo]   = useState('todos')
  const [filtroStatus, setFiltroStatus] = useState('todos')

  useEffect(() => { campRefineEndRef.current?.scrollIntoView({ behavior:'smooth' }) }, [campRefineMsgs])
  useEffect(() => { imgRefineEndRef.current?.scrollIntoView({ behavior:'smooth' }) }, [imgRefineMsgs])

  function getFormPostVazio() {
    return { id:'', titulo:'', descricao:'', plataforma:'instagram', data:new Date().toISOString().slice(0,10), horario:'09:00', status:'Pendente', tipo:'organico', hashtags:'', imagemUrl:'', cta:'', tipoMidia:'imagem' }
  }

  useEffect(() => {
    async function init() {
      const { data:{ session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/'); return }
      let { data:perf } = await supabase.from('perfis').select('*').eq('user_id', session.user.id).maybeSingle()
      if (!perf) {
        const nome = session.user.email?.split('@')[0]||'Usuário'
        const { data:np } = await supabase.from('perfis').insert({ user_id:session.user.id, nome, email:session.user.email, empresa_id:session.user.id, perfil:'admin' }).select().single()
        perf = np
      }
      setPerfil(perf)
      const eid = perf?.empresa_id||session.user.id
      setEmpresaId(eid)
      const { data:row } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${eid}`).single()
      if (row?.value) {
        const c = JSON.parse(row.value)
        setCfg(c)
        setPosts(c.mktPosts||[])
        setNicho(c.nicho||'')
        setNichoImg(c.nicho||'')
        setProduto(c.company||'')
        // Aplicar paleta de cores da empresa
        if (c.cores) setCores(prev => ({ ...prev, ...c.cores }))
      }
      // Carregar logomarca separada (chave logo:{eid})
      const { data: logoRow } = await supabase.from('vx_storage').select('value').eq('key', `logo:${eid}`).maybeSingle()
      if (logoRow?.value) setLogoB64(logoRow.value)
      setLoading(false)
    }
    init()
  }, [router])

  // Recomendação automática de estilo ao trocar o nicho
  useEffect(() => {
    if (!nichoImg) { setRecEstilo(null); return }
    const rec = ESTILO_RECOMENDADO_POR_NICHO[nichoImg]
    if (rec) {
      setRecEstilo(rec)
      // Aplica automaticamente se usuário ainda não escolheu
      if (estiloVisual === 'ia_decide') setEstiloVisual(rec.estilo)
    } else {
      setRecEstilo(null)
    }
  }, [nichoImg])

  async function salvarStorage(novoCfg) {
    await supabase.from('vx_storage').upsert({ key:`cfg:${empresaId}`, value:JSON.stringify(novoCfg), updated_at:new Date().toISOString() }, { onConflict:'key' })
  }

  // ════════════════════════════════════════════════════════════════
  // LÓGICA CAMPANHAS IA
  // ════════════════════════════════════════════════════════════════

  async function gerarCampanha(modoRecriar = false) {
    if (!produto||!objetivo) { toast('Preencha produto e objetivo', 'err'); return }
    setGerandoCamp(true)
    if (!modoRecriar) { setCampResultado(null); setCampImagemUrl(''); setCampStatus('rascunho'); setAdsResultados([]) }
    setCampRefineMsgs([])

    const platsInfo = plataformasCamp.map(pid => PLATAFORMAS.find(p=>p.id===pid)?.label||pid).join(', ')
    const sysPr = gestorPrompt(cfg, cores)
    const identidadeVisual = `Identidade Visual: empresa "${cfg.company||'empresa'}", cores primária ${cores.primaria}, secundária ${cores.secundaria}, acento ${cores.acento}. ${logoB64 ? 'A empresa possui logomarca cadastrada — mencione para incluí-la no criativo.' : ''}`
    const prompt = `Crie um plano COMPLETO de campanha digital de alta conversão para:

DADOS:
- Produto/Serviço: ${produto}
- Nicho: ${nicho||'Geral'}
- Objetivo: ${objetivo==='conversao'?'Conversão (vendas)':objetivo==='leads'?'Geração de Leads':objetivo==='branding'?'Branding':'Engajamento'}
- Orçamento mensal: ${orcamento?'R$ '+orcamento:'Não informado'}
- Plataformas: ${platsInfo}
- Público-alvo: ${publicoAlvo||'Definir automaticamente'}
- Faixa etária: ${idadeMin}-${idadeMax} anos | Gênero: ${genero}
- ${identidadeVisual}

Responda SOMENTE em JSON sem markdown:
{
  "resumo": "resumo executivo da campanha (3 linhas)",
  "publicoAlvo": "descrição detalhada do público ideal",
  "segmentacao": { "interesses":["int1","int2","int3"], "remarketing":"estratégia" },
  "plataformas": {
    ${plataformasCamp.map(pid=>`"${pid}":{"ativa":true,"tipo":"${PLATAFORMAS.find(p=>p.id===pid)?.paid?'pago':'organico'}","orcamentoPct":0,"headline":"","copy":"","cta":"","publicoEspecifico":""}`).join(',\n    ')}
  },
  "copies":[{"titulo":"","texto":"","plataforma":""},{"titulo":"","texto":"","plataforma":""},{"titulo":"","texto":"","plataforma":""}],
  "calendario":[{"semana":1,"acoes":["a1","a2"]},{"semana":2,"acoes":["a1","a2"]},{"semana":3,"acoes":["a1","a2"]},{"semana":4,"acoes":["a1","a2"]}],
  "kpis":[{"metrica":"CTR esperado","valor":"","benchmark":""},{"metrica":"CPC estimado","valor":"","benchmark":""},{"metrica":"CPL estimado","valor":"","benchmark":""},{"metrica":"ROAS esperado","valor":"","benchmark":""}],
  "promptImagem": "prompt detalhado em inglês para gerar o criativo da campanha via Stable Diffusion (inclua estilo, cores da marca: ${cores.primaria} primária e ${cores.secundaria} secundária, composição, formato quadrado)",
  "tipoMidia": "imagem"
}`
    try {
      const raw = await callAI(prompt, cfg, { temperature:0.6, maxTokens:3000, systemPrompt:sysPr })
      let parsed
      try { parsed = JSON.parse(raw.replace(/```json|```/g,'').trim()) }
      catch { parsed = { resumo:raw, publicoAlvo:'', segmentacao:{}, plataformas:{}, copies:[], calendario:[], kpis:[], promptImagem:`Marketing creative for ${produto} brand, professional, ${nicho} industry, high quality, photorealistic`, tipoMidia:'imagem' } }
      parsed._produto = produto; parsed._nicho = nicho; parsed._objetivo = objetivo; parsed._plataformas = plataformasCamp
      setCampResultado(parsed)
      setCampStatus('rascunho')
      setCampRefineMsgs([{ role:'bot', content:`Campanha para **${produto}** gerada! 🚀\n\nRevise o plano. Você pode refiná-lo aqui, aprovar para ativar nas plataformas, ou recriar do zero.` }])
      toast('Campanha gerada!')

      // Gerar imagem automaticamente se houver prompt
      if (parsed.promptImagem) {
        setGerandoImgCamp(true)
        const imgUrl = await gerarImagemHF(parsed.promptImagem, cfg)
        if (imgUrl) { setCampImagemUrl(imgUrl); toast('🖼️ Criativo gerado!') }
        setGerandoImgCamp(false)
      }
    } catch(e) { toast('Erro: '+e.message, 'err') }
    setGerandoCamp(false)
  }

  async function refinarCampanha() {
    const msg = campRefineInput.trim(); if (!msg||campRefinando) return
    setCampRefineInput('')
    setCampRefineMsgs(p => [...p, { role:'user', content:msg }])
    setCampRefinando(true)
    const hist = campRefineMsgs.slice(-6).map(m => ({ role:m.role==='user'?'user':'assistant', content:m.content }))
    const ctx = campResultado?.resumo ? `Campanha atual: ${campResultado.resumo}` : ''
    try {
      const r = await callAI(msg, cfg, { temperature:0.7, systemPrompt:gestorPrompt(cfg, cores)+'\n\n'+ctx, history:hist })
      setCampRefineMsgs(p => [...p, { role:'bot', content:r }])
    } catch(e) { setCampRefineMsgs(p => [...p, { role:'bot', content:'❌ '+e.message }]) }
    setCampRefinando(false)
  }

  async function aprovarCampanha() {
    if (!campResultado) return
    const campObj = {
      id: Date.now(), produto, nicho, objetivo, orcamento,
      plataformas: plataformasCamp, resultado: campResultado,
      imagemUrl: campImagemUrl, status:'Aprovada',
      criadoEm: new Date().toISOString()
    }
    // Adiciona posts na agenda como Pendente (aguardando aprovação do usuário para publicar)
    const novosPostsAgenda = [...posts]
    plataformasCamp.forEach((pid, i) => {
      const pd = campResultado.plataformas?.[pid]
      if (!pd) return
      const d = new Date(); d.setDate(d.getDate()+i+1)
      novosPostsAgenda.push({
        id: String(Date.now()+i), titulo: pd.headline||`Campanha ${produto} — ${pid}`,
        descricao: pd.copy||'', plataforma:pid, data:d.toISOString().slice(0,10),
        horario:'09:00', status:'Pendente', tipo:'pago', cta:pd.cta||'',
        imagemUrl:campImagemUrl, campanha:campObj.id,
        promptImagem:campResultado.promptImagem||''
      })
    })
    setPosts(novosPostsAgenda)
    const novoCfg = { ...cfg, mktCampanhas:[...(cfg.mktCampanhas||[]),campObj], mktPosts:novosPostsAgenda }
    setCfg(novoCfg)
    await salvarStorage(novoCfg)
    setCampStatus('aprovada')
    toast(`✅ Campanha aprovada! ${plataformasCamp.length} post(s) adicionados à Agenda.`)
  }

  async function publicarCampanhaAds() {
    if (!campResultado) return
    setPublicandoAds(true); setAdsResultados([])
    const resultados = []
    for (const pid of plataformasCamp) {
      const plat = PLATAFORMAS.find(p=>p.id===pid)
      if (!plat?.paid) continue
      let r
      if (pid === 'instagram' || pid === 'facebook') r = await criarCampanhaMetaAds({ cfg, campanha:{ produto, objetivo, orcamento, idadeMin, idadeMax }, imagemUrl:campImagemUrl })
      else if (pid === 'google') r = await criarCampanhaGoogleAds({ cfg, campanha:{ produto, objetivo, orcamento } })
      else if (pid === 'tiktok') r = await criarCampanhaTikTokAds({ cfg, campanha:{ produto, objetivo, orcamento } })
      else continue
      resultados.push({ plataforma:plat.label, icon:plat.icon, ...r })
    }
    setAdsResultados(resultados)
    setPublicandoAds(false)
    const ok = resultados.filter(r=>r.ok).length
    toast(ok > 0 ? `✅ ${ok} campanha(s) criada(s) nas plataformas!` : 'Nenhuma campanha criada. Verifique as integrações.', ok>0?'ok':'err')
  }

  function abrirCampanhaAnterior(c) { setCampModalAberta(c) }

  async function aprovarCampanhaAnterior(c) {
    const novos = (cfg.mktCampanhas||[]).map(x => x.id===c.id ? { ...x, status:'Aprovada' } : x)
    const novoCfg = { ...cfg, mktCampanhas:novos }; setCfg(novoCfg); await salvarStorage(novoCfg)
    setCampModalAberta({ ...c, status:'Aprovada' })
    toast('✅ Campanha aprovada!')
  }

  function recriarCampanhaAnterior(c) {
    setProduto(c.produto||c._produto||produto)
    setNicho(c.nicho||c._nicho||nicho)
    setObjetivo(c.objetivo||c._objetivo||objetivo)
    setPlataformasCamp(c.plataformas||plataformasCamp)
    setCampModalAberta(null)
    setCampResultado(null); setCampImagemUrl(''); setCampStatus('rascunho')
    toast('♻️ Formulário preenchido — clique em Gerar para recriar.', 'warn')
  }

  // ════════════════════════════════════════════════════════════════
  // LÓGICA GERAÇÃO DE CONTEÚDO
  // ════════════════════════════════════════════════════════════════

  async function gerarConteudo() {
    if (!promptImg) { toast('Descreva o conteúdo', 'err'); return }
    setGerandoImg(true); setImgResultado(null); setImgUrl(''); setImgStatus('rascunho'); setOrgResultados([])
    const platInfo   = PLATAFORMAS.find(p=>p.id===plataformaImg)
    const estiloInfo = ESTILOS_VISUAIS.find(e=>e.id===estiloVisual) || ESTILOS_VISUAIS[0]
    const estiloDesc = estiloVisual === 'ia_decide'
      ? 'Escolha o estilo visual mais impactante para este nicho e plataforma (realista, 3D, ilustração, minimalista ou infográfico). Justifique com base em dados de engajamento do nicho.'
      : `Estilo visual obrigatório: ${estiloInfo.label} — ${estiloInfo.desc}`
    const proporcao = plataformaImg==='tiktok' ? '9:16 vertical' : plataformaImg==='instagram' ? '1:1 quadrado' : '16:9 paisagem'
    const estiloSuffix = estiloVisual === 'ia_decide' ? 'choose the most engaging visual style for this specific niche' : estiloInfo.promptSuffix

    const prompt = `Você é um gestor de marketing digital sênior especialista em criação de conteúdo viral.

DADOS:
- Plataforma: ${platInfo?.label||plataformaImg}
- Nicho: ${nichoImg||'Geral'}
- Tema/Produto: ${promptImg}
- Tipo de mídia: ${tipoConteudo==='ia_decide'?'Decida você (analise o que performa melhor neste nicho)':tipoConteudo}
- ${estiloDesc}
- Empresa: ${cfg.company||'empresa'}
- Identidade Visual: cor primária ${cores.primaria}, secundária ${cores.secundaria}, acento ${cores.acento}${logoB64?' (possui logomarca — inclua referência no criativo)':''}

ANÁLISE: Analise quais formatos e abordagens geram mais engajamento neste nicho no ${platInfo?.label||plataformaImg} e use esse conhecimento no conteúdo.

Responda SOMENTE em JSON sem markdown:
{
  "tipoMidia": "imagem ou video",
  "estiloVisual": "${estiloVisual==='ia_decide'?'o estilo escolhido por você':estiloVisual}",
  "justificativa": "por que este estilo/tipo gera mais engajamento neste nicho",
  "titulo": "título chamativo max 80 chars",
  "legenda": "legenda completa com emojis e CTA forte para ${plataformaImg}",
  "cta": "call to action específico e urgente",
  "hashtags": ["#hash1","#hash2","#hash3","#hash4","#hash5","#hash6","#hash7","#hash8","#hash9","#hash10"],
  "melhorHorario": "ex: 18h-20h terça ou quinta",
  "promptImagem": "prompt DETALHADO em inglês para Stable Diffusion, específico para nicho ${nichoImg||'general'}, ${estiloSuffix}, brand colors hex (primary: ${cores.primaria}, secondary: ${cores.secundaria}, accent: ${cores.acento}), proporção ${proporcao}, ultra high quality, professional marketing material, highly engaging, trending on social media",
  "roteiro": "${plataformaImg==='tiktok'||tipoConteudo==='video'?'roteiro completo com timecodes e indicações de cena':'null'}",
  "seo": "palavras-chave SEO relevantes para a legenda",
  "dica_engajamento": "dica específica do que fazer/evitar para maximizar engajamento neste nicho"
}`
    try {
      const raw = await callAI(prompt, cfg, { temperature:0.8, maxTokens:2000, systemPrompt:gestorPrompt(cfg, cores) })
      let parsed
      try { parsed = JSON.parse(raw.replace(/```json|```/g,'').trim()) }
      catch { parsed = { titulo:promptImg, legenda:raw, hashtags:[], cta:'', tipoMidia:'imagem', estiloVisual:estiloVisual, promptImagem:`Professional ${estiloSuffix} marketing image for ${promptImg}, ${nichoImg} industry, ${cores.primaria} primary color, high quality`, melhorHorario:'', roteiro:'null', seo:'', dica_engajamento:'' } }
      parsed._plataforma = plataformaImg; parsed._nicho = nichoImg; parsed._tema = promptImg; parsed._criadoEm = new Date().toISOString()
      setImgResultado(parsed)
      const estiloLabel = ESTILOS_VISUAIS.find(e=>e.id===(parsed.estiloVisual||estiloVisual))?.label || estiloVisual
      setImgRefineMsgs([{ role:'bot', content:`Conteúdo criado para ${platInfo?.label}! ${parsed.tipoMidia==='video'?'🎥':'🖼️'}\n\n🎨 Estilo: **${estiloLabel}**\n${parsed.justificativa?`> ${parsed.justificativa}`:''}\n${parsed.dica_engajamento?`\n💡 **Dica:** ${parsed.dica_engajamento}`:''}\n\nGerando imagem agora...` }])
      toast('Conteúdo gerado!')

      if (parsed.promptImagem && parsed.tipoMidia !== 'video') {
        setGerandoImagemReal(true)
        const url = await gerarImagemHF(parsed.promptImagem, cfg)
        if (url) { setImgUrl(url); toast('🖼️ Imagem gerada com sucesso!') }
        else { toast('⚠️ Não foi possível gerar a imagem. O prompt está disponível para uso externo.', 'warn') }
        setGerandoImagemReal(false)
      }
    } catch(e) { toast('Erro: '+e.message, 'err') }
    setGerandoImg(false)
  }

  async function refinarConteudo() {
    const msg = imgRefineInput.trim(); if (!msg) return
    setImgRefineInput('')
    setImgRefineMsgs(p => [...p, { role:'user', content:msg }])
    const hist = imgRefineMsgs.slice(-6).map(m => ({ role:m.role==='user'?'user':'assistant', content:m.content }))
    const ctx = imgResultado?.titulo ? `Conteúdo atual para ${imgResultado._plataforma}: ${imgResultado.titulo}` : ''
    try {
      const r = await callAI(msg, cfg, { temperature:0.75, systemPrompt:gestorPrompt(cfg, cores)+'\n\n'+ctx, history:hist })
      setImgRefineMsgs(p => [...p, { role:'bot', content:r }])
    } catch(e) { setImgRefineMsgs(p => [...p, { role:'bot', content:'❌ '+e.message }]) }
  }

  async function aprovarEAgendarConteudo() {
    if (!imgResultado) return
    const novoPost = {
      id: String(Date.now()), titulo: imgResultado.titulo||promptImg,
      descricao: imgResultado.legenda||'', plataforma: plataformaImg,
      data: new Date().toISOString().slice(0,10),
      horario: imgResultado.melhorHorario?.match(/\d+/)?.[0] ? imgResultado.melhorHorario.match(/\d+/)[0]+':00' : '18:00',
      status:'Pendente', tipo:'organico', cta:imgResultado.cta||'',
      hashtags:(imgResultado.hashtags||[]).join(' '), promptImagem:imgResultado.promptImagem||'',
      tipoMidia:imgResultado.tipoMidia||'imagem', imagemUrl:imgUrl||''
    }
    const novos = [...posts, novoPost]; setPosts(novos)
    const novoCfg = { ...cfg, mktPosts:novos, mktConteudos:[...(cfg.mktConteudos||[]),{ ...imgResultado, id:Date.now(), imagemUrl:imgUrl }] }
    setCfg(novoCfg); await salvarStorage(novoCfg)
    setImgStatus('aprovado')
    toast('✅ Conteúdo aprovado e adicionado à Agenda!')
  }

  async function publicarOrganico() {
    if (!imgResultado) return
    setPublicandoOrg(true); setOrgResultados([])
    const resultados = []
    const postData = { titulo:imgResultado.titulo||promptImg, descricao:imgResultado.legenda||'', hashtags:(imgResultado.hashtags||[]).join(' '), cta:imgResultado.cta||'' }
    if (plataformaImg === 'instagram') {
      const r = await publicarInstagram({ cfg, post:postData, imagemUrl:imgUrl })
      resultados.push({ plataforma:'Instagram', icon:'📸', ...r })
    }
    if (plataformaImg === 'facebook') {
      const r = await publicarFacebook({ cfg, post:postData, imagemUrl:imgUrl })
      resultados.push({ plataforma:'Facebook', icon:'👥', ...r })
    }
    if (plataformaImg === 'tiktok') {
      const r = await publicarTikTok({ cfg, post:postData })
      resultados.push({ plataforma:'TikTok', icon:'🎵', ...r })
    }
    if (!resultados.length) resultados.push({ plataforma:'WhatsApp', icon:'💬', ok:false, erro:'Publicação orgânica disponível para Instagram, Facebook e TikTok.' })
    setOrgResultados(resultados)
    setPublicandoOrg(false)
    const ok = resultados.filter(r=>r.ok).length
    if (ok > 0) {
      const novos = posts.map(p => p.imagemUrl===imgUrl||p.descricao===imgResultado?.legenda ? { ...p, status:'Publicado' } : p)
      setPosts(novos); const novoCfg = { ...cfg, mktPosts:novos }; setCfg(novoCfg); await salvarStorage(novoCfg)
    }
    toast(ok>0?`✅ Publicado em ${ok} plataforma(s)!`:'Falha na publicação. Verifique tokens em Config → Integrações.', ok>0?'ok':'err')
  }

  // ════════════════════════════════════════════════════════════════
  // LÓGICA AGENDA
  // ════════════════════════════════════════════════════════════════
  function getDiasSemana() {
    const hoje = new Date()
    const ini = new Date(hoje); ini.setDate(hoje.getDate()-hoje.getDay()+offsetSemana*7)
    return Array.from({ length:7 }, (_,i) => { const d = new Date(ini); d.setDate(ini.getDate()+i); return d })
  }
  function getDiasMes() {
    const ref = new Date(); ref.setMonth(ref.getMonth()+offsetMes, 1)
    const ano=ref.getFullYear(), mes=ref.getMonth()
    const primeiroDia=new Date(ano,mes,1).getDay()
    const diasNoMes=new Date(ano,mes+1,0).getDate()
    const cells = []
    for (let i=0;i<primeiroDia;i++) cells.push(null)
    for (let d=1;d<=diasNoMes;d++) cells.push(new Date(ano,mes,d))
    return { cells, ano, mes }
  }
  function getPostsDoDia(data) {
    if (!data) return []
    const ds = data.toISOString ? data.toISOString().slice(0,10) : data
    return posts.filter(p => p.data===ds &&
      (filtroTipo==='todos'||p.tipo===filtroTipo) &&
      (filtroStatus==='todos'||p.status===filtroStatus))
  }
  async function salvarPost() {
    if (!formPost.titulo||!formPost.data) { toast('Preencha título e data','err'); return }
    setSaving(true)
    const np = { ...formPost, id:formPost.id||String(Date.now()) }
    const novos = formPost.id ? posts.map(p=>p.id===formPost.id?np:p) : [...posts,np]
    setPosts(novos)
    const novoCfg = { ...cfg, mktPosts:novos }; setCfg(novoCfg); await salvarStorage(novoCfg)
    setShowFormPost(false); setFormPost(getFormPostVazio()); toast('Post salvo!'); setSaving(false)
  }
  async function excluirPost(id) {
    const novos = posts.filter(p=>p.id!==id); setPosts(novos)
    const novoCfg = { ...cfg, mktPosts:novos }; setCfg(novoCfg); await salvarStorage(novoCfg); toast('Post removido')
  }
  async function mudarStatusPost(id, status) {
    const novos = posts.map(p=>p.id===id?{ ...p, status }:p); setPosts(novos)
    const novoCfg = { ...cfg, mktPosts:novos }; setCfg(novoCfg); await salvarStorage(novoCfg)
    if (postPreview?.id===id) setPostPreview(novos.find(p=>p.id===id)||null)
    toast(status==='Aprovado'?'✅ Aprovado! Publicando automaticamente...':status==='Publicado'?'📢 Publicado!':'⚠️ Rejeitado', status==='Rejeitado'?'warn':'ok')
    // Publicar automaticamente ao aprovar
    if (status === 'Aprovado') {
      const post = novos.find(p=>p.id===id)
      if (post && ['instagram','facebook','tiktok'].includes(post.plataforma)) {
        setTimeout(() => publicarPostDireto(post), 800)
      }
    }
  }
  async function publicarPostDireto(post) {
    if (!post.imagemUrl && !post.descricao) { toast('Post sem conteúdo suficiente','err'); return }
    let r
    if (post.plataforma==='instagram') r = await publicarInstagram({ cfg, post, imagemUrl:post.imagemUrl })
    else if (post.plataforma==='facebook') r = await publicarFacebook({ cfg, post, imagemUrl:post.imagemUrl })
    else if (post.plataforma==='tiktok') r = await publicarTikTok({ cfg, post })
    else { toast('Publicação direta disponível para Instagram, Facebook e TikTok','warn'); return }
    if (r.ok) { await mudarStatusPost(post.id, 'Publicado'); toast(`✅ Publicado no ${r.plataforma}!`) }
    else toast('Erro: '+r.erro, 'err')
  }

  // ── Render ────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0a0f1e',color:'#64748b',fontFamily:'DM Mono, monospace' }}>
      Carregando Marketing...
    </div>
  )

  const diasSemana = getDiasSemana()
  const { cells:diasMes, ano:anoMes, mes:mesMes } = getDiasMes()
  const postsPublicados = posts.filter(p=>p.status==='Publicado').length
  const postsPendentes  = posts.filter(p=>p.status==='Pendente').length

  return (
    <>
      <Head>
        <title>Marketing — {cfg.company||'Vivanexa'}</title>
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet"/>
      </Head>
      <style>{CSS}</style>
      {/* CSS vars dinâmicos com paleta da empresa */}
      <style>{`
        :root {
          --accent:   ${cores.primaria};
          --accent2:  ${cores.secundaria};
          --accent3:  ${cores.acento};
          --text:     ${cores.texto};
        }
        .btn-primary  { background: linear-gradient(135deg, ${cores.primaria}, ${cores.primaria}bb) !important; }
        .btn-purple   { background: linear-gradient(135deg, ${cores.secundaria}, ${cores.secundaria}bb) !important; }
        .btn-green    { background: linear-gradient(135deg, ${cores.acento}, ${cores.acento}bb) !important; }
        .tab-btn.active { background: ${cores.secundaria}22 !important; border-color: ${cores.secundaria}80 !important; color: ${cores.secundaria} !important; }
        .stat-val { color: ${cores.secundaria} !important; }
      `}</style>
      <div className="orb orb1"/><div className="orb orb2"/>
      <Navbar cfg={cfg} perfil={perfil}/>

      <div className="page-wrap">
        {/* Cabeçalho com logo e nome da empresa */}
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
          {logoB64 && (
            <img
              src={`data:image/png;base64,${logoB64}`}
              alt={cfg.company||'Logo'}
              style={{ height:44, maxWidth:120, objectFit:'contain', borderRadius:8, border:`1px solid ${cores.primaria}33`, padding:4, background:'rgba(255,255,255,.04)' }}
              onError={e => e.target.style.display='none'}
            />
          )}
          <div>
            <div className="page-title">📣 Marketing{cfg.company ? ` — ${cfg.company}` : ''}</div>
            <div className="page-sub">Campanhas IA, criação de conteúdo e agenda de publicação</div>
          </div>
        </div>

        </div>

        {/* Stats */}
        <div className="stat-row">
          <div className="stat-card"><div className="stat-val">{(cfg.mktCampanhas||[]).length}</div><div className="stat-label">Campanhas</div></div>
          <div className="stat-card"><div className="stat-val">{posts.length}</div><div className="stat-label">Posts na Agenda</div></div>
          <div className="stat-card"><div className="stat-val" style={{ color:'#f59e0b' }}>{postsPendentes}</div><div className="stat-label">Aguardando Aprovação</div></div>
          <div className="stat-card"><div className="stat-val" style={{ color:'#10b981' }}>{postsPublicados}</div><div className="stat-label">Publicados</div></div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          {[{ id:'campanhas',label:'🎯 Campanhas IA'},{ id:'imagens',label:'✨ Geração de Conteúdo'},{ id:'agenda',label:'📅 Agenda'}].map(t => (
            <button key={t.id} className={`tab-btn ${aba===t.id?'active':''}`} onClick={()=>setAba(t.id)}>{t.label}</button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════
            ABA: CAMPANHAS IA
        ══════════════════════════════════════════════════════ */}
        {aba === 'campanhas' && (
          <div>
            {/* Aviso de integrações */}
            {(!cfg.metaAdsToken && !cfg.googleAdsToken && !cfg.tiktokAdsToken) && (
              <div className="info-box" style={{ background:'rgba(245,158,11,.08)', border:'1px solid rgba(245,158,11,.2)', color:'#f59e0b' }}>
                ⚠️ <strong>Integrações de Ads não configuradas.</strong> O sistema criará o plano completo com IA, mas para publicar nas plataformas configure os tokens em <button onClick={()=>router.push('/configuracoes?tab=integracoes')} style={{ background:'none', border:'none', color:'#00d4ff', cursor:'pointer', fontFamily:'DM Mono', fontSize:12, textDecoration:'underline' }}>Configurações → Integrações</button>.
              </div>
            )}

            {/* Formulário */}
            <div className="card">
              <div className="card-title">🎯 Criar Campanha com IA</div>
              {/* Badge de identidade visual ativa */}
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14, padding:'8px 12px', background:`${cores.primaria}0d`, border:`1px solid ${cores.primaria}33`, borderRadius:8, flexWrap:'wrap' }}>
                {logoB64 && <img src={`data:image/png;base64,${logoB64}`} alt="logo" style={{ height:24, maxWidth:60, objectFit:'contain', borderRadius:4 }} onError={e=>e.target.style.display='none'} />}
                <span style={{ fontSize:11, color: cores.primaria, fontFamily:'DM Mono, monospace' }}>🎨 Identidade visual aplicada:</span>
                {[cores.primaria, cores.secundaria, cores.acento].map((c,i) => (
                  <span key={i} style={{ display:'inline-block', width:18, height:18, borderRadius:'50%', background:c, border:'2px solid rgba(255,255,255,.15)', title:c }} />
                ))}
                <span style={{ fontSize:10, color:'#64748b', marginLeft:4 }}>{cores.primaria} · {cores.secundaria} · {cores.acento}</span>
              </div>
              <div className="grid3">
                <div className="field"><label>Produto / Serviço</label><input value={produto} onChange={e=>setProduto(e.target.value)} placeholder="Ex: Software contábil"/></div>
                <div className="field"><label>Nicho de Mercado</label>
                  <select value={nicho} onChange={e=>setNicho(e.target.value)} style={{ width:'100%',background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:8,padding:'9px 12px',fontFamily:'DM Mono, monospace',fontSize:13,color:'#e2e8f0',outline:'none' }}>
                    <option value="">Selecione...</option>{NICHOS.map(n=><option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="field"><label>Objetivo</label>
                  <select value={objetivo} onChange={e=>setObjetivo(e.target.value)} style={{ width:'100%',background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:8,padding:'9px 12px',fontFamily:'DM Mono, monospace',fontSize:13,color:'#e2e8f0',outline:'none' }}>
                    <option value="conversao">🛒 Conversão (Vendas)</option>
                    <option value="leads">📋 Leads</option>
                    <option value="branding">🏆 Branding</option>
                    <option value="engajamento">❤️ Engajamento</option>
                  </select>
                </div>
              </div>
              <div className="grid3">
                <div className="field"><label>Orçamento (R$/mês)</label><input type="number" value={orcamento} onChange={e=>setOrcamento(e.target.value)} placeholder="Ex: 2000"/></div>
                <div className="field"><label>Faixa Etária</label>
                  <div style={{ display:'flex',gap:6,alignItems:'center' }}>
                    <input type="number" value={idadeMin} onChange={e=>setIdadeMin(e.target.value)} style={{ width:65,background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:8,padding:'9px 10px',fontFamily:'DM Mono',fontSize:13,color:'#e2e8f0',outline:'none' }}/>
                    <span style={{ color:'#64748b',fontSize:12 }}>a</span>
                    <input type="number" value={idadeMax} onChange={e=>setIdadeMax(e.target.value)} style={{ width:65,background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:8,padding:'9px 10px',fontFamily:'DM Mono',fontSize:13,color:'#e2e8f0',outline:'none' }}/>
                    <span style={{ color:'#64748b',fontSize:11 }}>anos</span>
                  </div>
                </div>
                <div className="field"><label>Gênero</label>
                  <select value={genero} onChange={e=>setGenero(e.target.value)} style={{ width:'100%',background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:8,padding:'9px 12px',fontFamily:'DM Mono, monospace',fontSize:13,color:'#e2e8f0',outline:'none' }}>
                    <option value="todos">Todos</option><option value="masculino">Masculino</option><option value="feminino">Feminino</option>
                  </select>
                </div>
              </div>
              <div className="field"><label>Público-Alvo (opcional)</label><input value={publicoAlvo} onChange={e=>setPublicoAlvo(e.target.value)} placeholder="Ex: Contadores e donos de escritório contábil com 5+ funcionários"/></div>
              <div className="field">
                <label>Plataformas</label>
                <div className="tag-list">
                  {PLATAFORMAS.map(p => (
                    <span key={p.id} className={`tag ${plataformasCamp.includes(p.id)?'active':''}`}
                      onClick={()=>setPlataformasCamp(prev=>prev.includes(p.id)?prev.filter(x=>x!==p.id):[...prev,p.id])}
                      style={plataformasCamp.includes(p.id)?{ borderColor:p.color+'88',color:p.color,background:p.color+'18' }:{}}>
                      {p.icon} {p.label} {p.paid&&<span style={{ fontSize:9,marginLeft:3,color:'#f59e0b' }}>PAGO</span>}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ display:'flex',gap:8,marginTop:8,flexWrap:'wrap' }}>
                <button className="btn btn-purple" onClick={()=>gerarCampanha(false)} disabled={gerandoCamp}>
                  {gerandoCamp?'⏳ Gerando campanha...':'🚀 Gerar Campanha com IA'}
                </button>
                {campResultado && (
                  <button className="btn btn-secondary" style={{ fontSize:11 }} onClick={()=>gerarCampanha(true)} disabled={gerandoCamp}>
                    🔄 Recriar
                  </button>
                )}
              </div>
              {gerandoCamp && <div className="thinking" style={{ marginTop:12 }}><span/><span/><span/><span style={{ color:'#a78bfa',fontSize:12,marginLeft:8 }}>Gerando plano completo...</span></div>}
              {gerandoImgCamp && <div className="thinking" style={{ marginTop:8 }}><span/><span/><span/><span style={{ color:'#f59e0b',fontSize:12,marginLeft:8 }}>Gerando criativo da campanha...</span></div>}
            </div>

            {/* Resultado da campanha */}
            {campResultado && (
              <div>
                <div className="card" style={{ borderColor:'rgba(124,58,237,.3)',background:'rgba(124,58,237,.03)' }}>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14,flexWrap:'wrap',gap:10 }}>
                    <div className="card-title" style={{ margin:0 }}>📊 Plano de Campanha — {produto}</div>
                    <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
                      {campStatus !== 'aprovada' && (
                        <button className="btn btn-green" style={{ fontSize:11 }} onClick={aprovarCampanha}>✅ Aprovar e Agendar</button>
                      )}
                      {campStatus === 'aprovada' && (
                        <span className="badge badge-green" style={{ padding:'6px 12px',fontSize:12 }}>✅ Aprovada e Agendada</span>
                      )}
                      {/* Publicar nas plataformas de Ads */}
                      {plataformasCamp.some(pid=>PLATAFORMAS.find(p=>p.id===pid)?.paid) && (
                        <button className="btn btn-meta" style={{ fontSize:11 }} onClick={publicarCampanhaAds} disabled={publicandoAds}>
                          {publicandoAds?'⏳ Publicando...':'🚀 Publicar nas Plataformas de Ads'}
                        </button>
                      )}
                      <button className="btn btn-secondary" style={{ fontSize:11 }} onClick={()=>gerarCampanha(true)} disabled={gerandoCamp}>🔄 Recriar</button>
                    </div>
                  </div>

                  {campImagemUrl && (
                    <div style={{ marginBottom:16 }}>
                      <div style={{ fontSize:11,color:'#64748b',textTransform:'uppercase',letterSpacing:1,marginBottom:6 }}>🖼️ Criativo Gerado</div>
                      <img src={campImagemUrl} alt="criativo" className="img-preview" onError={e=>e.target.style.display='none'}/>
                      <div style={{ display:'flex',gap:6,marginTop:8,flexWrap:'wrap' }}>
                        <a href={campImagemUrl} download="criativo-campanha.jpg" className="btn btn-secondary" style={{ fontSize:10,padding:'4px 10px',textDecoration:'none' }}>⬇️ Baixar</a>
                        <button onClick={async()=>{ setGerandoImgCamp(true); const u=await gerarImagemHF(campResultado.promptImagem,cfg); if(u)setCampImagemUrl(u); setGerandoImgCamp(false) }}
                          style={{ padding:'4px 10px',borderRadius:7,background:'rgba(255,255,255,.04)',border:'1px solid #1e2d4a',color:'#64748b',fontFamily:'DM Mono',fontSize:10,cursor:'pointer' }}>
                          🔄 Regenerar
                        </button>
                        <button onClick={()=>setCampImagemUrl('')}
                          style={{ padding:'4px 10px',borderRadius:7,background:'rgba(245,158,11,.06)',border:'1px solid rgba(245,158,11,.2)',color:'#f59e0b',fontFamily:'DM Mono',fontSize:10,cursor:'pointer' }}>
                          🎨 Editar Prompt
                        </button>
                      </div>
                    </div>
                  )}
                  {!campImagemUrl && !gerandoImgCamp && campResultado?.promptImagem && (
                    <div style={{ marginBottom:14,padding:'14px 16px',background:'rgba(245,158,11,.06)',border:'1px solid rgba(245,158,11,.2)',borderRadius:10 }}>
                      <div style={{ fontSize:11,color:'#f59e0b',fontWeight:700,marginBottom:8 }}>🎨 Prompt do Criativo — edite antes de gerar</div>
                      {/* Seletor de estilo visual */}
                      <div style={{ display:'flex',gap:6,flexWrap:'wrap',marginBottom:10 }}>
                        {[['photorealistic','📷 Foto Real'],['3D render','🧊 3D'],['flat illustration','🎨 Ilustração'],['cartoon','🖼️ Cartoon'],['cinematic','🎬 Cinemático'],['minimalist','⬜ Minimalista']].map(([v,l])=>(
                          <button key={v}
                            onClick={()=>{
                              const base = campResultado.promptImagem.replace(/,?\s*(photorealistic|3D render|flat illustration|cartoon|cinematic|minimalist)[^,]*/gi,'').trim()
                              setCampResultado(prev=>({...prev,promptImagem:`${base}, ${v} style`}))
                            }}
                            style={{ padding:'4px 11px',borderRadius:20,border:'1px solid rgba(245,158,11,.3)',background:campResultado.promptImagem?.includes(v)?'rgba(245,158,11,.2)':'transparent',color:campResultado.promptImagem?.includes(v)?'#f59e0b':'#64748b',fontFamily:'DM Mono',fontSize:10,cursor:'pointer' }}>
                            {l}
                          </button>
                        ))}
                      </div>
                      <textarea value={campResultado.promptImagem} onChange={e=>setCampResultado(prev=>({...prev,promptImagem:e.target.value}))}
                        style={{ width:'100%',background:'rgba(0,0,0,.3)',border:'1px solid rgba(245,158,11,.25)',borderRadius:8,padding:'8px 12px',fontFamily:'DM Mono, monospace',fontSize:12,color:'#94a3b8',outline:'none',resize:'vertical',minHeight:70,lineHeight:1.6 }}/>
                      <div style={{ display:'flex',gap:8,marginTop:8 }}>
                        <button className="btn btn-gold" style={{ fontSize:10,padding:'5px 14px' }}
                          onClick={async()=>{ setGerandoImgCamp(true); const u=await gerarImagemHF(campResultado.promptImagem,cfg); if(u){setCampImagemUrl(u);toast('🖼️ Criativo gerado!')} else toast('⚠️ Falha na geração. Use o prompt em DALL-E ou Midjourney.','warn'); setGerandoImgCamp(false) }}>
                          ✨ Gerar Imagem
                        </button>
                        <button onClick={()=>navigator.clipboard.writeText(campResultado.promptImagem)} style={{ padding:'5px 12px',borderRadius:7,background:'none',border:'1px solid rgba(245,158,11,.25)',color:'#64748b',fontFamily:'DM Mono',fontSize:10,cursor:'pointer' }}>📋 Copiar prompt</button>
                      </div>
                    </div>
                  )}

                  {/* Resumo */}
                  {campResultado.resumo && (
                    <div style={{ padding:'12px 16px',background:'rgba(0,0,0,.2)',borderRadius:10,fontSize:13,color:'#94a3b8',lineHeight:1.8,marginBottom:16 }}>
                      {campResultado.resumo}
                    </div>
                  )}

                  {/* Público */}
                  {campResultado.publicoAlvo && (
                    <div style={{ marginBottom:16 }}>
                      <div style={{ fontSize:11,color:'#64748b',textTransform:'uppercase',letterSpacing:1,marginBottom:6 }}>🎯 Público-Alvo</div>
                      <div style={{ padding:'10px 14px',background:'rgba(0,212,255,.06)',border:'1px solid rgba(0,212,255,.15)',borderRadius:8,fontSize:12,color:'#94a3b8' }}>{campResultado.publicoAlvo}</div>
                      {campResultado.segmentacao?.interesses && (
                        <div style={{ display:'flex',gap:6,flexWrap:'wrap',marginTop:8 }}>
                          {campResultado.segmentacao.interesses.map((int,i) => <span key={i} className="badge badge-blue">{int}</span>)}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Por plataforma */}
                  {campResultado.plataformas && Object.keys(campResultado.plataformas).length > 0 && (
                    <div style={{ marginBottom:16 }}>
                      <div style={{ fontSize:11,color:'#64748b',textTransform:'uppercase',letterSpacing:1,marginBottom:10 }}>📱 Por Plataforma</div>
                      {Object.entries(campResultado.plataformas).map(([pid,pd]) => {
                        const plat = PLATAFORMAS.find(p=>p.id===pid)
                        if (!plat||!pd) return null
                        return (
                          <div key={pid} style={{ border:`1px solid ${plat.color}33`,borderRadius:10,padding:'14px 16px',marginBottom:10,background:`${plat.color}08` }}>
                            <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:10 }}>
                              <span style={{ fontSize:18 }}>{plat.icon}</span>
                              <span style={{ fontWeight:700,color:plat.color,fontSize:13 }}>{plat.label}</span>
                              {pd.tipo && <span className={pd.tipo==='pago'?'badge badge-yellow':'badge badge-green'}>{pd.tipo}</span>}
                            </div>
                            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,fontSize:12 }}>
                              {pd.headline && <div><div style={{ color:'#64748b',fontSize:10 }}>HEADLINE</div><div style={{ color:'#e2e8f0',fontWeight:600 }}>{pd.headline}</div></div>}
                              {pd.cta && <div><div style={{ color:'#64748b',fontSize:10 }}>CTA</div><div style={{ color:'#a78bfa',fontWeight:600 }}>{pd.cta}</div></div>}
                              {pd.copy && <div style={{ gridColumn:'1/-1' }}><div style={{ color:'#64748b',fontSize:10,marginBottom:2 }}>COPY</div><div style={{ color:'#94a3b8',lineHeight:1.6 }}>{pd.copy}</div></div>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Copies */}
                  {(campResultado.copies||[]).filter(c=>c?.texto).length > 0 && (
                    <div style={{ marginBottom:16 }}>
                      <div style={{ fontSize:11,color:'#64748b',textTransform:'uppercase',letterSpacing:1,marginBottom:10 }}>🔥 Copies de Alta Conversão</div>
                      {campResultado.copies.filter(c=>c?.texto).map((c,i) => (
                        <div key={i} style={{ background:'rgba(124,58,237,.08)',borderRadius:8,padding:'12px 14px',marginBottom:8,borderLeft:'3px solid #7c3aed' }}>
                          <div style={{ display:'flex',justifyContent:'space-between',marginBottom:4 }}>
                            <span style={{ fontSize:11,fontWeight:700,color:'#a78bfa' }}>{c.titulo}</span>
                            <button onClick={()=>navigator.clipboard.writeText(c.texto)} style={{ background:'none',border:'none',color:'#64748b',cursor:'pointer',fontSize:10 }}>📋</button>
                          </div>
                          <div style={{ fontSize:12,color:'#94a3b8',lineHeight:1.6 }}>{c.texto}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* KPIs */}
                  {(campResultado.kpis||[]).filter(k=>k?.valor).length > 0 && (
                    <div style={{ marginBottom:16 }}>
                      <div style={{ fontSize:11,color:'#64748b',textTransform:'uppercase',letterSpacing:1,marginBottom:10 }}>📈 KPIs Esperados</div>
                      <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:8 }}>
                        {campResultado.kpis.filter(k=>k?.valor).map((k,i) => (
                          <div key={i} style={{ background:'rgba(0,212,255,.06)',border:'1px solid rgba(0,212,255,.15)',borderRadius:8,padding:'10px 12px' }}>
                            <div style={{ fontSize:10,color:'#64748b',marginBottom:3 }}>{k.metrica}</div>
                            <div style={{ fontSize:16,fontWeight:700,color:'#00d4ff' }}>{k.valor}</div>
                            {k.benchmark && <div style={{ fontSize:9,color:'#475569',marginTop:2 }}>Ref: {k.benchmark}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Resultados de publicação nas plataformas Ads */}
                  {adsResultados.length > 0 && (
                    <div style={{ marginTop:16,padding:'14px 16px',background:'rgba(0,0,0,.2)',borderRadius:10 }}>
                      <div style={{ fontSize:12,fontWeight:700,color:'#e2e8f0',marginBottom:10 }}>📊 Resultado da Publicação nos Ads</div>
                      {adsResultados.map((r,i) => (
                        <div key={i} style={{ display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderRadius:8,marginBottom:6,background:r.ok?'rgba(16,185,129,.08)':'rgba(239,68,68,.08)',border:`1px solid ${r.ok?'rgba(16,185,129,.2)':'rgba(239,68,68,.2)'}` }}>
                          <span style={{ fontSize:18 }}>{r.icon}</span>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:12,fontWeight:600,color:'#e2e8f0' }}>{r.plataforma}</div>
                            {r.ok ? <div style={{ fontSize:11,color:'#10b981' }}>✅ Campanha criada {r.campanhaId?`· ID: ${r.campanhaId}`:''}</div>
                                  : <div style={{ fontSize:11,color:'#ef4444' }}>❌ {r.erro}</div>}
                          </div>
                        </div>
                      ))}
                      <div style={{ fontSize:11,color:'#64748b',marginTop:8 }}>
                        ⚠️ As campanhas foram criadas com status PAUSADO. Acesse o gerenciador de anúncios de cada plataforma para revisar e ativar.
                      </div>
                    </div>
                  )}
                </div>

                {/* Chat de refinamento */}
                <div className="card" style={{ borderColor:'rgba(124,58,237,.25)' }}>
                  <div className="card-title">🤖 Refinar Campanha com o Agente</div>
                  <div className="chat-area">
                    {campRefineMsgs.map((m,i) => <div key={i} className={`chat-msg ${m.role}`}>{m.content}</div>)}
                    {campRefinando && <div className="chat-msg bot"><div className="thinking"><span/><span/><span/></div></div>}
                    <div ref={campRefineEndRef}/>
                  </div>
                  <div className="chat-input-row">
                    <input value={campRefineInput} onChange={e=>setCampRefineInput(e.target.value)}
                      onKeyDown={e=>e.key==='Enter'&&refinarCampanha()}
                      placeholder="Ex: 'Refine os copies para tom mais urgente' ou 'Mude o público para empresas menores'..." disabled={campRefinando}/>
                    <button className="btn btn-purple" onClick={refinarCampanha} disabled={campRefinando||!campRefineInput.trim()}>{campRefinando?'⏳':'➤'}</button>
                  </div>
                </div>
              </div>
            )}

            {/* ✅ FIX: Campanhas Anteriores com modal correto */}
            {(cfg.mktCampanhas||[]).length > 0 && (
              <div className="card">
                <div className="card-title">📜 Campanhas Anteriores</div>
                {[...(cfg.mktCampanhas||[])].reverse().slice(0,8).map(c => (
                  <CampanhaAnteriorCard key={c.id} c={c}
                    onVer={() => abrirCampanhaAnterior(c)}
                    onDuplicar={() => recriarCampanhaAnterior(c)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            ABA: GERAÇÃO DE CONTEÚDO
        ══════════════════════════════════════════════════════ */}
        {aba === 'imagens' && (
          <div>
            <div className="card">
              <div className="card-title">✨ Criador de Conteúdo com IA</div>

              {/* Aviso HuggingFace */}
              <div className="info-box" style={{ background:'rgba(0,212,255,.05)',border:'1px solid rgba(0,212,255,.15)',color:'#64748b' }}>
                🖼️ Imagens geradas via <strong style={{ color:'#00d4ff' }}>Stable Diffusion (Hugging Face)</strong> — gratuito. Adicione sua chave HF em Config → Integrações para mais velocidade e qualidade.
              </div>

              <div className="grid2">
                <div className="field"><label>Nicho</label>
                  <select value={nichoImg} onChange={e=>setNichoImg(e.target.value)} style={{ width:'100%',background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:8,padding:'9px 12px',fontFamily:'DM Mono, monospace',fontSize:13,color:'#e2e8f0',outline:'none' }}>
                    <option value="">Selecione...</option>{NICHOS.map(n=><option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="field"><label>Plataforma</label>
                  <div style={{ display:'flex',gap:6,flexWrap:'wrap',marginTop:4 }}>
                    {PLATAFORMAS.filter(p=>p.organic).map(p => (
                      <button key={p.id} onClick={()=>setPlataformaImg(p.id)}
                        style={{ padding:'6px 12px',borderRadius:8,border:`1px solid ${plataformaImg===p.id?p.color:'#1e2d4a'}`,background:plataformaImg===p.id?p.color+'22':'#1a2540',color:plataformaImg===p.id?p.color:'#64748b',fontFamily:'DM Mono, monospace',fontSize:11,cursor:'pointer' }}>
                        {p.icon} {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="field"><label>Tipo de Mídia</label>
                <div style={{ display:'flex',gap:8 }}>
                  {[['ia_decide','🤖 IA Decide'],['imagem','🖼️ Imagem'],['video','🎥 Vídeo']].map(([v,l]) => (
                    <button key={v} onClick={()=>setTipoConteudo(v)}
                      style={{ padding:'7px 16px',borderRadius:8,border:'none',cursor:'pointer',fontFamily:'DM Mono, monospace',fontSize:11,background:tipoConteudo===v?'linear-gradient(135deg,#7c3aed,#5b21b6)':'rgba(255,255,255,.04)',color:tipoConteudo===v?'#fff':'#64748b',outline:tipoConteudo===v?'none':'1px solid #1e2d4a' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Seletor de Estilo Visual ── */}
              <div className="field">
                <label>Estilo Visual da Imagem</label>

                {/* Recomendação automática por nicho */}
                {recEstilo && (
                  <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:8,padding:'7px 12px',background:'rgba(16,185,129,.07)',border:'1px solid rgba(16,185,129,.25)',borderRadius:8 }}>
                    <span style={{ fontSize:13 }}>💡</span>
                    <span style={{ fontSize:11,color:'#10b981',lineHeight:1.5 }}>
                      <strong>Recomendado para {nichoImg}:</strong> {ESTILOS_VISUAIS.find(e=>e.id===recEstilo.estilo)?.label} — {recEstilo.motivo}
                    </span>
                    <button onClick={()=>setEstiloVisual(recEstilo.estilo)}
                      style={{ marginLeft:'auto',padding:'3px 10px',borderRadius:6,border:'1px solid rgba(16,185,129,.4)',background:'rgba(16,185,129,.12)',color:'#10b981',fontFamily:'DM Mono,monospace',fontSize:10,cursor:'pointer',whiteSpace:'nowrap' }}>
                      Aplicar
                    </button>
                  </div>
                )}

                <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(155px,1fr))',gap:8 }}>
                  {ESTILOS_VISUAIS.map(e => {
                    const ativo = estiloVisual === e.id
                    const isRec = recEstilo?.estilo === e.id
                    return (
                      <button key={e.id} onClick={()=>setEstiloVisual(e.id)}
                        style={{ padding:'10px 12px',borderRadius:10,cursor:'pointer',fontFamily:'DM Mono,monospace',textAlign:'left',transition:'all .15s',
                          border:`1.5px solid ${ativo ? e.color : isRec ? e.color+'55' : '#1e2d4a'}`,
                          background: ativo ? `${e.color}18` : isRec ? `${e.color}08` : 'rgba(255,255,255,.02)',
                          boxShadow: ativo ? `0 0 12px ${e.color}30` : 'none' }}>
                        <div style={{ fontSize:12,fontWeight:ativo?700:400,color:ativo?e.color:isRec?e.color+'cc':'#94a3b8',marginBottom:3 }}>
                          {ativo?'✓ ':''}{e.label}{isRec&&!ativo?' ⭐':''}
                        </div>
                        <div style={{ fontSize:10,color:'#475569',lineHeight:1.4 }}>{e.desc}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="field"><label>Descreva o conteúdo / tema</label>
                <textarea value={promptImg} onChange={e=>setPromptImg(e.target.value)} style={{ minHeight:80 }}
                  placeholder="Ex: Post mostrando os 5 benefícios de contratar um contador, linguagem descontraída, foco em PMEs..."/>
              </div>

              <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
                <button className="btn btn-purple" onClick={gerarConteudo} disabled={gerandoImg}>
                  {gerandoImg?'⏳ Criando...':'✨ Gerar Conteúdo + Imagem com IA'}
                </button>
                {imgResultado && (
                  <button className="btn btn-secondary" style={{ fontSize:11 }} onClick={()=>{ setImgResultado(null); setImgUrl(''); setImgStatus('rascunho') }}>🔄 Recriar</button>
                )}
              </div>
              {gerandoImg && <div className="thinking" style={{ marginTop:12 }}><span/><span/><span/><span style={{ color:'#a78bfa',fontSize:12,marginLeft:8 }}>Gerando copy e conteúdo...</span></div>}
              {gerandoImagemReal && <div className="thinking" style={{ marginTop:8 }}><span/><span/><span/><span style={{ color:'#f59e0b',fontSize:12,marginLeft:8 }}>Gerando imagem via Stable Diffusion (pode levar 10-30s)...</span></div>}
            </div>

            {/* Resultado do conteúdo */}
            {imgResultado && (
              <div>
                <div className="card" style={{ borderColor:'rgba(124,58,237,.3)' }}>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14,flexWrap:'wrap',gap:10 }}>
                    <div className="card-title" style={{ margin:0 }}>{imgResultado.tipoMidia==='video'?'🎥':'🖼️'} {imgResultado.titulo}</div>
                    <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
                      {imgStatus !== 'aprovado' ? (
                        <button className="btn btn-green" style={{ fontSize:11 }} onClick={aprovarEAgendarConteudo}>✅ Aprovar e Agendar</button>
                      ) : (
                        <span className="badge badge-green" style={{ padding:'6px 12px',fontSize:12 }}>✅ Aprovado e Agendado</span>
                      )}
                      {/* Publicar orgânico */}
                      {['instagram','facebook','tiktok'].includes(plataformaImg) && (
                        <button className="btn btn-meta" style={{ fontSize:11 }} onClick={publicarOrganico} disabled={publicandoOrg}>
                          {publicandoOrg?'⏳ Publicando...':'📲 Publicar Agora'}
                        </button>
                      )}
                      <button className="btn btn-secondary" style={{ fontSize:11 }} onClick={()=>{ setImgResultado(null); setImgUrl(''); setImgStatus('rascunho') }}>🔄 Recriar</button>
                    </div>
                  </div>

                  <div style={{ display:'grid',gridTemplateColumns:imgUrl?'280px 1fr':'1fr',gap:16 }}>
                    {/* Imagem */}
                    <div>
                      {imgUrl ? (
                        <div>
                          <img src={imgUrl} alt="gerado" className="img-preview"/>
                          <div style={{ display:'flex',gap:6,marginTop:8,flexWrap:'wrap' }}>
                            <a href={imgUrl} download="conteudo.jpg" className="btn btn-secondary" style={{ fontSize:10,padding:'4px 10px',textDecoration:'none' }}>⬇️ Baixar</a>
                            <button onClick={()=>{ setImgUrl(''); setGerandoImagemReal(true); gerarImagemHF(imgResultado.promptImagem,cfg).then(url=>{ if(url)setImgUrl(url); setGerandoImagemReal(false) }) }}
                              style={{ padding:'4px 10px',borderRadius:7,background:'rgba(255,255,255,.04)',border:'1px solid #1e2d4a',color:'#64748b',fontFamily:'DM Mono',fontSize:10,cursor:'pointer' }}>
                              🔄 Regenerar
                            </button>
                            <button onClick={()=>setImgUrl('')}
                              style={{ padding:'4px 10px',borderRadius:7,background:'rgba(245,158,11,.06)',border:'1px solid rgba(245,158,11,.2)',color:'#f59e0b',fontFamily:'DM Mono',fontSize:10,cursor:'pointer' }}>
                              🎨 Editar Prompt
                            </button>
                          </div>
                        </div>
                      ) : gerandoImagemReal ? (
                        <div className="img-placeholder"><div style={{ textAlign:'center' }}><div style={{ fontSize:32,marginBottom:8 }}>⏳</div><div style={{ fontSize:11,color:'#64748b' }}>Gerando imagem...</div></div></div>
                      ) : (
                        <div>
                          <div className="img-placeholder"><div style={{ textAlign:'center' }}><div style={{ fontSize:32,marginBottom:8 }}>🎨</div><div style={{ fontSize:11,color:'#64748b' }}>Prompt disponível</div></div></div>
                          {imgResultado.promptImagem && (
                            <div style={{ marginTop:8,padding:'12px 14px',background:'rgba(245,158,11,.06)',border:'1px solid rgba(245,158,11,.2)',borderRadius:10 }}>
                              <div style={{ fontSize:10,color:'#f59e0b',fontWeight:700,marginBottom:6 }}>🎨 Estilo visual</div>
                              <div style={{ display:'flex',gap:5,flexWrap:'wrap',marginBottom:8 }}>
                                {[['photorealistic','📷 Foto'],['3D render','🧊 3D'],['flat illustration','🎨 Ilust.'],['cartoon','🖼️ Cartoon'],['cinematic','🎬 Cinem.'],['minimalist','⬜ Minim.']].map(([v,l])=>(
                                  <button key={v}
                                    onClick={()=>{
                                      const base = imgResultado.promptImagem.replace(/,?\s*(photorealistic|3D render|flat illustration|cartoon|cinematic|minimalist)[^,]*/gi,'').trim()
                                      setImgResultado(prev=>({...prev,promptImagem:`${base}, ${v} style`}))
                                    }}
                                    style={{ padding:'3px 9px',borderRadius:20,border:'1px solid rgba(245,158,11,.3)',background:imgResultado.promptImagem?.includes(v)?'rgba(245,158,11,.2)':'transparent',color:imgResultado.promptImagem?.includes(v)?'#f59e0b':'#64748b',fontFamily:'DM Mono',fontSize:9,cursor:'pointer' }}>
                                    {l}
                                  </button>
                                ))}
                              </div>
                              <textarea value={imgResultado.promptImagem} onChange={e=>setImgResultado(prev=>({...prev,promptImagem:e.target.value}))}
                                style={{ width:'100%',background:'rgba(0,0,0,.3)',border:'1px solid rgba(245,158,11,.2)',borderRadius:7,padding:'7px 10px',fontFamily:'DM Mono',fontSize:11,color:'#94a3b8',outline:'none',resize:'vertical',minHeight:60,lineHeight:1.6 }}/>
                              <div style={{ display:'flex',gap:6,marginTop:6 }}>
                                <button className="btn btn-gold" style={{ fontSize:10,padding:'4px 12px' }}
                                  onClick={()=>{ setGerandoImagemReal(true); gerarImagemHF(imgResultado.promptImagem,cfg).then(url=>{ if(url)setImgUrl(url); else toast('⚠️ Falha na geração','warn'); setGerandoImagemReal(false) }) }}>
                                  ✨ Gerar Imagem
                                </button>
                                <button onClick={()=>navigator.clipboard.writeText(imgResultado.promptImagem)} style={{ padding:'4px 10px',borderRadius:7,background:'none',border:'1px solid rgba(245,158,11,.2)',color:'#64748b',fontFamily:'DM Mono',fontSize:10,cursor:'pointer' }}>📋 Copiar</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Conteúdo textual */}
                    <div>
                      <div style={{ display:'flex',gap:6,flexWrap:'wrap',marginBottom:10 }}>
                        {(()=>{ const p=PLATAFORMAS.find(pl=>pl.id===imgResultado._plataforma); return p?<span style={{ padding:'3px 9px',borderRadius:20,fontSize:10,fontWeight:700,background:p.color+'22',color:p.color,border:`1px solid ${p.color}44` }}>{p.icon} {p.label}</span>:null })()}
                        <span className="badge badge-purple">{imgResultado.tipoMidia==='video'?'🎥 Vídeo':'🖼️ Imagem'}</span>
                        {imgResultado.estiloVisual && (()=>{
                          const est = ESTILOS_VISUAIS.find(e=>e.id===imgResultado.estiloVisual)
                          return est
                            ? <span style={{ padding:'3px 9px',borderRadius:20,fontSize:10,fontWeight:600,background:`${est.color}18`,color:est.color,border:`1px solid ${est.color}44` }}>{est.label}</span>
                            : <span className="badge badge-blue">{imgResultado.estiloVisual}</span>
                        })()}
                        {imgResultado.melhorHorario && <span className="badge badge-yellow">⏰ {imgResultado.melhorHorario}</span>}
                      </div>

                      {/* Justificativa + dica de engajamento */}
                      {(imgResultado.justificativa||imgResultado.dica_engajamento) && (
                        <div style={{ marginBottom:12,padding:'9px 13px',background:'rgba(16,185,129,.06)',border:'1px solid rgba(16,185,129,.2)',borderRadius:9 }}>
                          {imgResultado.justificativa && <div style={{ fontSize:11,color:'#10b981',marginBottom:imgResultado.dica_engajamento?5:0 }}>🎯 {imgResultado.justificativa}</div>}
                          {imgResultado.dica_engajamento && <div style={{ fontSize:11,color:'#64748b' }}>💡 {imgResultado.dica_engajamento}</div>}
                        </div>
                      )}

                      <div style={{ fontSize:11,color:'#64748b',textTransform:'uppercase',letterSpacing:1,marginBottom:6 }}>📝 Legenda</div>
                      <div style={{ background:'rgba(0,0,0,.2)',borderRadius:8,padding:'12px 14px',fontSize:13,color:'#e2e8f0',lineHeight:1.7,whiteSpace:'pre-wrap',maxHeight:180,overflowY:'auto',marginBottom:10 }}>
                        {imgResultado.legenda}
                      </div>
                      <button onClick={()=>navigator.clipboard.writeText(imgResultado.legenda)} style={{ background:'none',border:'none',color:'#64748b',cursor:'pointer',fontSize:11,marginBottom:12 }}>📋 Copiar legenda</button>

                      {imgResultado.cta && (
                        <div style={{ padding:'8px 12px',background:'rgba(124,58,237,.1)',border:'1px solid rgba(124,58,237,.25)',borderRadius:8,fontSize:12,color:'#a78bfa',fontWeight:600,marginBottom:10 }}>
                          🔗 CTA: {imgResultado.cta}
                        </div>
                      )}

                      {(imgResultado.hashtags||[]).length > 0 && (
                        <div>
                          <div style={{ fontSize:11,color:'#64748b',marginBottom:6 }}>🏷️ Hashtags</div>
                          <div style={{ display:'flex',flexWrap:'wrap',gap:5 }}>
                            {imgResultado.hashtags.map((h,i) => <span key={i} className="badge badge-blue">{h}</span>)}
                          </div>
                          <button onClick={()=>navigator.clipboard.writeText(imgResultado.hashtags.join(' '))} style={{ background:'none',border:'none',color:'#64748b',cursor:'pointer',fontSize:10,marginTop:6 }}>📋 Copiar todas</button>
                        </div>
                      )}

                      {imgResultado.roteiro && imgResultado.roteiro !== 'null' && (
                        <div style={{ marginTop:12,padding:'10px 14px',background:'rgba(239,68,68,.06)',border:'1px solid rgba(239,68,68,.2)',borderRadius:8 }}>
                          <div style={{ fontSize:11,color:'#ef4444',fontWeight:700,marginBottom:6 }}>🎬 Roteiro do Vídeo</div>
                          <div style={{ fontSize:12,color:'#94a3b8',lineHeight:1.8,whiteSpace:'pre-wrap',maxHeight:160,overflowY:'auto' }}>{imgResultado.roteiro}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Resultados de publicação orgânica */}
                  {orgResultados.length > 0 && (
                    <div style={{ marginTop:16,padding:'14px 16px',background:'rgba(0,0,0,.2)',borderRadius:10 }}>
                      <div style={{ fontSize:12,fontWeight:700,color:'#e2e8f0',marginBottom:10 }}>📊 Resultado da Publicação</div>
                      {orgResultados.map((r,i) => (
                        <div key={i} style={{ display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderRadius:8,marginBottom:6,background:r.ok?'rgba(16,185,129,.08)':'rgba(239,68,68,.08)',border:`1px solid ${r.ok?'rgba(16,185,129,.2)':'rgba(239,68,68,.2)'}` }}>
                          <span style={{ fontSize:18 }}>{r.icon}</span>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:12,fontWeight:600,color:'#e2e8f0' }}>{r.plataforma}</div>
                            {r.ok ? <div style={{ fontSize:11,color:'#10b981' }}>✅ Publicado {r.postId?`· ID: ${r.postId}`:''}</div>
                                  : <div style={{ fontSize:11,color:'#ef4444' }}>❌ {r.erro}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Chat de refinamento */}
                <div className="card" style={{ borderColor:'rgba(124,58,237,.25)' }}>
                  <div className="card-title">🤖 Refinar Conteúdo com o Agente</div>
                  <div className="chat-area">
                    {imgRefineMsgs.map((m,i) => <div key={i} className={`chat-msg ${m.role}`}>{m.content}</div>)}
                    <div ref={imgRefineEndRef}/>
                  </div>
                  <div className="chat-input-row">
                    <input value={imgRefineInput} onChange={e=>setImgRefineInput(e.target.value)}
                      onKeyDown={e=>e.key==='Enter'&&refinarConteudo()}
                      placeholder="Ex: 'Tom mais descontraído', 'Crie uma variação para Stories', 'Legenda mais curta'..."/>
                    <button className="btn btn-purple" onClick={refinarConteudo} disabled={!imgRefineInput.trim()}>➤</button>
                  </div>
                </div>
              </div>
            )}

            {!imgResultado && <AgenteChat cfg={cfg} cores={cores} contexto={`Aba de criação de conteúdo. Nicho: ${nichoImg||'não definido'}. Plataforma: ${plataformaImg}.`}/>}

            {/* Conteúdos anteriores */}
            {(cfg.mktConteudos||[]).length > 0 && (
              <div className="card">
                <div className="card-title">📚 Conteúdos Criados</div>
                {[...(cfg.mktConteudos||[])].reverse().slice(0,5).map(c => (
                  <div key={c.id} style={{ padding:'10px 14px',background:'#1a2540',borderRadius:8,marginBottom:6,display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                    <div style={{ display:'flex',gap:10,alignItems:'center' }}>
                      {c.imagemUrl && <img src={c.imagemUrl} alt="" style={{ height:36,width:36,borderRadius:6,objectFit:'cover' }} onError={e=>e.target.style.display='none'}/>}
                      <div>
                        <div style={{ fontSize:13,color:'#e2e8f0',fontWeight:600 }}>{c.tipoMidia==='video'?'🎥':'🖼️'} {c.titulo}</div>
                        <div style={{ fontSize:11,color:'#64748b',marginTop:2 }}>{c._plataforma} · {c._nicho} · {c._criadoEm?new Date(c._criadoEm).toLocaleDateString('pt-BR'):''}</div>
                      </div>
                    </div>
                    <button className="btn btn-secondary" style={{ fontSize:10,padding:'3px 10px' }} onClick={()=>{ setImgResultado(c); setImgUrl(c.imagemUrl||'') }}>👁 Ver</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            ABA: AGENDA DE PUBLICAÇÃO
        ══════════════════════════════════════════════════════ */}
        {aba === 'agenda' && (
          <div>
            {/* Controles */}
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,flexWrap:'wrap',gap:10 }}>
              <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
                {[['dia','Dia'],['semana','Semana'],['mes','Mês']].map(([v,l]) => (
                  <button key={v} onClick={()=>setVistaAgenda(v)}
                    style={{ padding:'7px 14px',borderRadius:8,border:'none',cursor:'pointer',fontFamily:'DM Mono, monospace',fontSize:11,background:vistaAgenda===v?'linear-gradient(135deg,#7c3aed,#5b21b6)':'rgba(255,255,255,.04)',color:vistaAgenda===v?'#fff':'#64748b',outline:vistaAgenda===v?'none':'1px solid #1e2d4a' }}>
                    {l}
                  </button>
                ))}
                <div style={{ width:1,background:'#1e2d4a',margin:'0 2px' }}/>
                {vistaAgenda==='semana' && <>
                  <button className="btn btn-secondary" style={{ fontSize:11,padding:'6px 12px' }} onClick={()=>setOffsetSemana(s=>s-1)}>← Anterior</button>
                  <button className="btn btn-secondary" style={{ fontSize:11,padding:'6px 12px' }} onClick={()=>setOffsetSemana(0)}>Hoje</button>
                  <button className="btn btn-secondary" style={{ fontSize:11,padding:'6px 12px' }} onClick={()=>setOffsetSemana(s=>s+1)}>Próxima →</button>
                </>}
                {vistaAgenda==='mes' && <>
                  <button className="btn btn-secondary" style={{ fontSize:11,padding:'6px 12px' }} onClick={()=>setOffsetMes(m=>m-1)}>← Anterior</button>
                  <button className="btn btn-secondary" style={{ fontSize:11,padding:'6px 12px' }} onClick={()=>setOffsetMes(0)}>Hoje</button>
                  <button className="btn btn-secondary" style={{ fontSize:11,padding:'6px 12px' }} onClick={()=>setOffsetMes(m=>m+1)}>Próximo →</button>
                </>}
                {vistaAgenda==='dia' && (
                  <input type="date" value={diaFoco} onChange={e=>setDiaFoco(e.target.value)}
                    style={{ background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:8,padding:'6px 12px',fontFamily:'DM Mono',fontSize:12,color:'#e2e8f0',outline:'none' }}/>
                )}
              </div>
              <button className="btn btn-purple" onClick={()=>{ setFormPost(getFormPostVazio()); setShowFormPost(true) }}>+ Novo Post</button>
            </div>

            {/* Filtros */}
            <div style={{ display:'flex',gap:8,marginBottom:14,flexWrap:'wrap',alignItems:'center' }}>
              <span style={{ fontSize:11,color:'#64748b' }}>Filtrar:</span>
              {[['todos','Todos'],['organico','🌱 Orgânico'],['pago','💰 Pago']].map(([v,l]) => (
                <button key={v} onClick={()=>setFiltroTipo(v)}
                  style={{ padding:'4px 12px',borderRadius:6,border:'none',cursor:'pointer',fontFamily:'DM Mono',fontSize:11,background:filtroTipo===v?'rgba(124,58,237,.2)':'rgba(255,255,255,.03)',color:filtroTipo===v?'#a78bfa':'#64748b',outline:filtroTipo===v?'1px solid rgba(124,58,237,.4)':'1px solid #1e2d4a' }}>
                  {l}
                </button>
              ))}
              <span style={{ color:'#1e2d4a' }}>|</span>
              {['todos','Pendente','Aprovado','Agendado','Publicado','Rejeitado'].map(s => (
                <button key={s} onClick={()=>setFiltroStatus(s)}
                  style={{ padding:'4px 12px',borderRadius:6,border:'none',cursor:'pointer',fontFamily:'DM Mono',fontSize:11,background:filtroStatus===s?'rgba(0,212,255,.12)':'rgba(255,255,255,.03)',color:filtroStatus===s?'#00d4ff':'#64748b',outline:filtroStatus===s?'1px solid rgba(0,212,255,.3)':'1px solid #1e2d4a' }}>
                  {s==='todos'?'Todos os status':s}
                </button>
              ))}
            </div>

            {/* Vista Dia */}
            {vistaAgenda==='dia' && (
              <div className="card">
                <div style={{ fontSize:14,fontWeight:700,color:'#e2e8f0',marginBottom:14,fontFamily:'Syne, sans-serif' }}>
                  📅 {new Date(diaFoco+'T12:00').toLocaleDateString('pt-BR',{ weekday:'long',day:'numeric',month:'long' })}
                </div>
                {getPostsDoDia(new Date(diaFoco+'T12:00')).length===0
                  ? <div style={{ textAlign:'center',color:'#64748b',padding:30,fontSize:13 }}>Nenhum post neste dia</div>
                  : getPostsDoDia(new Date(diaFoco+'T12:00')).sort((a,b)=>a.horario>b.horario?1:-1).map(post => (
                    <PostCard key={post.id} post={post}
                      onVer={()=>setPostPreview(post)} onEditar={()=>{ setFormPost(post);setShowFormPost(true) }}
                      onExcluir={()=>excluirPost(post.id)} onAprovar={()=>mudarStatusPost(post.id,'Aprovado')}
                      onRejeitar={()=>mudarStatusPost(post.id,'Rejeitado')} onPublicar={()=>publicarPostDireto(post)} />
                  ))
                }
              </div>
            )}

            {/* Vista Semana */}
            {vistaAgenda==='semana' && (
              <div className="card">
                <div className="agenda-grid-week">
                  {diasSemana.map((dia,i) => {
                    const pd = getPostsDoDia(dia)
                    const isHoje = dia.toDateString()===new Date().toDateString()
                    return (
                      <div key={i} className="agenda-day" style={{ borderColor:isHoje?'rgba(124,58,237,.5)':'#1e2d4a',background:isHoje?'rgba(124,58,237,.05)':'#1a2540' }}>
                        <div style={{ textAlign:'center',fontSize:10,color:isHoje?'#a78bfa':'#64748b',marginBottom:6 }}>
                          {DIAS_SEMANA[i]}<br/><span style={{ fontSize:14,fontWeight:isHoje?700:400 }}>{dia.getDate()}</span>
                        </div>
                        {pd.map(post => {
                          const plat = PLATAFORMAS.find(p=>p.id===post.plataforma)
                          const st = COR_STATUS[post.status]||COR_STATUS['Agendado']
                          return (
                            <div key={post.id} className="agenda-post-pill"
                              style={{ background:st.bg,borderLeftColor:plat?.color||st.cor,color:st.cor }} onClick={()=>setPostPreview(post)}>
                              {plat?.icon} {post.horario} {post.titulo.slice(0,14)}
                              {post.tipo==='pago'&&<span style={{ fontSize:8,color:'#f59e0b' }}> $</span>}
                            </div>
                          )
                        })}
                        <button onClick={()=>{ setFormPost({ ...getFormPostVazio(),data:dia.toISOString().slice(0,10) });setShowFormPost(true) }}
                          style={{ width:'100%',background:'none',border:'1px dashed #1e2d4a',borderRadius:4,color:'#2a3a5a',fontSize:10,cursor:'pointer',padding:2,marginTop:4 }}>+</button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Vista Mês */}
            {vistaAgenda==='mes' && (
              <div className="card">
                <div style={{ fontSize:14,fontWeight:700,color:'#e2e8f0',marginBottom:14,fontFamily:'Syne, sans-serif' }}>{MESES_FULL[mesMes]} {anoMes}</div>
                <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4,marginBottom:4 }}>
                  {DIAS_SEMANA.map(d => <div key={d} style={{ textAlign:'center',fontSize:10,color:'#64748b',fontWeight:600,padding:'4px 0' }}>{d}</div>)}
                </div>
                <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3 }}>
                  {diasMes.map((dia,i) => {
                    if (!dia) return <div key={i}/>
                    const pd = getPostsDoDia(dia)
                    const isHoje = dia.toDateString()===new Date().toDateString()
                    return (
                      <div key={i} style={{ background:isHoje?'rgba(124,58,237,.08)':'#1a2540',border:`1px solid ${isHoje?'rgba(124,58,237,.4)':'#1e2d4a'}`,borderRadius:7,padding:'5px 4px',minHeight:65,cursor:'pointer' }}
                        onClick={()=>{ setDiaFoco(dia.toISOString().slice(0,10));setVistaAgenda('dia') }}>
                        <div style={{ textAlign:'center',fontSize:11,color:isHoje?'#a78bfa':'#64748b',fontWeight:isHoje?700:400,marginBottom:3 }}>{dia.getDate()}</div>
                        {pd.slice(0,3).map(post => {
                          const plat = PLATAFORMAS.find(p=>p.id===post.plataforma)
                          return (
                            <div key={post.id} style={{ fontSize:9,padding:'2px 3px',borderRadius:3,marginBottom:2,background:COR_STATUS[post.status]?.bg||'rgba(0,212,255,.1)',color:plat?.color||'#00d4ff',borderLeft:`2px solid ${plat?.color||'#00d4ff'}`,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                              {plat?.icon} {post.titulo.slice(0,10)}
                            </div>
                          )
                        })}
                        {pd.length>3 && <div style={{ fontSize:9,color:'#64748b',textAlign:'center' }}>+{pd.length-3}</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Lista de posts */}
            <div className="card">
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
                <div className="card-title" style={{ margin:0 }}>📋 Todos os Posts</div>
                <div style={{ display:'flex',gap:6 }}>
                  {postsPendentes>0 && <span className="badge badge-yellow">{postsPendentes} pendentes</span>}
                  <span className="badge badge-green">{postsPublicados} publicados</span>
                </div>
              </div>
              {postsPendentes>0 && (
                <div style={{ padding:'10px 14px',background:'rgba(245,158,11,.08)',border:'1px solid rgba(245,158,11,.25)',borderRadius:8,fontSize:12,color:'#f59e0b',marginBottom:12 }}>
                  ⚠️ <strong>{postsPendentes} post(s)</strong> aguardando sua aprovação.
                </div>
              )}
              {posts.length===0 ? <div style={{ textAlign:'center',color:'#64748b',padding:20,fontSize:13 }}>Nenhum post criado</div>
              : [...posts].sort((a,b)=>a.data>b.data?1:-1)
                .filter(p=>(filtroTipo==='todos'||p.tipo===filtroTipo)&&(filtroStatus==='todos'||p.status===filtroStatus))
                .map(post => (
                  <PostCard key={post.id} post={post}
                    onVer={()=>setPostPreview(post)} onEditar={()=>{ setFormPost(post);setShowFormPost(true) }}
                    onExcluir={()=>excluirPost(post.id)} onAprovar={()=>mudarStatusPost(post.id,'Aprovado')}
                    onRejeitar={()=>mudarStatusPost(post.id,'Rejeitado')} onPublicar={()=>publicarPostDireto(post)} />
                ))
              }
            </div>

            {/* Modal: Preview do post */}
            {postPreview && (
              <div className="modal-bg" onClick={()=>setPostPreview(null)}>
                <div className="modal-box" onClick={e=>e.stopPropagation()}>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14 }}>
                    <div style={{ fontFamily:'Syne, sans-serif',fontSize:15,fontWeight:700,color:'#e2e8f0' }}>{postPreview.titulo}</div>
                    <button onClick={()=>setPostPreview(null)} style={{ background:'none',border:'none',color:'#64748b',fontSize:20,cursor:'pointer' }}>✕</button>
                  </div>
                  <div style={{ display:'flex',gap:6,flexWrap:'wrap',marginBottom:12 }}>
                    {(() => { const p=PLATAFORMAS.find(pl=>pl.id===postPreview.plataforma); return p?<span style={{ padding:'3px 9px',borderRadius:20,fontSize:10,fontWeight:700,background:p.color+'22',color:p.color,border:`1px solid ${p.color}44` }}>{p.icon} {p.label}</span>:null })()}
                    <span className="badge" style={{ background:COR_STATUS[postPreview.status]?.bg,color:COR_STATUS[postPreview.status]?.cor,border:`1px solid ${COR_STATUS[postPreview.status]?.border}` }}>{postPreview.status}</span>
                    <span className={`badge ${postPreview.tipo==='pago'?'badge-yellow':'badge-green'}`}>{postPreview.tipo==='pago'?'💰 Pago':'🌱 Orgânico'}</span>
                    {postPreview.tipoMidia && <span className="badge badge-purple">{postPreview.tipoMidia==='video'?'🎥 Vídeo':'🖼️ Imagem'}</span>}
                  </div>
                  <div style={{ fontSize:12,color:'#64748b',marginBottom:12 }}>📅 {postPreview.data} às {postPreview.horario}</div>

                  {/* Imagem */}
                  {postPreview.imagemUrl ? (
                    <img src={postPreview.imagemUrl} alt="post" className="img-preview" style={{ marginBottom:14 }} onError={e=>e.target.style.display='none'}/>
                  ) : (
                    <div className="img-placeholder" style={{ height:160,marginBottom:14 }}>
                      <div style={{ textAlign:'center' }}><div style={{ fontSize:32,marginBottom:6 }}>{postPreview.tipoMidia==='video'?'🎥':'🖼️'}</div><div style={{ fontSize:11,color:'#64748b' }}>Sem imagem</div></div>
                    </div>
                  )}

                  {postPreview.descricao && (
                    <div style={{ background:'#1a2540',borderRadius:8,padding:'12px 14px',fontSize:13,color:'#e2e8f0',lineHeight:1.7,marginBottom:10,whiteSpace:'pre-wrap',maxHeight:160,overflowY:'auto' }}>
                      {postPreview.descricao}
                    </div>
                  )}
                  {postPreview.cta && <div style={{ padding:'8px 12px',background:'rgba(124,58,237,.1)',border:'1px solid rgba(124,58,237,.25)',borderRadius:8,fontSize:12,color:'#a78bfa',marginBottom:10 }}>🔗 {postPreview.cta}</div>}
                  {postPreview.hashtags && <div style={{ fontSize:11,color:'#475569',marginBottom:12 }}>{postPreview.hashtags}</div>}
                  {postPreview.promptImagem && (
                    <div style={{ padding:'8px 12px',background:'rgba(245,158,11,.06)',border:'1px solid rgba(245,158,11,.2)',borderRadius:8,fontSize:11,color:'#94a3b8',marginBottom:12,fontStyle:'italic' }}>
                      🎨 {postPreview.promptImagem.slice(0,150)}...
                    </div>
                  )}

                  <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
                    {postPreview.status==='Pendente' && <>
                      <button className="btn btn-green" style={{ flex:1,justifyContent:'center' }} onClick={()=>mudarStatusPost(postPreview.id,'Aprovado')}>✅ Aprovar</button>
                      <button className="btn btn-red" style={{ flex:1,justifyContent:'center' }} onClick={()=>mudarStatusPost(postPreview.id,'Rejeitado')}>❌ Rejeitar</button>
                    </>}
                    {postPreview.status==='Aprovado' && (
                      <button className="btn btn-purple" style={{ flex:1,justifyContent:'center' }} onClick={()=>publicarPostDireto(postPreview)}>📢 Publicar Agora</button>
                    )}
                    {postPreview.status==='Publicado' && (
                      <span className="badge badge-green" style={{ padding:'8px 14px',fontSize:12 }}>✅ Já Publicado</span>
                    )}
                    <button className="btn btn-secondary" onClick={()=>{ setFormPost(postPreview);setShowFormPost(true);setPostPreview(null) }}>✏️ Editar</button>
                    <button className="btn btn-secondary" style={{ color:'#ef4444',borderColor:'rgba(239,68,68,.3)' }} onClick={()=>{ excluirPost(postPreview.id);setPostPreview(null) }}>🗑</button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal: Formulário de post */}
            {showFormPost && (
              <div className="modal-bg">
                <div className="modal-box">
                  <div style={{ display:'flex',justifyContent:'space-between',marginBottom:16 }}>
                    <span style={{ fontFamily:'Syne, sans-serif',fontSize:15,fontWeight:700,color:'#e2e8f0' }}>📅 {formPost.id?'Editar Post':'Novo Post'}</span>
                    <button onClick={()=>setShowFormPost(false)} style={{ background:'none',border:'none',color:'#64748b',fontSize:18,cursor:'pointer' }}>✕</button>
                  </div>
                  <div className="field"><label>Título</label><input value={formPost.titulo} onChange={e=>setFormPost(f=>({...f,titulo:e.target.value}))} placeholder="Título do post"/></div>
                  <div className="field"><label>Descrição / Legenda</label><textarea value={formPost.descricao} onChange={e=>setFormPost(f=>({...f,descricao:e.target.value}))} style={{ minHeight:90 }} placeholder="Legenda completa..."/></div>
                  <div className="field"><label>CTA</label><input value={formPost.cta||''} onChange={e=>setFormPost(f=>({...f,cta:e.target.value}))} placeholder="Ex: Clique no link da bio!"/></div>
                  <div className="field"><label>Hashtags</label><input value={formPost.hashtags||''} onChange={e=>setFormPost(f=>({...f,hashtags:e.target.value}))} placeholder="#marketing #vendas"/></div>
                  {/* ── Upload de Imagem (local ou URL) ── */}
                  <ImageUploadField
                    value={formPost.imagemUrl||''}
                    onChange={url=>setFormPost(f=>({...f,imagemUrl:url}))}
                    cfg={cfg}
                  />
                  <div className="grid2">
                    <div className="field"><label>Plataforma</label>
                      <select value={formPost.plataforma} onChange={e=>setFormPost(f=>({...f,plataforma:e.target.value}))} style={{ width:'100%',background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:8,padding:'9px 12px',fontFamily:'DM Mono, monospace',fontSize:13,color:'#e2e8f0',outline:'none' }}>
                        {PLATAFORMAS.map(p=><option key={p.id} value={p.id}>{p.icon} {p.label}</option>)}
                      </select>
                    </div>
                    <div className="field"><label>Tipo</label>
                      <select value={formPost.tipo||'organico'} onChange={e=>setFormPost(f=>({...f,tipo:e.target.value}))} style={{ width:'100%',background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:8,padding:'9px 12px',fontFamily:'DM Mono, monospace',fontSize:13,color:'#e2e8f0',outline:'none' }}>
                        <option value="organico">🌱 Orgânico</option><option value="pago">💰 Pago</option>
                      </select>
                    </div>
                    <div className="field"><label>Status</label>
                      <select value={formPost.status} onChange={e=>setFormPost(f=>({...f,status:e.target.value}))} style={{ width:'100%',background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:8,padding:'9px 12px',fontFamily:'DM Mono, monospace',fontSize:13,color:'#e2e8f0',outline:'none' }}>
                        {['Pendente','Aprovado','Agendado','Publicado','Rascunho','Rejeitado'].map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="field"><label>Tipo de Mídia</label>
                      <select value={formPost.tipoMidia||'imagem'} onChange={e=>setFormPost(f=>({...f,tipoMidia:e.target.value}))} style={{ width:'100%',background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:8,padding:'9px 12px',fontFamily:'DM Mono, monospace',fontSize:13,color:'#e2e8f0',outline:'none' }}>
                        <option value="imagem">🖼️ Imagem</option><option value="video">🎥 Vídeo</option><option value="carrossel">🎠 Carrossel</option><option value="stories">📲 Stories/Reels</option>
                      </select>
                    </div>
                    <div className="field"><label>Data</label><input type="date" value={formPost.data} onChange={e=>setFormPost(f=>({...f,data:e.target.value}))}/></div>
                    <div className="field"><label>Horário</label><input type="time" value={formPost.horario} onChange={e=>setFormPost(f=>({...f,horario:e.target.value}))}/></div>
                  </div>
                  <div style={{ display:'flex',gap:8,justifyContent:'flex-end',marginTop:8 }}>
                    <button className="btn btn-secondary" onClick={()=>setShowFormPost(false)}>Cancelar</button>
                    <button className="btn btn-purple" onClick={salvarPost} disabled={saving}>{saving?'⏳':'✅ Salvar'}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de campanha anterior — ✅ FIX principal */}
      <CampanhaModal
        campanha={campModalAberta}
        onClose={()=>setCampModalAberta(null)}
        onAprovar={aprovarCampanhaAnterior}
        onRecriar={recriarCampanhaAnterior}
        onEditar={(c)=>{ recriarCampanhaAnterior(c); }}
      />

      <div id="mkt-toast" className="toast"/>
    </>
  )
}
