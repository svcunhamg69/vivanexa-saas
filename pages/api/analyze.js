// pages/api/analyze.js
export default function handler(req, res) {
  console.log('✅ API ANALYZE EXECUTADA COM SUCESSO!');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  return res.status(200).json({
    analysis: `✅ TESTE 100% FUNCIONANDO!\n\nA rota /api/analyze está respondendo corretamente.\n\nO problema era no código anterior.\n\nAgora podemos colocar o Gemini de verdade.`,
    provider: 'test'
  });
}
