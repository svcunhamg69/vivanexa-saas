import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' })
  }

  try {
    const { companyId, modules, cnpjs, notas, voucher } = req.body

    // Buscar produtos e preços da empresa
    const { data: products, error } = await supabase
      .from('products')
      .select(`
        *,
        prices (plan_id, adesao, mensalidade),
        plans!inner (*)
      `)
      .eq('company_id', companyId)

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    // Exemplo simples de cálculo
    let totalAdesao = 0
    let totalMensalidade = 0

    products.forEach(p => {
      if (modules.includes(p.internal_key)) {
        p.prices.forEach(price => {
          totalAdesao += Number(price.adesao || 0)
          totalMensalidade += Number(price.mensalidade || 0)
        })
      }
    })

    res.status(200).json({
      adesao: totalAdesao,
      mensalidade: totalMensalidade
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}