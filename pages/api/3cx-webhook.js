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
            }

            // ✅ Identifica o usuário pelo ramal 3CX (agenteRamal)
            if (empresaId && agenteRamal) {
              const usuarios = cfg.users || []
              const userMatch = usuarios.find(u => u.tcxRamal && String(u.tcxRamal).trim() === String(agenteRamal).trim())
              if (userMatch) {
                // Será usado no registro da atividade
                cfg._userMatch = { nome: userMatch.nome, id: userMatch.id, ramal: userMatch.tcxRamal }
              }
            }

            if (neg) break
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
        // Identifica usuário pelo ramal
        let agenteNomeResolvido = agenteNome
        let agenteIdResolvido = null
        if (agenteRamal) {
          const usersAtual = (cfg.users || [])
          const uu = usersAtual.find(u => u.tcxRamal && String(u.tcxRamal).trim() === String(agenteRamal).trim())
          if (uu) { agenteNomeResolvido = uu.nome || agenteNome; agenteIdResolvido = uu.id }
        }

        const novaAtiv = {
          id:           'atv_3cx_' + Date.now(),
          negocioId:    negocioId || '',
          tipo:         'Ligação',
          descricao:    descricao + (agenteNomeResolvido !== agenteNome ? ` · Identificado: ${agenteNomeResolvido}` : ''),
          prazo:        callStart,
          concluida:    true,
          criadoEm:     new Date().toISOString(),
          duracao_seg:  duracao,
          gravacao_url: gravacaoUrl,
          agente_nome:  agenteNomeResolvido,
          agente_id:    agenteIdResolvido,
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
