'use client';

import { useState, useEffect } from 'react';
import { FileText, Plus, Save, Trash2, Mail, Info, Check } from 'lucide-react';

interface Template {
  id: number;
  name: string;
  subject: string;
  body: string;
  created_at: string;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  
  // Variables for preview simulation
  const mockContact = {
    name: 'Sparky Plumbing Services',
    niche: 'Plumber',
    city: 'Orlando',
    state: 'FL'
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
        if (data.length > 0 && !selectedTemplate) {
          selectTemplate(data[0]);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectTemplate = (tpl: Template) => {
    setSelectedTemplate(tpl);
    setName(tpl.name);
    setSubject(tpl.subject);
    setBody(tpl.body);
    setIsEditing(false);
  };

  const handleNew = () => {
    setSelectedTemplate(null);
    setName('Novo Modelo de Prospecção');
    setSubject('Website proposal for {{business_name}}');
    setBody(`Hi {{business_name}} Team,

I was looking for businesses in {{city}} and noticed your business, but couldn't find a website for it. 

We build modern, fast websites for companies like yours. Would you be open to a quick chat next week?

Best regards,
[Your Name]`);
    setIsEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = selectedTemplate ? `/api/templates/${selectedTemplate.id}` : '/api/templates';
      const method = selectedTemplate ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, subject, body })
      });

      if (res.ok) {
        const savedTpl = await res.json();
        await loadTemplates();
        setSelectedTemplate(savedTpl);
        setIsEditing(false);
        alert('Modelo salvo com sucesso!');
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao salvar modelo.');
      }
    } catch (err: any) {
      alert(err.message || 'Erro de rede.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Deseja realmente excluir este modelo?')) return;
    try {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSelectedTemplate(null);
        await loadTemplates();
        alert('Modelo excluído com sucesso.');
      } else {
        alert('Erro ao excluir modelo.');
      }
    } catch (err: any) {
      alert(err.message || 'Erro de rede.');
    }
  };

  const getPreviewText = (text: string) => {
    if (!text) return '';
    return text
      .replace(/\{\{business_name\}\}/gi, mockContact.name)
      .replace(/\{\{name\}\}/gi, mockContact.name)
      .replace(/\{\{niche\}\}/gi, mockContact.niche)
      .replace(/\{\{city\}\}/gi, mockContact.city)
      .replace(/\{\{state\}\}/gi, mockContact.state);
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1>Modelos de E-mail</h1>
          <p>Escreva e gerencie seus templates de e-mail de prospecção (em inglês) para as empresas.</p>
        </div>
        <button onClick={handleNew} className="btn btn-primary glow-on-hover">
          <Plus size={16} />
          <span>Criar Modelo</span>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '32px', minHeight: '600px' }}>
        {/* Painel Esquerdo: Lista */}
        <div className="glass" style={{ padding: '16px', overflowY: 'auto' }}>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px', paddingLeft: '8px' }}>
            Modelos ({templates.length})
          </h3>
          
          {loading && templates.length === 0 ? (
            <p style={{ padding: '8px', color: 'var(--text-muted)' }}>Carregando...</p>
          ) : templates.length === 0 ? (
            <p style={{ padding: '8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nenhum modelo cadastrado.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => selectTemplate(tpl)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid transparent',
                    background: selectedTemplate?.id === tpl.id ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                    borderColor: selectedTemplate?.id === tpl.id ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                    color: selectedTemplate?.id === tpl.id ? 'white' : 'var(--text-secondary)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: selectedTemplate?.id === tpl.id ? 600 : 500,
                    transition: 'all 0.2s ease'
                  }}
                >
                  <FileText size={16} style={{ color: selectedTemplate?.id === tpl.id ? 'var(--accent-primary)' : 'inherit' }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tpl.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Painel Direito: Editor / Preview */}
        {(selectedTemplate || isEditing) ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Editor */}
            <div className="glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1.2rem', margin: 0 }}>
                  {selectedTemplate ? 'Editar Modelo' : 'Novo Modelo'}
                </h2>
                {selectedTemplate && (
                  <button 
                    onClick={() => handleDelete(selectedTemplate.id)}
                    className="btn btn-danger"
                    style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                  >
                    <Trash2 size={14} />
                    <span>Excluir</span>
                  </button>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Nome do Modelo (Identificação no CRM)</label>
                <input
                  type="text"
                  className="form-input"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setIsEditing(true); }}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Assunto do E-mail (Subject)</label>
                <input
                  type="text"
                  className="form-input"
                  value={subject}
                  onChange={(e) => { setSubject(e.target.value); setIsEditing(true); }}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <label className="form-label">Corpo do E-mail (Em Inglês)</label>
                <textarea
                  className="form-textarea"
                  style={{ flex: 1, minHeight: '260px', resize: 'none' }}
                  value={body}
                  onChange={(e) => { setBody(e.target.value); setIsEditing(true); }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  onClick={handleSave} 
                  disabled={saving || !isEditing}
                  className="btn btn-primary glow-on-hover"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  <Save size={16} />
                  <span>{saving ? 'Salvando...' : 'Salvar Alterações'}</span>
                </button>
              </div>
            </div>

            {/* Preview Panel */}
            <div className="glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(7, 9, 19, 0.4)' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem', margin: 0 }}>
                <Mail size={18} style={{ color: 'var(--accent-secondary)' }} />
                <span>Pré-visualização do Lead</span>
              </h2>

              <div style={{
                background: 'rgba(20, 26, 57, 0.4)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '16px',
                fontSize: '0.85rem'
              }}>
                <span style={{ display: 'block', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Dados do Lead Simulado</span>
                <span style={{ display: 'block', color: 'var(--text-primary)' }}><strong>Empresa:</strong> {mockContact.name}</span>
                <span style={{ display: 'block', color: 'var(--text-primary)' }}><strong>Cidade/Estado:</strong> {mockContact.city}, {mockContact.state}</span>
                <span style={{ display: 'block', color: 'var(--text-primary)' }}><strong>Nicho:</strong> {mockContact.niche}</span>
              </div>

              <div style={{
                background: '#0B0E1B',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '20px',
                flex: 1,
                fontSize: '0.9rem',
                lineHeight: '1.6',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                fontFamily: 'monospace'
              }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Subject:</span>{' '}
                  <span style={{ color: 'white', fontWeight: 600 }}>{getPreviewText(subject)}</span>
                </div>
                <div style={{ borderBottom: '1px solid var(--border-color)', margin: '8px 0' }}></div>
                <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>
                  {getPreviewText(body)}
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '6px',
                background: 'rgba(99, 102, 241, 0.05)',
                border: '1px solid rgba(99, 102, 241, 0.15)',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)'
              }}>
                <Info size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                <span>
                  As tags dinâmicas <code>{`{{business_name}}`}</code>, <code>{`{{city}}`}</code> e <code>{`{{niche}}`}</code> serão substituídas automaticamente pelos dados do contato no momento do disparo.
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="glass" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
            <FileText size={48} style={{ color: 'var(--text-muted)' }} />
            <p>Selecione um modelo à esquerda ou crie um novo modelo para editar.</p>
          </div>
        )}
      </div>
    </div>
  );
}
