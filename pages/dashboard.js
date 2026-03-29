import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/router';
import { fmt } from '../lib/pricing';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState([]);
  const [goals, setGoals] = useState([]);
  const [users, setUsers] = useState([]);
  const router = useRouter();

  useEffect(() => {
    checkUser();
    fetchData();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) router.push('/');
  };

  const fetchData = async () => {
    setLoading(true);
    // Buscar contratos assinados (status = 'signed')
    const { data: docs, error: docsError } = await supabase
      .from('documents')
      .select(`
        id,
        type,
        status,
        signed_at,
        signed_by,
        t_ad,
        t_men,
        client_id,
        consultant_id,
        clients (fantasia, razao)
      `)
      .eq('type', 'contrato')
      .eq('status', 'signed')
      .order('signed_at', { ascending: false });
    if (!docsError) setSales(docs || []);

    // Buscar metas
    const { data: goalsData, error: goalsError } = await supabase
      .from('goals')
      .select('*');
    if (!goalsError) setGoals(goalsData || []);

    // Buscar usuários (apenas vendedores com role = 'user')
    const { data: usersData, error: usersError } = await supabase
      .from('profiles')
      .select('id, name, role')
      .eq('role', 'user');
    if (!usersError) setUsers(usersData || []);

    setLoading(false);
  };

  // Agrupar vendas por vendedor
  const salesByUser = {};
  sales.forEach(sale => {
    const uid = sale.consultant_id;
    if (!uid) return;
    if (!salesByUser[uid]) {
      salesByUser[uid] = { ad: 0, men: 0, count: 0 };
    }
    salesByUser[uid].ad += sale.t_ad || 0;
    salesByUser[uid].men += sale.t_men || 0;
    salesByUser[uid].count += 1;
  });

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyGoals = goals.filter(g => g.month === currentMonth);

  const getGoalForUser = (userId) => {
    const goal = monthlyGoals.find(g => g.user_id === userId);
    return goal || { ad_meta: 0, men_meta: 0, contracts_meta: 0 };
  };

  if (loading) {
    return <div style={{ padding: '50px', textAlign: 'center' }}>Carregando dashboard...</div>;
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 20 }}>
      {/* Cabeçalho com botão de voltar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1>Dashboard de Vendas</h1>
        <button
          onClick={() => router.push('/chat')}
          style={{
            padding: '8px 16px',
            background: '#00d4ff',
            border: 'none',
            borderRadius: 8,
            color: '#000',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          ← Voltar ao Chat
        </button>
      </div>

      <p>Período: {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>

      {/* Cards de resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 16, marginBottom: 32 }}>
        <div style={{ background: '#111827', padding: 16, borderRadius: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 'bold', color: '#10b981' }}>{sales.length}</div>
          <div>Contratos assinados</div>
        </div>
        <div style={{ background: '#111827', padding: 16, borderRadius: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 'bold', color: '#10b981' }}>
            {fmt(sales.reduce((acc, s) => acc + (s.t_ad || 0), 0))}
          </div>
          <div>Total de adesão</div>
        </div>
        <div style={{ background: '#111827', padding: 16, borderRadius: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 'bold', color: '#fbbf24' }}>
            {fmt(sales.reduce((acc, s) => acc + (s.t_men || 0), 0))}/mês
          </div>
          <div>MRR adicionado</div>
        </div>
      </div>

      {/* Tabela de metas por vendedor */}
      <h2>Metas dos Vendedores</h2>
      {users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
          Nenhum vendedor cadastrado ainda. Crie usuários com perfil 'user' na tabela profiles.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e2d4a' }}>
                <th style={{ textAlign: 'left', padding: 12 }}>Vendedor</th>
                <th style={{ textAlign: 'right', padding: 12 }}>Adesão (R$)</th>
                <th style={{ textAlign: 'right', padding: 12 }}>Meta</th>
                <th style={{ textAlign: 'right', padding: 12 }}>Mensalidade (R$)</th>
                <th style={{ textAlign: 'right', padding: 12 }}>Meta</th>
                <th style={{ textAlign: 'right', padding: 12 }}>Contratos</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => {
                const real = salesByUser[user.id] || { ad: 0, men: 0, count: 0 };
                const goal = getGoalForUser(user.id);
                const adPct = goal.ad_meta > 0 ? Math.min(100, (real.ad / goal.ad_meta) * 100) : 0;
                const menPct = goal.men_meta > 0 ? Math.min(100, (real.men / goal.men_meta) * 100) : 0;
                return (
                  <tr key={user.id} style={{ borderBottom: '1px solid #1e2d4a' }}>
                    <td style={{ padding: 12 }}>{user.name || user.id}</td>
                    <td style={{ textAlign: 'right', padding: 12 }}>{fmt(real.ad)}</td>
                    <td style={{ textAlign: 'right', padding: 12 }}>
                      {goal.ad_meta > 0 && (
                        <div style={{ background: '#1e2d4a', borderRadius: 4, marginTop: 4 }}>
                          <div style={{ width: `${adPct}%`, background: '#10b981', height: 4, borderRadius: 4 }}></div>
                        </div>
                      )}
                      {fmt(goal.ad_meta)}
                    </td>
                    <td style={{ textAlign: 'right', padding: 12 }}>{fmt(real.men)}</td>
                    <td style={{ textAlign: 'right', padding: 12 }}>
                      {goal.men_meta > 0 && (
                        <div style={{ background: '#1e2d4a', borderRadius: 4, marginTop: 4 }}>
                          <div style={{ width: `${menPct}%`, background: '#fbbf24', height: 4, borderRadius: 4 }}></div>
                        </div>
                      )}
                      {fmt(goal.men_meta)}
                    </td>
                    <td style={{ textAlign: 'right', padding: 12 }}>{real.count} / {goal.contracts_meta}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
