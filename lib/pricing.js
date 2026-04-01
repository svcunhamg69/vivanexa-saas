// lib/pricing.js
// Funções auxiliares de formatação e cálculo de preços com descontos

// Formata um número para moeda brasileira
export function fmt(n) {
  return 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Calcula o preço de um produto com base no plano e configurações de desconto.
 * @param {object} product - O objeto do produto (ex: { id: 'Gestão Fiscal', nome: 'Gestão Fiscal', precos: { basic: [478, 318] } })
 * @param {string} planId - O ID do plano (ex: 'basic', 'pro')
 * @param {object} discountConfig - As configurações de desconto da empresa (cfg.discounts)
 * @param {string} tipoCalculo - 'tela' para preços exibidos, 'fechamento' para o preço final de contrato
 * @param {object} voucher - O objeto do voucher, se houver (ex: { percAdesao: 30, percMensalidade: 0 })
 * @returns {object} - Um objeto com { adesao: number, mensalidade: number, adesaoOriginal: number, mensalidadeOriginal: number }
 */
export function calcularPrecoComDesconto(product, planId, discountConfig, tipoCalculo = 'tela', voucher = null) {
  const precosBase = product.precos[planId] || [0, 0];
  let adesaoOriginal = precosBase[0];
  let mensalidadeOriginal = precosBase[1];

  let adesaoFinal = adesaoOriginal;
  let mensalidadeFinal = mensalidadeOriginal;

  // Aplicar desconto via voucher primeiro, se presente
  if (voucher) {
    if (voucher.percAdesao > 0) {
      adesaoFinal = adesaoOriginal * (1 - (voucher.percAdesao / 100));
    }
    if (voucher.percMensalidade > 0) {
      mensalidadeFinal = mensalidadeOriginal * (1 - (voucher.percMensalidade / 100));
    }
  } else {
    // Se não há voucher, aplicar desconto da configuração da empresa
    if (discountConfig.descontoEmTela && tipoCalculo === 'tela') {
      if (discountConfig.percAdesaoTela > 0) {
        adesaoFinal = adesaoOriginal * (1 - (discountConfig.percAdesaoTela / 100));
      }
      if (discountConfig.percMensalidadeTela > 0) {
        mensalidadeFinal = mensalidadeOriginal * (1 - (discountConfig.percMensalidadeTela / 100));
      }
    } else if (tipoCalculo === 'fechamento') {
      if (discountConfig.percAdesaoFechamento > 0) {
        adesaoFinal = adesaoOriginal * (1 - (discountConfig.percAdesaoFechamento / 100));
      }
      // Mensalidade de fechamento geralmente não tem desconto automático diferente da tela,
      // mas pode ser adicionado um percMensalidadeFechamento se necessário.
    }
  }

  return {
    adesao: parseFloat(adesaoFinal.toFixed(2)),
    mensalidade: parseFloat(mensalidadeFinal.toFixed(2)),
    adesaoOriginal: parseFloat(adesaoOriginal.toFixed(2)),
    mensalidadeOriginal: parseFloat(mensalidadeOriginal.toFixed(2)),
  };
}
