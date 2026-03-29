import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';

export default function SignPage() {
  const router = useRouter();
  const { token } = router.query;
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', cpf: '', email: '', agreed: false });
  const [error, setError] = useState('');
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    if (!token) return;
    async function loadDocument() {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('sign_token', token)
        .single();
      if (error || !data) {
        setError('Documento não encontrado ou link inválido.');
        setLoading(false);
        return;
      }
      setDocument(data);
      if (data.status === 'signed' || data.signed_at) {
        setSigned(true);
      }
      setLoading(false);
    }
    loadDocument();
  }, [token]);

  const handleSign = async (e) => {
    e.preventDefault();
    if (!form.name || !form.cpf || !form.email) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }
    if (!form.agreed) {
      setError('Você precisa concordar com os termos para assinar.');
      return;
    }
    setSaving(true);
    setError('');

    const now = new Date().toISOString();
    const updates = {
      signed_at: now,
      signed_by: form.name,
      sign_cpf: form.cpf,
      sign_email: form.email,
      status: document.consultant_signed_at ? 'signed' : 'pending',
    };
    const { error: updateError } = await supabase
      .from('documents')
      .update(updates)
      .eq('sign_token', token);
    if (updateError) {
      setError('Erro ao registrar assinatura. Tente novamente.');
      console.error(updateError);
    } else {
      setSigned(true);
    }
    setSaving(false);
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '50px' }}>Carregando documento...</div>;
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '50px', color: '#ef4444' }}>
        <h2>Erro</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (signed) {
    return (
      <div style={{ maxWidth: 600, margin: '50px auto', textAlign: 'center', background: '#fff', padding: 30, borderRadius: 12 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <h2>Documento já assinado</h2>
        <p>Obrigado, <strong>{document.signed_by}</strong>!<br />Sua assinatura foi registrada em {new Date(document.signed_at).toLocaleString('pt-BR')}.</p>
        <p style={{ fontSize: 12, color: '#64748b' }}>Este documento agora tem validade jurídica conforme Lei nº 14.063/2020.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: 20 }}>
      <h1 style={{ textAlign: 'center', marginBottom: 20 }}>Assinatura Eletrônica</h1>
      <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 16, marginBottom: 20, maxHeight: '50vh', overflowY: 'auto' }}>
        <div dangerouslySetInnerHTML={{ __html: document.html }} />
      </div>

      <form onSubmit={handleSign} style={{ background: '#f8fafc', padding: 24, borderRadius: 12 }}>
        <h3 style={{ marginBottom: 16 }}>Dados do Signatário</h3>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Nome Completo *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ccc' }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>CPF *</label>
          <input
            type="text"
            value={form.cpf}
            onChange={(e) => setForm({ ...form, cpf: e.target.value })}
            placeholder="000.000.000-00"
            style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ccc' }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>E-mail *</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ccc' }}
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={form.agreed}
              onChange={(e) => setForm({ ...form, agreed: e.target.checked })}
            />
            <span>Declaro que li e concordo com os termos deste documento e autorizo o uso dos meus dados para fins de assinatura eletrônica.</span>
          </label>
        </div>
        {error && <div style={{ color: '#ef4444', marginBottom: 12 }}>{error}</div>}
        <button
          type="submit"
          disabled={saving}
          style={{
            width: '100%',
            padding: 12,
            background: '#10b981',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          {saving ? 'Processando...' : 'Assinar Documento'}
        </button>
      </form>
    </div>
  );
}
