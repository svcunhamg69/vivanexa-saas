// pages/api/3cx-webhook.js
// SALVAR EM: pages/api/3cx-webhook.js
//
// CONFIGURAR NO 3CX:
// Console 3CX → Settings → CDR → Webhook URL
// Colocar: https://vivanexa-saas.vercel.app/api/3cx-webhook
//
// Este arquivo recebe os dados de cada ligação automaticamente
// e salva como atividade "Ligação" no CRM do negócio correspondente.

import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const cdr = req.body

    // Normalizar campos (o 3CX pode usar nomes diferentes dependendo da versão)
    const from        = String(cdr.from        || cdr.callerfrom    || cdr.callerid  || '')
    const to          = String(cdr.to          || cdr.callerto      || cdr.dnis      || '')
    const duracao     = parseInt(cdr.duration  || cdr.talkduration  || 0) || 0
    const gravacaoUrl = cdr.recordingfile      || cdr.recording_url || cdr.recordingurl || null
    const callStart   = cdr.callstart          || cdr.starttime     || new Date().toISOString()
    const agenteNome  = cdr.agentname          || cdr.agentdisplayname || ''
    const agenteRamal = cdr.agentextension     || cdr.from_dn       || ''
    const callId      = cdr.callid             || cdr.sessionid     || ''

    // Buscar número a pesquisar (to = número discado = cliente externo)
    const telBusca = to.replace(/\D/g,'') || from.replace(/\D/g,'')

    // Tentar encontrar o negócio pelo telefone (últimos 8 dígitos)
    let negocioId = null
    let empresaId = null

    if (telBusca.length >= 8) {
      const sufixo = telBusca.slice(-8)

      // Buscar nos negócios do CRM (dentro do JSON do vx_storage)
      // Como os dados ficam em vx_storage como JSON, buscamos por todas as empresas
      // e filtramos no JS. Para volume alto considere migrar para tabela dedicada.
      const { data: storageRows } = await supabase
        .from('vx_storage')
        .select('key, value')
        .like('key', 'cfg:%')
        .limit(100)

      if (storageRows?.length) {
        for (const row of storageRows) {
          try {
            const cfg = JSON.parse(row.value)
            const negs = cfg.crm_negocios || []
            const neg = negs.find(n => {
              const t = String(n.telefone||'').replace(/\D/g,'')
              return t.length >= 8 && t.slice(-8) === sufixo
            })
            if (neg) {
              negocioId = neg.id
              empresaId = row.key.replace('cfg:', '')
              break
            }
          } catch {}
        }
      }
    }

    // Montar descrição da ligação
    const duracaoStr = duracao > 0 ? `${Math.floor(duracao/60)}min ${duracao%60}s` : 'Não atendida'
    const descricao = [
      `Ligação ${duracaoStr}`,
      agenteNome   ? `· Atendente: ${agenteNome}`  : '',
      agenteRamal  ? `· Ramal: ${agenteRamal}`     : '',
      from && from !== to ? `· De: ${from}`         : '',
      to           ? `· Para: ${to}`               : '',
    ].filter(Boolean).join(' ')

    // Se encontrou empresa, salvar atividade dentro do JSON de config
    if (empresaId) {
      const { data: cfgRow } = await supabase
        .from('vx_storage')
        .select('value')
        .eq('key', `cfg:${empresaId}`)
        .maybeSingle()

      if (cfgRow?.value) {
        const cfg = JSON.parse(cfgRow.value)
        const novaAtiv = {
          id:           'atv_3cx_' + Date.now(),
          negocioId:    negocioId || '',
          tipo:         'Ligação',
          descricao,
          prazo:        callStart,
          concluida:    true,
          criadoEm:     new Date().toISOString(),
          duracao_seg:  duracao,
          gravacao_url: gravacaoUrl,
          agente_nome:  agenteNome,
          agente_ramal: agenteRamal,
          call_id:      callId,
          telefone_ext: from,
        }
        const atividades = [...(cfg.crm_atividades || []), novaAtiv]
        const novoCfg = { ...cfg, crm_atividades: atividades }

        await supabase.from('vx_storage').upsert({
          key:        `cfg:${empresaId}`,
          value:      JSON.stringify(novoCfg),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' })
      }
    }

    return res.status(200).json({ ok: true, empresaId, negocioId, duracao })

  } catch (err) {
    console.error('3CX Webhook error:', err)
    // Retorna 200 para o 3CX não retentar indefinidamente
    return res.status(200).json({ ok: false, error: err.message })
  }
}
