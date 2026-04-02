// pages/api/analyze.js
import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  // Apenas POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { data, contexto, empresaId } = req.body;

  if (!data) {
    return res.status(400).json({ error: 'Dados não fornecidos' });
  }

  // 1. Tenta pegar chaves das variáveis de ambiente
  let geminiKey = process.env.GEMINI_API_KEY;
  let groqKey = process.env.GROQ_API_KEY;

  // 2. Se não encontrou, busca no Supabase
  if ((!geminiKey || !geminiKey.startsWith('AIza')) && empresaId) {
    try {
      const { data: cfgRow, error } = await supabase
        .from('vx_storage')
        .select('value')
        .eq('key', `cfg:${empresaId}`)
        .single();

      if (!error && cfgRow?.value) {
        const cfg = JSON.parse(cfgRow.value);
        if (cfg.geminiApiKey && cfg.geminiApiKey.startsWith('AIza')) {
          geminiKey = cfg.geminiApiKey;
        }
        if (cfg.groqApiKey) {
          groqKey = cfg.groqApiKey;
        }
      }
    } catch (err) {
      console.error('Erro ao buscar chaves do Supabase:', err);
    }
  }

  // 3. Se ainda não tem chave, retorna erro amigável
  if (!geminiKey && !groqKey) {
    return res.status(400).json({
      error: '❌ Nenhuma chave de API encontrada!\n\n✅ Solução:\n1. Adicione GEMINI_API_KEY no arquivo .env.local\n2. Ou configure na aba Empresa → Configuração de IA\n3. Depois reinicie o servidor (npm run dev)'
    });
  }

  // 4. Monta o prompt
  const prompt = `
Você é um consultor de negócios especializado em vendas de software SaaS. Analise os dados abaixo e forneça um plano de ação.

DADOS:
${JSON.stringify(data, null, 2)}

Responda no seguinte formato:
1. RESUMO EXECUTIVO: (2-3 linhas)
2. PONTOS IMPORTANTES: (liste os principais destaques)
3. PROBLEMAS ENCONTRADOS: (liste pontos de atenção)
4. SUGESTÕES DE AÇÃO: (mínimo 3 sugestões práticas)

Seja direto e prático. Use português claro.
`;

  // 5. Tenta Gemini (com a URL corrigida: v1beta)
  if (geminiKey && geminiKey.startsWith('AIza')) {
    try {
      // 🔥 CORREÇÃO AQUI: v1 → v1beta
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
      console.log('🔄 Chamando Gemini com URL:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });

      const result = await response.json();

      if (response.ok && result.candidates?.[0]?.content?.parts?.[0]?.text) {
        const analysis = result.candidates[0].content.parts[0].text;
        return res.status(200).json({ analysis, provider: 'gemini' });
      } else {
        console.error('Gemini erro:', result);
        if (groqKey) return await usarGroq(prompt, groqKey, res);
        return res.status(500).json({ error: 'Erro na API Gemini: ' + JSON.stringify(result) });
      }
    } catch (err) {
      console.error('Gemini exception:', err);
      if (groqKey) return await usarGroq(prompt, groqKey, res);
      return res.status(500).json({ error: err.message });
    }
  }

  // 6. Fallback para Groq
  if (groqKey) {
    return await usarGroq(prompt, groqKey, res);
  }

  return res.status(400).json({ error: 'Chave Gemini inválida. Verifique se começa com AIza' });
}

// Função auxiliar para Groq
async function usarGroq(prompt, apiKey, res) {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
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
      return res.status(200).json({ analysis: result.choices[0].message.content, provider: 'groq' });
    } else {
      console.error('Groq erro:', result);
      return res.status(500).json({ error: 'Erro na API Groq' });
    }
  } catch (err) {
    console.error('Groq exception:', err);
    return res.status(500).json({ error: err.message });
  }
}
