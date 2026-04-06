import { useState, useRef, useCallback } from 'react'

// ─── Ícones inline (sem dependência) ─────────────────────────────────────────
const Icon = ({ d, size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

const ICONS = {
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  plus: 'M12 5v14M5 12h14',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  send: 'M22 2L11 13M22 2L15 22 11 13 2 9l20-7z',
  image: 'M21 15l-5-5L5 21M3 3h18v18H3z',
  video: 'M15 10l4.553-2.274A1 1 0 0 1 21 8.65v6.7a1 1 0 0 1-1.447.924L15 14M3 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z',
  audio: 'M9 18V5l12-2v13M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  check: 'M20 6L9 17l-5-5',
  x: 'M18 6L6 18M6 6l12 12',
  info: 'M12 16v-4M12 8h.01M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  clock: 'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zM12 6v6l4 2',
  zap: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
}

// ─── Estilos base ─────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: '100vh',
    background: '#0d1117',
    color: '#e6edf3',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    padding: '24px',
  },
  card: {
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '16px',
  },
  cardTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#58a6ff',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  label: { fontSize: '13px', color: '#8b949e', marginBottom: '6px', display: 'block' },
  input: {
    width: '100%',
    background: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: '8px',
    color: '#e6edf3',
    padding: '10px 14px',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    background: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: '8px',
    color: '#e6edf3',
    padding: '10px 14px',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    resize: 'vertical',
    minHeight: '90px',
    fontFamily: 'inherit',
  },
  btn: (variant = 'primary') => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    transition: 'all 0.15s',
    background: variant === 'primary' ? '#238636' : variant === 'danger' ? '#da3633' : variant === 'blue' ? '#1f6feb' : '#21262d',
    color: '#fff',
  }),
  tag: (color = '#1f6feb') => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: color + '22',
    border: `1px solid ${color}44`,
    color: color,
    borderRadius: '20px',
    padding: '4px 12px',
    fontSize: '12px',
    fontWeight: 600,
  }),
  row: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  divider: { borderTop: '1px solid #30363d', margin: '16px 0' },
  badge: (color) => ({
    display: 'inline-block',
    background: color + '22',
    color,
    border: `1px solid ${color}44`,
    borderRadius: '6px',
    padding: '2px 8px',
    fontSize: '12px',
    fontWeight: 700,
  }),
}

// ─── Parser CSV/Excel simples ─────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(/[,;|\t]/).map(h => h.trim().toLowerCase().replace(/[^a-z]/g, ''))
  return lines.slice(1).map(line => {
    const cols = line.split(/[,;|\t]/).map(c => c.trim().replace(/^"|"$/g, ''))
    const obj = {}
    headers.forEach((h, i) => { obj[h] = cols[i] || '' })
    // Normaliza campos comuns
    return {
      numero: obj.numero || obj.telefone || obj.phone || obj.tel || '',
      nome: obj.nome || obj.name || obj.cliente || '',
      empresa: obj.empresa || obj.company || obj.razao || '',
      cidade: obj.cidade || obj.city || '',
    }
  }).filter(c => c.numero)
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function DisparoMassa({ empresaId = 'demo', instancias = [] }) {
  const fileInputRef = useRef()
  const mediaInputRef = useRef()

  // Contatos
  const [contatos, setContatos] = useState([])
  const [novoNumero, setNovoNumero] = useState('')
  const [novoNome, setNovoNome] = useState('')

  // Mensagens (até 10)
  const [mensagens, setMensagens] = useState([''])

  // Mídia
  const [tipo, setTipo] = useState('text')
  const [mediaUrl, setMediaUrl] = useState('')
  const [mediaCaption, setMediaCaption] = useState('')

  // Configurações anti-banimento
  const [delayMin, setDelayMin] = useState(8)
  const [delayMax, setDelayMax] = useState(20)
  const [loteSize, setLoteSize] = useState(20)
  const [lotePausa, setLotePausa] = useState(60)
  const [instanceKey, setInstanceKey] = useState('')

  // Estado da campanha
  const [disparando, setDisparando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [progresso, setProgresso] = useState(0)
  const [erro, setErro] = useState('')

  // ── Importar CSV ────────────────────────────────────────────────────────────
  const onFileChange = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = parseCSV(ev.target.result)
        if (!parsed.length) { setErro('Nenhum contato válido encontrado. Verifique o arquivo.'); return }
        setContatos(prev => {
          const nums = new Set(prev.map(c => c.numero))
          const novos = parsed.filter(c => !nums.has(c.numero))
          return [...prev, ...novos]
        })
        setErro('')
      } catch { setErro('Erro ao ler arquivo. Use CSV com colunas: numero, nome, empresa, cidade') }
    }
    reader.readAsText(file, 'UTF-8')
    e.target.value = ''
  }, [])

  // ── Adicionar contato manual ─────────────────────────────────────────────────
  const adicionarContato = () => {
    const num = novoNumero.replace(/\D/g, '')
    if (!num) return
    if (contatos.find(c => c.numero === num)) { setErro('Número já adicionado'); return }
    setContatos(prev => [...prev, { numero: num, nome: novoNome, empresa: '', cidade: '' }])
    setNovoNumero('')
    setNovoNome('')
    setErro('')
  }

  // ── Mensagens ────────────────────────────────────────────────────────────────
  const addMensagem = () => {
    if (mensagens.length >= 10) return
    setMensagens(prev => [...prev, ''])
  }
  const updateMensagem = (i, val) => setMensagens(prev => prev.map((m, idx) => idx === i ? val : m))
  const removeMensagem = (i) => setMensagens(prev => prev.filter((_, idx) => idx !== i))

  // ── Baixar modelo CSV ────────────────────────────────────────────────────────
  const baixarModelo = () => {
    const csv = 'numero,nome,empresa,cidade\n5531999999999,João Silva,Empresa ABC,Belo Horizonte\n5511988888888,Maria Souza,Empresa XYZ,São Paulo'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'modelo_contatos.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Disparar ─────────────────────────────────────────────────────────────────
  const disparar = async () => {
    const msgsValidas = mensagens.filter(m => m.trim())
    if (!contatos.length) { setErro('Adicione ao menos um contato'); return }
    if (!msgsValidas.length) { setErro('Adicione ao menos uma mensagem'); return }
    if (tipo !== 'text' && !mediaUrl.trim()) { setErro('Informe a URL da mídia'); return }
    if (delayMin > delayMax) { setErro('Delay mínimo deve ser menor que o máximo'); return }

    setDisparando(true)
    setErro('')
    setResultado(null)
    setProgresso(0)

    // Simula progresso visual enquanto API processa
    const total = contatos.length
    let prog = 0
    const avgDelay = ((delayMin + delayMax) / 2) * 1000
    const interval = setInterval(() => {
      prog = Math.min(prog + (100 / (total * (avgDelay / 1000))), 95)
      setProgresso(Math.floor(prog))
    }, 1000)

    try {
      const res = await fetch('/api/wpp/disparo-massa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId,
          instanceKey: instanceKey || undefined,
          contatos,
          mensagens: msgsValidas,
          tipo,
          mediaUrl: tipo !== 'text' ? mediaUrl : undefined,
          mediaCaption: tipo !== 'text' ? mediaCaption : undefined,
          delayMinMs: delayMin * 1000,
          delayMaxMs: delayMax * 1000,
          loteSize,
          lotePausaMs: lotePausa * 1000,
        }),
      })
      const data = await res.json()
      clearInterval(interval)
      setProgresso(100)
      if (res.ok) setResultado(data)
      else setErro(data.error || 'Erro no disparo')
    } catch (e) {
      clearInterval(interval)
      setErro('Erro de conexão: ' + e.message)
    } finally {
      setDisparando(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <span style={{ ...S.tag('#58a6ff'), fontSize: 13 }}>
              <Icon d={ICONS.zap} size={14} /> Disparo em Massa
            </span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, color: '#e6edf3' }}>WhatsApp em Massa</h1>
          <p style={{ color: '#8b949e', margin: '6px 0 0', fontSize: 14 }}>
            Importe contatos, configure mensagens variadas e dispare com segurança
          </p>
        </div>

        {/* Erro global */}
        {erro && (
          <div style={{ background: '#da363320', border: '1px solid #da363344', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: '#ff7b72', fontSize: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
            <Icon d={ICONS.x} size={16} /> {erro}
          </div>
        )}

        {/* ── CONTATOS ── */}
        <div style={S.card}>
          <div style={S.cardTitle}>
            <Icon d={ICONS.users} size={16} /> Contatos
            <span style={{ marginLeft: 'auto', ...S.badge('#58a6ff') }}>{contatos.length} adicionados</span>
          </div>

          {/* Importar CSV */}
          <div style={{ ...S.row, marginBottom: 16 }}>
            <button style={S.btn('blue')} onClick={() => fileInputRef.current?.click()}>
              <Icon d={ICONS.upload} size={16} /> Importar CSV / TXT
            </button>
            <button style={S.btn('default')} onClick={baixarModelo}>
              <Icon d={ICONS.download} size={16} /> Baixar Modelo
            </button>
            <span style={{ color: '#8b949e', fontSize: 12, alignSelf: 'center' }}>
              Colunas aceitas: numero, nome, empresa, cidade
            </span>
            <input ref={fileInputRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={onFileChange} />
          </div>

          <div style={S.divider} />

          {/* Adicionar manual */}
          <div style={S.cardTitle}>Adicionar manualmente</div>
          <div style={{ ...S.row, marginBottom: 12 }}>
            <div style={{ flex: 2, minWidth: 160 }}>
              <label style={S.label}>Número (DDI+DDD+número)</label>
              <input style={S.input} placeholder="5531999999999" value={novoNumero}
                onChange={e => setNovoNumero(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && adicionarContato()} />
            </div>
            <div style={{ flex: 2, minWidth: 140 }}>
              <label style={S.label}>Nome (opcional)</label>
              <input style={S.input} placeholder="João Silva" value={novoNome}
                onChange={e => setNovoNome(e.target.value)} />
            </div>
            <button style={{ ...S.btn('primary'), alignSelf: 'flex-end' }} onClick={adicionarContato}>
              <Icon d={ICONS.plus} size={16} /> Adicionar
            </button>
          </div>

          {/* Lista de contatos */}
          {contatos.length > 0 && (
            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #30363d', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#0d1117' }}>
                    {['Número', 'Nome', 'Empresa', ''].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#8b949e', fontWeight: 600, borderBottom: '1px solid #30363d' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contatos.map((c, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #21262d' }}>
                      <td style={{ padding: '8px 12px' }}>{c.numero}</td>
                      <td style={{ padding: '8px 12px', color: '#8b949e' }}>{c.nome || '—'}</td>
                      <td style={{ padding: '8px 12px', color: '#8b949e' }}>{c.empresa || '—'}</td>
                      <td style={{ padding: '8px 4px' }}>
                        <button onClick={() => setContatos(p => p.filter((_, j) => j !== i))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#da3633', padding: 4 }}>
                          <Icon d={ICONS.trash} size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── MENSAGENS ── */}
        <div style={S.card}>
          <div style={S.cardTitle}>
            <Icon d={ICONS.zap} size={16} /> Mensagens
            <span style={{ color: '#8b949e', fontSize: 12, fontWeight: 400, marginLeft: 8 }}>
              Até 10 mensagens — o sistema escolhe uma aleatoriamente por contato (anti-spam)
            </span>
            <button style={{ ...S.btn('blue'), marginLeft: 'auto', padding: '6px 14px', fontSize: 12 }}
              onClick={addMensagem} disabled={mensagens.length >= 10}>
              <Icon d={ICONS.plus} size={14} /> Adicionar variação
            </button>
          </div>

          <div style={{ background: '#0d111788', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#8b949e', display: 'flex', gap: 8 }}>
            <Icon d={ICONS.info} size={14} />
            Variáveis disponíveis: <code style={{ color: '#58a6ff' }}>{'{{nome}}'}</code> <code style={{ color: '#58a6ff' }}>{'{{empresa}}'}</code> <code style={{ color: '#58a6ff' }}>{'{{cidade}}'}</code> <code style={{ color: '#58a6ff' }}>{'{{numero}}'}</code>
          </div>

          {mensagens.map((msg, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'flex-start' }}>
              <div style={{ ...S.badge('#8b949e'), minWidth: 24, textAlign: 'center', marginTop: 10 }}>{i + 1}</div>
              <textarea
                style={{ ...S.textarea, flex: 1 }}
                placeholder={`Mensagem ${i + 1}... Ex: Olá {{nome}}, temos uma oferta especial para você!`}
                value={msg}
                onChange={e => updateMensagem(i, e.target.value)}
              />
              {mensagens.length > 1 && (
                <button onClick={() => removeMensagem(i)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#da3633', marginTop: 10, padding: 4 }}>
                  <Icon d={ICONS.x} size={16} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* ── MÍDIA ── */}
        <div style={S.card}>
          <div style={S.cardTitle}>
            <Icon d={ICONS.image} size={16} /> Tipo de Conteúdo
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { val: 'text', label: '💬 Texto', icon: ICONS.zap },
              { val: 'image', label: '🖼️ Imagem', icon: ICONS.image },
              { val: 'video', label: '🎥 Vídeo', icon: ICONS.video },
              { val: 'audio', label: '🎵 Áudio', icon: ICONS.audio },
              { val: 'document', label: '📄 Documento', icon: ICONS.download },
            ].map(t => (
              <button key={t.val}
                onClick={() => setTipo(t.val)}
                style={{
                  ...S.btn(tipo === t.val ? 'blue' : 'default'),
                  padding: '8px 16px',
                  fontSize: 13,
                  opacity: tipo === t.val ? 1 : 0.7,
                }}>
                {t.label}
              </button>
            ))}
          </div>

          {tipo !== 'text' && (
            <div>
              <div style={{ marginBottom: 12 }}>
                <label style={S.label}>URL da Mídia *</label>
                <input style={S.input} placeholder="https://..." value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} />
              </div>
              {tipo !== 'audio' && (
                <div>
                  <label style={S.label}>Legenda (opcional)</label>
                  <input style={S.input} placeholder="Legenda da mídia..." value={mediaCaption} onChange={e => setMediaCaption(e.target.value)} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── ANTI-BANIMENTO ── */}
        <div style={S.card}>
          <div style={S.cardTitle}>
            <Icon d={ICONS.shield} size={16} /> Configurações Anti-Banimento
          </div>

          <div style={{ background: '#238636' + '11', border: '1px solid #238636' + '33', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#3fb950', display: 'flex', gap: 8 }}>
            <Icon d={ICONS.shield} size={14} />
            Delays inteligentes e rotação de mensagens minimizam risco de suspensão da conta
          </div>

          <div style={S.grid2}>
            <div>
              <label style={S.label}>⏱️ Delay mínimo entre envios (segundos)</label>
              <input type="number" style={S.input} value={delayMin} min={3} max={120}
                onChange={e => setDelayMin(Number(e.target.value))} />
            </div>
            <div>
              <label style={S.label}>⏱️ Delay máximo entre envios (segundos)</label>
              <input type="number" style={S.input} value={delayMax} min={5} max={300}
                onChange={e => setDelayMax(Number(e.target.value))} />
            </div>
            <div>
              <label style={S.label}>📦 Pausar a cada N envios (tamanho do lote)</label>
              <input type="number" style={S.input} value={loteSize} min={5} max={100}
                onChange={e => setLoteSize(Number(e.target.value))} />
            </div>
            <div>
              <label style={S.label}>⏳ Pausa entre lotes (segundos)</label>
              <input type="number" style={S.input} value={lotePausa} min={10} max={600}
                onChange={e => setLotePausa(Number(e.target.value))} />
            </div>
          </div>

          {instancias.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <label style={S.label}>📱 Instância WhatsApp (opcional)</label>
              <select style={S.input} value={instanceKey} onChange={e => setInstanceKey(e.target.value)}>
                <option value="">Padrão</option>
                {instancias.map(inst => (
                  <option key={inst.key} value={inst.key}>{inst.label || inst.key}</option>
                ))}
              </select>
            </div>
          )}

          {/* Resumo estimativa */}
          {contatos.length > 0 && (
            <div style={{ marginTop: 16, background: '#0d1117', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#8b949e' }}>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <span><strong style={{ color: '#e6edf3' }}>{contatos.length}</strong> contatos</span>
                <span><strong style={{ color: '#e6edf3' }}>~{Math.round(((delayMin + delayMax) / 2) * contatos.length / 60)}min</strong> estimado</span>
                <span><strong style={{ color: '#e6edf3' }}>{Math.ceil(contatos.length / loteSize)}</strong> lotes de {loteSize}</span>
                <span><strong style={{ color: '#e6edf3' }}>{mensagens.filter(m => m.trim()).length}</strong> variações de mensagem</span>
              </div>
            </div>
          )}
        </div>

        {/* ── BOTÃO DISPARAR ── */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <button
            style={{ ...S.btn('primary'), fontSize: 16, padding: '14px 40px', opacity: disparando ? 0.7 : 1 }}
            onClick={disparar}
            disabled={disparando}
          >
            {disparando
              ? <><Icon d={ICONS.clock} size={18} /> Disparando... {progresso}%</>
              : <><Icon d={ICONS.send} size={18} /> Iniciar Disparo para {contatos.length} contatos</>
            }
          </button>

          {disparando && (
            <div style={{ marginTop: 16 }}>
              <div style={{ background: '#21262d', borderRadius: 20, height: 8, overflow: 'hidden', maxWidth: 400, margin: '0 auto' }}>
                <div style={{
                  height: '100%',
                  width: `${progresso}%`,
                  background: 'linear-gradient(90deg, #238636, #3fb950)',
                  borderRadius: 20,
                  transition: 'width 0.5s ease',
                }} />
              </div>
              <p style={{ color: '#8b949e', fontSize: 13, marginTop: 8 }}>
                Aguarde — delays inteligentes estão sendo aplicados para proteger sua conta
              </p>
            </div>
          )}
        </div>

        {/* ── RESULTADO ── */}
        {resultado && (
          <div style={{ ...S.card, borderColor: resultado.erros === 0 ? '#238636' : '#d29922' }}>
            <div style={S.cardTitle}>
              <Icon d={ICONS.check} size={16} color={resultado.erros === 0 ? '#3fb950' : '#d29922'} />
              Resultado da Campanha
              <span style={{ marginLeft: 'auto', ...S.badge('#8b949e') }}>ID: {resultado.campanhaId}</span>
            </div>

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
              <div style={{ ...S.card, background: '#238636' + '11', border: '1px solid #238636' + '44', margin: 0, flex: 1, textAlign: 'center', padding: '16px' }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#3fb950' }}>{resultado.enviados}</div>
                <div style={{ color: '#8b949e', fontSize: 13 }}>Enviados</div>
              </div>
              <div style={{ ...S.card, background: '#da3633' + '11', border: '1px solid #da3633' + '44', margin: 0, flex: 1, textAlign: 'center', padding: '16px' }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#ff7b72' }}>{resultado.erros}</div>
                <div style={{ color: '#8b949e', fontSize: 13 }}>Erros</div>
              </div>
              <div style={{ ...S.card, background: '#1f6feb' + '11', border: '1px solid #1f6feb' + '44', margin: 0, flex: 1, textAlign: 'center', padding: '16px' }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#58a6ff' }}>{resultado.total}</div>
                <div style={{ color: '#8b949e', fontSize: 13 }}>Total</div>
              </div>
            </div>

            {/* Detalhes por contato */}
            {resultado.resultados?.length > 0 && (
              <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #30363d', borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#0d1117' }}>
                      {['Número', 'Status', 'Detalhe'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#8b949e', borderBottom: '1px solid #30363d' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.resultados.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #21262d' }}>
                        <td style={{ padding: '8px 12px' }}>{r.numero}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={S.badge(r.status === 'enviado' ? '#3fb950' : '#ff7b72')}>
                            {r.status === 'enviado' ? '✓ Enviado' : '✗ Erro'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', color: '#8b949e', fontSize: 12 }}>{r.motivo || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
