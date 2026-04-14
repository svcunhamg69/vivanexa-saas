// pages/api/tenant-access.js
// Verifica se o tenant tem acesso a um módulo específico
// Chamado pelo _app.js ou pelas próprias páginas
// GET ?empresaId=xxx&modulo=chat → { ok: true }

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { empresaId, modulo } = req.query
    if (!empresaId) return res.status(400).json({ error: 'empresaId obrigatório' })

    const { data: cfgRow } = await supabase
      .from('vx_storage').select('value').eq('key', `cfg:${empresaId}`).maybeSingle()

    const cfg = cfgRow?.value ? JSON.parse(cfgRow.value) : {}
    const modulos = cfg.modulosAtivos || cfg.tenant_modulos || null

    // Se não há restrição configurada, libera tudo (comportamento legado)
    if (!modulos) return res.status(200).json({ ok: true, modulos: null })

    if (!modulo) return res.status(200).json({ ok: true, modulos })

    const temAcesso = modulos.includes(modulo)
    return res.status(200).json({ ok: temAcesso, modulos })
  }

  return res.status(405).json({ error: 'Método não permitido' })
}
