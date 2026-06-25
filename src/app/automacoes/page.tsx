'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { GitBranch, Plus, Play, Pause, Trash2, Calendar, ChevronRight, Loader2 } from 'lucide-react';

interface Automation {
  id: number;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadAutomations();
  }, []);

  const loadAutomations = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/automations');
      if (res.ok) {
        const data = await res.json();
        setAutomations(data);
      }
    } catch (err) {
      console.error('Erro ao carregar automações:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;
    setCreating(true);

    try {
      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      });

      if (res.ok) {
        const newAuto = await res.json();
        setNewName('');
        await loadAutomations();
        alert('Automação criada! Vamos abrir o editor visual.');
        window.location.href = `/automacoes/${newAuto.id}`;
      } else {
        alert('Erro ao criar automação.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (automation: Automation) => {
    const nextStatus = automation.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await fetch(`/api/automations/${automation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });

      if (res.ok) {
        loadAutomations();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Deseja excluir esta automação? Isso interromperá todos os contatos ativos nela.')) return;
    try {
      const res = await fetch(`/api/automations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadAutomations();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fade-in" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1>Automações de E-mail</h1>
          <p>Crie e gerencie réguas de contato automáticas com e-mails, atrasos e checagem de respostas.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '32px' }}>
        {/* Lista de Automações */}
        <div className="glass" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '20px' }}>Fluxos Cadastrados</h2>
          
          {loading ? (
            <p>Carregando fluxos...</p>
          ) : automations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
              <GitBranch size={32} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
              <p>Nenhuma automação criada ainda.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {automations.map((aut) => (
                <div key={aut.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 20px',
                  background: 'rgba(20, 26, 57, 0.3)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  transition: 'all 0.2s ease'
                }} className="glow-on-hover">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 700, fontSize: '1rem', color: 'white' }}>{aut.name}</span>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: aut.status === 'active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(107, 114, 128, 0.15)',
                        color: aut.status === 'active' ? 'var(--accent-green)' : 'var(--text-secondary)'
                      }}>
                        {aut.status === 'active' ? 'Ativo' : 'Pausado'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <Calendar size={12} />
                      <span>Atualizado em: {new Date(aut.updated_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => handleToggleStatus(aut)}
                      className="btn btn-secondary"
                      style={{ padding: '8px', color: aut.status === 'active' ? 'var(--accent-yellow)' : 'var(--accent-green)' }}
                      title={aut.status === 'active' ? 'Pausar Automação' : 'Ativar Automação'}
                    >
                      {aut.status === 'active' ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                    </button>
                    
                    <Link href={`/automacoes/${aut.id}`} className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.8rem', gap: '4px' }}>
                      <span>Editar</span>
                      <ChevronRight size={14} />
                    </Link>

                    <button
                      onClick={() => handleDelete(aut.id)}
                      className="btn btn-danger"
                      style={{ padding: '8px' }}
                      title="Excluir Automação"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Criar Nova Automação */}
        <div className="glass" style={{ padding: '24px', alignSelf: 'flex-start' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '20px' }}>Nova Automação</h2>
          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label className="form-label">Nome da Automação</label>
              <input
                type="text"
                className="form-input"
                placeholder="ex: Prospecção Dentistas Orlando"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
                Dê um nome claro para identificar a campanha no CRM (ex: por nicho e região).
              </span>
            </div>

            <button type="submit" disabled={creating} className="btn btn-primary glow-on-hover" style={{ width: '100%', justifyContent: 'center' }}>
              {creating ? (
                <>
                  <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Criando...</span>
                </>
              ) : (
                <>
                  <Plus size={16} />
                  <span>Criar Automação</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
