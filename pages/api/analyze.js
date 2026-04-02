console.log('GEMINI KEY:', process.env.GEMINI_API_KEY ? 'OK' : 'ERRO');
console.log('GROQ KEY:', process.env.GROQ_API_KEY ? 'OK' : 'ERRO');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { data, contexto } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'Dados não enviados' });
    }

    const prompt = `
Analise os seguintes dados comerciais:

Contexto: ${contexto || 'Dados da empresa'}

Dados:
${JSON.stringify(data, null, 2)}

Retorne:
1. Resumo geral
2. Principais insights
3. Problemas identificados
4. Sugestões práticas de ação
`;

    // =========================
    // 🔵 TENTAR GEMINI
    // =========================
    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
          }),
        }
      );

      const geminiData = await geminiRes.json();

      if (geminiRes.ok) {
        const text =
          geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (text) {
          return res.status(200).json({
            analysis: text,
            provider: 'gemini',
          });
        }
      }

      console.warn('⚠️ Gemini falhou, tentando Groq...');
    } catch (e) {
      console.warn('⚠️ Erro Gemini:', e.message);
    }

    // =========================
    // 🟢 FALLBACK GROQ
    // =========================
    try {
      const groqRes = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama3-70b-8192',
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
          }),
        }
      );

      const groqData = await groqRes.json();

      if (groqRes.ok) {
        const text = groqData?.choices?.[0]?.message?.content;

        if (text) {
          return res.status(200).json({
            analysis: text,
            provider: 'groq',
          });
        }
      }

      console.error('❌ Groq também falhou:', groqData);
    } catch (e) {
      console.error('❌ Erro Groq:', e.message);
    }

    // =========================
    // ❌ FALHA TOTAL
    // =========================
    return res.status(500).json({
      error: 'Nenhuma IA respondeu. Verifique as chaves.',
    });

  } catch (error) {
    console.error('🔥 ERRO GERAL:', error);
    return res.status(500).json({
      error: 'Erro interno ao analisar dados',
    });
  }
}
