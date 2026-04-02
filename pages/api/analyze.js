// pages/api/analyze.js
import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { data, contexto, empresaId } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'Dados não enviados' });
    }

    // Buscar chaves do ambiente ou do banco
    let geminiKey = process.env.GEMINI_API_KEY;
    let groqKey = process.env.GROQ_API_KEY;

    // Se não encontrou no ambiente, tenta no Supabase (se empresaId foi enviado)
    if ((!geminiKey || !geminiKey.startsWith('AIza')) && empresaId) {
      try {
        const { data: cfgRow } = await supabase
          .from('vx_storage')
          .select('value')
          .eq('key', `cfg:${empresaId}`)
          .single();

        if (cfgRow?.value) {
          const cfg = JSON.parse(cfgRow.value);
          geminiKey = cfg.geminiApiKey || geminiKey;
          groqKey = cfg.groqApiKey || groqKey;
        }
      } catch (err) {
        console.warn('Erro ao buscar chaves do Supabase:', err.message);
      }
    }

    // Se ainda não tem chave, retorna erro
    if (!geminiKey && !groqKey) {
      return res.status(400).json({
        error: '❌ Nenhuma chave de API configurada.\n\n✅ Configure GEMINI_API_KEY no .env.local ou na aba Empresa → Configuração de IA.'
      });
    }

    const prompt = `
Você é um consultor de negócios especializado em vendas de software SaaS. Analise os dados abaixo e forneça um plano de ação concreto.

DADOS:
${JSON.stringify(data, null, 2)}

Responda no formato:
1. RESUMO EXECUTIVO: (2-3 linhas)
2. PONTOS IMPORTANTES: (liste)
3. PROBLEMAS ENCONTRADOS: (liste)
4. SUGESTÕES DE AÇÃO: (mínimo 3, práticas)
`;

    // ========= TENTA GEMINI =========
    if (geminiKey && geminiKey.startsWith('AIza')) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        });

        const result = await response.json();
        if (response.ok && result.candidates?.[0]?.content?.parts?.[0]?.text) {
          return res.status(200).json({
            analysis: result.candidates[0].content.parts[0].text,
            provider: 'gemini',
          });
        } else {
          console.warn('Gemini falhou, tentando Groq...');
        }
      } catch (err) {
        console.warn('Erro Gemini:', err.message);
      }
    }

    // ========= FALLBACK GROQ =========
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
            temperature: 0.7,
          }),
        });

        const result = await response.json();
        if (response.ok && result.choices?.[0]?.message?.content) {
          return res.status(200).json({
            analysis: result.choices[0].message.content,
            provider: 'groq',
          });
        } else {
          console.error('Groq também falhou:', result);
        }
      } catch (err) {
        console.error('Erro Groq:', err.message);
      }
    }

    // Se tudo falhar
    return res.status(500).json({
      error: '❌ Nenhuma IA respondeu. Verifique as chaves e a conexão com a internet.',
    });
  } catch (error) {
    console.error('Erro geral:', error);
    return res.status(500).json({
      error: 'Erro interno no servidor. Tente novamente mais tarde.',
    });
  }
}
