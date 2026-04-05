// pages/prospeccao.js — Prospecção e Ferramentas Comerciais Vivanexa SaaS
// =========================================================================
// Submenus: Disparo em Massa, Chatbot, Agente IA, Script/Playbook Comercial
// =========================================================================

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

const CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  :root{
    --bg:#0a0f1e;--surface:#111827;--surface2:#1a2540;--border:#1e2d4a;
    --accent:#00d4ff;--accent2:#7c3aed;--accent3:#10b981;
    --text:#e2e8f0;--muted:#64748b;--danger:#ef4444;--gold:#f59e0b;
    --wpp:#25d366;
  }
  body{background:var(--bg);color:var(--text);font-family:'DM Mono',monospace;min-height:100vh}
  body::before{content:'';position:fixed;inset:0;
    background-image:linear-gradient(rgba(0,212,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,.02) 1px,transparent 1px);
    background-size:40px 40px;pointer-events:none;z-index:0}
  .page-wrap{max-width:1100px;margin:0 auto;padding:24px 16px;position:relative;z-index:1}
  .page-title{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:var(--text);margin-bottom:4px}
  .page-sub{font-size:12px;color:var(--muted);margin-bottom:20px}
  .tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:24px;border-bottom:1px solid var(--border);padding-bottom:12px}
  .tab-btn{padding:8px 16px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);
    color:var(--muted);font-family:'DM Mono',monospace;font-size:12px;cursor:pointer;transition:all .15s}
  .tab-btn.active{background:rgba(0,212,255,.12);border-color:rgba(0,212,255,.4);color:var(--accent);font-weight:600}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:16px}
  .card-title{font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px}
  .field{margin-bottom:12px}
  .field label{font-size:11px;color:var(--muted);display:block;margin-bottom:4px;letter-spacing:.5px;text-transform:uppercase}
  .field input,.field textarea,.field select{width:100%;background:var(--surface2);border:1px solid var(--border);
    border-radius:8px;padding:9px 12px;font-family:'DM Mono',monospace;font-size:13px;color:var(--text);
    outline:none;transition:border-color .2s;resize:vertical}
  .field input:focus,.field textarea:focus,.field select:focus{border-color:var(--accent)}
  .field textarea{min-height:80px}
  .btn{padding:9px 16px;border-radius:8px;border:none;font-family:'DM Mono',monospace;font-size:12px;
    font-weight:600;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:6px}
  .btn-primary{background:linear-gradient(135deg,var(--accent),#0099bb);color:#fff}
  .btn-primary:hover{box-shadow:0 0 16px rgba(0,212,255,.4);transform:translateY(-1px)}
  .btn-secondary{background:var(--surface2);border:1px solid var(--border);color:var(--muted)}
  .btn-secondary:hover{border-color:var(--accent);color:var(--accent)}
  .btn-wpp{background:linear-gradient(135deg,#25d366,#128c7e);color:#fff}
  .btn-wpp:hover{box-shadow:0 0 16px rgba(37,211,102,.4)}
  .btn-purple{background:linear-gradient(135deg,var(--accent2),#5b21b6);color:#fff}
  .btn-green{background:linear-gradient(135deg,var(--accent3),#059669);color:#fff}
  .btn:disabled{opacity:.5;cursor:not-allowed;transform:none!important}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
  @media(max-width:640px){.grid2,.grid3{grid-template-columns:1fr}}
  .badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:.5px}
  .badge-blue{background:rgba(0,212,255,.15);color:var(--accent);border:1px solid rgba(0,212,255,.3)}
  .badge-green{background:rgba(16,185,129,.15);color:var(--accent3);border:1px solid rgba(16,185,129,.3)}
  .badge-yellow{background:rgba(245,158,11,.15);color:var(--gold);border:1px solid rgba(245,158,11,.3)}
  .badge-red{background:rgba(239,68,68,.15);color:var(--danger);border:1px solid rgba(239,68,68,.3)}
  .result-box{background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:16px;
    font-size:13px;line-height:1.7;white-space:pre-wrap;color:var(--text);margin-top:12px;max-height:400px;overflow-y:auto}
  .thinking{display:flex;gap:6px;padding:8px 0}
  .thinking span{width:8px;height:8px;background:var(--accent);border-radius:50%;animation:bounce .6s infinite alternate}
  .thinking span:nth-child(2){animation-delay:.2s}
  .thinking span:nth-child(3){animation-delay:.4s}
  @keyframes bounce{from{transform:translateY(0)}to{transform:translateY(-6px)}}
  .chat-area{background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:14px;min-height:300px;max-height:420px;overflow-y:auto;display:flex;flex-direction:column;gap:10px}
  .chat-msg{max-width:78%;padding:10px 14px;border-radius:12px;font-size:13px;line-height:1.5}
  .chat-msg.bot{align-self:flex-start;background:var(--surface);border:1px solid var(--border);color:var(--text)}
  .chat-msg.user{align-self:flex-end;background:linear-gradient(135deg,rgba(0,212,255,.15),rgba(0,212,255,.08));border:1px solid rgba(0,212,255,.3);color:var(--text)}
  .chat-input-row{display:flex;gap:8px;margin-top:10px}
  .chat-input-row input{flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:8px;
    padding:9px 12px;font-family:'DM Mono',monospace;font-size:13px;color:var(--text);outline:none}
  .chat-input-row input:focus{border-color:var(--accent)}
  .contact-row{display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);border-radius:8px;margin-bottom:6px}
  .contact-check{width:16px;height:16px;accent-color:var(--accent);cursor:pointer}
  .progress-bar{height:4px;background:var(--border);border-radius:2px;overflow:hidden;margin-top:8px}
  .progress-fill{height:100%;background:linear-gradient(90deg,var(--accent),var(--accent3));border-radius:2px;transition:width .3s}
  .stat-row{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px}
  .stat-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 18px;flex:1;min-width:130px}
  .stat-val{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:var(--accent)}
  .stat-label{font-size:11px;color:var(--muted);margin-top:2px}
  .toast{position:fixed;bottom:24px;right:24px;padding:12px 20px;border-radius:10px;font-size:13px;
    font-family:'DM Mono',monospace;z-index:9999;opacity:0;transform:translateY(20px);transition:all .3s}
  .orb{position:fixed;border-radius:50%;filter:blur(120px);pointer-events:none;z-index:0;opacity:.06}
  .orb1{width:400px;height:400px;background:var(--accent);top:-100px;right:-100px}
  .orb2{width:300px;height:300px;background:var(--accent2);bottom:-100px;left:-100px}
  .section-label{font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:1px;margin:14px 0 8px;padding-bottom:6px;border-bottom:1px solid var(--border)}
  .info-box{padding:12px 16px;border-radius:10px;font-size:12px;line-height:1.6;margin-bottom:12px}
  .info-blue{background:rgba(0,212,255,.08);border:1px solid rgba(0,212,255,.2);color:#94a3b8}
`

function toast(msg, type = 'ok') {
  const el = document.getElementById('pros-toast')
  if (!el) return
  el.textContent = msg
  el.style.background = type === 'ok' ? 'rgba(16,185,129,.9)' : 'rgba(239,68,68,.9)'
  el.style.color = '#fff'
  el.style.opacity = '1'
  el.style.transform = 'translateY(0)'
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(20px)' }, 3000)
}

const TIPOS_SCRIPT = [
  { id: 'abordagem', label: '👋 Abordagem Inicial' },
  { id: 'apresentacao', label: '💼 Apresentação do Produto' },
  { id: 'objecao', label: '🛡️ Contorno de Objeções' },
  { id: 'followup', label: '🔄 Follow-up' },
  { id: 'fechamento', label: '🔥 Fechamento' },
  { id: 'reativacao', label: '♻️ Reativação de Clientes' },
]

export default function Prospeccao() {
  const router = useRouter()
  const { aba: abaQuery } = router.query
  const [aba, setAba] = useState('disparo')
  const [loading, setLoading] = useState(true)
  const [cfg, setCfg] = useState({})
  const [empresaId, setEmpresaId] = useState(null)
  const [saving, setSaving] = useState(false)

  // Disparo em Massa
  const [contatos, setContatos] = useState([])
  const [selecionados, setSelecionados] = useState([])
  const [mensagemDisparo, setMensagemDisparo] = useState('')
  const [disparando, setDisparando] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const [novoContato, setNovoContato] = useState({ nome: '', telefone: '', email: '' })
  const [showAddContato, setShowAddContato] = useState(false)

  // Chatbot
  const [chatbotNome, setChatbotNome] = useState('')
  const [chatbotPersonalidade, setChatbotPersonalidade] = useState('profissional')
  const [chatbotObjetivo, setChatbotObjetivo] = useState('vendas')
  const [chatbotPrompt, setChatbotPrompt] = useState('')
  const [gerandoChatbot, setGerandoChatbot] = useState(false)
  const [chatbotConfig, setChatbotConfig] = useState(null)

  // Agente IA — chat de teste
  const [agenteMessages, setAgenteMessages] = useState([])
  const [agenteInput, setAgenteInput] = useState('')
  const [agenteThinking, setAgenteThinking] = useState(false)
  const [providerAgente, setProviderAgente] = useState('gemini')
  const chatEndRef = useRef(null)

  // Script Comercial
  const [tipoScript, setTipoScript] = useState('abordagem')
  const [nichoScript, setNichoScript] = useState('')
  const [produtoScript, setProdutoScript] = useState('')
  const [gerandoScript, setGerandoScript] = useState(false)
  const [scriptResultado, setScriptResultado] = useState('')

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
      const eid = perf?.empresa_id || session.user.id
      setEmpresaId(eid)
      const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${eid}`).single()
      if (row?.value) {
        const c = JSON.parse(row.value)
        setCfg(c)
        setContatos(c.contatos || [])
        setChatbotConfig(c.chatbotConfig || null)
        setChatbotNome(c.chatbotConfig?.nome || c.company || '')
        setNichoScript(c.nicho || '')
        setProdutoScript(c.company || '')
        // Inicializa agente
        setAgenteMessages([{
          role: 'bot',
          content: `Olá! Sou o Agente IA da ${c.company || 'Vivanexa'}. Como posso ajudá-lo hoje?`
        }])
      }
      setLoading(false)
    }
    init()
  }, [router])

  useEffect(() => { if (abaQuery) setAba(abaQuery) }, [abaQuery])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [agenteMessages])

  async function salvarStorage(novoCfg) {
    await supabase.from('vx_storage').upsert({ key: `cfg:${empresaId}`, value: JSON.stringify(novoCfg), updated_at: new Date().toISOString() }, { onConflict: 'key' })
  }

  // ── Disparo em Massa ─────────────────────────────────────────
  async function adicionarContato() {
    if (!novoContato.nome || (!novoContato.telefone && !novoContato.email)) {
      toast('Informe nome e telefone ou e-mail', 'err'); return
    }
    const novo = { ...novoContato, id: String(Date.now()) }
    const novos = [...contatos, novo]
    setContatos(novos)
    const novoCfg = { ...cfg, contatos: novos }
    setCfg(novoCfg)
    await salvarStorage(novoCfg)
    setNovoContato({ nome: '', telefone: '', email: '' })
    setShowAddContato(false)
    toast('Contato adicionado!')
  }

  async function removerContato(id) {
    const novos = contatos.filter(c => c.id !== id)
    setContatos(novos)
    const novoCfg = { ...cfg, contatos: novos }
    setCfg(novoCfg)
    await salvarStorage(novoCfg)
  }

  async function dispararMensagens() {
    const alvos = selecionados.length > 0 ? contatos.filter(c => selecionados.includes(c.id)) : contatos
    if (alvos.length === 0) { toast('Selecione ou adicione contatos', 'err'); return }
    if (!mensagemDisparo) { toast('Digite a mensagem', 'err'); return }

    setDisparando(true)
    setProgresso(0)

    for (let i = 0; i < alvos.length; i++) {
      const contato = alvos[i]
      const msg = mensagemDisparo.replace(/\{nome\}/gi, contato.nome)

      if (contato.telefone) {
        const tel = contato.telefone.replace(/\D/g, '')
        const url = `https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`
        window.open(url, '_blank')
      }

      setProgresso(Math.round(((i + 1) / alvos.length) * 100))

      if (i < alvos.length - 1) {
        await new Promise(r => setTimeout(r, 2000))
      }
    }

    setDisparando(false)
    toast(`✅ ${alvos.length} mensagem(ns) disparada(s)!`)
  }

  // ── Chatbot Config ───────────────────────────────────────────
  async function gerarConfigChatbot() {
    const geminiKey = cfg.geminiKey || ''
    const groqKey = cfg.groqKey || ''
    if (!geminiKey && !groqKey) { toast('Configure a API em Configurações → Empresa', 'err'); return }
    if (!chatbotNome) { toast('Informe o nome do chatbot', 'err'); return }

    setGerandoChatbot(true)

    const prompt = `Crie um prompt de sistema completo para um chatbot de atendimento comercial com as seguintes características:

Nome: ${chatbotNome}
Personalidade: ${chatbotPersonalidade}
Objetivo Principal: ${chatbotObjetivo}
Empresa/Produto: ${cfg.company || 'Vivanexa'}
Nicho: ${cfg.nicho || 'Software'}

O prompt deve:
1. Definir claramente o papel e personalidade do assistente
2. Listar os principais objetivos e como alcançá-los
3. Definir tom e estilo de comunicação
4. Incluir exemplos de como responder às principais dúvidas
5. Definir como qualificar leads e coletar informações
6. Definir quando e como escalar para um humano
7. Incluir respostas para as 10 perguntas mais comuns

Crie um prompt profissional, completo e prático em português.`

    try {
      let resultado = ''
      if (geminiKey && geminiKey.startsWith('AIza')) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${geminiKey}`
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) })
        const data = await res.json()
        resultado = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      }
      if (!resultado && groqKey) {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'llama3-70b-8192', messages: [{ role: 'user', content: prompt }], temperature: 0.7 }) })
        const data = await res.json()
        resultado = data.choices?.[0]?.message?.content || ''
      }

      if (resultado) {
        const config = { nome: chatbotNome, personalidade: chatbotPersonalidade, objetivo: chatbotObjetivo, prompt: resultado, criadoEm: new Date().toISOString() }
        setChatbotConfig(config)
        setChatbotPrompt(resultado)
        const novoCfg = { ...cfg, chatbotConfig: config }
        setCfg(novoCfg)
        await salvarStorage(novoCfg)
        toast('Chatbot configurado!')
      }
    } catch (e) {
      toast('Erro: ' + e.message, 'err')
    }
    setGerandoChatbot(false)
  }

  // ── Agente IA ────────────────────────────────────────────────
  async function enviarMensagemAgente() {
    if (!agenteInput.trim()) return
    const userMsg = agenteInput.trim()
    setAgenteInput('')
    setAgenteMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setAgenteThinking(true)

    const geminiKey = cfg.geminiKey || ''
    const groqKey = cfg.groqKey || ''

    if (!geminiKey && !groqKey) {
      setAgenteThinking(false)
      setAgenteMessages(prev => [...prev, { role: 'bot', content: '⚠️ Configure a API do Gemini ou Groq em Configurações → Empresa para ativar o Agente IA.' }])
      return
    }

    const systemPrompt = chatbotConfig?.prompt || `Você é um assistente comercial da empresa ${cfg.company || 'Vivanexa'}. Seja prestativo, profissional e focado em ajudar o cliente.`
    const history = agenteMessages.slice(-10).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))
    history.push({ role: 'user', content: userMsg })

    try {
      let resposta = ''

      if ((providerAgente === 'gemini' || !groqKey) && geminiKey && geminiKey.startsWith('AIza')) {
        const contents = [
          { role: 'user', parts: [{ text: `SISTEMA: ${systemPrompt}` }] },
          { role: 'model', parts: [{ text: 'Entendido. Vou seguir essas diretrizes.' }] },
          ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] }))
        ]
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${geminiKey}`
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents }) })
        const data = await res.json()
        resposta = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      }

      if (!resposta && groqKey) {
        const msgs = [{ role: 'system', content: systemPrompt }, ...history]
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'llama3-70b-8192', messages: msgs, temperature: 0.7 }) })
        const data = await res.json()
        resposta = data.choices?.[0]?.message?.content || ''
      }

      setAgenteMessages(prev => [...prev, { role: 'bot', content: resposta || 'Sem resposta. Verifique as chaves de API.' }])
    } catch (e) {
      setAgenteMessages(prev => [...prev, { role: 'bot', content: 'Erro ao conectar com a IA: ' + e.message }])
    }
    setAgenteThinking(false)
  }

  // ── Script Comercial ─────────────────────────────────────────
  async function gerarScriptComercial() {
    const geminiKey = cfg.geminiKey || ''
    const groqKey = cfg.groqKey || ''
    if (!geminiKey && !groqKey) { toast('Configure a API em Configurações', 'err'); return }
    if (!nichoScript || !produtoScript) { toast('Preencha o nicho e o produto', 'err'); return }

    setGerandoScript(true)
    setScriptResultado('')

    const tipo = TIPOS_SCRIPT.find(t => t.id === tipoScript)

    const prompt = `Você é um especialista em vendas consultivas B2B e B2C para o mercado de ${nichoScript}.

Crie um ${tipo?.label || 'Script'} completo para:
- Produto/Serviço: ${produtoScript}
- Nicho: ${nichoScript}
- Canal: WhatsApp e ligação telefônica

Inclua:
1. 🎯 OBJETIVO DO SCRIPT
2. 📋 ROTEIRO COMPLETO passo a passo
   - Abertura
   - Desenvolvimento
   - Fechamento
3. 💬 FRASES EXATAS para usar (exemplos reais)
4. ❓ PERGUNTAS ESTRATÉGICAS
5. 🛡️ COMO LIDAR COM RESISTÊNCIAS
6. 🔥 TÉCNICAS DE PERSUASÃO aplicadas
7. ⏱️ TEMPO ESTIMADO de cada etapa
8. ✅ PRÓXIMOS PASSOS após o script

Use linguagem natural, direta e adaptada para o nicho ${nichoScript}.`

    try {
      let resultado = ''
      if (geminiKey && geminiKey.startsWith('AIza')) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${geminiKey}`
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) })
        const data = await res.json()
        resultado = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      }
      if (!resultado && groqKey) {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'llama3-70b-8192', messages: [{ role: 'user', content: prompt }], temperature: 0.7 }) })
        const data = await res.json()
        resultado = data.choices?.[0]?.message?.content || ''
      }
      if (resultado) {
        setScriptResultado(resultado)
        const novoCfg = { ...cfg, scripts: [...(cfg.scripts || []), { id: Date.now(), tipo: tipoScript, nicho: nichoScript, produto: produtoScript, resultado, criadoEm: new Date().toISOString() }] }
        setCfg(novoCfg)
        await salvarStorage(novoCfg)
        toast('Script criado!')
      }
    } catch (e) {
      toast('Erro: ' + e.message, 'err')
    }
    setGerandoScript(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0f1e', color: '#64748b', fontFamily: 'DM Mono, monospace' }}>
      Carregando Prospecção...
    </div>
  )

  return (
    <>
      <Head>
        <title>Prospecção — {cfg.company || 'Vivanexa'}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet" />
      </Head>
      <style>{CSS}</style>
      <div className="orb orb1" /><div className="orb orb2" />

      <Navbar cfg={cfg} perfil={perfil} />
      </header>

      <div className="page-wrap">
        <div className="page-title">📣 Ferramentas Comerciais</div>
        <div className="page-sub">Disparo em massa, chatbot, agente IA e scripts de vendas</div>

        {/* Stats */}
        <div className="stat-row">
          <div className="stat-card">
            <div className="stat-val">{contatos.length}</div>
            <div className="stat-label">Contatos</div>
          </div>
          <div className="stat-card">
            <div className="stat-val">{chatbotConfig ? '✅' : '❌'}</div>
            <div className="stat-label">Chatbot Config</div>
          </div>
          <div className="stat-card">
            <div className="stat-val">{(cfg.scripts || []).length}</div>
            <div className="stat-label">Scripts Criados</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          <button className={`tab-btn ${aba === 'disparo' ? 'active' : ''}`} onClick={() => setAba('disparo')}>💬 Disparo em Massa</button>
          <button className={`tab-btn ${aba === 'chatbot' ? 'active' : ''}`} onClick={() => setAba('chatbot')}>🤖 Chatbot</button>
          <button className={`tab-btn ${aba === 'agente' ? 'active' : ''}`} onClick={() => setAba('agente')}>🧠 Agente IA</button>
          <button className={`tab-btn ${aba === 'script' ? 'active' : ''}`} onClick={() => setAba('script')}>📋 Script/Playbook</button>
        </div>

        {/* ── ABA DISPARO ── */}
        {aba === 'disparo' && (
          <div>
            <div className="info-box info-blue">
              💬 O disparo via WhatsApp abre automaticamente a conversa com cada contato. Para envios em larga escala, use a API oficial do WhatsApp Business (configure em Configurações → Empresa → API WhatsApp).
            </div>

            <div className="grid2">
              <div className="card">
                <div className="card-title">📝 Mensagem</div>
                <div className="field">
                  <label>Mensagem (use {'{nome}'} para personalizar)</label>
                  <textarea value={mensagemDisparo} onChange={e => setMensagemDisparo(e.target.value)} placeholder={'Olá {nome}! Tudo bem?\n\nSou da ' + (cfg.company || 'Vivanexa') + ' e gostaria de apresentar nossa solução...'} style={{ minHeight: 120 }} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-wpp" onClick={dispararMensagens} disabled={disparando || !mensagemDisparo}>
                    {disparando ? '⏳ Disparando...' : '🚀 Disparar via WhatsApp'}
                  </button>
                </div>
                {disparando && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{progresso}% concluído</div>
                    <div className="progress-bar"><div className="progress-fill" style={{ width: progresso + '%' }} /></div>
                  </div>
                )}
              </div>

              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div className="card-title" style={{ margin: 0 }}>👥 Contatos ({contatos.length})</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {selecionados.length > 0 && <span className="badge badge-blue">{selecionados.length} sel.</span>}
                    <button className="btn btn-secondary" style={{ fontSize: 10, padding: '4px 10px' }} onClick={() => setSelecionados(selecionados.length === contatos.length ? [] : contatos.map(c => c.id))}>
                      {selecionados.length === contatos.length ? 'Desmarcar' : 'Marcar todos'}
                    </button>
                    <button className="btn btn-primary" style={{ fontSize: 10, padding: '4px 10px' }} onClick={() => setShowAddContato(true)}>+</button>
                  </div>
                </div>

                <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                  {contatos.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#64748b', padding: 20, fontSize: 12 }}>Nenhum contato. Clique em + para adicionar.</div>
                  ) : contatos.map(c => (
                    <div key={c.id} className="contact-row">
                      <input type="checkbox" className="contact-check" checked={selecionados.includes(c.id)} onChange={() => setSelecionados(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id])} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>{c.nome}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{c.telefone}{c.email ? ' · ' + c.email : ''}</div>
                      </div>
                      <button onClick={() => removerContato(c.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14 }}>✕</button>
                    </div>
                  ))}
                </div>

                {showAddContato && (
                  <div style={{ marginTop: 12, padding: 12, background: '#0a0f1e', borderRadius: 10, border: '1px solid #1e2d4a' }}>
                    <div className="grid2">
                      <div className="field"><label>Nome</label><input value={novoContato.nome} onChange={e => setNovoContato(f => ({ ...f, nome: e.target.value }))} /></div>
                      <div className="field"><label>Telefone</label><input value={novoContato.telefone} onChange={e => setNovoContato(f => ({ ...f, telefone: e.target.value }))} placeholder="(11) 99999-0000" /></div>
                    </div>
                    <div className="field"><label>E-mail (opcional)</label><input value={novoContato.email} onChange={e => setNovoContato(f => ({ ...f, email: e.target.value }))} /></div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-primary" style={{ fontSize: 11 }} onClick={adicionarContato}>Adicionar</button>
                      <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={() => setShowAddContato(false)}>Cancelar</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── ABA CHATBOT ── */}
        {aba === 'chatbot' && (
          <div>
            <div className="card">
              <div className="card-title">🤖 Configuração do Chatbot</div>
              <div className="grid2">
                <div className="field">
                  <label>Nome do Chatbot</label>
                  <input value={chatbotNome} onChange={e => setChatbotNome(e.target.value)} placeholder="Ex: Sofia da Vivanexa" />
                </div>
                <div className="field">
                  <label>Personalidade</label>
                  <select value={chatbotPersonalidade} onChange={e => setChatbotPersonalidade(e.target.value)} style={{ width: '100%', background: '#1a2540', border: '1px solid #1e2d4a', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#e2e8f0', outline: 'none' }}>
                    <option value="profissional">Profissional e direto</option>
                    <option value="amigavel">Amigável e descontraído</option>
                    <option value="consultivo">Consultivo e técnico</option>
                    <option value="entusiasmado">Entusiasmado e vendedor</option>
                  </select>
                </div>
                <div className="field">
                  <label>Objetivo Principal</label>
                  <select value={chatbotObjetivo} onChange={e => setChatbotObjetivo(e.target.value)} style={{ width: '100%', background: '#1a2540', border: '1px solid #1e2d4a', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#e2e8f0', outline: 'none' }}>
                    <option value="vendas">Vendas diretas</option>
                    <option value="suporte">Suporte ao cliente</option>
                    <option value="leads">Qualificação de leads</option>
                    <option value="agendamento">Agendamento de reuniões</option>
                  </select>
                </div>
              </div>
              <button className="btn btn-primary" onClick={gerarConfigChatbot} disabled={gerandoChatbot} style={{ marginTop: 4 }}>
                {gerandoChatbot ? '⏳ Gerando...' : '✨ Gerar Configuração com IA'}
              </button>
              {gerandoChatbot && <div className="thinking" style={{ marginTop: 12 }}><span /><span /><span /></div>}
            </div>

            {(chatbotConfig || chatbotPrompt) && (
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div className="card-title" style={{ margin: 0 }}>✅ Prompt do Chatbot — {chatbotConfig?.nome}</div>
                  <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => navigator.clipboard.writeText(chatbotConfig?.prompt || chatbotPrompt)}>📋 Copiar</button>
                </div>
                <div className="result-box">{chatbotConfig?.prompt || chatbotPrompt}</div>
                <div className="info-box info-blue" style={{ marginTop: 12 }}>
                  💡 Copie este prompt e configure-o na plataforma de chatbot de sua preferência (ManyChat, ChatGuru, WhatsApp Business API, etc.)
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ABA AGENTE IA ── */}
        {aba === 'agente' && (
          <div>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div className="card-title" style={{ margin: 0 }}>🧠 Agente IA — Teste em tempo real</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#64748b' }}>IA:</span>
                  {cfg.geminiKey && <button onClick={() => setProviderAgente('gemini')} className={`btn ${providerAgente === 'gemini' ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: 10, padding: '3px 10px' }}>Gemini</button>}
                  {cfg.groqKey && <button onClick={() => setProviderAgente('groq')} className={`btn ${providerAgente === 'groq' ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: 10, padding: '3px 10px' }}>Groq</button>}
                  <button className="btn btn-secondary" style={{ fontSize: 10, padding: '3px 10px' }} onClick={() => setAgenteMessages([{ role: 'bot', content: `Olá! Sou o Agente IA da ${cfg.company || 'Vivanexa'}. Como posso ajudá-lo?` }])}>🔄 Reiniciar</button>
                </div>
              </div>

              {chatbotConfig && (
                <div style={{ padding: '6px 10px', background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 8, fontSize: 11, color: '#10b981', marginBottom: 10 }}>
                  ✅ Usando prompt do chatbot: <strong>{chatbotConfig.nome}</strong>
                </div>
              )}

              <div className="chat-area">
                {agenteMessages.map((m, i) => (
                  <div key={i} className={`chat-msg ${m.role}`}>{m.content}</div>
                ))}
                {agenteThinking && <div className="chat-msg bot"><div className="thinking"><span /><span /><span /></div></div>}
                <div ref={chatEndRef} />
              </div>

              <div className="chat-input-row">
                <input
                  value={agenteInput}
                  onChange={e => setAgenteInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') enviarMensagemAgente() }}
                  placeholder="Digite sua mensagem..."
                  disabled={agenteThinking}
                />
                <button className="btn btn-primary" onClick={enviarMensagemAgente} disabled={agenteThinking || !agenteInput.trim()}>
                  {agenteThinking ? '⏳' : '➤'}
                </button>
              </div>
            </div>

            {(!cfg.geminiKey && !cfg.groqKey) && (
              <div className="info-box" style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#fca5a5' }}>
                ⚠️ Configure a chave de API do <strong>Gemini</strong> ou <strong>Groq</strong> em <strong>Configurações → Empresa</strong> para ativar o Agente IA.
              </div>
            )}
          </div>
        )}

        {/* ── ABA SCRIPT/PLAYBOOK ── */}
        {aba === 'script' && (
          <div>
            <div className="card">
              <div className="card-title">📋 Gerador de Scripts Comerciais</div>
              <div className="grid2">
                <div className="field">
                  <label>Produto/Serviço</label>
                  <input value={produtoScript} onChange={e => setProdutoScript(e.target.value)} placeholder="Ex: Software de gestão contábil" />
                </div>
                <div className="field">
                  <label>Nicho de Mercado</label>
                  <input value={nichoScript} onChange={e => setNichoScript(e.target.value)} placeholder="Ex: Contabilidade, E-commerce..." />
                </div>
              </div>
              <div className="field">
                <label>Tipo de Script</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  {TIPOS_SCRIPT.map(t => (
                    <button key={t.id} onClick={() => setTipoScript(t.id)}
                      className={`btn ${tipoScript === t.id ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: 11 }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <button className="btn btn-primary" onClick={gerarScriptComercial} disabled={gerandoScript} style={{ marginTop: 8 }}>
                {gerandoScript ? '⏳ Gerando...' : '✨ Gerar Script com IA'}
              </button>
              {gerandoScript && <div className="thinking" style={{ marginTop: 12 }}><span /><span /><span /></div>}
              {scriptResultado && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: '#00d4ff' }}>✅ Script: {TIPOS_SCRIPT.find(t => t.id === tipoScript)?.label}</span>
                    <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => navigator.clipboard.writeText(scriptResultado)}>📋 Copiar</button>
                  </div>
                  <div className="result-box">{scriptResultado}</div>
                </div>
              )}
            </div>

            {/* Histórico */}
            {(cfg.scripts || []).length > 0 && (
              <div className="card">
                <div className="card-title">📜 Scripts Anteriores</div>
                {[...(cfg.scripts || [])].reverse().slice(0, 5).map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#1a2540', borderRadius: 8, marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>{TIPOS_SCRIPT.find(t => t.id === s.tipo)?.label} — {s.nicho}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{s.produto} · {new Date(s.criadoEm).toLocaleDateString('pt-BR')}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary" style={{ fontSize: 10, padding: '3px 8px' }} onClick={() => setScriptResultado(s.resultado)}>👁 Ver</button>
                      <button className="btn btn-secondary" style={{ fontSize: 10, padding: '3px 8px' }} onClick={() => navigator.clipboard.writeText(s.resultado)}>📋</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div id="pros-toast" className="toast" />
    </>
  )
}
