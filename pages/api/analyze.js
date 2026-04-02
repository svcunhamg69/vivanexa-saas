// pages/api/analyze.js
import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { data, empresaId } = req.body;

  if (!data) {
    return res.status(400).json({ error: 'Dados não enviados' });
  }

  console.log('🔍 [Analyze] Iniciando análise para empresaId:', empresaId);

  // === 1. Buscar chaves de API ===
  let geminiKey = process.env.GEMINI_API_KEY;
  let groqKey   = process.env.GROQ_API_KEY;

  // Se não tiver no .env, busca no Supabase (cfg da empresa)
  if ((!geminiKey || !geminiKey.startsWith('AIza')) && empresaId) {
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
      console.error('Erro ao buscar chaves no Supabase:', e.message);
    }
  }

  if (!geminiKey && !groqKey) {
    return res.status(400).json({
      error: '❌ Nenhuma chave de IA configurada.\n\nConfigure GEMINI_API_KEY no Vercel ou na aba Empresa → Configuração de IA.'
    });
  }

  const prompt = `
Você é um consultor comercial especialista em software fiscal.
Analise os dados abaixo e devolva um plano de ação claro e prático.

DADOS:
${JSON.stringify(data, null, 2)}

Responda exatamente neste formato:
1. RESUMO EXECUTIVO (2-3 linhas)
2. PONTOS IMPORTANTES (lista)
3. PROBLEMAS ENCONTRADOS (lista)
4. SUGESTÕES DE AÇÃO (mínimo 4 ações práticas)
`;

  // === 2. Tenta Gemini primeiro ===
  if (geminiKey && geminiKey.startsWith('AIza')) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        }),
      });

      const result = await response.json();

      if (response.ok && result.candidates?.[0]?.content?.parts?.[0]?.text) {
        console.log('✅ Análise gerada com Gemini');
        return res.status(200).json({
          analysis: result.candidates[0].content.parts[0].text,
          provider: 'gemini'
        });
      }
    } catch (err) {
      console.error('❌ Erro Gemini:', err.message);
    }
  }

  // === 3. Fallback Groq ===
  if (groqKey) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama3-70b-8192',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        }),
      });

      const result = await response.json();

      if (response.ok && result.choices?.[0]?.message?.content) {
        console.log('✅ Análise gerada com Groq');
        return res.status(200).json({
          analysis: result.choices[0].message.content,
          provider: 'groq'
        });
      }
    } catch (err) {
      console.error('❌ Erro Groq:', err.message);
    }
  }

  // === 4. Se nada funcionar ===
  console.error('❌ Nenhuma IA respondeu');
  return res.status(500).json({
    error: '❌ Nenhuma IA respondeu. Verifique as chaves GEMINI_API_KEY / GROQ_API_KEY no Vercel ou na configuração da empresa.'
  });
}
