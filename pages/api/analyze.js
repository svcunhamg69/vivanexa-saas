// pages/api/analyze.js
export default function handler(req, res) {
  console.log('✅ ANALYZE API EXECUTADA COM SUCESSO');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  return res.status(200).json({
    analysis: `✅ TESTE FUNCIONANDO 100%!\n\nA rota /api/analyze está respondendo corretamente.\n\nO problema era no build/deploy anterior.`,
    provider: 'test'
  });
}
