// pages/api/wpp/debug.js
// ⚠️ APENAS PARA DEBUG — remover após resolver o problema
// Captura o payload EXATO que a Evolution API envia e salva no Supabase
// Configure temporariamente o webhook da Evolution para apontar para:
// https://vivanexa-saas.vercel.app/api/wpp/debug

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export const config = { api: { bodyParser: { sizeLimit: '5mb' } } }

export default async function handler(req, res) {
  const payload = {
    method:  req.method,
    headers: req.headers,
    query:   req.query,
    body:    req.body,
    ts:      new Date().toISOString(),
  }

  console.log('[WPP DEBUG]', JSON.stringify(payload).slice(0, 2000))

  // Salva no Supabase para você ver no dashboard
  try {
    await supabase.from('vx_storage').upsert({
      key:        `wpp_debug:${Date.now()}`,
      value:      JSON.stringify(payload),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })
  } catch (e) {
    console.error('supabase save error:', e.message)
  }

  return res.status(200).json({ status: 'ok', received: payload.ts })
}
