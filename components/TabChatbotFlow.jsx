// components/TabChatbotFlow.jsx
// Aba "Construtor de Fluxo" para inserir dentro da página /prospeccao
//
// COMO USAR:
//   1. Copie este arquivo para components/TabChatbotFlow.jsx
//   2. Na sua página /prospeccao, importe e renderize quando aba === 'chatbot'
//
//   Exemplo na sua página de prospecção:
//   -----------------------------------------
//   import TabChatbotFlow from '../components/TabChatbotFlow'
//
//   // onde você renderiza as abas:
//   {aba === 'chatbot' && <TabChatbotFlow empresaId={empresaId} cfg={cfg} />}
//   -----------------------------------------

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// ─── Tipos de nó ─────────────────────────────────────────────────
const NODE_TYPES = {
  start:     { label: 'Início',    icon: '▶', color: '#10b981', desc: 'Ponto de entrada do fluxo' },
  message:   { label: 'Mensagem', icon: '💬', color: '#00d4ff', desc: 'Envia texto ao cliente' },
  question:  { label: 'Pergunta', icon: '❓', color: '#7c3aed', desc: 'Aguarda resposta do cliente' },
  condition: { label: 'Condição', icon: '⚡', color: '#f59e0b', desc: 'Ramifica por palavra-chave' },
  action:    { label: 'Ação',     icon: '⚙', color: '#ec4899', desc: 'Transfere ou chama webhook' },
  end:       { label: 'Fim',      icon: '⏹', color: '#64748b', desc: 'Encerra o atendimento' },
}

const SNAP = 20
const snapV = v => Math.round(v / SNAP) * SNAP
const NODE_W = 210
const NODE_H = 82
const genId = () => Math.random().toString(36).slice(2, 9)

// ─── Fluxo padrão para novos fluxos ─────────────────────────────
function makeDefaultFlow() {
  const ids = { s: genId(), m: genId(), q: genId(), c: genId(), a1: genId(), a2: genId(), a3: genId() }
  return {
    nodes: [
      { id: ids.s,  type: 'start',     x: 60,   y: 180, data: { text: 'Olá! Seja bem-vindo. 👋' } },
      { id: ids.m,  type: 'message',   x: 340,  y: 180, data: { text: 'Como posso te ajudar?' } },
      { id: ids.q,  type: 'question',  x: 620,  y: 180, data: { text: 'Digite 1-Suporte, 2-Vendas, 3-Financeiro', variable: 'opcao' } },
      { id: ids.c,  type: 'condition', x: 900,  y: 180, data: { variable: 'opcao', branches: [{ keyword: '1' }, { keyword: '2' }, { keyword: '3' }] } },
      { id: ids.a1, type: 'action',    x: 1180, y: 60,  data: { actionType: 'transfer', text: 'Transferindo para Suporte...' } },
      { id: ids.a2, type: 'action',    x: 1180, y: 200, data: { actionType: 'transfer', text: 'Transferindo para Vendas...' } },
      { id: ids.a3, type: 'action',    x: 1180, y: 340, data: { actionType: 'transfer', text: 'Transferindo para Financeiro...' } },
    ],
    connections: [
      { id: genId(), fromId: ids.s,  toId: ids.m,  port: 'main' },
      { id: genId(), fromId: ids.m,  toId: ids.q,  port: 'main' },
      { id: genId(), fromId: ids.q,  toId: ids.c,  port: 'main' },
      { id: genId(), fromId: ids.c,  toId: ids.a1, port: 'branch_0', label: '1' },
      { id: genId(), fromId: ids.c,  toId: ids.a2, port: 'branch_1', label: '2' },
      { id: genId(), fromId: ids.c,  toId: ids.a3, port: 'branch_2', label: '3' },
    ]
  }
}

// ─── Nó SVG ──────────────────────────────────────────────────────
function FlowNode({ node, selected, onMouseDown, onPortDown, onPortUp, connecting }) {
  const t = NODE_TYPES[node.type] || NODE_TYPES.message
  const extraPortCount = node.type === 'condition' ? (node.data?.branches?.length || 0) : 0
  const totalH = NODE_H + extraPortCount * 24

  return (
    <g transform={`translate(${node.x},${node.y})`} style={{ cursor: 'grab', userSelect: 'none' }}>
      {/* Sombra */}
      <rect x={3} y={5} width={NODE_W} height={totalH} rx={12} fill="rgba(0,0,0,.5)" />
      {/* Corpo */}
      <rect width={NODE_W} height={totalH} rx={12}
        fill={selected ? '#1e2d4a' : '#111827'}
        stroke={selected ? t.color : 'rgba(255,255,255,.07)'}
        strokeWidth={selected ? 2 : 1}
        onMouseDown={e => { e.stopPropagation(); onMouseDown(e, node.id) }}
      />
      {/* Faixa colorida esquerda */}
      <rect width={4} height={totalH} rx={2} fill={t.color} />
      {/* Ícone */}
      <text x={18} y={NODE_H / 2 + 6} fontSize={18} dominantBaseline="central"
        onMouseDown={e => { e.stopPropagation(); onMouseDown(e, node.id) }}>{t.icon}</text>
      {/* Tipo */}
      <text x={44} y={22} fontSize={10} fill={t.color} fontFamily="DM Mono,monospace" fontWeight={700} letterSpacing={1}
        onMouseDown={e => { e.stopPropagation(); onMouseDown(e, node.id) }}>
        {t.label.toUpperCase()}
      </text>
      {/* Texto do nó */}
      <foreignObject x={44} y={30} width={155} height={44}
        onMouseDown={e => { e.stopPropagation(); onMouseDown(e, node.id) }}>
        <div xmlns="http://www.w3.org/1999/xhtml"
          style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'DM Mono,monospace', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {node.data?.text || (node.type === 'condition' ? `Var: ${node.data?.variable || '?'}` : node.type === 'end' ? 'Encerrar conversa' : 'Clique para editar...')}
        </div>
      </foreignObject>
      {/* Porta de entrada (esquerda) */}
      {node.type !== 'start' && (
        <circle cx={0} cy={NODE_H / 2} r={7} fill="#0a0f1e" stroke="#334155" strokeWidth={2}
          style={{ cursor: 'crosshair' }}
          onMouseUp={e => { e.stopPropagation(); onPortUp(node.id) }} />
      )}
      {/* Porta de saída principal (direita) */}
      {node.type !== 'end' && node.type !== 'condition' && (
        <circle cx={NODE_W} cy={NODE_H / 2} r={7}
          fill={connecting?.fromId === node.id ? t.color : '#0a0f1e'}
          stroke={t.color} strokeWidth={2}
          style={{ cursor: 'crosshair' }}
          onMouseDown={e => { e.stopPropagation(); onPortDown(e, node.id, 'main', NODE_W, NODE_H / 2) }} />
      )}
      {/* Portas de ramificação para Condição */}
      {node.type === 'condition' && (node.data?.branches || []).map((b, i) => {
        const py = NODE_H / 2 + i * 24
        return (
          <g key={i}>
            <circle cx={NODE_W} cy={py} r={6} fill="#0a0f1e" stroke="#f59e0b" strokeWidth={2}
              style={{ cursor: 'crosshair' }}
              onMouseDown={e => { e.stopPropagation(); onPortDown(e, node.id, `branch_${i}`, NODE_W, py) }} />
            <text x={NODE_W + 10} y={py + 4} fontSize={10} fill="#94a3b8" fontFamily="DM Mono,monospace">
              {b.keyword || `Opção ${i + 1}`}
            </text>
          </g>
        )
      })}
    </g>
  )
}

// ─── Conexão ─────────────────────────────────────────────────────
function FlowEdge({ conn, nodes, selected, onClick }) {
  const from = nodes.find(n => n.id === conn.fromId)
  const to   = nodes.find(n => n.id === conn.toId)
  if (!from || !to) return null

  // Calcular ponto de saída considerando ramificações
  let y1 = from.y + NODE_H / 2
  if (conn.port?.startsWith('branch_')) {
    const idx = Number(conn.port.split('_')[1])
    y1 = from.y + NODE_H / 2 + idx * 24
  }
  const x1 = from.x + NODE_W
  const x2 = to.x
  const y2 = to.y + NODE_H / 2
  const cx = x1 + Math.max(60, (x2 - x1) * 0.5)
  const t = NODE_TYPES[from.type] || NODE_TYPES.message

  return (
    <g style={{ cursor: 'pointer' }} onClick={() => onClick(conn.id)}>
      <path d={`M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`}
        fill="none" stroke={selected ? '#fff' : t.color}
        strokeWidth={selected ? 2.5 : 1.5} strokeOpacity={selected ? 1 : 0.45}
        markerEnd="url(#arr)" />
      {/* Área clicável maior */}
      <path d={`M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`}
        fill="none" stroke="transparent" strokeWidth={12} />
      {conn.label && (
        <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 8}
          textAnchor="middle" fontSize={10} fill="#64748b" fontFamily="DM Mono,monospace">
          {conn.label}
        </text>
      )}
    </g>
  )
}

// ─── Painel de Propriedades ───────────────────────────────────────
function PropsPanel({ node, onChange, onDelete }) {
  if (!node) return (
    <div style={{ padding: 32, textAlign: 'center', color: '#334155' }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>🖱️</div>
      <div style={{ fontSize: 12, lineHeight: 1.6 }}>Clique em um nó para<br />editar as propriedades</div>
    </div>
  )

  const t = NODE_TYPES[node.type]
  const upd = patch => onChange({ ...node, data: { ...(node.data || {}), ...patch } })

  return (
    <div style={{ padding: 14, overflowY: 'auto', flex: 1 }}>
      {/* Cabeçalho do tipo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #1e2d4a' }}>
        <span style={{ fontSize: 18 }}>{t.icon}</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.color, letterSpacing: 0.5 }}>{t.label.toUpperCase()}</div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{t.desc}</div>
        </div>
      </div>

      {/* Campos por tipo */}
      {(node.type === 'start' || node.type === 'message' || node.type === 'end') && (
        <Fld label="Mensagem">
          <textarea value={node.data?.text || ''} onChange={e => upd({ text: e.target.value })}
            rows={4} placeholder="Digite a mensagem..." style={fSt.ta} />
        </Fld>
      )}

      {node.type === 'question' && <>
        <Fld label="Pergunta enviada ao cliente">
          <textarea value={node.data?.text || ''} onChange={e => upd({ text: e.target.value })}
            rows={3} placeholder="Ex: Qual é o seu nome?" style={fSt.ta} />
        </Fld>
        <Fld label="Salvar resposta na variável">
          <input value={node.data?.variable || ''} onChange={e => upd({ variable: e.target.value })}
            placeholder="Ex: nome_cliente" style={fSt.inp} />
          <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>Use {'{{nome_cliente}}'} em mensagens futuras</div>
        </Fld>
        <Fld label="Timeout sem resposta (segundos)">
          <input type="number" value={node.data?.timeout || 120} onChange={e => upd({ timeout: Number(e.target.value) })} style={fSt.inp} />
        </Fld>
      </>}

      {node.type === 'condition' && <>
        <Fld label="Variável a analisar">
          <input value={node.data?.variable || ''} onChange={e => upd({ variable: e.target.value })}
            placeholder="Ex: opcao" style={fSt.inp} />
        </Fld>
        <Fld label="Ramificações (palavra-chave)">
          {(node.data?.branches || []).map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <input value={b.keyword || ''} placeholder={`Palavra-chave ${i + 1}`}
                onChange={e => {
                  const brs = [...(node.data?.branches || [])]
                  brs[i] = { ...brs[i], keyword: e.target.value }
                  upd({ branches: brs })
                }}
                style={{ ...fSt.inp, flex: 1, marginBottom: 0 }} />
              <button onClick={() => {
                const brs = [...(node.data?.branches || [])]
                brs.splice(i, 1); upd({ branches: brs })
              }} style={fSt.btnDel}>✕</button>
            </div>
          ))}
          <button onClick={() => upd({ branches: [...(node.data?.branches || []), { keyword: '' }] })}
            style={fSt.btnAdd}>+ Ramificação</button>
        </Fld>
      </>}

      {node.type === 'action' && <>
        <Fld label="Tipo de ação">
          <select value={node.data?.actionType || 'transfer'} onChange={e => upd({ actionType: e.target.value })} style={fSt.sel}>
            <option value="transfer">Transferir para humano</option>
            <option value="webhook">Chamar URL (webhook)</option>
            <option value="tag">Adicionar tag ao contato</option>
            <option value="close">Fechar conversa</option>
          </select>
        </Fld>
        {node.data?.actionType === 'transfer' && (
          <Fld label="Mensagem antes de transferir">
            <textarea value={node.data?.text || ''} onChange={e => upd({ text: e.target.value })}
              rows={2} placeholder="Aguarde, vou conectar você..." style={fSt.ta} />
          </Fld>
        )}
        {node.data?.actionType === 'webhook' && (
          <Fld label="URL do Webhook (POST)">
            <input value={node.data?.webhookUrl || ''} onChange={e => upd({ webhookUrl: e.target.value })}
              placeholder="https://..." style={fSt.inp} />
          </Fld>
        )}
        {node.data?.actionType === 'tag' && (
          <Fld label="Tag a adicionar">
            <input value={node.data?.tag || ''} onChange={e => upd({ tag: e.target.value })}
              placeholder="Ex: lead_quente" style={fSt.inp} />
          </Fld>
        )}
      </>}

      <button onClick={() => onDelete(node.id)}
        style={{ ...fSt.btnDel, width: '100%', padding: '9px', marginTop: 20, borderRadius: 8, fontSize: 12 }}>
        🗑 Excluir este nó
      </button>
    </div>
  )
}

function Fld({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 10, color: '#64748b', letterSpacing: 0.8, display: 'block', marginBottom: 5, textTransform: 'uppercase' }}>{label}</label>
      {children}
    </div>
  )
}

const fSt = {
  inp: { width: '100%', padding: '7px 9px', borderRadius: 7, background: '#0a0f1e', border: '1px solid #1e2d4a', color: '#e2e8f0', fontFamily: 'DM Mono,monospace', fontSize: 12, marginBottom: 0, outline: 'none', boxSizing: 'border-box' },
  ta:  { width: '100%', padding: '7px 9px', borderRadius: 7, background: '#0a0f1e', border: '1px solid #1e2d4a', color: '#e2e8f0', fontFamily: 'DM Mono,monospace', fontSize: 12, resize: 'vertical', outline: 'none', boxSizing: 'border-box' },
  sel: { width: '100%', padding: '7px 9px', borderRadius: 7, background: '#0a0f1e', border: '1px solid #1e2d4a', color: '#e2e8f0', fontFamily: 'DM Mono,monospace', fontSize: 12, outline: 'none', boxSizing: 'border-box' },
  btnAdd: { width: '100%', padding: '7px', borderRadius: 7, background: 'rgba(0,212,255,.08)', border: '1px solid rgba(0,212,255,.2)', color: '#00d4ff', fontFamily: 'DM Mono,monospace', fontSize: 11, cursor: 'pointer', marginTop: 2 },
  btnDel: { padding: '5px 8px', borderRadius: 6, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', color: '#ef4444', fontFamily: 'DM Mono,monospace', fontSize: 11, cursor: 'pointer' },
}

// ════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL DA ABA
// ════════════════════════════════════════════════════════════════════
export default function TabChatbotFlow({ empresaId, cfg = {} }) {
  // ── Estado dos fluxos ──────────────────────────────────────────
  const [flows, setFlows]           = useState([])
  const [botAtivo, setBotAtivo]     = useState(false)
  const [activeFlowId, setActiveFlowId] = useState(null)
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [view, setView]             = useState('list') // 'list' | 'editor'
  const [editFlow, setEditFlow]     = useState(null)   // fluxo em edição
  const [toast, setToast]           = useState(null)

  // ── Estado do canvas ───────────────────────────────────────────
  const svgRef    = useRef(null)
  const dragging  = useRef(null)
  const isPanning = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })

  const [nodes, setNodes]           = useState([])
  const [conns, setConns]           = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [selectedConnId, setSelectedConnId] = useState(null)
  const [connecting, setConnecting] = useState(null)
  const [pan, setPan]               = useState({ x: 40, y: 30 })
  const [scale, setScale]           = useState(0.85)
  const [flowName, setFlowName]     = useState('')

  // ── Carregar dados ─────────────────────────────────────────────
  useEffect(() => {
    if (!empresaId) return
    loadData()
  }, [empresaId])

  async function loadData() {
    setLoading(true)
    const { data: row } = await supabase.from('vx_storage').select('value')
      .eq('key', `chatbot_flows:${empresaId}`).maybeSingle()
    if (row?.value) {
      const d = JSON.parse(row.value)
      setFlows(d.flows || [])
      setBotAtivo(d.botAtivo || false)
      setActiveFlowId(d.activeFlowId || null)
    }
    setLoading(false)
  }

  async function persistFlows(newFlows, newBotAtivo, newActiveId) {
    await supabase.from('vx_storage').upsert({
      key: `chatbot_flows:${empresaId}`,
      value: JSON.stringify({
        flows: newFlows ?? flows,
        botAtivo: newBotAtivo ?? botAtivo,
        activeFlowId: newActiveId ?? activeFlowId,
      }),
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' })
  }

  function toast_(msg, type = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Operações de fluxo ─────────────────────────────────────────
  function criarFluxo() {
    const df = makeDefaultFlow()
    const f = { id: genId(), name: 'Novo Fluxo', active: false, createdAt: new Date().toISOString(), ...df }
    openEditor(f)
  }

  function openEditor(f) {
    setEditFlow(f)
    setFlowName(f.name)
    setNodes(f.nodes || [])
    setConns(f.connections || [])
    setSelectedId(null)
    setSelectedConnId(null)
    setPan({ x: 40, y: 30 })
    setScale(0.85)
    setView('editor')
  }

  async function salvarFluxo() {
    setSaving(true)
    const updated = { ...editFlow, name: flowName, nodes, connections: conns, updatedAt: new Date().toISOString() }
    const newFlows = flows.find(f => f.id === updated.id)
      ? flows.map(f => f.id === updated.id ? updated : f)
      : [...flows, updated]
    setFlows(newFlows)
    await persistFlows(newFlows)
    setSaving(false)
    toast_('✅ Fluxo salvo com sucesso!')
  }

  async function excluirFluxo(id) {
    if (!confirm('Excluir este fluxo?')) return
    const nf = flows.filter(f => f.id !== id)
    setFlows(nf)
    const newActive = activeFlowId === id ? null : activeFlowId
    setActiveFlowId(newActive)
    await persistFlows(nf, botAtivo, newActive)
    toast_('🗑 Fluxo excluído')
  }

  async function ativarFluxo(id) {
    const nf = flows.map(f => ({ ...f, active: f.id === id }))
    setFlows(nf)
    setActiveFlowId(id)
    await persistFlows(nf, botAtivo, id)
    toast_('✅ Fluxo ativado!')
  }

  async function toggleBot() {
    const nb = !botAtivo
    setBotAtivo(nb)
    await persistFlows(flows, nb, activeFlowId)
    toast_(nb ? '✅ Chatbot ativado no WhatsApp!' : '⏸ Chatbot pausado')
  }

  // ── Canvas: Drag nós ───────────────────────────────────────────
  function startDrag(e, nodeId) {
    if (!svgRef.current) return
    const r = svgRef.current.getBoundingClientRect()
    const mx = (e.clientX - r.left - pan.x) / scale
    const my = (e.clientY - r.top  - pan.y) / scale
    const n = nodes.find(x => x.id === nodeId)
    dragging.current = { nodeId, ox: mx - n.x, oy: my - n.y }
    setSelectedId(nodeId)
    setSelectedConnId(null)
  }

  function onSvgMove(e) {
    if (!svgRef.current) return
    const r = svgRef.current.getBoundingClientRect()
    const mx = (e.clientX - r.left - pan.x) / scale
    const my = (e.clientY - r.top  - pan.y) / scale

    if (dragging.current) {
      const { nodeId, ox, oy } = dragging.current
      setNodes(ns => ns.map(n => n.id === nodeId
        ? { ...n, x: snapV(mx - ox), y: snapV(my - oy) }
        : n))
      return
    }
    if (isPanning.current) {
      setPan(p => ({ x: p.x + e.clientX - lastMouse.current.x, y: p.y + e.clientY - lastMouse.current.y }))
      lastMouse.current = { x: e.clientX, y: e.clientY }
      return
    }
    if (connecting) {
      setConnecting(c => ({ ...c, mx, my }))
    }
  }

  function onSvgUp() {
    dragging.current = null
    isPanning.current = false
    if (connecting) setConnecting(null)
  }

  function onSvgDown(e) {
    if (e.altKey || e.button === 1) {
      isPanning.current = true
      lastMouse.current = { x: e.clientX, y: e.clientY }
      return
    }
    setSelectedId(null)
    setSelectedConnId(null)
  }

  function onWheel(e) {
    e.preventDefault()
    setScale(s => Math.min(2, Math.max(0.25, s * (e.deltaY > 0 ? 0.9 : 1.11))))
  }

  // ── Portas de conexão ──────────────────────────────────────────
  function startConnect(e, fromId, port, portX, portY) {
    const r = svgRef.current.getBoundingClientRect()
    const fromNode = nodes.find(n => n.id === fromId)
    setConnecting({
      fromId, port,
      fx: fromNode.x + portX,
      fy: fromNode.y + portY,
      mx: (e.clientX - r.left - pan.x) / scale,
      my: (e.clientY - r.top  - pan.y) / scale,
    })
  }

  function finishConnect(toId) {
    if (!connecting || connecting.fromId === toId) { setConnecting(null); return }
    const exists = conns.find(c => c.fromId === connecting.fromId && c.toId === toId && c.port === connecting.port)
    if (!exists) {
      setConns(cs => [...cs, { id: genId(), fromId: connecting.fromId, toId, port: connecting.port }])
    }
    setConnecting(null)
  }

  // ── Nós: adicionar e deletar ───────────────────────────────────
  function addNode(type) {
    const cx = snapV((-pan.x + 300) / scale)
    const cy = snapV((-pan.y + 200) / scale)
    const n = { id: genId(), type, x: cx, y: cy, data: {} }
    setNodes(ns => [...ns, n])
    setSelectedId(n.id)
  }

  function deleteNode(id) {
    setNodes(ns => ns.filter(n => n.id !== id))
    setConns(cs => cs.filter(c => c.fromId !== id && c.toId !== id))
    setSelectedId(null)
  }

  function updateNode(updated) {
    setNodes(ns => ns.map(n => n.id === updated.id ? updated : n))
  }

  const selectedNode = nodes.find(n => n.id === selectedId) || null
  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const webhookUrl = `${appUrl}/api/wpp/webhook`

  // ════════════════════════════════════════
  // VISTA: LISTA DE FLUXOS
  // ════════════════════════════════════════
  if (view === 'list') return (
    <div style={{ padding: '0 0 40px' }}>
      {/* Barra superior */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', fontFamily: 'Syne,sans-serif' }}>🤖 Fluxos de Chatbot</div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>Crie fluxos visuais de atendimento automático via WhatsApp</div>
        </div>

        {/* Toggle bot ativo/pausado */}
        <div onClick={toggleBot} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
          borderRadius: 10, cursor: 'pointer', transition: 'all .2s',
          background: botAtivo ? 'rgba(16,185,129,.12)' : 'rgba(100,116,139,.08)',
          border: `1px solid ${botAtivo ? 'rgba(16,185,129,.35)' : 'rgba(100,116,139,.25)'}`,
          color: botAtivo ? '#10b981' : '#64748b', fontSize: 12, fontWeight: 600,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: botAtivo ? '#10b981' : '#475569', boxShadow: botAtivo ? '0 0 8px #10b981' : 'none' }} />
          {botAtivo ? 'Bot Ativo' : 'Bot Pausado'}
        </div>

        <button onClick={criarFluxo} style={{ padding: '9px 18px', borderRadius: 10, background: 'linear-gradient(135deg,#00d4ff,#0099bb)', border: 'none', color: '#fff', fontFamily: 'DM Mono,monospace', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          + Novo Fluxo
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#475569', fontSize: 13 }}>Carregando...</div>
      ) : flows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#0f172a', borderRadius: 14, border: '1px dashed #1e2d4a' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🌊</div>
          <div style={{ fontSize: 14, color: '#e2e8f0', marginBottom: 6 }}>Nenhum fluxo criado</div>
          <div style={{ fontSize: 12, color: '#475569', marginBottom: 20 }}>Crie seu primeiro fluxo de atendimento automático</div>
          <button onClick={criarFluxo} style={{ padding: '10px 22px', borderRadius: 10, background: 'linear-gradient(135deg,#00d4ff,#0099bb)', border: 'none', color: '#fff', fontFamily: 'DM Mono,monospace', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            + Criar Primeiro Fluxo
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {flows.map(f => (
            <div key={f.id} style={{ background: '#0f172a', border: `1px solid ${f.active ? 'rgba(16,185,129,.35)' : '#1e2d4a'}`, borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{f.name}</span>
                  {f.active && (
                    <span style={{ fontSize: 9, background: 'rgba(16,185,129,.15)', color: '#10b981', border: '1px solid rgba(16,185,129,.3)', borderRadius: 20, padding: '2px 7px', letterSpacing: 0.5 }}>ATIVO</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#475569' }}>
                  {f.nodes?.length || 0} nós · {f.connections?.length || 0} conexões
                  {f.updatedAt && ` · Salvo em ${new Date(f.updatedAt).toLocaleDateString('pt-BR')}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {!f.active && (
                  <button onClick={() => ativarFluxo(f.id)} style={{ padding: '7px 13px', borderRadius: 8, background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.25)', color: '#10b981', fontFamily: 'DM Mono,monospace', fontSize: 11, cursor: 'pointer' }}>
                    ▶ Ativar
                  </button>
                )}
                <button onClick={() => openEditor(f)} style={{ padding: '7px 13px', borderRadius: 8, background: 'rgba(0,212,255,.08)', border: '1px solid rgba(0,212,255,.25)', color: '#00d4ff', fontFamily: 'DM Mono,monospace', fontSize: 11, cursor: 'pointer' }}>
                  ✏ Editar
                </button>
                <button onClick={() => excluirFluxo(f.id)} style={{ padding: '7px 11px', borderRadius: 8, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', color: '#ef4444', fontFamily: 'DM Mono,monospace', fontSize: 11, cursor: 'pointer' }}>
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info webhook */}
      <div style={{ marginTop: 24, padding: '16px 18px', background: '#0f172a', borderRadius: 12, border: '1px dashed #1e2d4a' }}>
        <div style={{ fontSize: 11, color: '#00d4ff', fontWeight: 700, marginBottom: 6, letterSpacing: 0.5 }}>⚡ WEBHOOK JÁ CONFIGURADO</div>
        <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.7 }}>
          O webhook abaixo já está integrado ao seu sistema. Configure-o no painel da Evolution API:
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', background: '#080d1a', padding: '8px 12px', borderRadius: 8, fontFamily: 'monospace', marginTop: 8, wordBreak: 'break-all' }}>
          {webhookUrl}
        </div>
        <div style={{ fontSize: 10, color: '#334155', marginTop: 8 }}>
          Eventos necessários: <strong style={{ color: '#475569' }}>messages.upsert</strong>
        </div>
      </div>

      {toast && <Toast {...toast} />}
    </div>
  )

  // ════════════════════════════════════════
  // VISTA: EDITOR DE CANVAS
  // ════════════════════════════════════════
  return (
    <div style={{ position: 'fixed', inset: 0, top: 52, zIndex: 500, background: '#080d1a', display: 'flex', flexDirection: 'column', fontFamily: 'DM Mono,monospace' }}>

      {/* Toolbar do editor */}
      <div style={{ height: 48, background: '#0c1628', borderBottom: '1px solid #1e2d4a', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8, flexShrink: 0 }}>
        {/* Voltar */}
        <button onClick={() => { salvarFluxo(); setView('list') }}
          style={{ padding: '5px 10px', borderRadius: 7, background: 'none', border: '1px solid #1e2d4a', color: '#64748b', fontFamily: 'DM Mono,monospace', fontSize: 11, cursor: 'pointer' }}>
          ← Lista
        </button>

        {/* Nome editável */}
        <input value={flowName} onChange={e => setFlowName(e.target.value)}
          style={{ width: 180, height: 30, padding: '0 9px', borderRadius: 7, background: '#0a0f1e', border: '1px solid #1e2d4a', color: '#e2e8f0', fontFamily: 'DM Mono,monospace', fontSize: 12, fontWeight: 600, outline: 'none' }} />

        <div style={{ flex: 1 }} />

        {/* Botões de adicionar nó */}
        <span style={{ fontSize: 10, color: '#334155', marginRight: 4 }}>ADD:</span>
        {Object.entries(NODE_TYPES).filter(([k]) => k !== 'start').map(([type, t]) => (
          <button key={type} onClick={() => addNode(type)} title={t.desc}
            style={{ padding: '4px 9px', borderRadius: 7, background: 'rgba(255,255,255,.03)', border: `1px solid ${t.color}40`, color: t.color, fontFamily: 'DM Mono,monospace', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            {t.icon} {t.label}
          </button>
        ))}

        <div style={{ width: 1, height: 20, background: '#1e2d4a', margin: '0 4px' }} />

        {/* Zoom */}
        <button onClick={() => setScale(s => Math.min(2, s * 1.15))} style={tbB}>+</button>
        <span style={{ fontSize: 10, color: '#475569', minWidth: 32, textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale(s => Math.max(0.25, s / 1.15))} style={tbB}>−</button>
        <button onClick={() => { setPan({ x: 40, y: 30 }); setScale(0.85) }} style={tbB} title="Resetar visão">⊡</button>

        <div style={{ width: 1, height: 20, background: '#1e2d4a', margin: '0 4px' }} />

        <button onClick={salvarFluxo} disabled={saving}
          style={{ padding: '6px 14px', borderRadius: 8, background: 'linear-gradient(135deg,#00d4ff,#0099bb)', border: 'none', color: '#fff', fontFamily: 'DM Mono,monospace', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          {saving ? '⏳' : '💾 Salvar'}
        </button>
      </div>

      {/* Área principal: canvas + painel */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Canvas */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {/* Grid de fundo */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <defs>
              <pattern id="g1" width={SNAP * scale} height={SNAP * scale} patternUnits="userSpaceOnUse"
                x={pan.x % (SNAP * scale)} y={pan.y % (SNAP * scale)}>
                <path d={`M${SNAP * scale} 0 L 0 0 0 ${SNAP * scale}`} fill="none" stroke="#1a2540" strokeWidth={0.4} />
              </pattern>
              <pattern id="g5" width={SNAP * 5 * scale} height={SNAP * 5 * scale} patternUnits="userSpaceOnUse"
                x={pan.x % (SNAP * 5 * scale)} y={pan.y % (SNAP * 5 * scale)}>
                <path d={`M${SNAP * 5 * scale} 0 L 0 0 0 ${SNAP * 5 * scale}`} fill="none" stroke="#1e2d4a" strokeWidth={0.8} />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#g1)" />
            <rect width="100%" height="100%" fill="url(#g5)" opacity={0.6} />
          </svg>

          {/* SVG interativo */}
          <svg ref={svgRef}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            onMouseMove={onSvgMove} onMouseUp={onSvgUp} onMouseDown={onSvgDown} onWheel={onWheel}>
            <defs>
              <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </marker>
            </defs>
            <g transform={`translate(${pan.x},${pan.y}) scale(${scale})`}>
              {/* Conexões */}
              {conns.map(c => (
                <FlowEdge key={c.id} conn={c} nodes={nodes}
                  selected={selectedConnId === c.id}
                  onClick={id => { setSelectedConnId(id); setSelectedId(null) }} />
              ))}
              {/* Linha de conexão temporária */}
              {connecting && (
                <path
                  d={`M${connecting.fx},${connecting.fy} C${connecting.fx + 80},${connecting.fy} ${connecting.mx - 80},${connecting.my} ${connecting.mx},${connecting.my}`}
                  fill="none" stroke="#00d4ff" strokeWidth={1.5} strokeDasharray="6 3" strokeOpacity={0.7}
                />
              )}
              {/* Nós */}
              {nodes.map(n => (
                <FlowNode key={n.id} node={n} selected={selectedId === n.id}
                  connecting={connecting}
                  onMouseDown={startDrag}
                  onPortDown={startConnect}
                  onPortUp={finishConnect} />
              ))}
            </g>
          </svg>

          {/* Dica no rodapé */}
          <div style={{ position: 'absolute', bottom: 12, left: 14, fontSize: 10, color: '#1e3a5f', pointerEvents: 'none' }}>
            Alt+arrastar = mover canvas · Scroll = zoom · Arraste as boletas coloridas para conectar nós · Clique numa seta para excluí-la
          </div>

          {/* Barra de excluir conexão */}
          {selectedConnId && (
            <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', background: '#0c1628', border: '1px solid #ef4444', borderRadius: 10, padding: '7px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>Conexão selecionada</span>
              <button onClick={() => { setConns(cs => cs.filter(c => c.id !== selectedConnId)); setSelectedConnId(null) }}
                style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.4)', color: '#ef4444', fontFamily: 'DM Mono,monospace', fontSize: 11, cursor: 'pointer' }}>
                🗑 Excluir
              </button>
            </div>
          )}
        </div>

        {/* Painel de propriedades */}
        <div style={{ width: 260, background: '#0c1628', borderLeft: '1px solid #1e2d4a', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e2d4a', fontSize: 10, color: '#334155', letterSpacing: 0.8 }}>
            PROPRIEDADES DO NÓ
          </div>
          <PropsPanel node={selectedNode} onChange={updateNode} onDelete={deleteNode} />
        </div>
      </div>

      {toast && <Toast {...toast} />}
    </div>
  )
}

function Toast({ msg, type }) {
  return (
    <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: type === 'ok' ? 'rgba(16,185,129,.9)' : 'rgba(239,68,68,.9)', color: '#fff', padding: '11px 22px', borderRadius: 10, fontSize: 13, zIndex: 99999, fontFamily: 'DM Mono,monospace', whiteSpace: 'nowrap' }}>
      {msg}
    </div>
  )
}

const tbB = { width: 26, height: 26, borderRadius: 6, background: 'rgba(255,255,255,.03)', border: '1px solid #1e2d4a', color: '#475569', cursor: 'pointer', fontFamily: 'DM Mono,monospace', fontSize: 13 }
