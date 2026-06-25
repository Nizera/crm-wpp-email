'use client';

import { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Filter, 
  Edit2, 
  Trash2, 
  Mail, 
  Clock, 
  AlertCircle, 
  Check, 
  X,
  FileText,
  Phone,
  MapPin,
  Tag,
  MessageSquare,
  Send
} from 'lucide-react';

interface Contact {
  id: number;
  name: string;
  email: string;
  phone: string;
  website: string;
  niche: string;
  city: string;
  state: string;
  status: string;
  tags: string;
  notes: string;
  created_at: string;
  whatsapp_agent_active?: number;
  whatsapp_status?: string;
}

interface EmailLog {
  id: number;
  email_type: string;
  subject: string;
  body: string;
  status: string;
  sent_at: string;
  replied_at: string | null;
  reply_body: string | null;
}

export default function ContatosPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterNiche, setFilterNiche] = useState('');

  // Modals state
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [historyLogs, setHistoryLogs] = useState<EmailLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Edit/Add Form states
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formNiche, setFormNiche] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formState, setFormState] = useState('');
  const [formStatus, setFormStatus] = useState('Novo');
  const [formTags, setFormTags] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // WhatsApp Integration states
  const [activeTab, setActiveTab] = useState<'email' | 'whatsapp'>('email');
  const [whatsappMessages, setWhatsappMessages] = useState<any[]>([]);
  const [loadingWaMessages, setLoadingWaMessages] = useState(false);
  const [waMessageInput, setWaMessageInput] = useState('');
  const [sendingWaMessage, setSendingWaMessage] = useState(false);
  const [isAgentActive, setIsAgentActive] = useState(false);
  const [verifyingWaStatus, setVerifyingWaStatus] = useState(false);

  useEffect(() => {
    loadContacts();
  }, [search, filterStatus, filterNiche]);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        search,
        status: filterStatus,
        niche: filterNiche
      });
      const res = await fetch(`/api/contacts?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setContacts(data);
      }
    } catch (err) {
      console.error('Erro ao buscar contatos:', err);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = async (contact: Contact) => {
    setSelectedContact(contact);
    setFormName(contact.name);
    setFormEmail(contact.email);
    setFormPhone(contact.phone);
    setFormNiche(contact.niche);
    setFormCity(contact.city);
    setFormState(contact.state);
    setFormStatus(contact.status);
    setFormTags(contact.tags);
    setFormNotes(contact.notes || '');
    setIsAgentActive(contact.whatsapp_agent_active === 1);
    setActiveTab('email');

    // Fetch history (Emails)
    setLoadingHistory(true);
    setHistoryLogs([]);
    try {
      const res = await fetch(`/api/contacts/${contact.id}/history`);
      if (res.ok) {
        const data = await res.json();
        setHistoryLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Erro ao buscar histórico:', err);
    } finally {
      setLoadingHistory(false);
    }

    // Fetch WhatsApp messages
    setLoadingWaMessages(true);
    setWhatsappMessages([]);
    try {
      const res = await fetch(`/api/whatsapp/messages?contactId=${contact.id}`);
      if (res.ok) {
        const data = await res.json();
        setWhatsappMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Erro ao buscar mensagens do WhatsApp:', err);
    } finally {
      setLoadingWaMessages(false);
    }
  };

  const refreshWaMessages = async (contactId: number) => {
    setLoadingWaMessages(true);
    try {
      const res = await fetch(`/api/whatsapp/messages?contactId=${contactId}`);
      if (res.ok) {
        const data = await res.json();
        setWhatsappMessages(data.messages || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingWaMessages(false);
    }
  };

  const verifyWhatsappNumber = async (contactId: number) => {
    setVerifyingWaStatus(true);
    try {
      const res = await fetch(`/api/whatsapp/check-number?contactId=${contactId}`);
      if (res.ok) {
        const data = await res.json();
        // Update selectedContact status
        if (selectedContact && selectedContact.id === contactId) {
          setSelectedContact({
            ...selectedContact,
            whatsapp_status: data.whatsapp_status
          });
        }
        // Update contacts list status
        setContacts(prev => prev.map(c => c.id === contactId ? { ...c, whatsapp_status: data.whatsapp_status } : c));
      } else {
        alert('Erro ao verificar número do WhatsApp.');
      }
    } catch (err) {
      console.error('Erro ao verificar WhatsApp:', err);
      alert('Erro de rede ao verificar WhatsApp.');
    } finally {
      setVerifyingWaStatus(false);
    }
  };

  const toggleAiAgent = async () => {
    if (!selectedContact) return;
    const nextState = !isAgentActive;
    setIsAgentActive(nextState);
    try {
      const res = await fetch('/api/whatsapp/toggle-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: selectedContact.id,
          active: nextState
        })
      });
      if (res.ok) {
        // Update local list
        setContacts(prev => prev.map(c => c.id === selectedContact.id ? { ...c, whatsapp_agent_active: nextState ? 1 : 0 } : c));
      } else {
        setIsAgentActive(!nextState);
        alert('Erro ao alterar agente de IA.');
      }
    } catch (err) {
      setIsAgentActive(!nextState);
      alert('Erro ao conectar com o servidor.');
    }
  };

  const handleSendWaMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContact || !waMessageInput.trim()) return;

    setSendingWaMessage(true);
    const text = waMessageInput;
    setWaMessageInput('');

    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: selectedContact.id,
          text: text
        })
      });
      if (res.ok) {
        refreshWaMessages(selectedContact.id);
      } else {
        alert('Erro ao enviar mensagem de WhatsApp.');
        setWaMessageInput(text);
      }
    } catch (err) {
      alert('Erro de rede.');
      setWaMessageInput(text);
    } finally {
      setSendingWaMessage(false);
    }
  };

  const getWaStatusColor = (status: string) => {
    switch (status) {
      case 'Válido': return 'var(--accent-green)';
      case 'Sem WhatsApp': return 'var(--accent-red)';
      default: return 'var(--accent-yellow)';
    }
  };

  const handleUpdateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContact) return;

    try {
      const res = await fetch(`/api/contacts/${selectedContact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          email: formEmail,
          phone: formPhone,
          niche: formNiche,
          city: formCity,
          state: formState,
          status: formStatus,
          tags: formTags,
          notes: formNotes
        })
      });

      if (res.ok) {
        alert('Contato atualizado com sucesso!');
        setSelectedContact(null);
        loadContacts();
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao atualizar contato.');
      }
    } catch (err: any) {
      alert(err.message || 'Erro de rede.');
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName) return;

    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          email: formEmail,
          phone: formPhone,
          website: '',
          niche: formNiche,
          city: formCity,
          state: formState,
          status: formStatus,
          tags: formTags,
          notes: formNotes
        })
      });

      if (res.ok) {
        alert('Contato cadastrado com sucesso!');
        setIsAddModalOpen(false);
        resetForm();
        loadContacts();
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao cadastrar contato.');
      }
    } catch (err: any) {
      alert(err.message || 'Erro de rede.');
    }
  };

  const handleDeleteContact = async (id: number) => {
    if (!confirm('Deseja realmente excluir este contato? Isso apagará também todo o histórico de e-mails.')) return;
    
    try {
      const res = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        alert('Contato excluído.');
        if (selectedContact?.id === id) setSelectedContact(null);
        loadContacts();
      } else {
        alert('Erro ao excluir contato.');
      }
    } catch (err: any) {
      alert(err.message || 'Erro de rede.');
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormNiche('');
    setFormCity('');
    setFormState('');
    setFormStatus('Novo');
    setFormTags('');
    setFormNotes('');
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'novo': return 'badge-new';
      case 'enviado': return 'badge-sent';
      case 'reenviado': return 'badge-resent';
      case 'respondido': return 'badge-replied';
      case 'sem interesse': return 'badge-uninterested';
      case 'convertido': return 'badge-converted';
      default: return 'badge-new';
    }
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1>Contatos (CRM)</h1>
          <p>Gerencie seus leads prospectados, monitore respostas e edite informações comerciais.</p>
        </div>
        <button onClick={() => { resetForm(); setIsAddModalOpen(true); }} className="btn btn-primary glow-on-hover">
          <Plus size={16} />
          <span>Cadastrar Contato</span>
        </button>
      </div>

      {/* Barra de Filtros */}
      <div className="glass" style={{ padding: '16px 24px', display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '240px' }}>
          <Search size={16} style={{ color: 'var(--text-secondary)' }} />
          <input
            type="text"
            className="form-input"
            style={{ padding: '8px 12px' }}
            placeholder="Pesquisar por nome, e-mail ou notas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={16} style={{ color: 'var(--text-secondary)' }} />
          <select
            className="form-select"
            style={{ padding: '8px 12px', width: '160px' }}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Todos Status</option>
            <option value="Novo">Novo</option>
            <option value="Enviado">Enviado</option>
            <option value="Reenviado">Reenviado</option>
            <option value="Respondido">Respondido</option>
            <option value="Sem Interesse">Sem Interesse</option>
            <option value="Convertido">Convertido</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            className="form-select"
            style={{ padding: '8px 12px', width: '180px' }}
            value={filterNiche}
            onChange={(e) => setFilterNiche(e.target.value)}
          >
            <option value="">Todos os Nichos</option>
            <option value="dentist">Dentistas</option>
            <option value="plumber">Encanadores</option>
            <option value="restaurant">Restaurantes</option>
            <option value="beauty">Salões de Beleza</option>
            <option value="car_repair">Mecânicas</option>
            <option value="gym">Academias</option>
            <option value="lawyer">Advogados</option>
            <option value="hotel">Hotéis</option>
            <option value="bakery">Padarias</option>
            <option value="painter">Pintores</option>
            <option value="electrician">Eletricistas</option>
            <option value="builder">Construtoras</option>
          </select>
        </div>
      </div>

      {/* Tabela de Contatos */}
      {loading && contacts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <p>Carregando contatos...</p>
        </div>
      ) : contacts.length === 0 ? (
        <div className="glass" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
          <Users size={36} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
          <p>Nenhum contato encontrado no CRM.</p>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Comece buscando leads na aba de Prospecção ou cadastre um manualmente.</span>
        </div>
      ) : (
        <div className="table-container fade-in">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Nome / Empresa</th>
                <th>Nicho</th>
                <th>E-mail</th>
                <th>Cidade / UF</th>
                <th>Status</th>
                <th>Agente IA</th>
                <th>Tags</th>
                <th style={{ width: '120px', textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr key={contact.id}>
                  <td style={{ fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{contact.name}</span>
                      {contact.phone && (
                        <span 
                          title={`WhatsApp: ${contact.whatsapp_status || 'Não Verificado'}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            background: contact.whatsapp_status === 'Válido' 
                              ? 'rgba(16, 185, 129, 0.15)' 
                              : contact.whatsapp_status === 'Sem WhatsApp' 
                                ? 'rgba(239, 68, 68, 0.15)' 
                                : 'rgba(245, 158, 11, 0.15)',
                            color: contact.whatsapp_status === 'Válido' 
                              ? 'var(--accent-green)' 
                              : contact.whatsapp_status === 'Sem WhatsApp' 
                                ? 'var(--accent-red)' 
                                : 'var(--accent-yellow)',
                          }}
                        >
                          <Phone size={9} />
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ textTransform: 'capitalize', fontSize: '0.85rem' }}>{contact.niche}</td>
                  <td>{contact.email || <span style={{ color: 'var(--text-muted)' }}>Sem e-mail</span>}</td>
                  <td style={{ fontSize: '0.85rem' }}>
                    {contact.city}{contact.state ? `, ${contact.state}` : ''}
                  </td>
                  <td>
                    <span className={`badge ${getStatusBadgeClass(contact.status)}`}>
                      {contact.status}
                    </span>
                  </td>
                  <td>
                    {contact.whatsapp_agent_active === 1 ? (
                      <span style={{
                        display: 'inline-block',
                        fontSize: '0.7rem',
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        color: 'var(--accent-green)',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        fontWeight: 600
                      }}>
                        IA Ativa
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Desativado</span>
                    )}
                  </td>
                  <td>
                    {contact.tags ? (
                      contact.tags.split(',').map((tag, idx) => (
                        <span key={idx} style={{
                          display: 'inline-block',
                          fontSize: '0.7rem',
                          background: 'rgba(99, 102, 241, 0.1)',
                          border: '1px solid rgba(99, 102, 241, 0.2)',
                          color: 'var(--accent-primary)',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          marginRight: '4px',
                          fontWeight: 600
                        }}>
                          {tag.trim()}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>-</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button 
                        onClick={() => openEditModal(contact)}
                        className="btn btn-secondary glow-on-hover"
                        style={{ padding: '6px 8px' }}
                        title="Ver Detalhes e Histórico"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button 
                        onClick={() => handleDeleteContact(contact.id)}
                        className="btn btn-danger"
                        style={{ padding: '6px 8px' }}
                        title="Excluir Contato"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL: VER / EDITAR CONTATO E HISTÓRICO */}
      {selectedContact && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          padding: '20px',
          backdropFilter: 'blur(4px)'
        }}>
          <div className="glass fade-in" style={{
            width: '1100px',
            maxWidth: '100%',
            height: '80vh',
            maxHeight: '900px',
            display: 'grid',
            gridTemplateColumns: '1.1fr 1.2fr',
            overflow: 'hidden',
            borderRadius: '12px'
          }}>
            {/* Esquerda: Formulário de Dados */}
            <form onSubmit={handleUpdateContact} style={{ padding: '28px', borderRight: '1px solid var(--border-color)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Editar Lead</h2>
                <button type="button" onClick={() => setSelectedContact(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  <X size={20} />
                </button>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Nome da Empresa</label>
                <input type="text" className="form-input" value={formName} onChange={e => setFormName(e.target.value)} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">E-mail</label>
                  <input type="email" className="form-input" value={formEmail} onChange={e => setFormEmail(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label">Telefone</label>
                    {selectedContact && (
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: selectedContact.whatsapp_status === 'Válido'
                          ? 'var(--accent-green)'
                          : selectedContact.whatsapp_status === 'Sem WhatsApp'
                            ? 'var(--accent-red)'
                            : 'var(--accent-yellow)'
                      }}>
                        {selectedContact.whatsapp_status === 'Válido' 
                          ? '🟢 Válido' 
                          : selectedContact.whatsapp_status === 'Sem WhatsApp' 
                            ? '🔴 Sem WhatsApp' 
                            : '🟡 Não Verificado'}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="text" className="form-input" value={formPhone} onChange={e => setFormPhone(e.target.value)} style={{ flex: 1 }} />
                    {selectedContact && formPhone && (
                      <button
                        type="button"
                        disabled={verifyingWaStatus}
                        onClick={() => verifyWhatsappNumber(selectedContact.id)}
                        style={{
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-primary)',
                          borderRadius: '6px',
                          padding: '0 12px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {verifyingWaStatus ? 'Checando...' : 'Checar'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Nicho</label>
                  <input type="text" className="form-input" value={formNiche} onChange={e => setFormNiche(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Cidade</label>
                  <input type="text" className="form-input" value={formCity} onChange={e => setFormCity(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Estado (UF)</label>
                  <input type="text" className="form-input" value={formState} onChange={e => setFormState(e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Status no CRM</label>
                  <select className="form-select" value={formStatus} onChange={e => setFormStatus(e.target.value)}>
                    <option value="Novo">Novo</option>
                    <option value="Enviado">Enviado</option>
                    <option value="Reenviado">Reenviado</option>
                    <option value="Respondido">Respondido</option>
                    <option value="Sem Interesse">Sem Interesse</option>
                    <option value="Convertido">Convertido</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Tags (separadas por vírgula)</label>
                  <input type="text" className="form-input" value={formTags} onChange={e => setFormTags(e.target.value)} placeholder="ex: Lead, Hot" />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <label className="form-label">Notas e Anotações</label>
                <textarea className="form-textarea" style={{ flex: 1, minHeight: '100px', resize: 'none' }} value={formNotes} onChange={e => setFormNotes(e.target.value)} />
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" onClick={() => setSelectedContact(null)} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1.5, justifyContent: 'center' }}>Salvar Alterações</button>
                </div>
              </div>
            </form>

            {/* Direita: Histórico de E-mails / WhatsApp Chat */}
            <div style={{ background: 'rgba(7, 9, 19, 0.4)', display: 'flex', flexDirection: 'column', height: '100%' }}>
              
              {/* Tab Selector */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'rgba(20, 26, 57, 0.2)' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('email')}
                  style={{
                    flex: 1,
                    padding: '16px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: activeTab === 'email' ? '2px solid var(--accent-secondary)' : '2px solid transparent',
                    color: activeTab === 'email' ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontSize: '0.9rem',
                    transition: 'all 0.2s'
                  }}
                >
                  <Mail size={16} />
                  <span>Histórico de E-mails</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('whatsapp')}
                  style={{
                    flex: 1,
                    padding: '16px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: activeTab === 'whatsapp' ? '2px solid var(--accent-green)' : '2px solid transparent',
                    color: activeTab === 'whatsapp' ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontSize: '0.9rem',
                    transition: 'all 0.2s'
                  }}
                >
                  <MessageSquare size={16} />
                  <span>WhatsApp Chat</span>
                </button>
              </div>

              {/* Tab Content */}
              <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
                
                {activeTab === 'email' ? (
                  <>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.15rem', margin: '0 0 20px 0' }}>
                      <Clock size={16} style={{ color: 'var(--accent-secondary)' }} />
                      <span>E-mails Enviados / Recebidos</span>
                    </h2>

                    {loadingHistory ? (
                      <p style={{ color: 'var(--text-secondary)' }}>Carregando histórico...</p>
                    ) : historyLogs.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                        <Mail size={32} style={{ color: 'var(--text-muted)' }} />
                        <p>Nenhum e-mail registrado para este contato.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {historyLogs.map((log) => (
                          <div key={log.id} style={{
                            background: '#0B0E1B',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '16px',
                            fontSize: '0.85rem'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                              <div>
                                <span className={`badge ${log.email_type === 'inbound' ? 'badge-replied' : 'badge-sent'}`} style={{ marginRight: '8px' }}>
                                  {log.email_type === 'inbound' ? 'Recebido' : 'Enviado'}
                                </span>
                                <span style={{ fontWeight: 600 }}>{log.subject}</span>
                              </div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                {new Date(log.sent_at).toLocaleString('pt-BR')}
                              </span>
                            </div>
                            <div style={{ 
                              whiteSpace: 'pre-wrap', 
                              color: 'var(--text-secondary)', 
                              padding: '10px', 
                              background: 'rgba(20, 26, 57, 0.4)', 
                              borderRadius: '6px',
                              fontFamily: 'monospace',
                              fontSize: '0.8rem',
                              maxHeight: '150px',
                              overflowY: 'auto'
                            }}>
                              {log.body}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  // WHATSAPP CHAT
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    
                    {/* Botão liga/desliga Robô de IA */}
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      background: 'rgba(99, 102, 241, 0.05)', 
                      padding: '12px 16px', 
                      borderRadius: '8px', 
                      border: '1px solid var(--border-color)',
                      marginBottom: '16px'
                    }}>
                      <div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Agente de IA Comercial</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                          Qualifica e agenda reuniões automaticamente.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={toggleAiAgent}
                        style={{
                          background: isAgentActive ? 'var(--accent-green)' : 'rgba(255, 255, 255, 0.1)',
                          color: isAgentActive ? '#070913' : 'var(--text-secondary)',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '20px',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          boxShadow: isAgentActive ? '0 0 10px rgba(16, 185, 129, 0.3)' : 'none'
                        }}
                      >
                        {isAgentActive ? 'ATIVO' : 'INATIVO'}
                      </button>
                    </div>

                    {/* Chat Messages Panel */}
                    <div style={{ 
                      flex: 1, 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '12px', 
                      overflowY: 'auto', 
                      paddingRight: '4px',
                      marginBottom: '16px',
                      minHeight: '200px'
                    }}>
                      {loadingWaMessages ? (
                        <p style={{ color: 'var(--text-secondary)' }}>Carregando mensagens...</p>
                      ) : whatsappMessages.length === 0 ? (
                        <div style={{ 
                          textAlign: 'center', 
                          padding: '40px 10px', 
                          color: 'var(--text-muted)', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          alignItems: 'center', 
                          gap: '10px',
                          marginTop: 'auto',
                          marginBottom: 'auto'
                        }}>
                          <MessageSquare size={32} />
                          <p style={{ fontSize: '0.85rem' }}>Nenhuma mensagem enviada ou recebida via WhatsApp.</p>
                          <span style={{ fontSize: '0.75rem' }}>Envie uma mensagem abaixo para iniciar o chat.</span>
                        </div>
                      ) : (
                        whatsappMessages.map((m) => {
                          const isOut = m.direction === 'outbound';
                          return (
                            <div 
                              key={m.id} 
                              style={{ 
                                display: 'flex', 
                                flexDirection: 'column',
                                alignSelf: isOut ? 'flex-end' : 'flex-start',
                                maxWidth: '80%'
                              }}
                            >
                              <div style={{
                                padding: '10px 14px',
                                borderRadius: isOut ? '12px 12px 0 12px' : '12px 12px 12px 0',
                                background: isOut ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                                border: isOut ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid var(--border-color)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                boxShadow: isOut ? '0 2px 8px rgba(16, 185, 129, 0.05)' : 'none'
                              }}>
                                {m.body}
                              </div>
                              <span style={{ 
                                fontSize: '0.65rem', 
                                color: 'var(--text-muted)', 
                                marginTop: '4px',
                                alignSelf: isOut ? 'flex-end' : 'flex-start' 
                              }}>
                                {new Date(m.sent_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Chat Input */}
                    <form onSubmit={handleSendWaMessage} style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder={formPhone ? "Digite a mensagem para o WhatsApp..." : "Sem número de telefone cadastrado"}
                        value={waMessageInput}
                        onChange={(e) => setWaMessageInput(e.target.value)}
                        disabled={!formPhone || sendingWaMessage}
                        style={{ flex: 1, padding: '10px 14px' }}
                      />
                      <button
                        type="button"
                        onClick={() => refreshWaMessages(selectedContact.id)}
                        className="btn btn-secondary"
                        style={{ padding: '10px' }}
                        title="Atualizar mensagens"
                      >
                        <Clock size={16} />
                      </button>
                      <button
                        type="submit"
                        disabled={!formPhone || !waMessageInput.trim() || sendingWaMessage}
                        className="btn btn-primary glow-on-hover"
                        style={{ padding: '10px 16px' }}
                      >
                        <Send size={15} />
                      </button>
                    </form>

                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CADASTRAR CONTATO MANUALLY */}
      {isAddModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          padding: '20px',
          backdropFilter: 'blur(4px)'
        }}>
          <form onSubmit={handleAddContact} className="glass fade-in" style={{
            width: '600px',
            maxWidth: '100%',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Cadastrar Novo Contato</h2>
              <button type="button" onClick={() => setIsAddModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={20} />
              </button>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Nome da Empresa / Contato *</label>
              <input type="text" className="form-input" value={formName} onChange={e => setFormName(e.target.value)} required />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">E-mail</label>
                <input type="email" className="form-input" value={formEmail} onChange={e => setFormEmail(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Telefone</label>
                <input type="text" className="form-input" value={formPhone} onChange={e => setFormPhone(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Nicho</label>
                <select className="form-select" value={formNiche} onChange={e => setFormNiche(e.target.value)}>
                  <option value="">Selecione...</option>
                  <option value="dentist">Dentista</option>
                  <option value="plumber">Encanador</option>
                  <option value="restaurant">Restaurante</option>
                  <option value="beauty">Salão de Beleza</option>
                  <option value="car_repair">Mecânica</option>
                  <option value="gym">Academia</option>
                  <option value="lawyer">Advogado</option>
                  <option value="hotel">Hotel</option>
                  <option value="bakery">Padaria</option>
                  <option value="painter">Pintor</option>
                  <option value="electrician">Eletricista</option>
                  <option value="builder">Construtora</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Cidade</label>
                <input type="text" className="form-input" value={formCity} onChange={e => setFormCity(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Estado (UF)</label>
                <input type="text" className="form-input" value={formState} onChange={e => setFormState(e.target.value)} placeholder="ex: FL" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Status Inicial</label>
                <select className="form-select" value={formStatus} onChange={e => setFormStatus(e.target.value)}>
                  <option value="Novo">Novo</option>
                  <option value="Enviado">Enviado</option>
                  <option value="Respondido">Respondido</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Tags</label>
                <input type="text" className="form-input" value={formTags} onChange={e => setFormTags(e.target.value)} placeholder="ex: Manual, VIP" />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Notas / Anotações</label>
              <textarea className="form-textarea" rows={3} value={formNotes} onChange={e => setFormNotes(e.target.value)} />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
              <button type="button" onClick={() => setIsAddModalOpen(false)} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancelar</button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1.5, justifyContent: 'center' }}>Cadastrar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
