// lib/nfe/utils.js
const crypto = require('crypto');

function gerarCNF() {
  return Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
}

function gerarChave(uf, anoMes, cnpj, modelo, serie, nNF, cNF) {
  const tpEmis = '1';
  const base = `${uf}${anoMes}${cnpj}${modelo}${serie.padStart(3, '0')}${nNF.padStart(9, '0')}${tpEmis}${cNF}`;
  const dv = calcularDigitoVerificador(base);
  return base + dv;
}

function calcularDigitoVerificador(chave) {
  const weights = [2, 3, 4, 5, 6, 7, 8, 9];
  let sum = 0;
  let index = 0;
  for (let i = chave.length - 1; i >= 0; i--) {
    sum += parseInt(chave[i]) * weights[index % weights.length];
    index++;
  }
  const rest = sum % 11;
  const dv = rest <= 1 ? 0 : 11 - rest;
  return dv.toString();
}

function gerarIdNFe(chave) {
  return `NFe${chave}`;
}

function formatMoney(value) {
  return Number(value).toFixed(2);
}

function gerarNumeroNota(ultimoNumero = 0) {
  return (ultimoNumero + 1).toString().padStart(9, '0');
}

function obterCodigoUF(uf) {
  const ufMap = {
    'RO': 11, 'AC': 12, 'AM': 13, 'RR': 14, 'PA': 15, 'AP': 16, 'TO': 17,
    'MA': 21, 'PI': 22, 'CE': 23, 'RN': 24, 'PB': 25, 'PE': 26, 'AL': 27,
    'SE': 28, 'BA': 29, 'MG': 31, 'ES': 32, 'RJ': 33, 'SP': 35, 'PR': 41,
    'SC': 42, 'RS': 43, 'MS': 50, 'MT': 51, 'GO': 52, 'DF': 53
  };
  return ufMap[uf] || 35;
}

module.exports = {
  gerarCNF,
  gerarChave,
  calcularDigitoVerificador,
  gerarIdNFe,
  formatMoney,
  gerarNumeroNota,
  obterCodigoUF
};
