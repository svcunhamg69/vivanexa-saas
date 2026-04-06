// pages/api/analyze.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { data, empresaId } = req.body;
    // Aceita ambos os nomes de chave (legado e novo)
    const geminiKey = req.body.geminiApiKey || req.body.geminiKey || '';
    const groqKey   = req.body.groqApiKey   || req.body.groqKey   || '';
    const openaiKey = req.body.openaiApiKey  || req.body.openaiKey  || '';

    if (!data) {
      return res.status(400).json({ error: 'Dados não enviados' });
    }

    // Tenta chaves do ambiente primeiro, depois do cfg salvo na requisição
    const geminiKeyFinal = process.env.GEMINI_API_KEY || geminiKey || '';
    const groqKeyFinal   = process.env.GROQ_API_KEY   || groqKey   || '';
    const openaiKeyFinal = process.env.OPENAI_API_KEY  || openaiKey || '';

    if (!openaiKeyFinal && !geminiKeyFinal && !groqKeyFinal) {
      return res.status(400).json({
        error: '❌ Nenhuma chave de IA configurada.\n\n✅ Acesse Configurações → Empresa → 🤖 Configuração de IA e insira sua chave do OpenAI, Google Gemini ou Groq.'
      });
    }

    const prompt = `
Você é um consultor de negócios especializado em vendas de software SaaS. Analise os dados abaixo e forneça um plano de ação concreto.

DADOS:
${JSON.stringify(data, null, 2)}

Responda em português no formato:
1. RESUMO EXECUTIVO:
2. PONTOS POSITIVOS:
3. PROBLEMAS ENCONTRADOS:
4. SUGESTÕES DE AÇÃO: (mínimo 3 ações concretas)
5. META PARA O PRÓXIMO MÊS:
`;

    // Tenta OpenAI primeiro
    if (openaiKeyFinal) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${openaiKeyFinal}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.7, max_tokens: 1500 }),
        });
        const result = await response.json();
        if (response.ok && result.choices?.[0]?.message?.content) {
          return res.status(200).json({ analysis: result.choices[0].message.content, provider: 'openai' });
        }
        console.warn('OpenAI falhou:', result?.error?.message || result);
      } catch (err) {
        console.warn('Erro OpenAI:', err.message);
      }
    }

    // Tenta Gemini
    if (geminiKeyFinal && geminiKeyFinal.startsWith('AIza')) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${geminiKeyFinal}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        });
        const result = await response.json();
        if (response.ok && result.candidates?.[0]?.content?.parts?.[0]?.text) {
          return res.status(200).json({ analysis: result.candidates[0].content.parts[0].text, provider: 'gemini' });
        }
        console.warn('Gemini falhou:', result?.error?.message || result);
      } catch (err) {
        console.warn('Erro Gemini:', err.message);
      }
    }

    // Fallback Groq
    if (groqKeyFinal) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${groqKeyFinal}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama3-70b-8192',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
          }),
        });
        const result = await response.json();
        if (response.ok && result.choices?.[0]?.message?.content) {
          return res.status(200).json({ analysis: result.choices[0].message.content, provider: 'groq' });
        }
        console.warn('Groq falhou:', result?.error?.message || result);
      } catch (err) {
        console.warn('Erro Groq:', err.message);
      }
    }

    return res.status(500).json({ error: '❌ Nenhuma IA respondeu. Verifique as chaves em Configurações → Empresa.' });
  } catch (error) {
    console.error('Erro geral:', error);
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
}
