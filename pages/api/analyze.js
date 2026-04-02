// pages/api/analyze.js
import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  console.log('🔥 [Analyze API] Requisição recebida');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { data, empresaId } = req.body;
  console.log('📦 Dados recebidos:', { empresaId, dataLength: JSON.stringify(data).length });

  if (!data) {
    return res.status(400).json({ error: 'Dados não enviados' });
  }

  // Buscar chaves
  let geminiKey = process.env.GEMINI_API_KEY;
  let groqKey   = process.env.GROQ_API_KEY;

  if (empresaId) {
    try {
      const { data: cfgRow } = await supabase
        .from('vx_storage')
        .select('value')
        .eq('key', `cfg:${empresaId}`)
        .maybeSingle();

      if (cfgRow?.value) {
        const cfg = JSON.parse(cfgRow.value);
        geminiKey = cfg.geminiApiKey || geminiKey;
        groqKey   = cfg.groqApiKey   || groqKey;
      }
    } catch (e) {
      console.error('Erro Supabase:', e.message);
    }
  }

  console.log('🔑 Chaves encontradas → Gemini:', !!geminiKey, ' | Groq:', !!groqKey);

  if (!geminiKey && !groqKey) {
    return res.status(400).json({ error: 'Nenhuma chave de IA configurada' });
  }

  // Teste simples - retorna resposta fake para ver se a API funciona
  return res.status(200).json({
    analysis: `✅ Teste de IA funcionando!\n\nResumo: Você enviou ${Object.keys(data).length} campos.\nSugestão: Verifique as chaves Gemini/Groq no Vercel.`,
    provider: 'test'
  });
}
