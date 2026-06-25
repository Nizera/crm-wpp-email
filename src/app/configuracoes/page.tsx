'use client';

import { useState, useEffect } from 'react';
import { Settings, Save, AlertCircle, CheckCircle2, TestTube, Send, MessageSquare } from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    resend_api_key: '',
    resend_from_email: 'onboarding@resend.dev',
    inbound_domain: '',
    hunter_api_key: '',
    google_places_api_key: '',
    evolution_api_url: 'http://localhost:8080',
    evolution_api_token: '',
    evolution_instance_name: '',
    whatsapp_agent_provider: 'gemini',
    whatsapp_agent_model: 'gemini-1.5-flash',
    whatsapp_agent_api_key: '',
    whatsapp_agent_prompt: ''
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ success: boolean; text: string } | null>(null);

  // Webhook Simulation state (Resend)
  const [simEmail, setSimEmail] = useState('');
  const [simText, setSimText] = useState('Hi, I am interested in getting a website for my plumbing business. Let me know when we can talk.');
  const [simSubject, setSimSubject] = useState('Re: Website proposal');
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<{ success: boolean; text: string } | null>(null);

  // WhatsApp Simulation state
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedContactPhone, setSelectedContactPhone] = useState('');
  const [simWaText, setSimWaText] = useState('Sim, tenho interesse! Como funciona?');
  const [simulatingWa, setSimulatingWa] = useState(false);
  const [simWaResult, setSimWaResult] = useState<{ success: boolean; text: string; details?: string } | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          setSettings({
            resend_api_key: data.resend_api_key || '',
            resend_from_email: data.resend_from_email || 'onboarding@resend.dev',
            inbound_domain: data.inbound_domain || '',
            hunter_api_key: data.hunter_api_key || '',
            google_places_api_key: data.google_places_api_key || '',
            evolution_api_url: data.evolution_api_url || 'http://localhost:8080',
            evolution_api_token: data.evolution_api_token || '',
            evolution_instance_name: data.evolution_instance_name || '',
            whatsapp_agent_provider: data.whatsapp_agent_provider || 'gemini',
            whatsapp_agent_model: data.whatsapp_agent_model || 'gemini-1.5-flash',
            whatsapp_agent_api_key: data.whatsapp_agent_api_key || '',
            whatsapp_agent_prompt: data.whatsapp_agent_prompt || ''
          });
        }
      } catch (err) {
        console.error('Erro ao carregar configurações:', err);
      } finally {
        setLoading(false);
      }
    }
    
    async function loadContacts() {
      try {
        const res = await fetch('/api/contacts');
        if (res.ok) {
          const data = await res.json();
          // Filter contacts that have a phone number
          setContacts(data.filter((c: any) => c.phone));
        }
      } catch (err) {
        console.error('Erro ao buscar contatos:', err);
      }
    }

    loadSettings();
    loadContacts();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      
      if (res.ok) {
        setStatusMsg({ success: true, text: 'Configurações salvas com sucesso!' });
      } else {
        const err = await res.json();
        setStatusMsg({ success: false, text: err.error || 'Erro ao salvar configurações' });
      }
    } catch (err: any) {
      setStatusMsg({ success: false, text: err.message || 'Erro de rede' });
    } finally {
      setSaving(false);
    }
  };

  const handleSimulateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simEmail) {
      alert('Por favor, informe o e-mail do contato de teste.');
      return;
    }
    
    setSimulating(true);
    setSimResult(null);

    try {
      const query = new URLSearchParams({
        email: simEmail,
        text: simText,
        subject: simSubject
      });
      
      const res = await fetch(`/api/webhooks/resend-inbound?${query.toString()}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setSimResult({ 
          success: true, 
          text: `Sucesso! Contato marcado como Respondido. Resposta simulada inserida.` 
        });
      } else {
        setSimResult({ 
          success: false, 
          text: data.error || 'Falha ao simular recebimento.' 
        });
      }
    } catch (err: any) {
      setSimResult({ success: false, text: err.message || 'Erro de rede' });
    } finally {
      setSimulating(false);
    }
  };

  const handleSimulateWaWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContactPhone) {
      alert('Por favor, selecione um contato com telefone.');
      return;
    }

    setSimulatingWa(true);
    setSimWaResult(null);

    try {
      const res = await fetch('/api/whatsapp/simulate-receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: selectedContactPhone,
          text: simWaText
        })
      });
      
      const data = await res.json();

      if (res.ok && data.success) {
        if (data.contactMatched) {
          setSimWaResult({
            success: true,
            text: `Sucesso! Mensagem simulada recebida no CRM.`,
            details: data.replyText 
              ? `O Agente de IA respondeu automaticamente: "${data.replyText}"`
              : `Mensagem gravada no chat, mas o Agente de IA está inativo para este contato.`
          });
        } else {
          setSimWaResult({
            success: false,
            text: `Mensagem recebida, mas o número "${selectedContactPhone}" não corresponde a nenhum lead do CRM.`
          });
        }
      } else {
        setSimWaResult({
          success: false,
          text: data.error || 'Falha ao simular recebimento de WhatsApp.'
        });
      }
    } catch (err: any) {
      setSimWaResult({ success: false, text: err.message || 'Erro de rede' });
    } finally {
      setSimulatingWa(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <p>Carregando configurações...</p>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ maxWidth: '1100px', margin: '0 auto', paddingBottom: '50px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1>Configurações do CRM</h1>
        <p>Configure suas integrações de E-mail (Resend), Prospecção (Google Places) e WhatsApp (Evolution API + Agente de IA).</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '32px' }}>
        
        {/* Painel de Configurações */}
        <form onSubmit={handleSave} className="glass" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* SECÃO: RESEND */}
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.15rem', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <Settings size={18} style={{ color: 'var(--accent-primary)' }} />
              <span>Configurações do Resend (E-mail)</span>
            </h2>

            <div className="form-group">
              <label className="form-label">Resend API Key</label>
              <input
                type="password"
                className="form-input"
                placeholder="re_..."
                value={settings.resend_api_key}
                onChange={(e) => setSettings({ ...settings, resend_api_key: e.target.value })}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
                Se deixada em branco, os e-mails funcionarão em <strong>Modo Simulado (Mock)</strong>.
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Remetente Verificado</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.resend_from_email}
                  onChange={(e) => setSettings({ ...settings, resend_from_email: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Domínio Inbound (Recebimento)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="ex: inbound.seudominio.com"
                  value={settings.inbound_domain}
                  onChange={(e) => setSettings({ ...settings, inbound_domain: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* SEÇÃO: GOOGLE PLACES & HUNTER */}
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.15rem', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <Settings size={18} style={{ color: 'var(--accent-blue)' }} />
              <span>Busca de Leads (Places e Hunter)</span>
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Google Places API Key</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="AIza..."
                  value={settings.google_places_api_key}
                  onChange={(e) => setSettings({ ...settings, google_places_api_key: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Hunter.io API Key</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Chave Hunter.io..."
                  value={settings.hunter_api_key}
                  onChange={(e) => setSettings({ ...settings, hunter_api_key: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* SEÇÃO: WHATSAPP (EVOLUTION API) */}
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.15rem', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <MessageSquare size={18} style={{ color: 'var(--accent-green)' }} />
              <span>Integração WhatsApp (Evolution API)</span>
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Se as chaves estiverem em branco, o sistema rodará em <strong>Modo Simulado</strong>, mostrando mensagens no console e na tela de chat.
            </p>

            <div className="form-group">
              <label className="form-label">URL da Evolution API</label>
              <input
                type="text"
                className="form-input"
                placeholder="http://localhost:8080"
                value={settings.evolution_api_url}
                onChange={(e) => setSettings({ ...settings, evolution_api_url: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Global API Token (apikey)</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Cole o token da Evolution..."
                  value={settings.evolution_api_token}
                  onChange={(e) => setSettings({ ...settings, evolution_api_token: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Nome da Instância (Instance)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="ex: antigravity"
                  value={settings.evolution_instance_name}
                  onChange={(e) => setSettings({ ...settings, evolution_instance_name: e.target.value })}
                />
              </div>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
              Webhook para Evolution API: configure o webhook na Evolution apontando para: <code>{typeof window !== 'undefined' ? `${window.location.origin}/api/whatsapp/webhook` : '/api/whatsapp/webhook'}</code> com o evento <code>MESSAGES_UPSERT</code>.
            </span>
          </div>

          {/* SEÇÃO: AGENTE DE IA (WHATSAPP) */}
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.15rem', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <Settings size={18} style={{ color: 'var(--accent-secondary)' }} />
              <span>Agente Comercial de IA (WhatsApp)</span>
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Provedor de IA</label>
                <select
                  className="form-select"
                  value={settings.whatsapp_agent_provider}
                  onChange={(e) => setSettings({ ...settings, whatsapp_agent_provider: e.target.value })}
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI (ChatGPT)</option>
                  <option value="mock">Simulado (Sem Chave)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Modelo de IA</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="ex: gemini-1.5-flash ou gpt-4o-mini"
                  value={settings.whatsapp_agent_model}
                  onChange={(e) => setSettings({ ...settings, whatsapp_agent_model: e.target.value })}
                />
              </div>
            </div>

            {settings.whatsapp_agent_provider !== 'mock' && (
              <div className="form-group">
                <label className="form-label">API Key do Provedor</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Cole sua chave da API de IA..."
                  value={settings.whatsapp_agent_api_key}
                  onChange={(e) => setSettings({ ...settings, whatsapp_agent_api_key: e.target.value })}
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Prompt de Instruções do Agente</label>
              <textarea
                className="form-textarea"
                rows={5}
                value={settings.whatsapp_agent_prompt}
                onChange={(e) => setSettings({ ...settings, whatsapp_agent_prompt: e.target.value })}
                placeholder="Instruções para guiar a conversa do agente no WhatsApp..."
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
                Use as tags dinâmicas: <code>{"{{business_name}}"}</code>, <code>{"{{niche}}"}</code>, <code>{"{{city}}"}</code>, <code>{"{{phone}}"}</code>.
              </span>
            </div>
          </div>

          {statusMsg && (
            <div style={{
              padding: '12px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: statusMsg.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${statusMsg.success ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
              color: statusMsg.success ? 'var(--accent-green)' : 'var(--accent-red)',
              fontSize: '0.85rem'
            }}>
              {statusMsg.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span style={{ fontWeight: 600 }}>{statusMsg.text}</span>
            </div>
          )}

          <button type="submit" disabled={saving} className="btn btn-primary glow-on-hover" style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}>
            <Save size={16} />
            <span>{saving ? 'Salvando...' : 'Salvar Todas as Configurações'}</span>
          </button>
        </form>

        {/* Simuladores de Recebimento */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* SIMULADOR WHATSAPP */}
          <div className="glass" style={{ padding: '28px' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.25rem', marginBottom: '16px', color: 'var(--accent-green)' }}>
              <MessageSquare size={20} />
              <span>Simulador de WhatsApp (Inbound)</span>
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Simule que um lead te enviou um WhatsApp para testar a resposta automática do Agente de IA comercial.
            </p>

            <form onSubmit={handleSimulateWaWebhook}>
              <div className="form-group">
                <label className="form-label">Selecionar Lead com Telefone</label>
                <select 
                  className="form-select"
                  value={selectedContactPhone}
                  onChange={(e) => setSelectedContactPhone(e.target.value)}
                  required
                >
                  <option value="">Selecione um contato...</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.phone}>
                      {c.name} ({c.phone}) - IA: {c.whatsapp_agent_active === 1 ? 'Ativa' : 'Inativa'}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                  Nota: Garanta que o Agente de IA está Ativado para o contato no CRM para vê-lo respondendo.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Mensagem Recebida do Lead</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={simWaText}
                  onChange={(e) => setSimWaText(e.target.value)}
                  required
                />
              </div>

              {simWaResult && (
                <div style={{
                  padding: '12px',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  background: simWaResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${simWaResult.success ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                  color: simWaResult.success ? 'var(--accent-green)' : 'var(--accent-red)',
                  fontSize: '0.85rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {simWaResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    <span style={{ fontWeight: 600 }}>{simWaResult.text}</span>
                  </div>
                  {simWaResult.details && (
                    <div style={{ 
                      marginTop: '6px', 
                      fontSize: '0.8rem', 
                      color: 'var(--text-primary)',
                      padding: '8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '4px',
                      fontStyle: 'italic'
                    }}>
                      {simWaResult.details}
                    </div>
                  )}
                </div>
              )}

              <button type="submit" disabled={simulatingWa} className="btn btn-secondary glow-on-hover" style={{ width: '100%', justifyContent: 'center' }}>
                <Send size={16} />
                <span>{simulatingWa ? 'Processando...' : 'Simular Recebimento WhatsApp'}</span>
              </button>
            </form>
          </div>

          {/* SIMULADOR RESEND (EMAIL) */}
          <div className="glass" style={{ padding: '28px' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.25rem', marginBottom: '16px', color: 'var(--accent-secondary)' }}>
              <TestTube size={20} />
              <span>Simulador de E-mail (Inbound)</span>
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Simule o recebimento de uma resposta de e-mail de um lead para ver o CRM e as automações rodarem.
            </p>

            <form onSubmit={handleSimulateWebhook}>
              <div className="form-group">
                <label className="form-label">E-mail do Contato a Responder</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="ex: plumber@miamipipes.com"
                  value={simEmail}
                  onChange={(e) => setSimEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Assunto da Resposta</label>
                <input
                  type="text"
                  className="form-input"
                  value={simSubject}
                  onChange={(e) => setSimSubject(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Corpo do E-mail</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={simText}
                  onChange={(e) => setSimText(e.target.value)}
                  required
                />
              </div>

              {simResult && (
                <div style={{
                  padding: '12px',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: simResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${simResult.success ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                  color: simResult.success ? 'var(--accent-green)' : 'var(--accent-red)',
                  fontSize: '0.85rem'
                }}>
                  {simResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span style={{ fontWeight: 600 }}>{simResult.text}</span>
                </div>
              )}

              <button type="submit" disabled={simulating} className="btn btn-secondary glow-on-hover" style={{ width: '100%', justifyContent: 'center' }}>
                <Send size={16} />
                <span>{simulating ? 'Processando...' : 'Simular Resposta E-mail'}</span>
              </button>
            </form>
          </div>

        </div>

      </div>
    </div>
  );
}
