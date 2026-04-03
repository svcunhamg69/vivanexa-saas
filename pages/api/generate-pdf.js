// pages/api/generate-pdf.js
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { htmlContent } = req.body;

  if (!htmlContent) {
    return res.status(400).json({ error: 'Conteúdo HTML é obrigatório.' });
  }

  let browser = null;
  try {
    // Configuração para Vercel (serverless)
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm',
      },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="contrato_assinado.pdf"');
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    res.status(500).json({ error: 'Falha ao gerar PDF do contrato.' });
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }
}
