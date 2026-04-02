// pages/api/analyze.js
// ============================================================
// API para análise de dados com Claude (Anthropic API)
// ============================================================

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { data, contexto } = req.body;
  if (!data) {
    return res.status(400).json({ error: 'Dados não fornecidos' });
  }

  // Obter chave da API do ambiente
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    console.error('CLAUDE_API_KEY não configurada');
    return res.status(500).json({ error: 'API de IA não configurada' });
  }

  // Construir prompt com os dados
  const prompt = `
Você é um consultor de negócios especializado em vendas de software SaaS. Analise os dados abaixo e forneça um plano de ação concreto para melhorar os resultados.

CONTEXTO: ${contexto || 'Análise de desempenho comercial'}

DADOS:
${JSON.stringify(data, null, 2)}

Com base nesses dados, produza um relatório com:
1. Principais insights (pontos fortes e fracos)
2. Sugestões de ação específicas (mínimo 3)
3. Previsão de impacto se as ações forem implementadas
4. Recomendações para o próximo período

Seja prático e direto. Use linguagem profissional.
`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const result = await response.json();
    if (result.error) {
      console.error('Erro Claude:', result.error);
      return res.status(500).json({ error: result.error.message });
    }

    const analysis = result.content?.[0]?.text || 'Não foi possível gerar análise.';
    return res.status(200).json({ analysis });
  } catch (err) {
    console.error('Erro ao chamar Claude:', err);
    return res.status(500).json({ error: err.message });
  }
}
