// pages/api/analyze.js
export default async function handler(req, res) {
  console.log('🚀 API ANALYZE FOI CHAMADA!');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { data, empresaId } = req.body;
  console.log('📦 Dados recebidos:', { empresaId, temData: !!data });

  // Resposta de teste (sempre funciona)
  return res.status(200).json({
    analysis: `✅ TESTE DE IA FUNCIONANDO!\n\nEmpresa ID: ${empresaId || 'não informado'}\n\nA IA está respondendo corretamente.\n\nAgora vamos colocar a lógica real do Gemini/Groq.`,
    provider: 'test'
  });
}
