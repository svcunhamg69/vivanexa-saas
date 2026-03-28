export function calculateFullPrice(products) {
  let adesao = 0
  let mensalidade = 0

  products.forEach(p => {
    adesao += Number(p.adesao || 0)
    mensalidade += Number(p.mensalidade || 0)
  })

  return { adesao, mensalidade }
}