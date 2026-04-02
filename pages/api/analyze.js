// pages/api/analyze.js
// ============================================================
// API para análise de dados com Google Gemini (e fallback Groq)
// ============================================================

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { data, contexto, geminiApiKey, groqApiKey } = req.body;
  if (!data) {
    return res.status(400).json({ error: 'Dados não fornecidos' });
  }

  // Construir prompt
  const prompt = `
Você é um consultor de negócios especializado em vendas de software SaaS. Analise os dados abaixo e forneça um plano de ação concreto para melhorar os resultados.

CONTEXTO: ${contexto || 'Análise de desempenho comercial'}

DADOS:
${JSON.stringify(data, null, 2)}

Com base nesses dados, produza um relatório com:
1. Resumo executivo
2. Pontos importantes
3. Problemas encontrados
4. Sugestões de ação (mínimo 3)

Seja prático e direto. Use linguagem profissional.
`;

  // Tentar Gemini primeiro se a chave for fornecida
  if (geminiApiKey && geminiApiKey.startsWith('AIza')) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });
      const result = await response.json();
      if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
        const analysis = result.candidates[0].content.parts[0].text;
        return res.status(200).json({ analysis, provider: 'gemini' });
      } else {
        console.error('Gemini error:', result);
        // Fallback para Groq se disponível
        if (groqApiKey) {
          return handleGroq(prompt, groqApiKey, res);
        }
        return res.status(500).json({ error: 'Erro na resposta da API Gemini' });
      }
    } catch (err) {
      console.error('Gemini fetch error:', err);
      if (groqApiKey) {
        return handleGroq(prompt, groqApiKey, res);
      }
      return res.status(500).json({ error: err.message });
    }
  }

  // Se não tem Gemini, tenta Groq
  if (groqApiKey) {
    return handleGroq(prompt, groqApiKey, res);
  }

  return res.status(400).json({ error: 'Nenhuma chave de API configurada. Configure em Configurações → Empresa.' });
}

async function handleGroq(prompt, apiKey, res) {
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
    if (result.choices && result.choices[0]?.message?.content) {
      return res.status(200).json({ analysis: result.choices[0].message.content, provider: 'groq' });
    } else {
      console.error('Groq error:', result);
      return res.status(500).json({ error: 'Erro na resposta da API Groq' });
    }
  } catch (err) {
    console.error('Groq fetch error:', err);
    return res.status(500).json({ error: err.message });
  }
}
