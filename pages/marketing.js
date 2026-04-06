// pages/marketing.js — Marketing Vivanexa SaaS
// =================================================
// Submenus: Campanhas IA, Geração de Imagens, Agenda de Publicação, Script/Playbook
// =================================================

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

// ── Estilos globais ─────────────────────────────────────────────
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
  .tab-btn.active{background:rgba(0,212,255,.12);border-color:rgba(0,212,255,.4);color:var(--accent);font-weight:600}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:16px}
  .card-title{font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:var(--text);margin-bottom:12px;display:flex;align-items:center;gap:8px}
  .field{margin-bottom:12px}
  .field label{font-size:11px;color:var(--muted);display:block;margin-bottom:4px;letter-spacing:.5px;text-transform:uppercase}
  .field input,.field textarea,.field select{width:100%;background:var(--surface2);border:1px solid var(--border);
    border-radius:8px;padding:9px 12px;font-family:'DM Mono',monospace;font-size:13px;color:var(--text);
    outline:none;transition:border-color .2s;resize:vertical}
  .field input:focus,.field textarea:focus,.field select:focus{border-color:var(--accent)}
  .field textarea{min-height:80px}
  .btn{padding:10px 18px;border-radius:8px;border:none;font-family:'DM Mono',monospace;font-size:12px;
    font-weight:600;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:6px}
  .btn-primary{background:linear-gradient(135deg,var(--accent),#0099bb);color:#fff}
  .btn-primary:hover{box-shadow:0 0 16px rgba(0,212,255,.4);transform:translateY(-1px)}
  .btn-secondary{background:var(--surface2);border:1px solid var(--border);color:var(--muted)}
  .btn-secondary:hover{border-color:var(--accent);color:var(--accent)}
  .btn-purple{background:linear-gradient(135deg,var(--accent2),#5b21b6);color:#fff}
  .btn-green{background:linear-gradient(135deg,var(--accent3),#059669);color:#fff}
  .btn:disabled{opacity:.5;cursor:not-allowed;transform:none!important}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
  @media(max-width:640px){.grid2,.grid3{grid-template-columns:1fr}}
  .result-box{background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:16px;
    font-size:13px;line-height:1.7;white-space:pre-wrap;color:var(--text);margin-top:12px;max-height:400px;overflow-y:auto}
  .badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:.5px}
  .badge-blue{background:rgba(0,212,255,.15);color:var(--accent);border:1px solid rgba(0,212,255,.3)}
  .badge-purple{background:rgba(124,58,237,.15);color:#a78bfa;border:1px solid rgba(124,58,237,.3)}
  .badge-green{background:rgba(16,185,129,.15);color:var(--accent3);border:1px solid rgba(16,185,129,.3)}
  .badge-yellow{background:rgba(245,158,11,.15);color:var(--gold);border:1px solid rgba(245,158,11,.3)}
  .tag-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
  .tag{padding:4px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:20px;
    font-size:11px;color:var(--muted);cursor:pointer;transition:all .12s}
  .tag:hover,.tag.active{background:rgba(0,212,255,.1);border-color:rgba(0,212,255,.4);color:var(--accent)}
  .agenda-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:12px}
  .agenda-day{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px;min-height:80px}
  .agenda-day-label{font-size:10px;color:var(--muted);margin-bottom:4px;text-align:center}
  .agenda-post{background:rgba(0,212,255,.08);border:1px solid rgba(0,212,255,.2);border-radius:4px;
    padding:3px 5px;font-size:10px;color:var(--accent);margin-bottom:2px;cursor:pointer;line-height:1.3}
  .platform-icon{width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
  .img-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-top:12px}
  .img-card{background:var(--surface2);border:1px solid var(--border);border-radius:10px;overflow:hidden}
  .img-placeholder{height:140px;background:linear-gradient(135deg,var(--surface2),#0f1f3d);display:flex;
    align-items:center;justify-content:center;font-size:40px}
  .img-info{padding:10px}
  .img-info .title{font-size:12px;font-weight:600;color:var(--text);margin-bottom:2px}
  .img-info .desc{font-size:11px;color:var(--muted);line-height:1.4}
  .thinking{display:flex;gap:6px;padding:8px 0}
  .thinking span{width:8px;height:8px;background:var(--accent);border-radius:50%;animation:bounce .6s infinite alternate}
  .thinking span:nth-child(2){animation-delay:.2s}
  .thinking span:nth-child(3){animation-delay:.4s}
  @keyframes bounce{from{transform:translateY(0)}to{transform:translateY(-6px)}}
  .toast{position:fixed;bottom:24px;right:24px;padding:12px 20px;border-radius:10px;font-size:13px;
    font-family:'DM Mono',monospace;z-index:9999;opacity:0;transform:translateY(20px);transition:all .3s}
  .orb{position:fixed;border-radius:50%;filter:blur(120px);pointer-events:none;z-index:0;opacity:.06}
  .orb1{width:400px;height:400px;background:var(--accent);top:-100px;right:-100px}
  .orb2{width:300px;height:300px;background:var(--accent2);bottom:-100px;left:-100px}
  .stat-row{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px}
  .stat-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 20px;flex:1;min-width:140px}
  .stat-val{font-family:'Syne',sans-serif;font-size:24px;font-weight:800;color:var(--accent)}
  .stat-label{font-size:11px;color:var(--muted);margin-top:2px}
`

const NICHOS = ['Contabilidade', 'E-commerce', 'Saúde', 'Educação', 'Imóveis', 'Restaurante', 'Tecnologia', 'Beleza', 'Fitness', 'Jurídico', 'Outro']
const PLATAFORMAS = [
  { id: 'instagram', label: 'Instagram', icon: '📸', color: '#e1306c' },
  { id: 'facebook', label: 'Facebook', icon: '👥', color: '#1877f2' },
  { id: 'tiktok', label: 'TikTok', icon: '🎵', color: '#ff0050' },
  { id: 'google', label: 'Google Ads', icon: '🔍', color: '#4285f4' },
  { id: 'whatsapp', label: 'WhatsApp', icon: '💬', color: '#25d366' },
]

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function toast(msg, type = 'ok') {
  const el = document.getElementById('mkt-toast')
  if (!el) return
  el.textContent = msg
  el.style.background = type === 'ok' ? 'rgba(16,185,129,.9)' : 'rgba(239,68,68,.9)'
  el.style.color = '#fff'
  el.style.opacity = '1'
  el.style.transform = 'translateY(0)'
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(20px)' }, 3000)
}

// Helper centralizado de IA — usa OpenAI, Gemini ou Groq com fallback automático
async function callAI(prompt, cfg, { temperature = 0.7, maxTokens = 2000 } = {}) {
  const openaiKey = cfg.openaiApiKey || cfg.openaiKey || ''
  const geminiKey = cfg.geminiApiKey || cfg.geminiKey || ''
  const groqKey   = cfg.groqApiKey   || cfg.groqKey   || ''

  if (!openaiKey && !geminiKey && !groqKey) {
    throw new Error('Nenhuma chave de IA configurada. Acesse Configurações → Empresa → 🤖 IA.')
  }

  // 1. Tenta OpenAI primeiro (se tiver chave)
  if (openaiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature, max_tokens: maxTokens })
      })
      const data = await res.json()
      const r = data.choices?.[0]?.message?.content
      if (r) return r
    } catch {}
  }

  // 2. Tenta Gemini
  if (geminiKey && geminiKey.startsWith('AIza')) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${geminiKey}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      })
      const data = await res.json()
      const r = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (r) return r
    } catch {}
  }

  // 3. Fallback Groq
  if (groqKey) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3-70b-8192', messages: [{ role: 'user', content: prompt }], temperature })
    })
    const data = await res.json()
    const r = data.choices?.[0]?.message?.content
    if (r) return r
  }

  throw new Error('Nenhuma IA respondeu. Verifique as chaves em Configurações → Empresa.')
}

export default function Marketing() {
  const router = useRouter()
  const { aba: abaQuery } = router.query
  const [aba, setAba] = useState('campanhas')
  const [loading, setLoading] = useState(true)
  const [cfg, setCfg] = useState({})
  const [empresaId, setEmpresaId] = useState(null)
  const [perfil, setPerfil] = useState(null)

  // Campanhas IA
  const [nicho, setNicho] = useState('')
  const [produto, setProduto] = useState('')
  const [objetivo, setObjetivo] = useState('conversao')
  const [orcamento, setOrcamento] = useState('')
  const [plataformasCamp, setPlataformasCamp] = useState([])
  const [gerandoCamp, setGerandoCamp] = useState(false)
  const [campResultado, setCampResultado] = useState('')

  // Imagens IA
  const [promptImg, setPromptImg] = useState('')
  const [nichoImg, setNichoImg] = useState('')
  const [plataformaImg, setPlataformaImg] = useState('instagram')
  const [gerandoImg, setGerandoImg] = useState(false)
  const [imagens, setImagens] = useState([])

  // Agenda
  const [posts, setPosts] = useState([])
  const [showFormPost, setShowFormPost] = useState(false)
  const [formPost, setFormPost] = useState({ id: '', titulo: '', descricao: '', plataforma: 'instagram', data: '', horario: '09:00', status: 'Agendado' })
  const [semanaAtual, setSemanaAtual] = useState(0)
  const [saving, setSaving] = useState(false)

  // Script/Playbook
  const [tipoScript, setTipoScript] = useState('venda')
  const [nichoScript, setNichoScript] = useState('')
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
        setNichoScript(c.nicho || '')
      }
      setLoading(false)
    }
    init()
  }, [router])

  useEffect(() => {
    if (abaQuery) setAba(abaQuery)
  }, [abaQuery])

  async function salvarStorage(novoCfg) {
    await supabase.from('vx_storage').upsert({
      key: `cfg:${empresaId}`,
      value: JSON.stringify(novoCfg),
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' })
  }

  // ── Gerador de Campanhas IA ──────────────────────────────────
  async function gerarCampanha() {
    const geminiKey = cfg.geminiApiKey || cfg.geminiKey || ''
    const groqKey = cfg.groqApiKey || cfg.groqKey || ''
    if (!geminiKey && !groqKey) {
      toast('Configure a API do Gemini ou Groq em Configurações → Empresa', 'err')
      return
    }
    if (!produto || !objetivo) { toast('Preencha produto e objetivo', 'err'); return }

    setGerandoCamp(true)
    setCampResultado('')

    const prompt = `Você é um especialista em marketing digital e campanhas de alta conversão.

DADOS DA CAMPANHA:
- Empresa/Produto: ${produto}
- Nicho de Mercado: ${nicho || 'Geral'}
- Objetivo: ${objetivo === 'conversao' ? 'Conversão (vendas diretas)' : objetivo === 'leads' ? 'Geração de Leads' : objetivo === 'branding' ? 'Branding e Reconhecimento' : 'Engajamento'}
- Orçamento mensal: ${orcamento ? 'R$ ' + orcamento : 'Não informado'}
- Plataformas: ${plataformasCamp.length > 0 ? plataformasCamp.join(', ') : 'Todas'}

Crie um plano completo de campanha digital com:

1. 📊 ESTRATÉGIA GERAL (objetivo, público-alvo, posicionamento)
2. 📱 CAMPANHAS POR PLATAFORMA (copy, headline, CTA para cada plataforma selecionada)
3. 🎯 SEGMENTAÇÃO RECOMENDADA (público, interesses, remarketing)
4. 💰 DISTRIBUIÇÃO DE ORÇAMENTO (% por plataforma)
5. 📅 CALENDÁRIO DE AÇÕES (semana 1 a 4)
6. 📈 KPIs E MÉTRICAS ESPERADAS
7. 🔥 3 COPIES DE ALTA CONVERSÃO prontos para usar

Responda em português, seja específico e prático.`

    try {
      const resultado = await callAI(prompt, cfg, { temperature: 0.7 })
      if (resultado) {
        setCampResultado(resultado)
        // Salvar no histórico
        const novoCfg = { ...cfg, mktCampanhas: [...(cfg.mktCampanhas || []), { id: Date.now(), produto, nicho, objetivo, resultado, criadoEm: new Date().toISOString() }] }
        setCfg(novoCfg)
        await salvarStorage(novoCfg)
        toast('Campanha gerada com sucesso!')
      } else {
        toast('Nenhuma IA respondeu. Verifique as chaves em Configurações', 'err')
      }
    } catch (e) {
      toast('Erro ao gerar campanha: ' + e.message, 'err')
    }
    setGerandoCamp(false)
  }

  // ── Gerador de Posts/Imagens ─────────────────────────────────
  async function gerarPost() {
    const geminiKey = cfg.geminiApiKey || cfg.geminiKey || ''
    const groqKey = cfg.groqApiKey || cfg.groqKey || ''
    if (!geminiKey && !groqKey) { toast('Configure a API em Configurações', 'err'); return }
    if (!promptImg) { toast('Descreva o post que deseja criar', 'err'); return }

    setGerandoImg(true)

    const prompt = `Você é um especialista em criação de conteúdo para redes sociais com foco em alta conversão.

DADOS:
- Plataforma: ${plataformaImg}
- Nicho: ${nichoImg || 'Geral'}
- Tema/Produto: ${promptImg}

Crie o seguinte para um post de ${plataformaImg}:

1. 📝 TÍTULO CHAMATIVO (máx 80 caracteres)
2. 📋 LEGENDA COMPLETA (com emojis, hashtags, CTA)
3. 🖼️ DESCRIÇÃO DA IMAGEM IDEAL (para criar visualmente)
4. 🏷️ HASHTAGS ESTRATÉGICAS (15-30 hashtags relevantes)
5. ⏰ MELHOR HORÁRIO PARA POSTAR
6. 🔗 CTA (Call to Action) personalizado
7. 📊 SEO e palavras-chave para a legenda

${plataformaImg === 'tiktok' ? '8. 🎵 Sugestão de som/trend e roteiro do vídeo (60 segundos)' : ''}
${plataformaImg === 'google' ? '8. 🔍 Headlines e descrições para Google Ads (máx caracteres)' : ''}

Seja criativo, use linguagem adequada para o nicho e plataforma.`

    try {
      const resultado = await callAI(prompt, cfg, { temperature: 0.8 })
      if (resultado) {
        const novaImagem = {
          id: Date.now(),
          plataforma: plataformaImg,
          nicho: nichoImg,
          tema: promptImg,
          conteudo: resultado,
          criadoEm: new Date().toISOString()
        }
        const novasImagens = [novaImagem, ...imagens]
        setImagens(novasImagens)
        const novoCfg = { ...cfg, mktPosts: [...(cfg.mktPosts || []), novaImagem] }
        setCfg(novoCfg)
        await salvarStorage(novoCfg)
        toast('Post criado!')
      } else {
        toast('Erro ao gerar. Verifique as chaves de API', 'err')
      }
    } catch (e) {
      toast('Erro: ' + e.message, 'err')
    }
    setGerandoImg(false)
  }

  // ── Agenda de Publicação ─────────────────────────────────────
  function getDiasSemana() {
    const hoje = new Date()
    const diaSemana = hoje.getDay()
    const inicioSemana = new Date(hoje)
    inicioSemana.setDate(hoje.getDate() - diaSemana + semanaAtual * 7)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(inicioSemana)
      d.setDate(inicioSemana.getDate() + i)
      return d
    })
  }

  function getPostsDodia(data) {
    const dateStr = data.toISOString().slice(0, 10)
    return posts.filter(p => p.data === dateStr)
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
    setFormPost({ id: '', titulo: '', descricao: '', plataforma: 'instagram', data: '', horario: '09:00', status: 'Agendado' })
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

  // ── Script/Playbook ──────────────────────────────────────────
  async function gerarScript() {
    const openaiKey = cfg.openaiApiKey || cfg.openaiKey || ''
    const geminiKey = cfg.geminiApiKey || cfg.geminiKey || ''
    const groqKey   = cfg.groqApiKey   || cfg.groqKey   || ''
    if (!openaiKey && !geminiKey && !groqKey) { toast('Configure a chave de IA em Configurações → Empresa', 'err'); return }
    if (!nichoScript) { toast('Informe o nicho de mercado', 'err'); return }

    setGerandoScript(true)
    setScriptResultado('')

    const tipos = {
      venda: 'Script de Abordagem e Venda',
      objecao: 'Script de Contorno de Objeções',
      followup: 'Script de Follow-up e Reativação',
      fechamento: 'Script de Fechamento de Vendas'
    }

    const prompt = `Você é um especialista em vendas e marketing digital com foco em alta conversão para o mercado ${nichoScript}.

Crie um ${tipos[tipoScript]} completo e profissional com:

1. 🎯 OBJETIVO DO SCRIPT
2. 📋 ROTEIRO COMPLETO (com marcações de [pausa], [escutar], [adaptar])
3. 💡 GATILHOS MENTAIS UTILIZADOS
4. ❓ PERGUNTAS ESTRATÉGICAS para descobrir necessidades
5. 🛡️ PRINCIPAIS OBJEÇÕES e como contorná-las
6. 🔥 FRASES DE FECHAMENTO de alta conversão
7. 📊 MÉTRICAS para medir a efetividade

Nicho: ${nichoScript}
Tipo: ${tipos[tipoScript]}

Seja prático, use exemplos reais do nicho e crie um script que qualquer vendedor consiga seguir.`

    try {
      const resultado = await callAI(prompt, cfg, { temperature: 0.7 })
      if (resultado) {
        setScriptResultado(resultado)
        const novoCfg = { ...cfg, mktScripts: [...(cfg.mktScripts || []), { id: Date.now(), tipo: tipoScript, nicho: nichoScript, resultado, criadoEm: new Date().toISOString() }] }
        setCfg(novoCfg)
        await salvarStorage(novoCfg)
        toast('Script gerado!')
      } else {
        toast('Erro ao gerar. Verifique as chaves de API', 'err')
      }
    } catch (e) {
      toast('Erro: ' + e.message, 'err')
    }
    setGerandoScript(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0f1e', color: '#64748b', fontFamily: 'DM Mono, monospace' }}>
      Carregando Marketing...
    </div>
  )

  const diasSemana = getDiasSemana()

  return (
    <>
      <Head>
        <title>Marketing — {cfg.company || 'Vivanexa'}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet" />
      </Head>
      <style>{CSS}</style>
      <div className="orb orb1" /><div className="orb orb2" />

      {/* NAVBAR */}
      <Navbar cfg={cfg} perfil={perfil} />

      <div className="page-wrap">
        <div className="page-title">📣 Marketing</div>
        <div className="page-sub">Campanhas IA, criação de conteúdo e agenda de publicação</div>

        {/* Stats */}
        <div className="stat-row">
          <div className="stat-card">
            <div className="stat-val">{(cfg.mktCampanhas || []).length}</div>
            <div className="stat-label">Campanhas Geradas</div>
          </div>
          <div className="stat-card">
            <div className="stat-val">{posts.length}</div>
            <div className="stat-label">Posts Agendados</div>
          </div>
          <div className="stat-card">
            <div className="stat-val">{(cfg.mktScripts || []).length}</div>
            <div className="stat-label">Scripts Criados</div>
          </div>
          <div className="stat-card">
            <div className="stat-val">{posts.filter(p => p.status === 'Publicado').length}</div>
            <div className="stat-label">Posts Publicados</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          {[
            { id: 'campanhas', label: '🎯 Campanhas IA' },
            { id: 'imagens', label: '🖼️ Posts & Imagens' },
            { id: 'agenda', label: '📅 Agenda' },
            { id: 'script', label: '📋 Script/Playbook' },
          ].map(t => (
            <button key={t.id} className={`tab-btn ${aba === t.id ? 'active' : ''}`} onClick={() => setAba(t.id)}>{t.label}</button>
          ))}
        </div>

        {/* ── ABA CAMPANHAS ── */}
        {aba === 'campanhas' && (
          <div>
            <div className="card">
              <div className="card-title">🎯 Gerador de Campanhas com IA</div>
              <div className="grid2">
                <div className="field">
                  <label>Produto / Serviço</label>
                  <input value={produto} onChange={e => setProduto(e.target.value)} placeholder="Ex: Software de gestão contábil" />
                </div>
                <div className="field">
                  <label>Nicho de Mercado</label>
                  <select value={nicho} onChange={e => setNicho(e.target.value)} style={{ width: '100%', background: '#1a2540', border: '1px solid #1e2d4a', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#e2e8f0', outline: 'none' }}>
                    <option value="">Selecione...</option>
                    {NICHOS.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Objetivo da Campanha</label>
                  <select value={objetivo} onChange={e => setObjetivo(e.target.value)} style={{ width: '100%', background: '#1a2540', border: '1px solid #1e2d4a', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#e2e8f0', outline: 'none' }}>
                    <option value="conversao">🛒 Conversão (Vendas)</option>
                    <option value="leads">📋 Geração de Leads</option>
                    <option value="branding">🏆 Branding</option>
                    <option value="engajamento">❤️ Engajamento</option>
                  </select>
                </div>
                <div className="field">
                  <label>Orçamento Mensal (R$)</label>
                  <input type="number" value={orcamento} onChange={e => setOrcamento(e.target.value)} placeholder="Ex: 2000" />
                </div>
              </div>
              <div className="field">
                <label>Plataformas</label>
                <div className="tag-list">
                  {PLATAFORMAS.map(p => (
                    <span key={p.id} className={`tag ${plataformasCamp.includes(p.label) ? 'active' : ''}`}
                      onClick={() => setPlataformasCamp(prev => prev.includes(p.label) ? prev.filter(x => x !== p.label) : [...prev, p.label])}>
                      {p.icon} {p.label}
                    </span>
                  ))}
                </div>
              </div>
              <button className="btn btn-primary" onClick={gerarCampanha} disabled={gerandoCamp} style={{ marginTop: 8 }}>
                {gerandoCamp ? '⏳ Gerando...' : '🚀 Gerar Campanha com IA'}
              </button>
              {gerandoCamp && <div className="thinking" style={{ marginTop: 12 }}><span /><span /><span /></div>}
              {campResultado && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: '#00d4ff' }}>✅ Campanha gerada</span>
                    <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => navigator.clipboard.writeText(campResultado)}>📋 Copiar</button>
                  </div>
                  <div className="result-box">{campResultado}</div>
                </div>
              )}
            </div>

            {/* Histórico de campanhas */}
            {(cfg.mktCampanhas || []).length > 0 && (
              <div className="card">
                <div className="card-title">📜 Campanhas Anteriores</div>
                {[...(cfg.mktCampanhas || [])].reverse().slice(0, 5).map(c => (
                  <div key={c.id} style={{ padding: '12px', background: '#1a2540', borderRadius: 8, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>{c.produto}</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{c.nicho} · {new Date(c.criadoEm).toLocaleDateString('pt-BR')}</div>
                    </div>
                    <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setCampResultado(c.resultado)}>👁 Ver</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ABA IMAGENS/POSTS ── */}
        {aba === 'imagens' && (
          <div>
            <div className="card">
              <div className="card-title">🖼️ Criador de Posts e Conteúdo</div>
              <div className="grid2">
                <div className="field">
                  <label>Nicho</label>
                  <select value={nichoImg} onChange={e => setNichoImg(e.target.value)} style={{ width: '100%', background: '#1a2540', border: '1px solid #1e2d4a', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#e2e8f0', outline: 'none' }}>
                    <option value="">Selecione...</option>
                    {NICHOS.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Plataforma</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {PLATAFORMAS.map(p => (
                      <button key={p.id} onClick={() => setPlataformaImg(p.id)}
                        style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${plataformaImg === p.id ? p.color : '#1e2d4a'}`, background: plataformaImg === p.id ? p.color + '22' : '#1a2540', color: plataformaImg === p.id ? p.color : '#64748b', fontFamily: 'DM Mono, monospace', fontSize: 11, cursor: 'pointer' }}>
                        {p.icon} {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="field">
                <label>Descreva o post / tema</label>
                <textarea value={promptImg} onChange={e => setPromptImg(e.target.value)} placeholder="Ex: Post sobre os benefícios de ter um contador, destacando economia de impostos..." />
              </div>
              <button className="btn btn-purple" onClick={gerarPost} disabled={gerandoImg}>
                {gerandoImg ? '⏳ Criando...' : '✨ Gerar Post com IA'}
              </button>
              {gerandoImg && <div className="thinking" style={{ marginTop: 12 }}><span /><span /><span /></div>}
            </div>

            {/* Posts gerados */}
            {imagens.length > 0 && (
              <div className="card">
                <div className="card-title">📋 Posts Criados</div>
                {imagens.slice(0, 5).map(img => (
                  <div key={img.id} style={{ border: '1px solid #1e2d4a', borderRadius: 10, padding: 14, marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <span className="badge badge-blue">{PLATAFORMAS.find(p => p.id === img.plataforma)?.icon} {img.plataforma}</span>
                        {img.nicho && <span className="badge badge-purple">{img.nicho}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary" style={{ fontSize: 10, padding: '3px 8px' }} onClick={() => navigator.clipboard.writeText(img.conteudo)}>📋</button>
                        <button className="btn btn-green" style={{ fontSize: 10, padding: '3px 8px' }}
                          onClick={() => { setFormPost({ ...formPost, titulo: img.tema, descricao: img.conteudo.slice(0, 200), plataforma: img.plataforma }); setAba('agenda'); setShowFormPost(true) }}>
                          📅 Agendar
                        </button>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>{img.tema}</div>
                    <div style={{ background: '#1a2540', borderRadius: 8, padding: 12, fontSize: 12, color: '#e2e8f0', lineHeight: 1.6, maxHeight: 200, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                      {img.conteudo.slice(0, 500)}{img.conteudo.length > 500 ? '...' : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ABA AGENDA ── */}
        {aba === 'agenda' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" onClick={() => setSemanaAtual(s => s - 1)}>← Semana anterior</button>
                <button className="btn btn-secondary" onClick={() => setSemanaAtual(0)}>Hoje</button>
                <button className="btn btn-secondary" onClick={() => setSemanaAtual(s => s + 1)}>Próxima semana →</button>
              </div>
              <button className="btn btn-primary" onClick={() => { setFormPost({ id: '', titulo: '', descricao: '', plataforma: 'instagram', data: new Date().toISOString().slice(0, 10), horario: '09:00', status: 'Agendado' }); setShowFormPost(true) }}>
                + Novo Post
              </button>
            </div>

            {/* Calendário semanal */}
            <div className="card">
              <div className="agenda-grid">
                {diasSemana.map((dia, i) => {
                  const postsDodia = getPostsDodia(dia)
                  const isHoje = dia.toDateString() === new Date().toDateString()
                  return (
                    <div key={i} className="agenda-day" style={{ borderColor: isHoje ? 'rgba(0,212,255,.4)' : '#1e2d4a', background: isHoje ? 'rgba(0,212,255,.04)' : '#1a2540' }}>
                      <div className="agenda-day-label" style={{ color: isHoje ? '#00d4ff' : '#64748b' }}>
                        {DIAS_SEMANA[i]}<br />
                        <span style={{ fontSize: 13, fontWeight: isHoje ? 700 : 400 }}>{dia.getDate()}</span>
                      </div>
                      {postsDodia.map(post => (
                        <div key={post.id} className="agenda-post"
                          style={{ borderColor: PLATAFORMAS.find(p => p.id === post.plataforma)?.color + '44' || 'rgba(0,212,255,.2)', color: PLATAFORMAS.find(p => p.id === post.plataforma)?.color || '#00d4ff' }}
                          onClick={() => { setFormPost(post); setShowFormPost(true) }}>
                          {PLATAFORMAS.find(p => p.id === post.plataforma)?.icon} {post.horario}<br />{post.titulo.slice(0, 20)}
                        </div>
                      ))}
                      <button onClick={() => { setFormPost({ id: '', titulo: '', descricao: '', plataforma: 'instagram', data: dia.toISOString().slice(0, 10), horario: '09:00', status: 'Agendado' }); setShowFormPost(true) }}
                        style={{ width: '100%', background: 'none', border: '1px dashed #1e2d4a', borderRadius: 4, color: '#2a3a5a', fontSize: 10, cursor: 'pointer', padding: '2px', marginTop: 2 }}>+</button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Lista de posts */}
            <div className="card">
              <div className="card-title">📋 Lista de Posts Agendados</div>
              {posts.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#64748b', padding: 20, fontSize: 13 }}>Nenhum post agendado</div>
              ) : (
                [...posts].sort((a, b) => a.data > b.data ? 1 : -1).map(post => (
                  <div key={post.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: '#1a2540', borderRadius: 8, marginBottom: 6 }}>
                    <div className="platform-icon" style={{ background: (PLATAFORMAS.find(p => p.id === post.plataforma)?.color || '#1e2d4a') + '22' }}>
                      {PLATAFORMAS.find(p => p.id === post.plataforma)?.icon || '📝'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>{post.titulo}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{post.data} às {post.horario} · {post.plataforma}</div>
                    </div>
                    <span className={`badge ${post.status === 'Publicado' ? 'badge-green' : post.status === 'Agendado' ? 'badge-blue' : 'badge-yellow'}`}>{post.status}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-secondary" style={{ fontSize: 10, padding: '3px 8px' }} onClick={() => { setFormPost(post); setShowFormPost(true) }}>✏️</button>
                      <button className="btn btn-secondary" style={{ fontSize: 10, padding: '3px 8px', color: '#ef4444' }} onClick={() => excluirPost(post.id)}>🗑</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal de post */}
            {showFormPost && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                <div style={{ background: '#111827', border: '1px solid #1e2d4a', borderRadius: 16, padding: 24, width: '100%', maxWidth: 500 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>📅 {formPost.id ? 'Editar Post' : 'Novo Post'}</span>
                    <button onClick={() => setShowFormPost(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 18, cursor: 'pointer' }}>✕</button>
                  </div>
                  <div className="field"><label>Título</label><input value={formPost.titulo} onChange={e => setFormPost(f => ({ ...f, titulo: e.target.value }))} placeholder="Título do post" /></div>
                  <div className="field"><label>Descrição / Legenda</label><textarea value={formPost.descricao} onChange={e => setFormPost(f => ({ ...f, descricao: e.target.value }))} placeholder="Legenda ou roteiro do post..." /></div>
                  <div className="grid2">
                    <div className="field"><label>Plataforma</label>
                      <select value={formPost.plataforma} onChange={e => setFormPost(f => ({ ...f, plataforma: e.target.value }))} style={{ width: '100%', background: '#1a2540', border: '1px solid #1e2d4a', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#e2e8f0', outline: 'none' }}>
                        {PLATAFORMAS.map(p => <option key={p.id} value={p.id}>{p.icon} {p.label}</option>)}
                      </select>
                    </div>
                    <div className="field"><label>Status</label>
                      <select value={formPost.status} onChange={e => setFormPost(f => ({ ...f, status: e.target.value }))} style={{ width: '100%', background: '#1a2540', border: '1px solid #1e2d4a', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#e2e8f0', outline: 'none' }}>
                        {['Agendado', 'Publicado', 'Rascunho', 'Cancelado'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="field"><label>Data</label><input type="date" value={formPost.data} onChange={e => setFormPost(f => ({ ...f, data: e.target.value }))} /></div>
                    <div className="field"><label>Horário</label><input type="time" value={formPost.horario} onChange={e => setFormPost(f => ({ ...f, horario: e.target.value }))} /></div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                    <button className="btn btn-secondary" onClick={() => setShowFormPost(false)}>Cancelar</button>
                    <button className="btn btn-primary" onClick={salvarPost} disabled={saving}>{saving ? '⏳' : '✅ Salvar'}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ABA SCRIPT/PLAYBOOK ── */}
        {aba === 'script' && (
          <div>
            <div className="card">
              <div className="card-title">📋 Gerador de Scripts e Playbooks de Marketing</div>
              <div className="grid2">
                <div className="field">
                  <label>Nicho de Mercado</label>
                  <select value={nichoScript} onChange={e => setNichoScript(e.target.value)} style={{ width: '100%', background: '#1a2540', border: '1px solid #1e2d4a', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#e2e8f0', outline: 'none' }}>
                    <option value="">Selecione o nicho...</option>
                    {NICHOS.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Tipo de Script</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                    {[['venda', '🎯 Abordagem e Venda'], ['objecao', '🛡️ Contorno de Objeções'], ['followup', '🔄 Follow-up e Reativação'], ['fechamento', '🔥 Fechamento de Vendas']].map(([id, label]) => (
                      <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: tipoScript === id ? '#00d4ff' : '#94a3b8' }}>
                        <input type="radio" value={id} checked={tipoScript === id} onChange={() => setTipoScript(id)} style={{ accentColor: '#00d4ff' }} />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <button className="btn btn-primary" onClick={gerarScript} disabled={gerandoScript} style={{ marginTop: 8 }}>
                {gerandoScript ? '⏳ Gerando...' : '✨ Gerar Script com IA'}
              </button>
              {gerandoScript && <div className="thinking" style={{ marginTop: 12 }}><span /><span /><span /></div>}
              {scriptResultado && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: '#00d4ff' }}>✅ Script gerado para o nicho {nichoScript}</span>
                    <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => navigator.clipboard.writeText(scriptResultado)}>📋 Copiar</button>
                  </div>
                  <div className="result-box">{scriptResultado}</div>
                </div>
              )}
            </div>

            {/* Histórico de scripts */}
            {(cfg.mktScripts || []).length > 0 && (
              <div className="card">
                <div className="card-title">📜 Scripts Anteriores</div>
                {[...(cfg.mktScripts || [])].reverse().slice(0, 5).map(s => (
                  <div key={s.id} style={{ padding: '12px', background: '#1a2540', borderRadius: 8, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>{s.nicho} — {s.tipo}</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{new Date(s.criadoEm).toLocaleDateString('pt-BR')}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setScriptResultado(s.resultado)}>👁 Ver</button>
                      <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => navigator.clipboard.writeText(s.resultado)}>📋</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div id="mkt-toast" className="toast" />
    </>
  )
}
