// pages/api/analyze.js
import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { data, contexto, empresaId } = req.body;

  if (!data) {
    return res.status(400).json({ error: 'Dados não fornecidos' });
  }

  // Tenta pegar a chave do ambiente (.env.local)
  let geminiKey = process.env.GEMINI_API_KEY;
  let groqKey = process.env.GROQ_API_KEY;

  // Se não achou no .env, tenta buscar no banco de dados
  if (!geminiKey && !groqKey && empresaId) {
    const { data: cfgRow } = await supabase
      .from('vx_storage')
      .select('value')
      .eq('key', `cfg:${empresaId}`)
      .single();

    if (cfgRow?.value) {
      const cfg = JSON.parse(cfgRow.value);
      geminiKey = cfg.geminiApiKey;
      groqKey = cfg.groqApiKey;
    }
  }

  // Se não tem chave nenhuma, mostra erro
  if (!geminiKey && !groqKey) {
    return res.status(400).json({
      error: '❌ Nenhuma chave de API configurada.\n\n🔧 Solução: Adicione GEMINI_API_KEY no arquivo .env.local ou configure na aba Empresa.'
    });
  }

  // Monta o texto que será enviado para a IA
  const prompt = `
Você é um consultor de negócios especializado em vendas. Analise os dados abaixo:

DADOS:
${JSON.stringify(data, null, 2)}

Responda com:
1. Resumo executivo
2. Pontos importantes
3. Problemas encontrados
4. Sugestões de ação (mínimo 3)
`;

  // Tenta usar o Google Gemini
  if (geminiKey && geminiKey.startsWith('AIza')) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });
      const result = await response.json();

      if (result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts[0] && result.candidates[0].content.parts[0].text) {
        const analysis = result.candidates[0].content.parts[0].text;
        return res.status(200).json({ analysis, provider: 'gemini' });
      } else {
        console.error('Gemini erro:', result);
      }
    } catch (err) {
      console.error('Gemini erro:', err);
    }
  }

  // Se Gemini falhar, tenta Groq (se tiver chave)
  if (groqKey) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama3-70b-8192',
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const result = await response.json();

      if (result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content) {
        const analysis = result.choices[0].message.content;
        return res.status(200).json({ analysis, provider: 'groq' });
      } else {
        console.error('Groq erro:', result);
      }
    } catch (err) {
      console.error('Groq erro:', err);
    }
  }

  // Se tudo falhar
  return res.status(500).json({ error: 'Erro ao gerar análise. Tente novamente mais tarde.' });
}
