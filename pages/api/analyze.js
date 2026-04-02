// pages/api/analyze.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { data, empresaId } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'Dados não enviados' });
    }

    // Tenta chaves do ambiente primeiro, depois do cfg salvo na requisição
    const geminiKey = process.env.GEMINI_API_KEY || req.body.geminiKey || '';
    const groqKey   = process.env.GROQ_API_KEY   || req.body.groqKey   || '';

    if (!geminiKey && !groqKey) {
      return res.status(400).json({
        error: '❌ Nenhuma chave de API configurada.\n\n✅ Acesse Configurações → Empresa e insira sua chave do Google Gemini (gratuita) ou Groq.'
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

    // Tenta Gemini
    if (geminiKey && geminiKey.startsWith('AIza')) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiKey}`;
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
    if (groqKey) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
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
