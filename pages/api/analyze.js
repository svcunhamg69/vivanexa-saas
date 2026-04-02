// pages/api/analyze.js
export default async function handler(req, res) {
  console.log('🚀 ANALYZE API FOI CHAMADA COM SUCESSO!');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Resposta de teste imediata (não depende de nada)
  return res.status(200).json({
    analysis: `✅ TESTE FUNCIONANDO!\n\nA rota /api/analyze está respondendo corretamente.\n\nAgora podemos colocar o Gemini/Groq de verdade.`,
    provider: 'test'
  });
}
