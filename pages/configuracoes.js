// pages/configuracoes.js
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase'; // Importa o Supabase
import {
    fetchDocuments,
    getDocumentDownloadUrl,
    resendAllSignatureLinks,
    fetchPendingSignaturesDocuments,
    resendSingleSignatureLink,
    formatDateTime
} from '../lib/documentService'; // Importa as novas funções

// Componente para o Histórico de Documentos
function DocumentHistory({ userId }) {
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function loadHistory() {
            try {
                setLoading(true);
                const data = await fetchDocuments(userId);
                setDocuments(data);
            } catch (err) {
                setError(err.message);
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        if (userId) {
            loadHistory();
        }
    }, [userId]);

    const handleViewDocument = async (documentId) => {
        try {
            const url = await getDocumentDownloadUrl(documentId);
            window.open(url, '_blank');
        } catch (err) {
            alert(err.message);
        }
    };

    const handleResendSignature = async (documentId) => {
        if (!confirm('Tem certeza que deseja reenviar os links de assinatura para este documento?')) {
            return;
        }
        try {
            await resendAllSignatureLinks(documentId);
            alert('Links de assinatura reenviados com sucesso!');
            // Opcional: recarregar o histórico para atualizar o status visualmente
            const data = await fetchDocuments(userId);
            setDocuments(data);
        } catch (err) {
            alert(err.message);
        }
    };

    if (loading) return <p>Carregando histórico de documentos...</p>;
    if (error) return <p>Erro: {error}</p>;
    if (documents.length === 0) return <p>Nenhum documento encontrado.</p>;

    return (
        <div className="document-history-list">
            <div className="document-history-header">
                <span>Título</span>
                <span>Tipo</span>
                <span>Status</span>
                <span>Data Criação</span>
                <span>Ações</span>
            </div>
            {documents.map(doc => (
                <div key={doc.id} className="document-history-item">
                    <span>{doc.title || 'Sem Título'}</span>
                    <span>{doc.type || 'N/A'}</span>
                    <span>{doc.status || 'N/A'}</span>
                    <span>{formatDateTime(doc.created_at)}</span>
                    <div className="document-actions">
                        <button onClick={() => handleViewDocument(doc.id)} disabled={!doc.file_path}>Ver</button>
                        <button onClick={() => handleResendSignature(doc.id)} disabled={doc.status !== 'PENDING_SIGNATURE'}>Reenviar Assinatura</button>
                    </div>
                </div>
            ))}
        </div>
    );
}

// Componente para o Acompanhamento de Assinaturas
function SignatureTracking({ userId }) {
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const router = useRouter();

    useEffect(() => {
        async function loadPending() {
            try {
                setLoading(true);
                const data = await fetchPendingSignaturesDocuments(userId);
                setDocuments(data);
            } catch (err) {
                setError(err.message);
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        if (userId) {
            loadPending();
        }
    }, [userId]);

    const handleResendClientLink = async (signatureId, signerEmail, signerName) => {
        if (!confirm(`Tem certeza que deseja reenviar o link de assinatura para ${signerName} (${signerEmail})?`)) {
            return;
        }
        try {
            await resendSingleSignatureLink(signatureId, signerEmail, signerName);
            alert(`Link de assinatura reenviado para ${signerName} (${signerEmail}) com sucesso!`);
        } catch (err) {
            alert(err.message);
        }
    };

    const handleSignNow = (signatureId) => {
        router.push(`/sign/${signatureId}`); // Redireciona para a página de assinatura
    };

    const handleViewSignedDocument = async (documentId) => {
        try {
            const url = await getDocumentDownloadUrl(documentId);
            window.open(url, '_blank');
        } catch (err) {
            alert(err.message);
        }
    };

    if (loading) return <p>Carregando acompanhamento de assinaturas...</p>;
    if (error) return <p>Erro: {error}</p>;
    if (documents.length === 0) return <p>Nenhum documento aguardando assinatura.</p>;

    return (
        <div className="pending-signatures-list">
            {documents.map(doc => {
                const contratada = doc.signatures.find(s => s.signer_type === 'USER');
                const contratante = doc.signatures.find(s => s.signer_type === 'CLIENT');
                const allSigned = doc.signatures.every(s => s.status === 'SIGNED');

                return (
                    <div key={doc.id} className="signature-tracking-item">
                        <h4>{doc.title} <span className={`status-badge ${allSigned ? 'signed' : 'pending'}`}>{allSigned ? 'Totalmente Assinado' : 'Aguardando Assinatura'}</span></h4>
                        <p>Criado em: {formatDateTime(doc.created_at)}</p>
                        <div className="signature-parties">
                            <div className="party contratada">
                                <h5>CONTRATADA (Usuário)</h5>
                                <p>{contratada?.signer_name || 'N/A'}</p>
                                <p>Status: <span className={contratada?.status === 'SIGNED' ? 'signed' : 'pending'}>{contratada?.status || 'PENDING'}</span></p>
                                {contratada?.signed_at && <p>Assinado em: {formatDateTime(contratada.signed_at)}</p>}
                                {contratada?.status === 'PENDING' && <button onClick={() => handleSignNow(contratada.id)}>Assinar Agora</button>}
                            </div>
                            <div className="party contratante">
                                <h5>CONTRATANTE (Cliente)</h5>
                                <p>{contratante?.signer_name || 'N/A'}</p>
                                <p>CPF: {contratante?.signer_cpf || 'N/A'}</p>
                                <p>Status: <span className={contratante?.status === 'SIGNED' ? 'signed' : 'pending'}>{contratante?.status || 'PENDING'}</span></p>
                                {contratante?.signed_at && <p>Assinado em: {formatDateTime(contratante.signed_at)}</p>}
                                {contratante?.status === 'PENDING' && <button onClick={() => handleResendClientLink(contratante.id, contratante.signer_email, contratante.signer_name)}>Reenviar Link</button>}
                            </div>
                        </div>
                        {allSigned && <p className="document-signed-message">Contrato completamente assinado por ambas as partes.</p>}
                        {allSigned && <button onClick={() => handleViewSignedDocument(doc.id)}>Ver Documento Assinado</button>}
                    </div>
                );
            })}
        </div>
    );
}

// Componente principal da página de Configurações
export default function Configuracoes() {
    const [activeTab, setActiveTab] = useState('empresa'); // Estado para controlar a aba ativa
    const [user, setUser] = useState(null); // Estado para o usuário logado
    const router = useRouter();

    useEffect(() => {
        async function getUser() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/'); // Redireciona para o login se não houver usuário
            } else {
                setUser(user);
            }
        }
        getUser();
    }, [router]);

    if (!user) return <p>Carregando usuário...</p>;

    return (
        <div className="configuracoes-container">
            {/* Menu de navegação das configurações */}
            <aside className="config-sidebar">
                <ul>
                    <li onClick={() => setActiveTab('empresa')} className={activeTab === 'empresa' ? 'active' : ''}>🏢 Empresa</li>
                    <li onClick={() => setActiveTab('metas')} className={activeTab === 'metas' ? 'active' : ''}>🎯 Metas</li>
                    <li onClick={() => setActiveTab('kpis')} className={activeTab === 'kpis' ? 'active' : ''}>📊 KPIs</li>
                    <li onClick={() => setActiveTab('usuarios')} className={activeTab === 'usuarios' ? 'active' : ''}>👥 Usuários</li>
                    <li onClick={() => setActiveTab('produtos')} className={activeTab === 'produtos' ? 'active' : ''}>📦 Produtos</li>
                    <li onClick={() => setActiveTab('descontos')} className={activeTab === 'descontos' ? 'active' : ''}>🏷️ Descontos</li>
                    <li onClick={() => setActiveTab('vouchers')} className={activeTab === 'vouchers' ? 'active' : ''}>🎫 Vouchers</li>
                    <li onClick={() => setActiveTab('documentos')} className={activeTab === 'documentos' ? 'active' : ''}>📄 Documentos</li>
                    <li onClick={() => setActiveTab('historico')} className={activeTab === 'historico' ? 'active' : ''}>🗂️ Histórico</li> {/* Nova aba */}
                    <li onClick={() => setActiveTab('assinaturas')} className={activeTab === 'assinaturas' ? 'active' : ''}>✍️ Assinaturas</li> {/* Nova aba */}
                    <li onClick={() => setActiveTab('clientes')} className={activeTab === 'clientes' ? 'active' : ''}>🗃️ Clientes</li>
                    <li onClick={() => setActiveTab('tema')} className={activeTab === 'tema' ? 'active' : ''}>🎨 Tema</li>
                </ul>
            </aside>

            {/* Conteúdo principal das configurações */}
            <main className="config-content">
                {activeTab === 'empresa' && (
                    <div>
                        <h3>🏢 Empresa</h3>
                        {/* Conteúdo da aba Empresa */}
                    </div>
                )}
                {activeTab === 'metas' && (
                    <div>
                        <h3>🎯 Metas</h3>
                        {/* Conteúdo da aba Metas */}
                    </div>
                )}
                {activeTab === 'kpis' && (
                    <div>
                        <h3>📊 KPIs</h3>
                        {/* Conteúdo da aba KPIs */}
                    </div>
                )}
                {activeTab === 'usuarios' && (
                    <div>
                        <h3>👥 Usuários</h3>
                        {/* Conteúdo da aba Usuários */}
                    </div>
                )}
                {activeTab === 'produtos' && (
                    <div>
                        <h3>📦 Produtos</h3>
                        {/* Conteúdo da aba Produtos */}
                    </div>
                )}
                {activeTab === 'descontos' && (
                    <div>
                        <h3>🏷️ Descontos</h3>
                        {/* Conteúdo da aba Descontos */}
                    </div>
                )}
                {activeTab === 'vouchers' && (
                    <div>
                        <h3>🎫 Vouchers</h3>
                        {/* Conteúdo da aba Vouchers */}
                    </div>
                )}
                {activeTab === 'documentos' && (
                    <div>
                        <h3>📄 Documentos</h3>
                        {/* Conteúdo da aba Documentos */}
                    </div>
                )}
                {activeTab === 'historico' && (
                    <div>
                        <h3>🗂️ Histórico de Documentos</h3>
                        <DocumentHistory userId={user.id} />
                    </div>
                )}
                {activeTab === 'assinaturas' && (
                    <div>
                        <h3>✍️ Acompanhamento de Assinaturas</h3>
                        <SignatureTracking userId={user.id} />
                    </div>
                )}
                {activeTab === 'clientes' && (
                    <div>
                        <h3>🗃️ Clientes</h3>
                        {/* Conteúdo da aba Clientes */}
                    </div>
                )}
                {activeTab === 'tema' && (
                    <div>
                        <h3>🎨 Tema</h3>
                        {/* Conteúdo da aba Tema */}
                    </div>
                )}
            </main>
        </div>
    );
}
