// pages/api/ai/fetch-site.js
// Extrai o conteúdo textual de uma URL para alimentar a base de conhecimento do Agente IA

export const config = {
  api: { bodyParser: { sizeLimit: '2mb' } },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' })
  }

  const { url } = req.body

  if (!url || !url.startsWith('http')) {
    return res.status(400).json({ error: 'URL inválida' })
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VivaNexaBot/1.0; +https://vivanexa.com.br)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      return res.status(200).json({ texto: '', aviso: `Site retornou HTTP ${response.status}` })
    }

    const html = await response.text()

    // Extração de texto do HTML
    const texto = extrairTextoHTML(html, url)

    return res.status(200).json({ texto, url, chars: texto.length })
  } catch (err) {
    console.error('[fetch-site]', err.message)
    return res.status(200).json({ texto: '', aviso: err.message })
  }
}

function extrairTextoHTML(html, url) {
  // Remove scripts, styles, head, nav, footer, header
  let texto = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')

  // Preserva quebras de linha em parágrafos e títulos
  texto = texto
    .replace(/<\/?(h[1-6])[^>]*>/gi, '\n\n')
    .replace(/<\/?(p|div|li|tr|br)[^>]*>/gi, '\n')

  // Remove todas as tags restantes
  texto = texto.replace(/<[^>]+>/g, ' ')

  // Decodifica entidades HTML comuns
  texto = texto
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/&#\d+;/g, ' ')

  // Limpar espaços e linhas em branco excessivas
  texto = texto
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 2)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  // Limitar a 6000 chars para não explodir o contexto da IA
  if (texto.length > 6000) {
    texto = texto.slice(0, 6000) + `\n\n[... conteúdo truncado — fonte: ${url}]`
  }

  return texto
}
