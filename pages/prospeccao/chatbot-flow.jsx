// pages/prospeccao/chatbot-flow.jsx
// Construtor visual de fluxo de chatbot WhatsApp — Vivanexa SaaS
// Integra com Evolution API via webhook

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import Navbar from '../../components/Navbar'

// ─── Tipos de nó disponíveis ────────────────────────────────────
const NODE_TYPES = {
  start:     { label: 'Início',        icon: '▶', color: '#10b981', desc: 'Ponto de entrada do fluxo' },
  message:   { label: 'Mensagem',      icon: '💬', color: '#00d4ff', desc: 'Envia texto ao cliente' },
  question:  { label: 'Pergunta',      icon: '❓', color: '#7c3aed', desc: 'Aguarda resposta do cliente' },
  condition: { label: 'Condição',      icon: '⚡', color: '#f59e0b', desc: 'Ramifica por palavra-chave' },
  action:    { label: 'Ação',          icon: '⚙', color: '#ec4899', desc: 'Transfere para humano ou API' },
  end:       { label: 'Fim',           icon: '⏹', color: '#64748b', desc: 'Encerra o atendimento' },
}

const SNAP = 20
const snap = v => Math.round(v / SNAP) * SNAP
const NODE_W = 200
const NODE_H = 80

function genId() { return Math.random().toString(36).slice(2, 9) }

// ─── Nó do fluxo ────────────────────────────────────────────────
function FlowNode({ node, selected, onSelect, onDragStart, onPortMouseDown, connecting, onPortMouseUp }) {
  const t = NODE_TYPES[node.type] || NODE_TYPES.message
  const isConnecting = connecting?.fromId === node.id

  return (
    <g
      transform={`translate(${node.x},${node.y})`}
      style={{ cursor: 'grab', userSelect: 'none' }}
      onMouseDown={e => { e.stopPropagation(); onDragStart(e, node.id); onSelect(node.id) }}
    >
      {/* Sombra */}
      <rect x={2} y={4} width={NODE_W} height={NODE_H} rx={12} fill="rgba(0,0,0,0.4)" />
      {/* Corpo */}
      <rect
        width={NODE_W} height={NODE_H} rx={12}
        fill={selected ? '#1a2540' : '#111827'}
        stroke={selected ? t.color : 'rgba(255,255,255,0.08)'}
        strokeWidth={selected ? 2 : 1}
      />
      {/* Barra lateral colorida */}
      <rect width={4} height={NODE_H} rx={2} fill={t.color} />
      {/* Ícone */}
      <text x={20} y={46} fontSize={20} dominantBaseline="central">{t.icon}</text>
      {/* Título */}
      <text x={48} y={30} fontSize={12} fill={t.color} fontFamily="DM Mono, monospace" fontWeight={600} letterSpacing={0.5}>
        {t.label.toUpperCase()}
      </text>
      {/* Conteúdo */}
      <foreignObject x={48} y={40} width={140} height={32}>
        <div xmlns="http://www.w3.org/1999/xhtml" style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'DM Mono, monospace', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {node.data?.text || node.data?.label || (node.type === 'start' ? 'Início do fluxo' : node.type === 'end' ? 'Encerrar' : 'Configurar...')}
        </div>
      </foreignObject>
      {/* Porta de entrada (esquerda) */}
      {node.type !== 'start' && (
        <circle
          cx={0} cy={NODE_H / 2} r={6}
          fill="#0a0f1e" stroke="#334155" strokeWidth={1.5}
          style={{ cursor: 'crosshair' }}
          onMouseUp={e => { e.stopPropagation(); onPortMouseUp(node.id, 'in') }}
        />
      )}
      {/* Porta de saída principal (direita) */}
      {node.type !== 'end' && (
        <circle
          cx={NODE_W} cy={NODE_H / 2} r={6}
          fill={isConnecting ? t.color : '#0a0f1e'}
          stroke={t.color} strokeWidth={1.5}
          style={{ cursor: 'crosshair' }}
          onMouseDown={e => { e.stopPropagation(); onPortMouseDown(e, node.id, 'main') }}
        />
      )}
      {/* Portas extras para condição */}
      {node.type === 'condition' && (node.data?.branches || []).map((b, i) => (
        <g key={i}>
          <circle
            cx={NODE_W} cy={NODE_H / 2 + (i + 1) * 24} r={5}
            fill="#0a0f1e" stroke="#f59e0b" strokeWidth={1.5}
            style={{ cursor: 'crosshair' }}
            onMouseDown={e => { e.stopPropagation(); onPortMouseDown(e, node.id, `branch_${i}`) }}
          />
          <text x={NODE_W + 10} y={NODE_H / 2 + (i + 1) * 24 + 4} fontSize={10} fill="#94a3b8" fontFamily="DM Mono, monospace">
            {b.keyword || `Opção ${i + 1}`}
          </text>
        </g>
      ))}
    </g>
  )
}

// ─── Conexão entre nós ──────────────────────────────────────────
function Connection({ conn, nodes, selected, onClick }) {
  const from = nodes.find(n => n.id === conn.fromId)
  const to   = nodes.find(n => n.id === conn.toId)
  if (!from || !to) return null

  const x1 = from.x + NODE_W
  const y1 = from.y + NODE_H / 2
  const x2 = to.x
  const y2 = to.y + NODE_H / 2
  const cx = (x1 + x2) / 2

  const t = NODE_TYPES[from.type] || NODE_TYPES.message

  return (
    <g style={{ cursor: 'pointer' }} onClick={() => onClick(conn.id)}>
      <path
        d={`M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`}
        fill="none" stroke={selected ? '#fff' : t.color}
        strokeWidth={selected ? 2 : 1.5}
        strokeOpacity={selected ? 1 : 0.5}
        markerEnd="url(#arrow)"
      />
      {/* Área clicável invisível */}
      <path
        d={`M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`}
        fill="none" stroke="transparent" strokeWidth={10}
      />
      {conn.label && (
        <text x={cx} y={(y1 + y2) / 2 - 6} textAnchor="middle" fontSize={10} fill="#64748b" fontFamily="DM Mono, monospace">
          {conn.label}
        </text>
      )}
    </g>
  )
}

// ─── Painel lateral de propriedades ─────────────────────────────
function PropsPanel({ node, onChange, onDelete }) {
  if (!node) return (
    <div style={st.emptyPanel}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🖱️</div>
      <div style={{ fontSize: 13, color: '#475569', textAlign: 'center', lineHeight: 1.6 }}>
        Clique em um nó para editar suas propriedades
      </div>
    </div>
  )

  const t = NODE_TYPES[node.type]
  const update = patch => onChange({ ...node, data: { ...(node.data || {}), ...patch } })

  return (
    <div style={st.propsPanel}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span style={{ fontSize: 20 }}>{t.icon}</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.color }}>{t.label}</div>
          <div style={{ fontSize: 11, color: '#475569' }}>{t.desc}</div>
        </div>
      </div>

      {/* Mensagem */}
      {(node.type === 'message' || node.type === 'start') && (
        <Field label="Mensagem">
          <textarea
            value={node.data?.text || ''}
            onChange={e => update({ text: e.target.value })}
            placeholder="Digite a mensagem que será enviada..."
            rows={4}
            style={st.textarea}
          />
        </Field>
      )}

      {/* Pergunta */}
      {node.type === 'question' && (
        <>
          <Field label="Pergunta">
            <textarea value={node.data?.text || ''} onChange={e => update({ text: e.target.value })} rows={3} style={st.textarea} placeholder="Digite a pergunta..." />
          </Field>
          <Field label="Variável para salvar resposta">
            <input value={node.data?.variable || ''} onChange={e => update({ variable: e.target.value })} style={st.input} placeholder="Ex: nome_cliente" />
          </Field>
          <Field label="Timeout (segundos)">
            <input type="number" value={node.data?.timeout || 60} onChange={e => update({ timeout: Number(e.target.value) })} style={st.input} />
          </Field>
        </>
      )}

      {/* Condição */}
      {node.type === 'condition' && (
        <>
          <Field label="Variável a verificar">
            <input value={node.data?.variable || ''} onChange={e => update({ variable: e.target.value })} style={st.input} placeholder="Ex: nome_cliente" />
          </Field>
          <Field label="Ramificações">
            {(node.data?.branches || []).map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <input
                  value={b.keyword || ''} placeholder={`Palavra-chave ${i + 1}`}
                  onChange={e => {
                    const branches = [...(node.data?.branches || [])]
                    branches[i] = { ...branches[i], keyword: e.target.value }
                    update({ branches })
                  }}
                  style={{ ...st.input, flex: 1 }}
                />
                <button onClick={() => { const b2 = [...(node.data?.branches || [])]; b2.splice(i, 1); update({ branches: b2 }) }} style={st.btnDanger}>✕</button>
              </div>
            ))}
            <button onClick={() => update({ branches: [...(node.data?.branches || []), { keyword: '' }] })} style={st.btnSecondary}>
              + Adicionar ramificação
            </button>
          </Field>
        </>
      )}

      {/* Ação */}
      {node.type === 'action' && (
        <>
          <Field label="Tipo de ação">
            <select value={node.data?.actionType || 'transfer'} onChange={e => update({ actionType: e.target.value })} style={st.select}>
              <option value="transfer">Transferir para humano</option>
              <option value="webhook">Chamar webhook</option>
              <option value="tag">Adicionar tag</option>
              <option value="close">Fechar conversa</option>
            </select>
          </Field>
          {node.data?.actionType === 'webhook' && (
            <Field label="URL do Webhook">
              <input value={node.data?.webhookUrl || ''} onChange={e => update({ webhookUrl: e.target.value })} style={st.input} placeholder="https://..." />
            </Field>
          )}
          {node.data?.actionType === 'tag' && (
            <Field label="Tag">
              <input value={node.data?.tag || ''} onChange={e => update({ tag: e.target.value })} style={st.input} placeholder="Ex: lead_quente" />
            </Field>
          )}
          {node.data?.actionType === 'transfer' && (
            <Field label="Mensagem antes de transferir">
              <textarea value={node.data?.text || ''} onChange={e => update({ text: e.target.value })} rows={2} style={st.textarea} placeholder="Aguarde, vou te conectar com um atendente..." />
            </Field>
          )}
        </>
      )}

      {/* Fim */}
      {node.type === 'end' && (
        <Field label="Mensagem de encerramento">
          <textarea value={node.data?.text || ''} onChange={e => update({ text: e.target.value })} rows={3} style={st.textarea} placeholder="Obrigado pelo contato! Até mais." />
        </Field>
      )}

      <button onClick={() => onDelete(node.id)} style={{ ...st.btnDanger, width: '100%', marginTop: 16, padding: '10px' }}>
        🗑 Excluir nó
      </button>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 11, color: '#64748b', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>{label.toUpperCase()}</label>
      {children}
    </div>
  )
}

// ─── Fluxo inicial padrão ────────────────────────────────────────
const DEFAULT_FLOW = {
  nodes: [
    { id: 'n1', type: 'start',   x: 80,  y: 200, data: { text: 'Olá! Seja bem-vindo. 👋' } },
    { id: 'n2', type: 'message', x: 360, y: 200, data: { text: 'Como posso te ajudar hoje?' } },
    { id: 'n3', type: 'question',x: 640, y: 200, data: { text: 'Digite 1 para Suporte, 2 para Vendas, ou 3 para Financeiro.', variable: 'opcao' } },
    { id: 'n4', type: 'condition',x: 920, y: 200, data: { variable: 'opcao', branches: [{ keyword: '1' }, { keyword: '2' }, { keyword: '3' }] } },
    { id: 'n5', type: 'action',  x: 1200, y: 80, data: { actionType: 'transfer', text: 'Transferindo para Suporte...' } },
    { id: 'n6', type: 'action',  x: 1200, y: 220, data: { actionType: 'transfer', text: 'Transferindo para Vendas...' } },
    { id: 'n7', type: 'action',  x: 1200, y: 360, data: { actionType: 'transfer', text: 'Transferindo para Financeiro...' } },
  ],
  connections: [
    { id: 'c1', fromId: 'n1', toId: 'n2', port: 'main' },
    { id: 'c2', fromId: 'n2', toId: 'n3', port: 'main' },
    { id: 'c3', fromId: 'n3', toId: 'n4', port: 'main' },
    { id: 'c4', fromId: 'n4', toId: 'n5', port: 'branch_0', label: '1' },
    { id: 'c5', fromId: 'n4', toId: 'n6', port: 'branch_1', label: '2' },
    { id: 'c6', fromId: 'n4', toId: 'n7', port: 'branch_2', label: '3' },
  ]
}

// ─── Componente Principal ────────────────────────────────────────
export default function ChatbotFlowPage() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState(null)
  const [cfg, setCfg] = useState({})

  // Fluxos salvos
  const [flows, setFlows] = useState([])
  const [activeFlowId, setActiveFlowId] = useState(null)
  const [activeFlow, setActiveFlow] = useState(null)
  const [botAtivo, setBotAtivo] = useState(false)
  const [savingFlow, setSavingFlow] = useState(false)
  const [view, setView] = useState('list') // 'list' | 'editor'

  // Editor de canvas
  const svgRef = useRef(null)
  const [nodes, setNodes] = useState([])
  const [connections, setConnections] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [selectedConnId, setSelectedConnId] = useState(null)
  const [connecting, setConnecting] = useState(null) // { fromId, port, mouseX, mouseY }
  const dragging = useRef(null)
  const [pan, setPan] = useState({ x: 40, y: 40 })
  const [scale, setScale] = useState(1)
  const isPanning = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })
  const [toast, setToast] = useState(null)

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      const { data: profile } = await supabase.from('perfis').select('*').eq('id', session.user.id).single()
      setUserProfile({ ...session.user, nome: profile?.nome || session.user.email?.split('@')[0], perfil: profile })
      const eid = profile?.empresa_id || session.user.id
      const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${eid}`).single()
      if (row?.value) { try { setCfg(JSON.parse(row.value)) } catch {} }
      loadFlows(eid)
    })
  }, [])

  async function loadFlows(eid) {
    const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `chatbot_flows:${eid}`).maybeSingle()
    if (row?.value) {
      const saved = JSON.parse(row.value)
      setFlows(saved.flows || [])
      setBotAtivo(saved.botAtivo || false)
      if (saved.activeFlowId) setActiveFlowId(saved.activeFlowId)
    }
  }

  async function saveFlows(newFlows, newBotAtivo, newActiveFlowId) {
    const { data: { session } } = await supabase.auth.getSession()
    const { data: profile } = await supabase.from('perfis').select('empresa_id').eq('id', session.user.id).single()
    const eid = profile?.empresa_id || session.user.id
    await supabase.from('vx_storage').upsert({
      key: `chatbot_flows:${eid}`,
      value: JSON.stringify({ flows: newFlows, botAtivo: newBotAtivo ?? botAtivo, activeFlowId: newActiveFlowId ?? activeFlowId }),
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' })
  }

  function showToast(msg, type = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Abrir editor com fluxo
  function openEditor(flow) {
    setActiveFlow(flow)
    setNodes(flow.nodes || DEFAULT_FLOW.nodes)
    setConnections(flow.connections || DEFAULT_FLOW.connections)
    setSelectedId(null)
    setSelectedConnId(null)
    setPan({ x: 40, y: 40 })
    setScale(1)
    setView('editor')
  }

  // Criar novo fluxo
  function newFlow() {
    const f = {
      id: genId(), name: 'Novo Fluxo', description: '',
      active: false, createdAt: new Date().toISOString(),
      nodes: [...DEFAULT_FLOW.nodes.map(n => ({ ...n, id: genId(), data: { ...n.data } }))],
      connections: []
    }
    // Reconectar com ids novos — simplificado: usa fluxo padrão com novos ids
    const idMap = {}
    DEFAULT_FLOW.nodes.forEach((orig, i) => { idMap[orig.id] = f.nodes[i].id })
    f.connections = DEFAULT_FLOW.connections.map(c => ({ ...c, id: genId(), fromId: idMap[c.fromId], toId: idMap[c.toId] }))
    const newFlows = [...flows, f]
    setFlows(newFlows)
    saveFlows(newFlows)
    openEditor(f)
  }

  // Salvar fluxo atual
  async function saveCurrentFlow() {
    setSavingFlow(true)
    const updated = { ...activeFlow, nodes, connections, updatedAt: new Date().toISOString() }
    const newFlows = flows.map(f => f.id === updated.id ? updated : f)
    if (!newFlows.find(f => f.id === updated.id)) newFlows.push(updated)
    setFlows(newFlows)
    await saveFlows(newFlows)
    setSavingFlow(false)
    showToast('✅ Fluxo salvo com sucesso!')
  }

  // Excluir fluxo
  async function deleteFlow(id) {
    if (!confirm('Excluir este fluxo?')) return
    const newFlows = flows.filter(f => f.id !== id)
    setFlows(newFlows)
    await saveFlows(newFlows)
    showToast('🗑 Fluxo excluído')
  }

  // Ativar/Desativar bot
  async function toggleBot() {
    const newBotAtivo = !botAtivo
    setBotAtivo(newBotAtivo)
    await saveFlows(flows, newBotAtivo)
    showToast(newBotAtivo ? '✅ Chatbot ativado!' : '⏸ Chatbot pausado')
  }

  // Ativar fluxo específico
  async function activateFlow(id) {
    const newFlows = flows.map(f => ({ ...f, active: f.id === id }))
    setFlows(newFlows)
    setActiveFlowId(id)
    await saveFlows(newFlows, botAtivo, id)
    showToast('✅ Fluxo ativo atualizado!')
  }

  // ─── Editor: Drag nós ──────────────────────
  function handleDragStart(e, nodeId) {
    const svgRect = svgRef.current.getBoundingClientRect()
    dragging.current = {
      nodeId,
      startMouseX: (e.clientX - svgRect.left - pan.x) / scale,
      startMouseY: (e.clientY - svgRect.top - pan.y) / scale,
      startNodeX: nodes.find(n => n.id === nodeId)?.x || 0,
      startNodeY: nodes.find(n => n.id === nodeId)?.y || 0,
    }
  }

  function handleSvgMouseMove(e) {
    if (!svgRef.current) return
    const svgRect = svgRef.current.getBoundingClientRect()
    const mx = (e.clientX - svgRect.left - pan.x) / scale
    const my = (e.clientY - svgRect.top - pan.y) / scale

    // Drag nó
    if (dragging.current) {
      const dx = mx - dragging.current.startMouseX
      const dy = my - dragging.current.startMouseY
      setNodes(ns => ns.map(n =>
        n.id === dragging.current.nodeId
          ? { ...n, x: snap(dragging.current.startNodeX + dx), y: snap(dragging.current.startNodeY + dy) }
          : n
      ))
      return
    }

    // Panning com espaço ou botão do meio
    if (isPanning.current) {
      const dx = e.clientX - lastMouse.current.x
      const dy = e.clientY - lastMouse.current.y
      setPan(p => ({ x: p.x + dx, y: p.y + dy }))
      lastMouse.current = { x: e.clientX, y: e.clientY }
      return
    }

    // Linha de conexão temporária
    if (connecting) {
      setConnecting(c => ({ ...c, mouseX: mx, mouseY: my }))
    }
  }

  function handleSvgMouseUp() {
    dragging.current = null
    if (connecting) setConnecting(null)
  }

  function handleSvgMouseDown(e) {
    if (e.button === 1 || e.altKey) {
      isPanning.current = true
      lastMouse.current = { x: e.clientX, y: e.clientY }
      return
    }
    setSelectedId(null)
    setSelectedConnId(null)
  }

  function handleSvgMouseUpGlobal() {
    isPanning.current = false
  }

  // Zoom
  function handleWheel(e) {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setScale(s => Math.min(2, Math.max(0.3, s * delta)))
  }

  // Portas de conexão
  function handlePortMouseDown(e, nodeId, port) {
    const svgRect = svgRef.current.getBoundingClientRect()
    const from = nodes.find(n => n.id === nodeId)
    const mx = (e.clientX - svgRect.left - pan.x) / scale
    const my = (e.clientY - svgRect.top - pan.y) / scale
    setConnecting({ fromId: nodeId, port, mouseX: mx, mouseY: my, fromX: from.x + NODE_W, fromY: from.y + NODE_H / 2 })
  }

  function handlePortMouseUp(nodeId, portType) {
    if (!connecting || connecting.fromId === nodeId) { setConnecting(null); return }
    const exists = connections.find(c => c.fromId === connecting.fromId && c.toId === nodeId)
    if (!exists) {
      setConnections(cs => [...cs, { id: genId(), fromId: connecting.fromId, toId: nodeId, port: connecting.port }])
    }
    setConnecting(null)
  }

  // Adicionar nó
  function addNode(type) {
    const centerX = snap((-pan.x / scale) + 400 / scale)
    const centerY = snap((-pan.y / scale) + 200 / scale)
    const n = { id: genId(), type, x: centerX, y: centerY, data: {} }
    setNodes(ns => [...ns, n])
    setSelectedId(n.id)
  }

  // Deletar nó selecionado
  function deleteNode(id) {
    setNodes(ns => ns.filter(n => n.id !== id))
    setConnections(cs => cs.filter(c => c.fromId !== id && c.toId !== id))
    setSelectedId(null)
  }

  // Atualizar nó
  function updateNode(updated) {
    setNodes(ns => ns.map(n => n.id === updated.id ? updated : n))
  }

  // Deletar conexão
  function deleteConnection(id) {
    setConnections(cs => cs.filter(c => c.id !== id))
    setSelectedConnId(null)
  }

  const selectedNode = nodes.find(n => n.id === selectedId) || null

  // ─── Vista: Lista de fluxos ──────────────────────────────────
  if (view === 'list') return (
    <div style={{ minHeight: '100vh', background: '#0a0f1e', fontFamily: 'DM Mono, monospace' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@300;400;500&display=swap');
        [data-theme="dark"]{--bg:#0a0f1e;--surface:#111827;--surface2:#1a2540;--border:#1e2d4a;--accent:#00d4ff;--accent2:#7c3aed;--accent3:#10b981;--text:#e2e8f0;--muted:#64748b;--danger:#ef4444;--warning:#f59e0b;--gold:#fbbf24;--shadow:0 4px 24px rgba(0,0,0,.4);}
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#0a0f1e}
      `}</style>

      <Navbar cfg={cfg} perfil={userProfile?.perfil} />

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 24, fontWeight: 800, color: '#e2e8f0' }}>🤖 Construtor de Fluxo</h1>
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Crie e gerencie fluxos de atendimento do WhatsApp</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* Toggle bot ativo */}
            <div
              onClick={toggleBot}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 10, cursor: 'pointer', background: botAtivo ? 'rgba(16,185,129,.15)' : 'rgba(100,116,139,.1)', border: `1px solid ${botAtivo ? 'rgba(16,185,129,.4)' : 'rgba(100,116,139,.3)'}`, color: botAtivo ? '#10b981' : '#64748b', fontSize: 12, fontWeight: 600, transition: 'all .2s' }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: botAtivo ? '#10b981' : '#475569', boxShadow: botAtivo ? '0 0 8px #10b981' : 'none', animation: botAtivo ? 'pulse 2s infinite' : 'none' }} />
              {botAtivo ? 'Bot Ativo' : 'Bot Pausado'}
            </div>
            <button onClick={newFlow} style={{ padding: '10px 20px', borderRadius: 10, background: 'linear-gradient(135deg,#00d4ff,#0099bb)', border: 'none', color: '#fff', fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              + Novo Fluxo
            </button>
          </div>
        </div>

        {/* Lista de fluxos */}
        {flows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', background: '#111827', borderRadius: 16, border: '1px solid #1e2d4a' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🌊</div>
            <div style={{ fontSize: 16, color: '#e2e8f0', marginBottom: 8 }}>Nenhum fluxo criado ainda</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>Crie seu primeiro fluxo de atendimento</div>
            <button onClick={newFlow} style={{ padding: '12px 24px', borderRadius: 10, background: 'linear-gradient(135deg,#00d4ff,#0099bb)', border: 'none', color: '#fff', fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              + Criar Primeiro Fluxo
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {flows.map(f => (
              <div key={f.id} style={{ background: '#111827', border: `1px solid ${f.active ? 'rgba(16,185,129,.4)' : '#1e2d4a'}`, borderRadius: 14, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16, transition: 'border-color .2s' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>{f.name}</span>
                    {f.active && <span style={{ fontSize: 10, background: 'rgba(16,185,129,.15)', color: '#10b981', border: '1px solid rgba(16,185,129,.3)', borderRadius: 20, padding: '2px 8px', letterSpacing: 0.5 }}>ATIVO</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#475569' }}>
                    {f.nodes?.length || 0} nós · {f.connections?.length || 0} conexões · {f.updatedAt ? new Date(f.updatedAt).toLocaleDateString('pt-BR') : 'Não salvo'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {!f.active && (
                    <button onClick={() => activateFlow(f.id)} style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.3)', color: '#10b981', fontFamily: 'DM Mono, monospace', fontSize: 12, cursor: 'pointer' }}>
                      ▶ Ativar
                    </button>
                  )}
                  <button onClick={() => openEditor(f)} style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.3)', color: '#00d4ff', fontFamily: 'DM Mono, monospace', fontSize: 12, cursor: 'pointer' }}>
                    ✏ Editar
                  </button>
                  <button onClick={() => deleteFlow(f.id)} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: '#ef4444', fontFamily: 'DM Mono, monospace', fontSize: 12, cursor: 'pointer' }}>
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Evolution API */}
        <div style={{ marginTop: 32, padding: '20px 24px', background: '#111827', borderRadius: 14, border: '1px dashed #1e2d4a' }}>
          <div style={{ fontSize: 12, color: '#00d4ff', fontWeight: 600, marginBottom: 8 }}>⚡ Webhook da Evolution API</div>
          <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.7 }}>
            Configure o webhook no painel da sua Evolution API apontando para:<br />
            <span style={{ color: '#94a3b8', background: '#0a0f1e', padding: '4px 8px', borderRadius: 6, fontFamily: 'monospace', display: 'inline-block', marginTop: 6 }}>
              {typeof window !== 'undefined' ? window.location.origin : 'https://sua-url'}/api/chatbot/webhook
            </span>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)', background: toast.type === 'ok' ? 'rgba(16,185,129,.9)' : 'rgba(239,68,68,.9)', color: '#fff', padding: '12px 24px', borderRadius: 10, fontSize: 14, zIndex: 9999, fontFamily: 'DM Mono, monospace' }}>
          {toast.msg}
        </div>
      )}
    </div>
  )

  // ─── Vista: Editor de canvas ─────────────────────────────────
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0a0f1e', fontFamily: 'DM Mono, monospace', overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@300;400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        select,input,textarea{color:#e2e8f0;background:#0a0f1e;border:1px solid #1e2d4a;border-radius:8px;font-family:'DM Mono',monospace;font-size:13px;}
        select:focus,input:focus,textarea:focus{outline:none;border-color:#00d4ff;}
      `}</style>

      {/* Toolbar */}
      <div style={{ height: 52, background: '#0f172a', borderBottom: '1px solid #1e2d4a', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10, flexShrink: 0, zIndex: 10 }}>
        <button onClick={() => { saveCurrentFlow(); setView('list') }} style={{ padding: '6px 12px', borderRadius: 8, background: 'none', border: '1px solid #1e2d4a', color: '#64748b', fontFamily: 'DM Mono, monospace', fontSize: 12, cursor: 'pointer' }}>
          ← Voltar
        </button>
        {/* Nome do fluxo */}
        <input
          value={activeFlow?.name || ''}
          onChange={e => setActiveFlow(f => ({ ...f, name: e.target.value }))}
          style={{ width: 200, height: 34, padding: '0 10px', fontSize: 13, fontWeight: 600 }}
        />
        <div style={{ flex: 1 }} />
        {/* Nós para adicionar */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#475569', marginRight: 4 }}>ADICIONAR:</span>
          {Object.entries(NODE_TYPES).filter(([k]) => k !== 'start').map(([type, t]) => (
            <button key={type} onClick={() => addNode(type)} style={{ padding: '5px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: `1px solid ${t.color}30`, color: t.color, fontFamily: 'DM Mono, monospace', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <div style={{ width: 1, height: 24, background: '#1e2d4a', margin: '0 4px' }} />
        {/* Zoom */}
        <button onClick={() => setScale(s => Math.min(2, s * 1.2))} style={tbBtn}>+</button>
        <span style={{ fontSize: 11, color: '#64748b', minWidth: 36, textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale(s => Math.max(0.3, s * 0.8))} style={tbBtn}>−</button>
        <button onClick={() => { setPan({ x: 40, y: 40 }); setScale(1) }} style={tbBtn}>⊡</button>
        <div style={{ width: 1, height: 24, background: '#1e2d4a', margin: '0 4px' }} />
        <button
          onClick={saveCurrentFlow} disabled={savingFlow}
          style={{ padding: '7px 16px', borderRadius: 8, background: 'linear-gradient(135deg,#00d4ff,#0099bb)', border: 'none', color: '#fff', fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          {savingFlow ? '⏳ Salvando...' : '💾 Salvar'}
        </button>
      </div>

      {/* Canvas + Painel */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Canvas SVG */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {/* Grid de fundo */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid-small" width={SNAP * scale} height={SNAP * scale} patternUnits="userSpaceOnUse" x={pan.x % (SNAP * scale)} y={pan.y % (SNAP * scale)}>
                <path d={`M ${SNAP * scale} 0 L 0 0 0 ${SNAP * scale}`} fill="none" stroke="#1e2d4a" strokeWidth={0.5} />
              </pattern>
              <pattern id="grid-large" width={SNAP * 5 * scale} height={SNAP * 5 * scale} patternUnits="userSpaceOnUse" x={pan.x % (SNAP * 5 * scale)} y={pan.y % (SNAP * 5 * scale)}>
                <path d={`M ${SNAP * 5 * scale} 0 L 0 0 0 ${SNAP * 5 * scale}`} fill="none" stroke="#1e2d4a" strokeWidth={1} />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-small)" />
            <rect width="100%" height="100%" fill="url(#grid-large)" opacity={0.5} />
          </svg>

          {/* Canvas principal */}
          <svg
            ref={svgRef}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: isPanning.current ? 'grabbing' : 'default' }}
            onMouseMove={handleSvgMouseMove}
            onMouseUp={() => { handleSvgMouseUp(); handleSvgMouseUpGlobal() }}
            onMouseDown={handleSvgMouseDown}
            onWheel={handleWheel}
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </marker>
            </defs>
            <g transform={`translate(${pan.x},${pan.y}) scale(${scale})`}>
              {/* Conexões */}
              {connections.map(c => (
                <Connection key={c.id} conn={c} nodes={nodes} selected={selectedConnId === c.id} onClick={setSelectedConnId} />
              ))}
              {/* Linha de conexão temporária */}
              {connecting && (
                <path
                  d={`M${connecting.fromX},${connecting.fromY} C${(connecting.fromX + connecting.mouseX) / 2},${connecting.fromY} ${(connecting.fromX + connecting.mouseX) / 2},${connecting.mouseY} ${connecting.mouseX},${connecting.mouseY}`}
                  fill="none" stroke="#00d4ff" strokeWidth={1.5} strokeDasharray="6 3" strokeOpacity={0.7}
                />
              )}
              {/* Nós */}
              {nodes.map(n => (
                <FlowNode
                  key={n.id} node={n}
                  selected={selectedId === n.id}
                  onSelect={setSelectedId}
                  onDragStart={handleDragStart}
                  onPortMouseDown={handlePortMouseDown}
                  onPortMouseUp={handlePortMouseUp}
                  connecting={connecting}
                />
              ))}
            </g>
          </svg>

          {/* Hint */}
          <div style={{ position: 'absolute', bottom: 16, left: 16, fontSize: 11, color: '#334155', pointerEvents: 'none' }}>
            Alt + arrastar para mover o canvas · Scroll para zoom · Arraste as portas para conectar nós
          </div>

          {/* Deletar conexão selecionada */}
          {selectedConnId && (
            <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', background: '#0f172a', border: '1px solid #ef4444', borderRadius: 10, padding: '8px 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>Conexão selecionada</span>
              <button onClick={() => deleteConnection(selectedConnId)} style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.4)', color: '#ef4444', fontFamily: 'DM Mono, monospace', fontSize: 11, cursor: 'pointer' }}>
                🗑 Deletar
              </button>
            </div>
          )}
        </div>

        {/* Painel de propriedades */}
        <div style={{ width: 280, background: '#0f172a', borderLeft: '1px solid #1e2d4a', overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #1e2d4a', fontSize: 11, color: '#475569', letterSpacing: 0.5 }}>
            PROPRIEDADES
          </div>
          <PropsPanel node={selectedNode} onChange={updateNode} onDelete={deleteNode} />
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)', background: toast.type === 'ok' ? 'rgba(16,185,129,.9)' : 'rgba(239,68,68,.9)', color: '#fff', padding: '12px 24px', borderRadius: 10, fontSize: 14, zIndex: 9999, fontFamily: 'DM Mono, monospace' }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

// ─── Estilos ─────────────────────────────────────────────────────
const tbBtn = { width: 28, height: 28, borderRadius: 6, background: 'rgba(255,255,255,.04)', border: '1px solid #1e2d4a', color: '#64748b', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }

const st = {
  emptyPanel: { padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, color: '#334155' },
  propsPanel: { padding: 16 },
  input: { width: '100%', padding: '8px 10px', borderRadius: 8, marginBottom: 0, background: '#0a0f1e', border: '1px solid #1e2d4a', color: '#e2e8f0', fontFamily: 'DM Mono, monospace', fontSize: 13 },
  textarea: { width: '100%', padding: '8px 10px', borderRadius: 8, background: '#0a0f1e', border: '1px solid #1e2d4a', color: '#e2e8f0', fontFamily: 'DM Mono, monospace', fontSize: 13, resize: 'vertical' },
  select: { width: '100%', padding: '8px 10px', borderRadius: 8, background: '#0a0f1e', border: '1px solid #1e2d4a', color: '#e2e8f0', fontFamily: 'DM Mono, monospace', fontSize: 13 },
  btnSecondary: { width: '100%', padding: '8px', borderRadius: 8, background: 'rgba(0,212,255,.08)', border: '1px solid rgba(0,212,255,.2)', color: '#00d4ff', fontFamily: 'DM Mono, monospace', fontSize: 12, cursor: 'pointer', marginTop: 4 },
  btnDanger: { padding: '6px 10px', borderRadius: 6, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: '#ef4444', fontFamily: 'DM Mono, monospace', fontSize: 12, cursor: 'pointer' },
}

export async function getServerSideProps() { return { props: {} } }
