// pages/api/cron-agente.js
// ═══════════════════════════════════════════════════════════════
// Cron de agendamento automático do Agente IA
//
// Configure no Vercel: vercel.json → crons → path: /api/cron-agente
// Sugestão: rodar a cada hora (0 * * * *) e este endpoint
// verifica se está na hora de executar cada ação.
//
// vercel.json:
// {
//   "crons": [{ "path": "/api/cron-agente", "schedule": "0 * * * *" }]
// }
//
// Ou via cron externo (cron-job.org, EasyCron) chamando a URL:
// GET https://seu-app.vercel.app/api/cron-agente?secret=CRON_SECRET
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  // Segurança mínima — aceita GET (Vercel Cron) ou POST com secret
  const secret = req.query.secret || req.headers['x-cron-secret'] || ''
  const cronSecret = process.env.CRON_SECRET || ''
  if (cronSecret && secret !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const agora = new Date()
  const horaAtual = `${String(agora.getHours()).padStart(2,'0')}:${String(agora.getMinutes()).padStart(2,'0')}`
  const horaHH   = `${String(agora.getHours()).padStart(2,'0')}:00`  // hora cheia para match aproximado

  console.log(`[cron-agente] rodando às ${horaAtual}`)

  // Busca todos os tenants com agente follow-up configurado
  const { data: rows } = await supabase
    .from('vx_storage')
    .select('key, value')
    .like('key', 'cfg:%')
    .limit(200)

  if (!rows?.length) return res.status(200).json({ ok: true, processados: 0 })

  const resultados = []
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  for (const row of rows) {
    try {
      const cfg = JSON.parse(row.value)
      const empresaId = row.key.replace('cfg:', '')
      const agentes = cfg.wppAgentes || []

      // Encontra agente de follow-up configurado
      const agenteFollowup = agentes.find(a => a.usarParaFollowup && a.ativo)
      if (!agenteFollowup) continue

      const hoje = agora.toISOString().slice(0, 10)
      const cronLog = cfg.cronLog || {}

      // ─── BRIEFING DIÁRIO ───────────────────────────────
      if (agenteFollowup.briefingAuto) {
        const horario = agenteFollowup.briefingHorario || '08:00'
        const jaRodouHoje = cronLog[`briefing_${hoje}`]
        const naHora = horaHH === horario || horaAtual === horario ||
          Math.abs(agora.getHours() * 60 + agora.getMinutes() - parseInt(horario.split(':')[0]) * 60 - parseInt(horario.split(':')[1])) <= 5

        if (naHora && !jaRodouHoje) {
          try {
            const r = await fetch(`${baseUrl}/api/agente-followup`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ acao: 'briefing_diario', empresaId, instanciaOverride: agenteFollowup.instancia })
            })
            const data = await r.json()
            cronLog[`briefing_${hoje}`] = { at: agora.toISOString(), ok: data.ok, enviados: data.totalEnviados }
            resultados.push({ empresaId, acao: 'briefing', ok: data.ok })
          } catch (e) { resultados.push({ empresaId, acao: 'briefing', erro: e.message }) }
        }
      }

      // ─── FOLLOW-UP NEGÓCIOS PARADOS ────────────────────
      if (agenteFollowup.followupAuto) {
        const horario = agenteFollowup.followupHorario || '09:00'
        const jaRodouHoje = cronLog[`followup_${hoje}`]
        const naHora = horaHH === horario || horaAtual === horario ||
          Math.abs(agora.getHours() * 60 + agora.getMinutes() - parseInt(horario.split(':')[0]) * 60 - parseInt(horario.split(':')[1])) <= 5

        if (naHora && !jaRodouHoje) {
          try {
            const r = await fetch(`${baseUrl}/api/agente-followup`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ acao: 'followup_parado', empresaId, instanciaOverride: agenteFollowup.instancia })
            })
            const data = await r.json()
            cronLog[`followup_${hoje}`] = { at: agora.toISOString(), ok: data.ok }
            resultados.push({ empresaId, acao: 'followup_parado', ok: data.ok })
          } catch (e) { resultados.push({ empresaId, acao: 'followup_parado', erro: e.message }) }
        }
      }

      // ─── FOLLOW-UP DE TAREFAS ──────────────────────────
      if (agenteFollowup.tarefasAuto) {
        const horario = agenteFollowup.tarefasHorario || '08:30'
        const jaRodouHoje = cronLog[`tarefas_${hoje}`]
        const naHora = horaHH === horario || horaAtual === horario ||
          Math.abs(agora.getHours() * 60 + agora.getMinutes() - parseInt(horario.split(':')[0]) * 60 - parseInt(horario.split(':')[1])) <= 5

        if (naHora && !jaRodouHoje) {
          try {
            const r = await fetch(`${baseUrl}/api/agente-followup`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ acao: 'followup_tarefas', empresaId, instanciaOverride: agenteFollowup.instancia })
            })
            const data = await r.json()
            cronLog[`tarefas_${hoje}`] = { at: agora.toISOString(), ok: data.ok }
            resultados.push({ empresaId, acao: 'followup_tarefas', ok: data.ok })
          } catch (e) { resultados.push({ empresaId, acao: 'followup_tarefas', erro: e.message }) }
        }
      }

      // Salva cronLog atualizado (mantém só últimos 30 dias)
      const logKeys = Object.keys(cronLog).sort().slice(-60)
      const logLimpo = {}
      logKeys.forEach(k => { logLimpo[k] = cronLog[k] })

      if (resultados.some(r => r.empresaId === empresaId)) {
        await supabase.from('vx_storage').upsert(
          { key: row.key, value: JSON.stringify({ ...cfg, cronLog: logLimpo }), updated_at: agora.toISOString() },
          { onConflict: 'key' }
        )
      }

    } catch (e) { console.error(`[cron-agente] erro empresa ${row.key}:`, e.message) }
  }

  console.log(`[cron-agente] concluído — ${resultados.length} ações`)
  return res.status(200).json({ ok: true, hora: horaAtual, processados: resultados.length, resultados })
}
