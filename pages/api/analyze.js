// pages/api/analyze.js
// ============================================================
// API para análise com Google Gemini (gratuito)
// ============================================================

export default async function handler(req, res) {
  // Apenas aceita requisições POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Pega os dados enviados pelo frontend
  const { data, contexto } = req.body;
  
  if (!data) {
    return res.status(400).json({ error: 'Dados não fornecidos' });
  }

  // Pega a chave da API do arquivo .env.local
  const geminiApiKey = process.env.GEMINI_API_KEY;

  // Se não tem chave, retorna erro
  if (!geminiApiKey) {
    return res.status(400).json({ 
      error: '❌ Chave do Google Gemini não encontrada.\n\n🔧 Solução: Adicione GEMINI_API_KEY no arquivo .env.local' 
    });
  }

  // Monta o texto que será enviado para o Gemini
  const prompt = `
Você é um consultor de negócios especializado em vendas de software SaaS. Analise os dados abaixo e forneça um plano de ação concreto.

DADOS:
${JSON.stringify(data, null, 2)}

Com base nesses dados, responda com:
1. Resumo executivo
2. Pontos importantes
3. Problemas encontrados
4. Sugestões de ação (mínimo 3)

Seja prático, direto e use linguagem profissional.
`;

  try {
    // Chama a API do Google Gemini
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    const result = await response.json();

    // Verifica se a resposta veio corretamente
    if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
      const analysis = result.candidates[0].content.parts[0].text;
      return res.status(200).json({ analysis, provider: 'gemini' });
    } else {
      console.error('Erro do Gemini:', result);
      return res.status(500).json({ error: 'Erro ao gerar análise. Tente novamente.' });
    }
  } catch (err) {
    console.error('Erro na requisição:', err);
    return res.status(500).json({ error: 'Erro de conexão com a API. Tente novamente.' });
  }
}
