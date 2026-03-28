import { supabase } from '../lib/supabase'

export default function TestPage() {
  async function testar() {
    const { data, error } = await supabase
      .from('teste')
      .select('*')

    console.log(data, error)
  }

  return (
    <div>
      <h1>Teste Supabase</h1>
      <button onClick={testar}>Testar conexão</button>
    </div>
  )
}