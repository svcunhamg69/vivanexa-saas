// pages/prospeccao.js — Prospecção e Ferramentas Comerciais Vivanexa SaaS
// =========================================================================
// Submenus: Disparo em Massa, Chatbot, Agente IA, Script/Playbook Comercial
// =========================================================================

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

// ══════════════════════════════════════════════════════════════════
// TAB CHATBOT FLOW — construtor visual de fluxos inline
// ══════════════════════════════════════════════════════════════════

const FLOW_NODE_TYPES = {
  start:     { label: 'Início',    icon: '▶', color: '#10b981', desc: 'Ponto de entrada do fluxo' },
  message:   { label: 'Mensagem', icon: '💬', color: '#00d4ff', desc: 'Envia texto ao cliente' },
  question:  { label: 'Pergunta', icon: '❓', color: '#7c3aed', desc: 'Aguarda resposta do cliente' },
  condition: { label: 'Condição', icon: '⚡', color: '#f59e0b', desc: 'Ramifica por palavra-chave' },
  action:    { label: 'Ação',     icon: '⚙', color: '#ec4899', desc: 'Transfere ou chama webhook' },
  end:       { label: 'Fim',      icon: '⏹', color: '#64748b', desc: 'Encerra o atendimento' },
}
const FLOW_SNAP = 20
const snapV = v => Math.round(v / FLOW_SNAP) * FLOW_SNAP
const FLOW_NODE_W = 210
const FLOW_NODE_H = 82
const flowGenId = () => Math.random().toString(36).slice(2, 9)

function makeDefaultFlow() {
  const ids = { s: flowGenId(), m: flowGenId(), q: flowGenId(), c: flowGenId(), a1: flowGenId(), a2: flowGenId(), a3: flowGenId() }
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
      { id: flowGenId(), fromId: ids.s,  toId: ids.m,  port: 'main' },
      { id: flowGenId(), fromId: ids.m,  toId: ids.q,  port: 'main' },
      { id: flowGenId(), fromId: ids.q,  toId: ids.c,  port: 'main' },
      { id: flowGenId(), fromId: ids.c,  toId: ids.a1, port: 'branch_0', label: '1' },
      { id: flowGenId(), fromId: ids.c,  toId: ids.a2, port: 'branch_1', label: '2' },
      { id: flowGenId(), fromId: ids.c,  toId: ids.a3, port: 'branch_2', label: '3' },
    ]
  }
}

function FlowNode({ node, selected, onMouseDown, onPortDown, onPortUp, connecting }) {
  const t = FLOW_NODE_TYPES[node.type] || FLOW_NODE_TYPES.message
  const extraPortCount = node.type === 'condition' ? (node.data?.branches?.length || 0) : 0
  const totalH = FLOW_NODE_H + extraPortCount * 24
  return (
    <g transform={`translate(${node.x},${node.y})`} style={{ cursor: 'grab', userSelect: 'none' }}>
      <rect x={3} y={5} width={FLOW_NODE_W} height={totalH} rx={12} fill="rgba(0,0,0,.5)" />
      <rect width={FLOW_NODE_W} height={totalH} rx={12}
        fill={selected ? '#1e2d4a' : '#111827'}
        stroke={selected ? t.color : 'rgba(255,255,255,.07)'}
        strokeWidth={selected ? 2 : 1}
        onMouseDown={e => { e.stopPropagation(); onMouseDown(e, node.id) }} />
      <rect width={4} height={totalH} rx={2} fill={t.color} />
      <text x={18} y={FLOW_NODE_H / 2 + 6} fontSize={18} dominantBaseline="central"
        onMouseDown={e => { e.stopPropagation(); onMouseDown(e, node.id) }}>{t.icon}</text>
      <text x={44} y={22} fontSize={10} fill={t.color} fontFamily="DM Mono,monospace" fontWeight={700} letterSpacing={1}
        onMouseDown={e => { e.stopPropagation(); onMouseDown(e, node.id) }}>
        {t.label.toUpperCase()}
      </text>
      <foreignObject x={44} y={30} width={155} height={44}
        onMouseDown={e => { e.stopPropagation(); onMouseDown(e, node.id) }}>
        <div xmlns="http://www.w3.org/1999/xhtml"
          style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'DM Mono,monospace', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {node.data?.text || (node.type === 'condition' ? `Var: ${node.data?.variable || '?'}` : node.type === 'end' ? 'Encerrar conversa' : 'Clique para editar...')}
        </div>
      </foreignObject>
      {node.type !== 'start' && (
        <circle cx={0} cy={FLOW_NODE_H / 2} r={7} fill="#0a0f1e" stroke="#334155" strokeWidth={2}
          style={{ cursor: 'crosshair' }}
          onMouseUp={e => { e.stopPropagation(); onPortUp(node.id) }} />
      )}
      {node.type !== 'end' && node.type !== 'condition' && (
        <circle cx={FLOW_NODE_W} cy={FLOW_NODE_H / 2} r={7}
          fill={connecting?.fromId === node.id ? t.color : '#0a0f1e'}
          stroke={t.color} strokeWidth={2}
          style={{ cursor: 'crosshair' }}
          onMouseDown={e => { e.stopPropagation(); onPortDown(e, node.id, 'main', FLOW_NODE_W, FLOW_NODE_H / 2) }} />
      )}
      {node.type === 'condition' && (node.data?.branches || []).map((b, i) => {
        const py = FLOW_NODE_H / 2 + i * 24
        return (
          <g key={i}>
            <circle cx={FLOW_NODE_W} cy={py} r={6} fill="#0a0f1e" stroke="#f59e0b" strokeWidth={2}
              style={{ cursor: 'crosshair' }}
              onMouseDown={e => { e.stopPropagation(); onPortDown(e, node.id, `branch_${i}`, FLOW_NODE_W, py) }} />
            <text x={FLOW_NODE_W + 10} y={py + 4} fontSize={10} fill="#94a3b8" fontFamily="DM Mono,monospace">
              {b.keyword || `Opção ${i + 1}`}
            </text>
          </g>
        )
      })}
    </g>
  )
}

function FlowEdge({ conn, nodes, selected, onClick }) {
  const from = nodes.find(n => n.id === conn.fromId)
  const to   = nodes.find(n => n.id === conn.toId)
  if (!from || !to) return null
  let y1 = from.y + FLOW_NODE_H / 2
  if (conn.port?.startsWith('branch_')) y1 = from.y + FLOW_NODE_H / 2 + Number(conn.port.split('_')[1]) * 24
  const x1 = from.x + FLOW_NODE_W, x2 = to.x, y2 = to.y + FLOW_NODE_H / 2
  const cx = x1 + Math.max(60, (x2 - x1) * 0.5)
  const t = FLOW_NODE_TYPES[from.type] || FLOW_NODE_TYPES.message
  return (
    <g style={{ cursor: 'pointer' }} onClick={() => onClick(conn.id)}>
      <path d={`M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`}
        fill="none" stroke={selected ? '#fff' : t.color}
        strokeWidth={selected ? 2.5 : 1.5} strokeOpacity={selected ? 1 : 0.45}
        markerEnd="url(#flowarr)" />
      <path d={`M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`} fill="none" stroke="transparent" strokeWidth={12} />
      {conn.label && (
        <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 8} textAnchor="middle" fontSize={10} fill="#64748b" fontFamily="DM Mono,monospace">{conn.label}</text>
      )}
    </g>
  )
}

function FlowPropsPanel({ node, onChange, onDelete }) {
  const fInp = { width: '100%', padding: '7px 9px', borderRadius: 7, background: '#0a0f1e', border: '1px solid #1e2d4a', color: '#e2e8f0', fontFamily: 'DM Mono,monospace', fontSize: 12, outline: 'none', boxSizing: 'border-box', marginBottom: 0 }
  const fTa  = { ...fInp, resize: 'vertical' }
  const fSel = { ...fInp }
  const fLbl = { fontSize: 10, color: '#64748b', letterSpacing: 0.8, display: 'block', marginBottom: 5, textTransform: 'uppercase' }
  const fFld = { marginBottom: 14 }

  if (!node) return (
    <div style={{ padding: 32, textAlign: 'center', color: '#334155' }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>🖱️</div>
      <div style={{ fontSize: 12, lineHeight: 1.6 }}>Clique em um nó para<br />editar as propriedades</div>
    </div>
  )
  const t = FLOW_NODE_TYPES[node.type]
  const upd = patch => onChange({ ...node, data: { ...(node.data || {}), ...patch } })
  return (
    <div style={{ padding: 14, overflowY: 'auto', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #1e2d4a' }}>
        <span style={{ fontSize: 18 }}>{t.icon}</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.color, letterSpacing: 0.5 }}>{t.label.toUpperCase()}</div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{t.desc}</div>
        </div>
      </div>
      {(node.type === 'start' || node.type === 'message' || node.type === 'end') && (
        <div style={fFld}><label style={fLbl}>Mensagem</label>
          <textarea value={node.data?.text || ''} onChange={e => upd({ text: e.target.value })} rows={4} placeholder="Digite a mensagem..." style={fTa} />
        </div>
      )}
      {node.type === 'question' && <>
        <div style={fFld}><label style={fLbl}>Pergunta ao cliente</label>
          <textarea value={node.data?.text || ''} onChange={e => upd({ text: e.target.value })} rows={3} placeholder="Ex: Qual seu nome?" style={fTa} />
        </div>
        <div style={fFld}><label style={fLbl}>Salvar resposta na variável</label>
          <input value={node.data?.variable || ''} onChange={e => upd({ variable: e.target.value })} placeholder="Ex: nome_cliente" style={fInp} />
          <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>Use {'{{nome_cliente}}'} em mensagens futuras</div>
        </div>
      </>}
      {node.type === 'condition' && <>
        <div style={fFld}><label style={fLbl}>Variável a analisar</label>
          <input value={node.data?.variable || ''} onChange={e => upd({ variable: e.target.value })} placeholder="Ex: opcao" style={fInp} />
        </div>
        <div style={fFld}><label style={fLbl}>Ramificações</label>
          {(node.data?.branches || []).map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <input value={b.keyword || ''} placeholder={`Palavra-chave ${i + 1}`}
                onChange={e => { const brs = [...(node.data?.branches || [])]; brs[i] = { ...brs[i], keyword: e.target.value }; upd({ branches: brs }) }}
                style={{ ...fInp, flex: 1 }} />
              <button onClick={() => { const brs = [...(node.data?.branches || [])]; brs.splice(i, 1); upd({ branches: brs }) }}
                style={{ padding: '5px 8px', borderRadius: 6, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', color: '#ef4444', fontFamily: 'DM Mono,monospace', fontSize: 11, cursor: 'pointer' }}>✕</button>
            </div>
          ))}
          <button onClick={() => upd({ branches: [...(node.data?.branches || []), { keyword: '' }] })}
            style={{ width: '100%', padding: '7px', borderRadius: 7, background: 'rgba(0,212,255,.08)', border: '1px solid rgba(0,212,255,.2)', color: '#00d4ff', fontFamily: 'DM Mono,monospace', fontSize: 11, cursor: 'pointer', marginTop: 2 }}>
            + Ramificação
          </button>
        </div>
      </>}
      {node.type === 'action' && <>
        <div style={fFld}><label style={fLbl}>Tipo de ação</label>
          <select value={node.data?.actionType || 'transfer'} onChange={e => upd({ actionType: e.target.value })} style={fSel}>
            <option value="transfer">Transferir para humano</option>
            <option value="webhook">Chamar URL (webhook)</option>
            <option value="tag">Adicionar tag ao contato</option>
            <option value="close">Fechar conversa</option>
          </select>
        </div>
        {node.data?.actionType === 'transfer' && (
          <div style={fFld}><label style={fLbl}>Mensagem antes de transferir</label>
            <textarea value={node.data?.text || ''} onChange={e => upd({ text: e.target.value })} rows={2} placeholder="Aguarde, vou conectar você..." style={fTa} />
          </div>
        )}
        {node.data?.actionType === 'webhook' && (
          <div style={fFld}><label style={fLbl}>URL do Webhook (POST)</label>
            <input value={node.data?.webhookUrl || ''} onChange={e => upd({ webhookUrl: e.target.value })} placeholder="https://..." style={fInp} />
          </div>
        )}
        {node.data?.actionType === 'tag' && (
          <div style={fFld}><label style={fLbl}>Tag a adicionar</label>
            <input value={node.data?.tag || ''} onChange={e => upd({ tag: e.target.value })} placeholder="Ex: lead_quente" style={fInp} />
          </div>
        )}
      </>}
      <button onClick={() => onDelete(node.id)}
        style={{ width: '100%', padding: '9px', marginTop: 20, borderRadius: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', color: '#ef4444', fontFamily: 'DM Mono,monospace', fontSize: 12, cursor: 'pointer' }}>
        🗑 Excluir este nó
      </button>
    </div>
  )
}

function TabChatbotFlow({ empresaId, cfg }) {
  const [flows, setFlows]               = useState([])
  const [botAtivo, setBotAtivo]         = useState(false)
  const [activeFlowId, setActiveFlowId] = useState(null)
  const [loadingFlows, setLoadingFlows] = useState(true)
  const [savingFlow, setSavingFlow]     = useState(false)
  const [flowView, setFlowView]         = useState('list')
  const [editFlow, setEditFlow]         = useState(null)
  const [flowToast, setFlowToast]       = useState(null)
  const svgRef    = useRef(null)
  const dragging  = useRef(null)
  const isPanning = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })
  const [nodes, setNodes]               = useState([])
  const [conns, setConns]               = useState([])
  const [selectedId, setSelectedId]     = useState(null)
  const [selectedConnId, setSelectedConnId] = useState(null)
  const [connecting, setConnecting]     = useState(null)
  const [pan, setPan]                   = useState({ x: 40, y: 30 })
  const [scale, setScale]               = useState(0.85)
  const [flowName, setFlowName]         = useState('')

  useEffect(() => { if (empresaId) loadFlowData() }, [empresaId])

  async function loadFlowData() {
    setLoadingFlows(true)
    const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `chatbot_flows:${empresaId}`).maybeSingle()
    if (row?.value) {
      const d = JSON.parse(row.value)
      setFlows(d.flows || [])
      setBotAtivo(d.botAtivo || false)
      setActiveFlowId(d.activeFlowId || null)
    }
    setLoadingFlows(false)
  }

  async function persistFlows(nf, nb, na) {
    await supabase.from('vx_storage').upsert({
      key: `chatbot_flows:${empresaId}`,
      value: JSON.stringify({ flows: nf ?? flows, botAtivo: nb ?? botAtivo, activeFlowId: na ?? activeFlowId }),
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' })
  }

  function showFlowToast(msg, type = 'ok') { setFlowToast({ msg, type }); setTimeout(() => setFlowToast(null), 3000) }

  function criarFluxo() {
    const df = makeDefaultFlow()
    const f = { id: flowGenId(), name: 'Novo Fluxo', active: false, createdAt: new Date().toISOString(), ...df }
    openFlowEditor(f)
  }

  function openFlowEditor(f) {
    setEditFlow(f); setFlowName(f.name); setNodes(f.nodes || []); setConns(f.connections || [])
    setSelectedId(null); setSelectedConnId(null); setPan({ x: 40, y: 30 }); setScale(0.85); setFlowView('editor')
  }

  async function salvarFluxo() {
    setSavingFlow(true)
    const updated = { ...editFlow, name: flowName, nodes, connections: conns, updatedAt: new Date().toISOString() }
    const nf = flows.find(f => f.id === updated.id) ? flows.map(f => f.id === updated.id ? updated : f) : [...flows, updated]
    setFlows(nf); await persistFlows(nf); setSavingFlow(false); showFlowToast('✅ Fluxo salvo!')
  }

  async function excluirFluxo(id) {
    if (!confirm('Excluir este fluxo?')) return
    const nf = flows.filter(f => f.id !== id); setFlows(nf)
    const na = activeFlowId === id ? null : activeFlowId; setActiveFlowId(na)
    await persistFlows(nf, botAtivo, na); showFlowToast('🗑 Fluxo excluído')
  }

  async function ativarFluxo(id) {
    const nf = flows.map(f => ({ ...f, active: f.id === id })); setFlows(nf); setActiveFlowId(id)
    await persistFlows(nf, botAtivo, id); showFlowToast('✅ Fluxo ativado!')
  }

  async function toggleBot() {
    const nb = !botAtivo; setBotAtivo(nb); await persistFlows(flows, nb, activeFlowId)
    showFlowToast(nb ? '✅ Chatbot ativado!' : '⏸ Chatbot pausado')
  }

  function startDrag(e, nodeId) {
    if (!svgRef.current) return
    const r = svgRef.current.getBoundingClientRect()
    const mx = (e.clientX - r.left - pan.x) / scale, my = (e.clientY - r.top - pan.y) / scale
    const n = nodes.find(x => x.id === nodeId)
    dragging.current = { nodeId, ox: mx - n.x, oy: my - n.y }; setSelectedId(nodeId); setSelectedConnId(null)
  }

  function onSvgMove(e) {
    if (!svgRef.current) return
    const r = svgRef.current.getBoundingClientRect()
    const mx = (e.clientX - r.left - pan.x) / scale, my = (e.clientY - r.top - pan.y) / scale
    if (dragging.current) {
      setNodes(ns => ns.map(n => n.id === dragging.current.nodeId ? { ...n, x: snapV(mx - dragging.current.ox), y: snapV(my - dragging.current.oy) } : n))
      return
    }
    if (isPanning.current) {
      setPan(p => ({ x: p.x + e.clientX - lastMouse.current.x, y: p.y + e.clientY - lastMouse.current.y }))
      lastMouse.current = { x: e.clientX, y: e.clientY }; return
    }
    if (connecting) setConnecting(c => ({ ...c, mx, my }))
  }

  function onSvgUp() { dragging.current = null; isPanning.current = false; if (connecting) setConnecting(null) }

  function onSvgDown(e) {
    if (e.altKey || e.button === 1) { isPanning.current = true; lastMouse.current = { x: e.clientX, y: e.clientY }; return }
    setSelectedId(null); setSelectedConnId(null)
  }

  function onWheel(e) { e.preventDefault(); setScale(s => Math.min(2, Math.max(0.25, s * (e.deltaY > 0 ? 0.9 : 1.11)))) }

  function startConnect(e, fromId, port, portX, portY) {
    const r = svgRef.current.getBoundingClientRect()
    const fromNode = nodes.find(n => n.id === fromId)
    setConnecting({ fromId, port, fx: fromNode.x + portX, fy: fromNode.y + portY, mx: (e.clientX - r.left - pan.x) / scale, my: (e.clientY - r.top - pan.y) / scale })
  }

  function finishConnect(toId) {
    if (!connecting || connecting.fromId === toId) { setConnecting(null); return }
    if (!conns.find(c => c.fromId === connecting.fromId && c.toId === toId && c.port === connecting.port))
      setConns(cs => [...cs, { id: flowGenId(), fromId: connecting.fromId, toId, port: connecting.port }])
    setConnecting(null)
  }

  function addNode(type) {
    const n = { id: flowGenId(), type, x: snapV((-pan.x + 300) / scale), y: snapV((-pan.y + 200) / scale), data: {} }
    setNodes(ns => [...ns, n]); setSelectedId(n.id)
  }

  function deleteNode(id) { setNodes(ns => ns.filter(n => n.id !== id)); setConns(cs => cs.filter(c => c.fromId !== id && c.toId !== id)); setSelectedId(null) }
  function updateNode(updated) { setNodes(ns => ns.map(n => n.id === updated.id ? updated : n)) }

  const selectedNode = nodes.find(n => n.id === selectedId) || null
  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''

  if (flowView === 'list') return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', fontFamily: 'Syne,sans-serif' }}>🤖 Fluxos de Chatbot</div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>Crie fluxos visuais de atendimento automático via WhatsApp</div>
        </div>
        <div onClick={toggleBot} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 10, cursor: 'pointer', background: botAtivo ? 'rgba(16,185,129,.12)' : 'rgba(100,116,139,.08)', border: `1px solid ${botAtivo ? 'rgba(16,185,129,.35)' : 'rgba(100,116,139,.25)'}`, color: botAtivo ? '#10b981' : '#64748b', fontSize: 12, fontWeight: 600 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: botAtivo ? '#10b981' : '#475569', boxShadow: botAtivo ? '0 0 8px #10b981' : 'none' }} />
          {botAtivo ? 'Bot Ativo' : 'Bot Pausado'}
        </div>
        <button onClick={criarFluxo} style={{ padding: '9px 18px', borderRadius: 10, background: 'linear-gradient(135deg,#00d4ff,#0099bb)', border: 'none', color: '#fff', fontFamily: 'DM Mono,monospace', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ Novo Fluxo</button>
      </div>

      {loadingFlows ? <div style={{ textAlign: 'center', padding: 60, color: '#475569', fontSize: 13 }}>Carregando...</div>
      : flows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#0f172a', borderRadius: 14, border: '1px dashed #1e2d4a' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🌊</div>
          <div style={{ fontSize: 14, color: '#e2e8f0', marginBottom: 6 }}>Nenhum fluxo criado</div>
          <div style={{ fontSize: 12, color: '#475569', marginBottom: 20 }}>Crie seu primeiro fluxo de atendimento automático</div>
          <button onClick={criarFluxo} style={{ padding: '10px 22px', borderRadius: 10, background: 'linear-gradient(135deg,#00d4ff,#0099bb)', border: 'none', color: '#fff', fontFamily: 'DM Mono,monospace', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ Criar Primeiro Fluxo</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {flows.map(f => (
            <div key={f.id} style={{ background: '#0f172a', border: `1px solid ${f.active ? 'rgba(16,185,129,.35)' : '#1e2d4a'}`, borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{f.name}</span>
                  {f.active && <span style={{ fontSize: 9, background: 'rgba(16,185,129,.15)', color: '#10b981', border: '1px solid rgba(16,185,129,.3)', borderRadius: 20, padding: '2px 7px', letterSpacing: 0.5 }}>ATIVO</span>}
                </div>
                <div style={{ fontSize: 11, color: '#475569' }}>{f.nodes?.length || 0} nós · {f.connections?.length || 0} conexões{f.updatedAt ? ` · ${new Date(f.updatedAt).toLocaleDateString('pt-BR')}` : ''}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {!f.active && <button onClick={() => ativarFluxo(f.id)} style={{ padding: '7px 13px', borderRadius: 8, background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.25)', color: '#10b981', fontFamily: 'DM Mono,monospace', fontSize: 11, cursor: 'pointer' }}>▶ Ativar</button>}
                <button onClick={() => openFlowEditor(f)} style={{ padding: '7px 13px', borderRadius: 8, background: 'rgba(0,212,255,.08)', border: '1px solid rgba(0,212,255,.25)', color: '#00d4ff', fontFamily: 'DM Mono,monospace', fontSize: 11, cursor: 'pointer' }}>✏ Editar</button>
                <button onClick={() => excluirFluxo(f.id)} style={{ padding: '7px 11px', borderRadius: 8, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', color: '#ef4444', fontFamily: 'DM Mono,monospace', fontSize: 11, cursor: 'pointer' }}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 24, padding: '16px 18px', background: '#0f172a', borderRadius: 12, border: '1px dashed #1e2d4a' }}>
        <div style={{ fontSize: 11, color: '#00d4ff', fontWeight: 700, marginBottom: 6 }}>⚡ WEBHOOK JÁ CONFIGURADO</div>
        <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.7 }}>Configure no painel da Evolution API apontando para:</div>
        <div style={{ fontSize: 11, color: '#94a3b8', background: '#080d1a', padding: '8px 12px', borderRadius: 8, fontFamily: 'monospace', marginTop: 8, wordBreak: 'break-all' }}>{appUrl}/api/wpp/webhook</div>
        <div style={{ fontSize: 10, color: '#334155', marginTop: 8 }}>Evento necessário: <strong style={{ color: '#475569' }}>messages.upsert</strong></div>
      </div>

      {flowToast && <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: flowToast.type === 'ok' ? 'rgba(16,185,129,.9)' : 'rgba(239,68,68,.9)', color: '#fff', padding: '11px 22px', borderRadius: 10, fontSize: 13, zIndex: 99999, fontFamily: 'DM Mono,monospace' }}>{flowToast.msg}</div>}
    </div>
  )

  // ── EDITOR ──────────────────────────────────────────────────────
  const tbB = { width: 26, height: 26, borderRadius: 6, background: 'rgba(255,255,255,.03)', border: '1px solid #1e2d4a', color: '#475569', cursor: 'pointer', fontFamily: 'DM Mono,monospace', fontSize: 13 }
  return (
    <div style={{ position: 'fixed', inset: 0, top: 52, zIndex: 500, background: '#080d1a', display: 'flex', flexDirection: 'column', fontFamily: 'DM Mono,monospace' }}>
      <div style={{ height: 48, background: '#0c1628', borderBottom: '1px solid #1e2d4a', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8, flexShrink: 0 }}>
        <button onClick={() => { salvarFluxo(); setFlowView('list') }} style={{ padding: '5px 10px', borderRadius: 7, background: 'none', border: '1px solid #1e2d4a', color: '#64748b', fontFamily: 'DM Mono,monospace', fontSize: 11, cursor: 'pointer' }}>← Lista</button>
        <input value={flowName} onChange={e => setFlowName(e.target.value)} style={{ width: 180, height: 30, padding: '0 9px', borderRadius: 7, background: '#0a0f1e', border: '1px solid #1e2d4a', color: '#e2e8f0', fontFamily: 'DM Mono,monospace', fontSize: 12, fontWeight: 600, outline: 'none' }} />
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: '#334155', marginRight: 4 }}>ADD:</span>
        {Object.entries(FLOW_NODE_TYPES).filter(([k]) => k !== 'start').map(([type, t]) => (
          <button key={type} onClick={() => addNode(type)} title={t.desc} style={{ padding: '4px 9px', borderRadius: 7, background: 'rgba(255,255,255,.03)', border: `1px solid ${t.color}40`, color: t.color, fontFamily: 'DM Mono,monospace', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            {t.icon} {t.label}
          </button>
        ))}
        <div style={{ width: 1, height: 20, background: '#1e2d4a', margin: '0 4px' }} />
        <button onClick={() => setScale(s => Math.min(2, s * 1.15))} style={tbB}>+</button>
        <span style={{ fontSize: 10, color: '#475569', minWidth: 32, textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale(s => Math.max(0.25, s / 1.15))} style={tbB}>−</button>
        <button onClick={() => { setPan({ x: 40, y: 30 }); setScale(0.85) }} style={tbB}>⊡</button>
        <div style={{ width: 1, height: 20, background: '#1e2d4a', margin: '0 4px' }} />
        <button onClick={salvarFluxo} disabled={savingFlow} style={{ padding: '6px 14px', borderRadius: 8, background: 'linear-gradient(135deg,#00d4ff,#0099bb)', border: 'none', color: '#fff', fontFamily: 'DM Mono,monospace', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          {savingFlow ? '⏳' : '💾 Salvar'}
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <defs>
              <pattern id="fg1" width={FLOW_SNAP * scale} height={FLOW_SNAP * scale} patternUnits="userSpaceOnUse" x={pan.x % (FLOW_SNAP * scale)} y={pan.y % (FLOW_SNAP * scale)}>
                <path d={`M${FLOW_SNAP * scale} 0 L 0 0 0 ${FLOW_SNAP * scale}`} fill="none" stroke="#1a2540" strokeWidth={0.4} />
              </pattern>
              <pattern id="fg5" width={FLOW_SNAP * 5 * scale} height={FLOW_SNAP * 5 * scale} patternUnits="userSpaceOnUse" x={pan.x % (FLOW_SNAP * 5 * scale)} y={pan.y % (FLOW_SNAP * 5 * scale)}>
                <path d={`M${FLOW_SNAP * 5 * scale} 0 L 0 0 0 ${FLOW_SNAP * 5 * scale}`} fill="none" stroke="#1e2d4a" strokeWidth={0.8} />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#fg1)" />
            <rect width="100%" height="100%" fill="url(#fg5)" opacity={0.6} />
          </svg>
          <svg ref={svgRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            onMouseMove={onSvgMove} onMouseUp={onSvgUp} onMouseDown={onSvgDown} onWheel={onWheel}>
            <defs>
              <marker id="flowarr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </marker>
            </defs>
            <g transform={`translate(${pan.x},${pan.y}) scale(${scale})`}>
              {conns.map(c => <FlowEdge key={c.id} conn={c} nodes={nodes} selected={selectedConnId === c.id} onClick={id => { setSelectedConnId(id); setSelectedId(null) }} />)}
              {connecting && (
                <path d={`M${connecting.fx},${connecting.fy} C${connecting.fx + 80},${connecting.fy} ${connecting.mx - 80},${connecting.my} ${connecting.mx},${connecting.my}`}
                  fill="none" stroke="#00d4ff" strokeWidth={1.5} strokeDasharray="6 3" strokeOpacity={0.7} />
              )}
              {nodes.map(n => <FlowNode key={n.id} node={n} selected={selectedId === n.id} connecting={connecting} onMouseDown={startDrag} onPortDown={startConnect} onPortUp={finishConnect} />)}
            </g>
          </svg>
          <div style={{ position: 'absolute', bottom: 12, left: 14, fontSize: 10, color: '#1e3a5f', pointerEvents: 'none' }}>
            Alt+arrastar = mover canvas · Scroll = zoom · Arraste as boletas coloridas para conectar · Clique numa seta para excluir
          </div>
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
        <div style={{ width: 260, background: '#0c1628', borderLeft: '1px solid #1e2d4a', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e2d4a', fontSize: 10, color: '#334155', letterSpacing: 0.8 }}>PROPRIEDADES DO NÓ</div>
          <FlowPropsPanel node={selectedNode} onChange={updateNode} onDelete={deleteNode} />
        </div>
      </div>
      {flowToast && <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: flowToast.type === 'ok' ? 'rgba(16,185,129,.9)' : 'rgba(239,68,68,.9)', color: '#fff', padding: '11px 22px', borderRadius: 10, fontSize: 13, zIndex: 99999, fontFamily: 'DM Mono,monospace' }}>{flowToast.msg}</div>}
    </div>
  )
}

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
  { id: 'abordagem',    label: '👋 Abordagem Inicial' },
  { id: 'apresentacao', label: '💼 Apresentação do Produto' },
  { id: 'objecao',      label: '🛡️ Contorno de Objeções' },
  { id: 'followup',     label: '🔄 Follow-up' },
  { id: 'fechamento',   label: '🔥 Fechamento' },
  { id: 'reativacao',   label: '♻️ Reativação de Clientes' },
]

// Helper centralizado de IA — usa OpenAI, Gemini ou Groq com fallback automático
async function callAI(prompt, cfg, { temperature = 0.7, maxTokens = 2000, systemPrompt = null, history = null } = {}) {
  const openaiKey = cfg.openaiApiKey || cfg.openaiKey || ''
  const geminiKey = cfg.geminiApiKey || cfg.geminiKey || ''
  const groqKey   = cfg.groqApiKey   || cfg.groqKey   || ''

  if (!openaiKey && !geminiKey && !groqKey) {
    throw new Error('Nenhuma chave de IA configurada. Acesse Configurações → Empresa → 🤖 IA.')
  }

  const messages = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...(history || []), { role: 'user', content: prompt }]
    : [...(history || []), { role: 'user', content: prompt }]

  // 1. OpenAI
  if (openaiKey) {
    try {
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

  // 2. Gemini
  if (geminiKey && geminiKey.startsWith('AIza')) {
    try {
      const contents = systemPrompt
        ? [{ role: 'user', parts: [{ text: `SISTEMA: ${systemPrompt}` }] }, { role: 'model', parts: [{ text: 'Entendido.' }] },
           ...(history || []).map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] })),
           { role: 'user', parts: [{ text: prompt }] }]
        : [{ parts: [{ text: prompt }] }]
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${geminiKey}`
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents }) })
      const data = await res.json()
      const r = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (r) return r
    } catch {}
  }

  // 3. Groq
  if (groqKey) {
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

export default function Prospeccao() {
  const router = useRouter()
  const { aba: abaQuery } = router.query
  const [aba, setAba]           = useState('disparo')
  const [loading, setLoading]   = useState(true)
  const [cfg, setCfg]           = useState({})
  const [empresaId, setEmpresaId] = useState(null)
  const [saving, setSaving]     = useState(false)
  const [perfil, setPerfil]     = useState(null)

  // Disparo em Massa
  const [contatos, setContatos]         = useState([])
  const [selecionados, setSelecionados] = useState([])
  const [mensagemDisparo, setMensagemDisparo] = useState('')
  const [disparando, setDisparando]     = useState(false)
  const [progresso, setProgresso]       = useState(0)
  const [novoContato, setNovoContato]   = useState({ nome: '', telefone: '', email: '' })
  const [showAddContato, setShowAddContato] = useState(false)
  // Disparo avançado
  const [mensagensVariadas, setMensagensVariadas] = useState([''])
  const [tipoMidia, setTipoMidia]       = useState('text')
  const [mediaUrl, setMediaUrl]         = useState('')
  const [mediaCaption, setMediaCaption] = useState('')
  const [delayMin, setDelayMin]         = useState(8)
  const [delayMax, setDelayMax]         = useState(20)
  const [loteSize, setLoteSize]         = useState(20)
  const [lotePausa, setLotePausa]       = useState(60)
  const [resultadoCampanha, setResultadoCampanha] = useState(null)
  const [erroDisparo, setErroDisparo]   = useState('')
  const [modoAvancado, setModoAvancado] = useState(false)
  const [modoOficial, setModoOficial]   = useState(false) // 🆕 Modo API Oficial (Meta Cloud API)

  // Chatbot
  const [chatbotNome, setChatbotNome]               = useState('')
  const [chatbotPersonalidade, setChatbotPersonalidade] = useState('profissional')
  const [chatbotObjetivo, setChatbotObjetivo]       = useState('vendas')
  const [chatbotPrompt, setChatbotPrompt]           = useState('')
  const [gerandoChatbot, setGerandoChatbot]         = useState(false)
  const [chatbotConfig, setChatbotConfig]           = useState(null)

  // Agente IA
  const [agenteMessages, setAgenteMessages] = useState([])
  const [agenteInput, setAgenteInput]       = useState('')
  const [agenteThinking, setAgenteThinking] = useState(false)
  const [providerAgente, setProviderAgente] = useState('gemini')
  const chatEndRef  = useRef(null)
  const fileImportRef = useRef(null)

  // Script Comercial
  const [tipoScript, setTipoScript]       = useState('abordagem')
  const [nichoScript, setNichoScript]     = useState('')
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
      setPerfil(perf)
      const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${eid}`).single()
      if (row?.value) {
        const c = JSON.parse(row.value)
        setCfg(c)
        setContatos(c.contatos || [])
        setChatbotConfig(c.chatbotConfig || null)
        setChatbotNome(c.chatbotConfig?.nome || c.company || '')
        setNichoScript(c.nicho || '')
        setProdutoScript(c.company || '')
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
  function parseCSVImport(text) {
    const lines = text.trim().split('\n').filter(l => l.trim())
    if (!lines.length) return []
    const sep = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ','
    const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/[^a-z]/g,''))
    const hasHeader = headers.some(h => ['numero','telefone','phone','tel','nome','name'].includes(h))
    if (!hasHeader) {
      return lines.map((l, idx) => {
        const num = l.split(sep)[0].replace(/\D/g,'').trim()
        return num.length >= 10 ? { id: String(Date.now()+idx), nome:'', telefone: num, email:'' } : null
      }).filter(Boolean)
    }
    return lines.slice(1).map((line, idx) => {
      const cols = line.split(sep).map(c => c.trim().replace(/^"|"$/g,''))
      const obj = {}
      headers.forEach((h,i) => { obj[h] = cols[i] || '' })
      const num = (obj.numero||obj.telefone||obj.phone||obj.tel||'').replace(/\D/g,'')
      return num.length >= 10 ? { id: String(Date.now()+idx), nome: obj.nome||obj.name||obj.cliente||'', telefone: num, email: obj.email||'', empresa: obj.empresa||'', cidade: obj.cidade||'' } : null
    }).filter(Boolean)
  }

  function onImportCSV(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = parseCSVImport(ev.target.result)
        if (!parsed.length) { toast('Nenhum número válido encontrado', 'err'); return }
        setContatos(prev => {
          const nums = new Set(prev.map(c => c.telefone))
          const novos = parsed.filter(c => !nums.has(c.telefone))
          toast(`✅ ${novos.length} contato(s) importado(s)`)
          return [...prev, ...novos]
        })
      } catch { toast('Erro ao ler arquivo', 'err') }
    }
    reader.readAsText(file, 'UTF-8')
    e.target.value = ''
  }

  function baixarModeloCSV() {
    const csv = 'telefone;nome;empresa;cidade\n5531999999999;João Silva;Empresa ABC;Belo Horizonte\n5511988888888;Maria Souza;XYZ;São Paulo'
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv],{type:'text/csv'})), download: 'modelo_contatos.csv' })
    a.click()
  }

  async function adicionarContato() {
    if (!novoContato.nome || (!novoContato.telefone && !novoContato.email)) {
      toast('Informe nome e telefone ou e-mail', 'err'); return
    }
    const novo = { ...novoContato, id: String(Date.now()), telefone: novoContato.telefone.replace(/\D/g,'') }
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

  // Modo simples — abre wa.me
  async function dispararMensagens() {
    const alvos = selecionados.length > 0 ? contatos.filter(c => selecionados.includes(c.id)) : contatos
    if (!alvos.length) { toast('Selecione ou adicione contatos', 'err'); return }
    if (!mensagemDisparo) { toast('Digite a mensagem', 'err'); return }
    setDisparando(true); setProgresso(0)
    for (let i = 0; i < alvos.length; i++) {
      const c = alvos[i]
      const msg = mensagemDisparo
        .replace(/\{nome\}/gi, c.nome||'')
        .replace(/\{empresa\}/gi, c.empresa||'')
        .replace(/\{cidade\}/gi, c.cidade||'')
      if (c.telefone) window.open(`https://wa.me/55${c.telefone}?text=${encodeURIComponent(msg)}`,'_blank')
      setProgresso(Math.round(((i+1)/alvos.length)*100))
      if (i < alvos.length-1) await new Promise(r => setTimeout(r,2000))
    }
    setDisparando(false)
    toast(`✅ ${alvos.length} mensagem(ns) disparada(s)!`)
  }

  // Modo avançado — API com delays inteligentes
  async function dispararAvancado() {
    const msgsValidas = mensagensVariadas.filter(m => m.trim())
    const alvos = selecionados.length > 0 ? contatos.filter(c => selecionados.includes(c.id)) : contatos
    setErroDisparo('')
    if (!alvos.length)   { setErroDisparo('Adicione ao menos um contato'); return }
    if (!msgsValidas.length) { setErroDisparo('Adicione ao menos uma mensagem'); return }
    if (tipoMidia !== 'text' && !mediaUrl.trim()) { setErroDisparo('Informe a URL da mídia'); return }
    if (delayMin >= delayMax) { setErroDisparo('Delay mínimo deve ser menor que o máximo'); return }

    setDisparando(true); setResultadoCampanha(null); setProgresso(0)
    const iv = setInterval(() => setProgresso(p => Math.min(p+1, 92)), ((delayMin+delayMax)/2)*1000/100)

    try {
      const res = await fetch('/api/wpp/disparo-massa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId,
          contatos: alvos.map(c => ({
            numero:  c.telefone,
            nome:    c.nome    || '',
            empresa: c.empresa || '',
            cidade:  c.cidade  || '',
          })),
          mensagens:   msgsValidas,
          tipo:        tipoMidia,
          mediaUrl:    tipoMidia !== 'text' ? mediaUrl    : undefined,
          mediaCaption: tipoMidia !== 'text' ? mediaCaption : undefined,
          delayMinMs:  delayMin  * 1000,
          delayMaxMs:  delayMax  * 1000,
          loteSize,
          lotePausaMs: lotePausa * 1000,
        }),
      })
      const data = await res.json()
      clearInterval(iv); setProgresso(100)
      if (res.ok) {
        setResultadoCampanha(data)
        toast(`✅ ${data.enviados} enviados, ${data.erros} erros`)
      } else {
        setErroDisparo(data.error || 'Erro no disparo')
      }
    } catch (e) {
      clearInterval(iv)
      setErroDisparo('Erro: ' + e.message)
    } finally {
      setDisparando(false)
    }
  }

  // ── Modo API Oficial (Meta WhatsApp Cloud API) ──────────────
  async function dispararOficial() {
    const wpp = cfg.wpp || {}
    if (!wpp.ativo)   { setErroDisparo('API Oficial inativa. Ative em Configurações → Integrações.'); return }
    if (!wpp.token)   { setErroDisparo('Token não configurado. Acesse Configurações → Integrações.'); return }
    if (!wpp.phoneId) { setErroDisparo('Phone ID não configurado. Acesse Configurações → Integrações.'); return }

    const msgsValidas = mensagensVariadas.filter(m => m.trim())
    const alvos = selecionados.length > 0 ? contatos.filter(c => selecionados.includes(c.id)) : contatos
    setErroDisparo('')
    if (!alvos.length)       { setErroDisparo('Adicione ao menos um contato'); return }
    if (!msgsValidas.length) { setErroDisparo('Adicione ao menos uma mensagem'); return }

    setDisparando(true); setResultadoCampanha(null); setProgresso(0)
    const resultados = []
    const total = alvos.length

    for (let i = 0; i < total; i++) {
      const c = alvos[i]
      const msgBase = msgsValidas[Math.floor(Math.random() * msgsValidas.length)]
      const texto = msgBase
        .replace(/\{nome\}/gi,    c.nome    || 'Cliente')
        .replace(/\{empresa\}/gi, c.empresa || '')
        .replace(/\{cidade\}/gi,  c.cidade  || '')
      try {
        const r = await fetch('/api/whatsapp', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action:'enviar', phoneId:wpp.phoneId, token:wpp.token, para:c.telefone, texto }),
        })
        const data = await r.json()
        resultados.push({ numero:c.telefone, nome:c.nome||'', status:r.ok?'enviado':'erro', motivo:r.ok?'':data.error||'falhou', at:new Date().toISOString() })
      } catch(e) {
        resultados.push({ numero:c.telefone, nome:c.nome||'', status:'erro', motivo:e.message, at:new Date().toISOString() })
      }
      setProgresso(Math.round(((i+1)/total)*100))
      if (i < total-1) {
        const delay = (delayMin + Math.random()*(delayMax-delayMin))*1000
        await new Promise(r=>setTimeout(r,delay))
        if ((i+1)%loteSize===0) await new Promise(r=>setTimeout(r,lotePausa*1000))
      }
    }
    const enviados = resultados.filter(r=>r.status==='enviado').length
    const erros    = resultados.filter(r=>r.status==='erro').length
    setResultadoCampanha({ campanhaId:`OFC-${Date.now()}`, enviados, erros, total, resultados })
    toast(`✅ ${enviados} enviados via API Oficial, ${erros} erros`)
    setDisparando(false)
  }

  function exportarRelatorioCSV(campanha) {
    const rows = [
      'numero,nome,status,motivo,horario',
      ...(campanha.resultados || []).map(r =>
        `${r.numero},"${r.nome || ''}",${r.status},"${r.motivo || ''}",${r.at || ''}`
      )
    ]
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' })),
      download: `campanha_${campanha.campanhaId}.csv`
    })
    a.click()
  }

  function estimarTempoDisparo() {
    const total = selecionados.length || contatos.length
    if (!total) return ''
    const secs = total*(delayMin+delayMax)/2 + Math.ceil(total/loteSize)*lotePausa
    if (secs < 60)   return `~${Math.round(secs)}s`
    if (secs < 3600) return `~${Math.round(secs/60)}min`
    return `~${(secs/3600).toFixed(1)}h`
  }

  // ── Chatbot Config ───────────────────────────────────────────
  async function gerarConfigChatbot() {
    const openaiKey = cfg.openaiApiKey || cfg.openaiKey || ''
    const geminiKey = cfg.geminiApiKey || cfg.geminiKey || ''
    const groqKey   = cfg.groqApiKey   || cfg.groqKey   || ''
    if (!openaiKey && !geminiKey && !groqKey) { toast('Configure a chave de IA em Configurações → Empresa', 'err'); return }
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
      const resultado = await callAI(prompt, cfg, { temperature: 0.7 })
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

    const openaiKey = cfg.openaiApiKey || cfg.openaiKey || ''
    const geminiKey = cfg.geminiApiKey || cfg.geminiKey || ''
    const groqKey   = cfg.groqApiKey   || cfg.groqKey   || ''

    if (!openaiKey && !geminiKey && !groqKey) {
      setAgenteThinking(false)
      setAgenteMessages(prev => [...prev, { role: 'bot', content: '⚠️ Configure a chave de IA em Configurações → Empresa para ativar o Agente IA.' }])
      return
    }

    const sysPr = chatbotConfig?.prompt || `Você é um assistente comercial da empresa ${cfg.company || 'Vivanexa'}. Seja prestativo, profissional e focado em ajudar o cliente.`
    const hist  = agenteMessages.slice(-10).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))

    try {
      const resposta = await callAI(userMsg, cfg, { temperature: 0.7, systemPrompt: sysPr, history: hist })
      setAgenteMessages(prev => [...prev, { role: 'bot', content: resposta || 'Sem resposta. Verifique as chaves de API.' }])
    } catch (e) {
      setAgenteMessages(prev => [...prev, { role: 'bot', content: 'Erro ao conectar com a IA: ' + e.message }])
    }
    setAgenteThinking(false)
  }

  // ── Script Comercial ─────────────────────────────────────────
  async function gerarScriptComercial() {
    const openaiKey = cfg.openaiApiKey || cfg.openaiKey || ''
    const geminiKey = cfg.geminiApiKey || cfg.geminiKey || ''
    const groqKey   = cfg.groqApiKey   || cfg.groqKey   || ''
    if (!openaiKey && !geminiKey && !groqKey) { toast('Configure a chave de IA em Configurações → Empresa', 'err'); return }
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
      const resultado = await callAI(prompt, cfg, { temperature: 0.7 })
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
          <button className={`tab-btn ${aba === 'disparo' ? 'active' : ''}`}  onClick={() => setAba('disparo')}>💬 Disparo em Massa</button>
          <button className={`tab-btn ${aba === 'chatbot' ? 'active' : ''}`}  onClick={() => setAba('chatbot')}>🤖 Chatbot</button>
          <button className={`tab-btn ${aba === 'agente'  ? 'active' : ''}`}  onClick={() => setAba('agente')}>🧠 Agente IA</button>
          <button className={`tab-btn ${aba === 'script'  ? 'active' : ''}`}  onClick={() => setAba('script')}>📋 Script/Playbook</button>
        </div>

        {/* ── ABA DISPARO ── */}
        {aba === 'disparo' && (
          <div>
            <div className="info-box info-blue">
              💬 <strong>Modo Simples</strong>: abre wa.me para cada contato (sem API). <strong>Modo Avançado</strong>: disparo via Evolution API com delays anti-banimento. <strong>API Oficial</strong>: usa sua integração Meta (WhatsApp Cloud API) configurada em Integrações.
            </div>

            {/* Toggle modo */}
            <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
              <button className={`btn ${!modoAvancado && !modoOficial ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize:11 }}
                onClick={() => { setModoAvancado(false); setModoOficial(false) }}>
                💬 Modo Simples (wa.me)
              </button>
              <button className={`btn ${modoAvancado && !modoOficial ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize:11 }}
                onClick={() => { setModoAvancado(true); setModoOficial(false) }}>
                🚀 Modo Avançado (API + Anti-Banimento)
              </button>
              <button className={`btn ${modoOficial ? 'btn-green' : 'btn-secondary'}`} style={{ fontSize:11 }}
                onClick={() => { setModoOficial(true); setModoAvancado(false) }}>
                📱 API Oficial (Meta)
                {cfg.wpp?.ativo
                  ? <span style={{ marginLeft:6, padding:'1px 6px', borderRadius:10, background:'rgba(16,185,129,.25)', color:'#10b981', fontSize:9, fontWeight:700 }}>● ATIVO</span>
                  : <span style={{ marginLeft:6, padding:'1px 6px', borderRadius:10, background:'rgba(239,68,68,.2)', color:'#ef4444', fontSize:9 }}>○ Inativo</span>
                }
              </button>
            </div>

            {erroDisparo && (
              <div style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.3)', borderRadius:8, padding:'10px 14px', marginBottom:12, color:'#fca5a5', fontSize:13 }}>
                ⚠️ {erroDisparo}
              </div>
            )}

            <div className="grid2">
              {/* ── COLUNA MENSAGEM ── */}
              <div className="card">
                <div className="card-title">📝 Mensagem</div>

                {!modoAvancado && !modoOficial ? (
                  <div className="field">
                    <label>Mensagem (use {'{nome}'}, {'{empresa}'} para personalizar)</label>
                    <textarea value={mensagemDisparo} onChange={e => setMensagemDisparo(e.target.value)}
                      placeholder={'Olá {nome}! Tudo bem?\n\nSou da ' + (cfg.company||'Vivanexa') + ' e gostaria de apresentar nossa solução...'}
                      style={{ minHeight:120 }} />
                  </div>
                ) : (
                  <div>
                    {modoOficial && (
                      <div style={{ background:'rgba(16,185,129,.06)', border:'1px solid rgba(16,185,129,.2)', borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:12, color:'#10b981' }}>
                        📱 <strong>API Oficial Meta</strong> — Número: <code style={{ color:'#00d4ff', background:'rgba(0,212,255,.1)', padding:'1px 6px', borderRadius:4 }}>{cfg.wpp?.numero || cfg.wpp?.phoneId || 'configurado'}</code>
                      </div>
                    )}
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                      <span style={{ fontSize:11, color:'#64748b' }}>Até 10 variações — escolha aleatória por contato (anti-spam)</span>
                      <button className="btn btn-secondary" style={{ fontSize:10, padding:'3px 10px' }}
                        onClick={() => mensagensVariadas.length < 10 && setMensagensVariadas(p => [...p,''])}>
                        + Variação
                      </button>
                    </div>
                    <div style={{ background:'rgba(0,212,255,.05)', border:'1px solid rgba(0,212,255,.15)', borderRadius:6, padding:'6px 10px', fontSize:11, color:'#64748b', marginBottom:10 }}>
                      Variáveis: <code style={{color:'#00d4ff'}}>{'{nome}'}</code> <code style={{color:'#00d4ff'}}>{'{empresa}'}</code> <code style={{color:'#00d4ff'}}>{'{cidade}'}</code>
                    </div>
                    {mensagensVariadas.map((msg, i) => (
                      <div key={i} style={{ display:'flex', gap:6, marginBottom:8, alignItems:'flex-start' }}>
                        <span style={{ background:'#1a2540', color:'#64748b', borderRadius:4, padding:'2px 7px', fontSize:11, marginTop:10, flexShrink:0 }}>{i+1}</span>
                        <textarea
                          style={{ flex:1, background:'#1a2540', border:'1px solid #1e2d4a', borderRadius:8, padding:'9px 12px', fontFamily:'DM Mono,monospace', fontSize:13, color:'#e2e8f0', outline:'none', resize:'vertical', minHeight:72, margin:0 }}
                          placeholder={`Mensagem ${i+1}... Use {nome}, {empresa}, {cidade}`}
                          value={msg}
                          onChange={e => setMensagensVariadas(p => p.map((m,j) => j===i ? e.target.value : m))} />
                        {mensagensVariadas.length > 1 && (
                          <button onClick={() => setMensagensVariadas(p => p.filter((_,j) => j!==i))}
                            style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', marginTop:10, padding:'2px 6px', fontSize:14 }}>✕</button>
                        )}
                      </div>
                    ))}

                    {/* Tipo mídia */}
                    <div style={{ borderTop:'1px solid #1e2d4a', paddingTop:12, marginTop:4 }}>
                      <div style={{ fontSize:11, color:'#64748b', marginBottom:8, textTransform:'uppercase', letterSpacing:'.5px' }}>Tipo de conteúdo</div>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
                        {[['text','💬 Texto'],['image','🖼️ Imagem'],['video','🎥 Vídeo'],['audio','🎵 Áudio'],['document','📄 Doc']].map(([val,label]) => (
                          <button key={val} onClick={() => setTipoMidia(val)}
                            className={`btn ${tipoMidia===val ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ fontSize:11, padding:'4px 12px' }}>{label}</button>
                        ))}
                      </div>
                      {tipoMidia !== 'text' && (
                        <div>
                          <div className="field"><label>URL da mídia *</label><input value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} placeholder="https://..." /></div>
                          {tipoMidia !== 'audio' && <div className="field"><label>Legenda (opcional)</label><input value={mediaCaption} onChange={e => setMediaCaption(e.target.value)} placeholder="Legenda..." /></div>}
                        </div>
                      )}
                    </div>

                    {/* Anti-banimento */}
                    <div style={{ borderTop:'1px solid #1e2d4a', paddingTop:12, marginTop:8 }}>
                      <div style={{ fontSize:11, color:'#10b981', marginBottom:8, display:'flex', gap:6, alignItems:'center' }}>
                        🛡️ <strong>Anti-Banimento</strong> — delays aleatórios + rotação de mensagens
                      </div>
                      <div className="grid2" style={{ gap:8 }}>
                        <div className="field"><label>Delay mínimo (seg)</label><input type="number" value={delayMin} min={3} max={120} onChange={e => setDelayMin(+e.target.value)} /></div>
                        <div className="field"><label>Delay máximo (seg)</label><input type="number" value={delayMax} min={5} max={300} onChange={e => setDelayMax(+e.target.value)} /></div>
                        <div className="field"><label>Envios por lote</label><input type="number" value={loteSize} min={5} max={100} onChange={e => setLoteSize(+e.target.value)} /></div>
                        <div className="field"><label>Pausa entre lotes (seg)</label><input type="number" value={lotePausa} min={10} max={600} onChange={e => setLotePausa(+e.target.value)} /></div>
                      </div>
                      {contatos.length > 0 && (
                        <div style={{ background:'#0a0f1e', borderRadius:6, padding:'8px 12px', fontSize:11, color:'#64748b', display:'flex', gap:16, flexWrap:'wrap' }}>
                          <span>👥 <strong style={{color:'#e2e8f0'}}>{selecionados.length||contatos.length}</strong> contatos</span>
                          <span>⏱ <strong style={{color:'#e2e8f0'}}>{estimarTempoDisparo()}</strong> estimado</span>
                          <span>📦 <strong style={{color:'#e2e8f0'}}>{Math.ceil((selecionados.length||contatos.length)/loteSize)}</strong> lotes</span>
                          <span>🔀 <strong style={{color:'#e2e8f0'}}>{mensagensVariadas.filter(m=>m.trim()).length}</strong> variações</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Botão disparar */}
                <div style={{ marginTop:14 }}>
                  {/* ── Aviso API Oficial sem config ── */}
                  {modoOficial && !cfg.wpp?.ativo && (
                    <div style={{ background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.2)', borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:12, color:'#fca5a5' }}>
                      ⚠️ A integração com WhatsApp Cloud API está inativa.{' '}
                      <button onClick={() => router.push('/configuracoes?tab=integracoes')} style={{ background:'none', border:'none', color:'#00d4ff', cursor:'pointer', fontFamily:'DM Mono,monospace', fontSize:12, textDecoration:'underline' }}>
                        Configurar agora →
                      </button>
                    </div>
                  )}
                  <button
                    className={`btn ${modoOficial ? 'btn-green' : modoAvancado ? 'btn-primary' : 'btn-wpp'}`}
                    style={{ width:'100%', justifyContent:'center', fontSize:13, padding:'11px' }}
                    onClick={modoOficial ? dispararOficial : modoAvancado ? dispararAvancado : dispararMensagens}
                    disabled={disparando || (!modoAvancado && !modoOficial && !mensagemDisparo)}>
                    {disparando
                      ? `⏳ Disparando... ${progresso}%`
                      : modoOficial
                        ? `📱 Disparar via API Oficial (${selecionados.length||contatos.length} contatos)`
                        : modoAvancado
                          ? `🚀 Disparar via API (${selecionados.length||contatos.length} contatos)`
                          : '💬 Disparar via WhatsApp'}
                  </button>
                  {disparando && (
                    <div style={{ marginTop:8 }}>
                      <div className="progress-bar"><div className="progress-fill" style={{ width:progresso+'%' }} /></div>
                      {modoAvancado && <div style={{ fontSize:11, color:'#64748b', marginTop:4, textAlign:'center' }}>Delays inteligentes — não feche a janela</div>}
                    </div>
                  )}
                </div>

                {/* ── RELATÓRIO DE ENTREGA ── */}
                {resultadoCampanha && (
                  <div style={{ marginTop:14, background:'#0a0f1e', borderRadius:10, padding:14, border:'1px solid #1e2d4a' }}>

                    {/* Cabeçalho */}
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                      <div style={{ fontSize:13, color:'#00d4ff', fontWeight:700 }}>📊 Relatório da Campanha</div>
                      <div style={{ fontSize:10, color:'#64748b' }}>{resultadoCampanha.campanhaId}</div>
                    </div>

                    {/* Totais */}
                    <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                      <div style={{ flex:1, textAlign:'center', background:'rgba(16,185,129,.1)', border:'1px solid rgba(16,185,129,.3)', borderRadius:8, padding:'10px 0' }}>
                        <div style={{ fontSize:22, fontWeight:800, color:'#10b981', fontFamily:'Syne,sans-serif' }}>{resultadoCampanha.enviados}</div>
                        <div style={{ fontSize:10, color:'#64748b', marginTop:2 }}>✅ Enviados</div>
                      </div>
                      <div style={{ flex:1, textAlign:'center', background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.3)', borderRadius:8, padding:'10px 0' }}>
                        <div style={{ fontSize:22, fontWeight:800, color:'#ef4444', fontFamily:'Syne,sans-serif' }}>{resultadoCampanha.erros}</div>
                        <div style={{ fontSize:10, color:'#64748b', marginTop:2 }}>❌ Erros</div>
                      </div>
                      <div style={{ flex:1, textAlign:'center', background:'rgba(0,212,255,.08)', border:'1px solid rgba(0,212,255,.2)', borderRadius:8, padding:'10px 0' }}>
                        <div style={{ fontSize:22, fontWeight:800, color:'#00d4ff', fontFamily:'Syne,sans-serif' }}>{resultadoCampanha.total}</div>
                        <div style={{ fontSize:10, color:'#64748b', marginTop:2 }}>📦 Total</div>
                      </div>
                    </div>

                    {/* Detalhamento por contato */}
                    <div style={{ fontSize:11, color:'#64748b', marginBottom:6, textTransform:'uppercase', letterSpacing:'.5px' }}>
                      Detalhamento por contato
                    </div>
                    <div style={{ maxHeight:220, overflowY:'auto', display:'flex', flexDirection:'column', gap:4 }}>
                      {(resultadoCampanha.resultados || []).map((r, i) => (
                        <div key={i} style={{
                          display:'flex', alignItems:'center', justifyContent:'space-between',
                          background: r.status === 'enviado' ? 'rgba(16,185,129,.06)' : 'rgba(239,68,68,.06)',
                          border: `1px solid ${r.status === 'enviado' ? 'rgba(16,185,129,.2)' : 'rgba(239,68,68,.2)'}`,
                          borderRadius:6, padding:'7px 10px', fontSize:12
                        }}>
                          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                            <span style={{ color:'#e2e8f0', fontWeight:600 }}>
                              {r.status === 'enviado' ? '✅' : '❌'} {r.nome || r.numero}
                            </span>
                            {r.nome && <span style={{ color:'#64748b', fontSize:10 }}>{r.numero}</span>}
                          </div>
                          <span style={{ color: r.status === 'enviado' ? '#10b981' : '#ef4444', fontSize:11, textAlign:'right', maxWidth:140 }}>
                            {r.status === 'enviado' ? 'Enviado' : (r.motivo || 'Erro desconhecido')}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Exportar CSV */}
                    <button
                      className="btn btn-secondary"
                      style={{ width:'100%', marginTop:10, fontSize:11, justifyContent:'center' }}
                      onClick={() => exportarRelatorioCSV(resultadoCampanha)}>
                      ⬇ Exportar relatório CSV
                    </button>
                  </div>
                )}
              </div>

              {/* ── COLUNA CONTATOS ── */}
              <div className="card">
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <div className="card-title" style={{ margin:0 }}>👥 Contatos ({contatos.length})</div>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {selecionados.length > 0 && <span className="badge badge-blue">{selecionados.length} sel.</span>}
                    <button className="btn btn-secondary" style={{ fontSize:10, padding:'4px 10px' }}
                      onClick={() => setSelecionados(selecionados.length===contatos.length ? [] : contatos.map(c=>c.id))}>
                      {selecionados.length===contatos.length ? 'Desmarcar' : 'Marcar todos'}
                    </button>
                    <button className="btn btn-secondary" style={{ fontSize:10, padding:'4px 10px' }} onClick={() => fileImportRef.current?.click()}>
                      ⬆ CSV
                    </button>
                    <button className="btn btn-secondary" style={{ fontSize:10, padding:'4px 10px' }} onClick={baixarModeloCSV}>
                      ⬇ Modelo
                    </button>
                    <button className="btn btn-primary" style={{ fontSize:10, padding:'4px 10px' }} onClick={() => setShowAddContato(true)}>+</button>
                    <input ref={fileImportRef} type="file" accept=".csv,.txt" style={{ display:'none' }} onChange={onImportCSV} />
                  </div>
                </div>

                <div style={{ fontSize:11, color:'#64748b', marginBottom:8 }}>
                  CSV aceita colunas: telefone, nome, empresa, cidade — ou lista pura de números
                </div>

                <div style={{ maxHeight:300, overflowY:'auto' }}>
                  {contatos.length === 0 ? (
                    <div style={{ textAlign:'center', color:'#64748b', padding:20, fontSize:12 }}>
                      Nenhum contato. Clique em <strong>⬆ CSV</strong> para importar ou <strong>+</strong> para adicionar.
                    </div>
                  ) : contatos.map(c => (
                    <div key={c.id} className="contact-row">
                      <input type="checkbox" className="contact-check" checked={selecionados.includes(c.id)}
                        onChange={() => setSelecionados(prev => prev.includes(c.id) ? prev.filter(x=>x!==c.id) : [...prev,c.id])} />
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, color:'#e2e8f0', fontWeight:600 }}>{c.nome||c.telefone}</div>
                        <div style={{ fontSize:11, color:'#64748b' }}>{c.telefone}{c.empresa ? ' · '+c.empresa : ''}{c.email ? ' · '+c.email : ''}</div>
                      </div>
                      <button onClick={() => removerContato(c.id)} style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:14 }}>✕</button>
                    </div>
                  ))}
                </div>

                {showAddContato && (
                  <div style={{ marginTop:12, padding:12, background:'#0a0f1e', borderRadius:10, border:'1px solid #1e2d4a' }}>
                    <div className="grid2">
                      <div className="field"><label>Nome</label><input value={novoContato.nome} onChange={e => setNovoContato(f=>({...f,nome:e.target.value}))} /></div>
                      <div className="field"><label>Telefone (com DDI)</label><input value={novoContato.telefone} onChange={e => setNovoContato(f=>({...f,telefone:e.target.value}))} placeholder="5531999999999" /></div>
                    </div>
                    <div className="field"><label>E-mail (opcional)</label><input value={novoContato.email} onChange={e => setNovoContato(f=>({...f,email:e.target.value}))} /></div>
                    <div style={{ display:'flex', gap:6 }}>
                      <button className="btn btn-primary" style={{ fontSize:11 }} onClick={adicionarContato}>Adicionar</button>
                      <button className="btn btn-secondary" style={{ fontSize:11 }} onClick={() => setShowAddContato(false)}>Cancelar</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── ABA CHATBOT ── */}
        {aba === 'chatbot' && (
          <TabChatbotFlow empresaId={empresaId} cfg={cfg} />
        )}

        {/* ── ABA AGENTE IA ── */}
        {aba === 'agente' && (
          <div>
            <div className="card">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <div className="card-title" style={{ margin:0 }}>🧠 Agente IA — Teste em tempo real</div>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <span style={{ fontSize:11, color:'#64748b' }}>IA:</span>
                  {(cfg.geminiApiKey || cfg.geminiKey) && <button onClick={() => setProviderAgente('gemini')} className={`btn ${providerAgente === 'gemini' ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize:10, padding:'3px 10px' }}>Gemini</button>}
                  {(cfg.groqApiKey   || cfg.groqKey)   && <button onClick={() => setProviderAgente('groq')}   className={`btn ${providerAgente === 'groq'   ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize:10, padding:'3px 10px' }}>Groq</button>}
                  <button className="btn btn-secondary" style={{ fontSize:10, padding:'3px 10px' }}
                    onClick={() => setAgenteMessages([{ role:'bot', content:`Olá! Sou o Agente IA da ${cfg.company || 'Vivanexa'}. Como posso ajudá-lo?` }])}>
                    🔄 Reiniciar
                  </button>
                </div>
              </div>

              {chatbotConfig && (
                <div style={{ padding:'6px 10px', background:'rgba(16,185,129,.08)', border:'1px solid rgba(16,185,129,.2)', borderRadius:8, fontSize:11, color:'#10b981', marginBottom:10 }}>
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

            {(!cfg.openaiApiKey && !cfg.openaiKey && !cfg.geminiApiKey && !cfg.geminiKey && !cfg.groqApiKey && !cfg.groqKey) && (
              <div className="info-box" style={{ background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.2)', color:'#fca5a5' }}>
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
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:4 }}>
                  {TIPOS_SCRIPT.map(t => (
                    <button key={t.id} onClick={() => setTipoScript(t.id)}
                      className={`btn ${tipoScript === t.id ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize:11 }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <button className="btn btn-primary" onClick={gerarScriptComercial} disabled={gerandoScript} style={{ marginTop:8 }}>
                {gerandoScript ? '⏳ Gerando...' : '✨ Gerar Script com IA'}
              </button>
              {gerandoScript && <div className="thinking" style={{ marginTop:12 }}><span /><span /><span /></div>}
              {scriptResultado && (
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:16, marginBottom:8 }}>
                    <span style={{ fontSize:12, color:'#00d4ff' }}>✅ Script: {TIPOS_SCRIPT.find(t => t.id === tipoScript)?.label}</span>
                    <button className="btn btn-secondary" style={{ fontSize:11, padding:'4px 10px' }} onClick={() => navigator.clipboard.writeText(scriptResultado)}>📋 Copiar</button>
                  </div>
                  <div className="result-box">{scriptResultado}</div>
                </div>
              )}
            </div>

            {(cfg.scripts || []).length > 0 && (
              <div className="card">
                <div className="card-title">📜 Scripts Anteriores</div>
                {[...(cfg.scripts || [])].reverse().slice(0, 5).map(s => (
                  <div key={s.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', background:'#1a2540', borderRadius:8, marginBottom:6 }}>
                    <div>
                      <div style={{ fontSize:13, color:'#e2e8f0', fontWeight:600 }}>{TIPOS_SCRIPT.find(t => t.id === s.tipo)?.label} — {s.nicho}</div>
                      <div style={{ fontSize:11, color:'#64748b' }}>{s.produto} · {new Date(s.criadoEm).toLocaleDateString('pt-BR')}</div>
                    </div>
                    <div style={{ display:'flex', gap:6 }}>
                      <button className="btn btn-secondary" style={{ fontSize:10, padding:'3px 8px' }} onClick={() => setScriptResultado(s.resultado)}>👁 Ver</button>
                      <button className="btn btn-secondary" style={{ fontSize:10, padding:'3px 8px' }} onClick={() => navigator.clipboard.writeText(s.resultado)}>📋</button>
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
