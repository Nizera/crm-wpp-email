'use client';

import { useState, useEffect, useRef } from 'react';
import { Save, CheckCircle2, AlertCircle, Mail, Search, MessageSquare, Bot, FlaskConical } from 'lucide-react';
import EmailSettings from '@/components/configuracoes/email-settings';
import LeadSearchSettings from '@/components/configuracoes/lead-search-settings';
import WhatsappSettings from '@/components/configuracoes/whatsapp-settings';
import AiAgentSettings from '@/components/configuracoes/ai-agent-settings';
import Simuladores from '@/components/configuracoes/simuladores';

type Tab = 'email' | 'leads' | 'whatsapp' | 'agente' | 'simuladores';

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'email', label: 'E-mail', icon: <Mail size={16} /> },
  { id: 'leads', label: 'Leads', icon: <Search size={16} /> },
  { id: 'whatsapp', label: 'WhatsApp', icon: <MessageSquare size={16} /> },
  { id: 'agente', label: 'Agente IA', icon: <Bot size={16} /> },
  { id: 'simuladores', label: 'Simuladores', icon: <FlaskConical size={16} /> },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('email');
  const [settings, setSettings] = useState({
    resend_api_key: '',
    resend_from_email: 'onboarding@resend.dev',
    inbound_domain: '',
    serper_api_key: '',
    hunter_api_key: '',
    google_places_api_key: '',
    whatsapp_agent_provider: 'gemini',
    whatsapp_agent_model: 'gemini-1.5-flash',
    whatsapp_agent_api_key: '',
    whatsapp_agent_prompt: '',
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

  // Baileys connection state
  const [baileysState, setBaileysState] = useState<string>('idle');
  const [baileysQrCode, setBaileysQrCode] = useState<string | null>(null);
  const [baileysLoading, setBaileysLoading] = useState(false);
  const baileysPollRef = useRef<NodeJS.Timeout | null>(null);



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
            serper_api_key: data.serper_api_key || '',
            hunter_api_key: data.hunter_api_key || '',
            google_places_api_key: data.google_places_api_key || '',
            whatsapp_agent_provider: data.whatsapp_agent_provider || 'gemini',
            whatsapp_agent_model: data.whatsapp_agent_model || 'gemini-1.5-flash',
            whatsapp_agent_api_key: data.whatsapp_agent_api_key || '',
            whatsapp_agent_prompt: data.whatsapp_agent_prompt || '',
          });
        }
      } catch (err) {
        console.error('Erro ao carregar configurações:', err);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
    pollBaileysStatus();
  }, []);

  // Poll Baileys status every 3 seconds while connecting
  useEffect(() => {
    if (baileysState === 'connecting') {
      baileysPollRef.current = setInterval(pollBaileysStatus, 3000);
    } else {
      if (baileysPollRef.current) {
        clearInterval(baileysPollRef.current);
        baileysPollRef.current = null;
      }
    }
    return () => {
      if (baileysPollRef.current) {
        clearInterval(baileysPollRef.current);
      }
    };
  }, [baileysState]);

  const handleChange = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
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

  const handleSimulateWebhook = async () => {
    if (!simEmail) {
      alert('Por favor, informe o e-mail do contato de teste.');
      return;
    }

    setSimulating(true);
    setSimResult(null);

    try {
      const query = new URLSearchParams({ email: simEmail, text: simText, subject: simSubject });
      const res = await fetch(`/api/webhooks/resend-inbound?${query.toString()}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setSimResult({
          success: true,
          text: `Sucesso! Contato marcado como Respondido. Resposta simulada inserida.`,
        });
      } else {
        setSimResult({ success: false, text: data.error || 'Falha ao simular recebimento.' });
      }
    } catch (err: any) {
      setSimResult({ success: false, text: err.message || 'Erro de rede' });
    } finally {
      setSimulating(false);
    }
  };

  // Baileys functions
  const pollBaileysStatus = async () => {
    try {
      const res = await fetch('/api/whatsapp/baileys/status');
      if (res.ok) {
        const data = await res.json();
        setBaileysState(data.state || 'idle');
        setBaileysQrCode(data.qrCode || null);
      }
    } catch {
      // Silently fail
    }
  };

  const handleConnectBaileys = async () => {
    setBaileysLoading(true);
    try {
      const res = await fetch('/api/whatsapp/baileys/connect', { method: 'POST' });
      if (res.ok) {
        setBaileysState('connecting');
      }
    } catch {
      // Handle error
    } finally {
      setBaileysLoading(false);
    }
  };

  const handleDisconnectBaileys = async () => {
    setBaileysLoading(true);
    try {
      const res = await fetch('/api/whatsapp/baileys/logout', { method: 'POST' });
      if (res.ok) {
        setBaileysState('logged_out');
        setBaileysQrCode(null);
      }
    } catch {
      // Handle error
    } finally {
      setBaileysLoading(false);
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
        <p>Configure cada integração separadamente nas abas abaixo.</p>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '24px',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '0',
        flexWrap: 'wrap',
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              fontSize: '0.85rem',
              fontWeight: 600,
              border: 'none',
              background: 'transparent',
              color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
              transition: 'all 0.2s ease',
              fontFamily: 'var(--font-family)',
            }}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <form onSubmit={handleSave} className="glass" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {activeTab === 'email' && (
          <EmailSettings settings={settings} onChange={handleChange} />
        )}
        {activeTab === 'leads' && (
          <LeadSearchSettings settings={settings} onChange={handleChange} />
        )}
        {activeTab === 'whatsapp' && (
          <WhatsappSettings
            settings={settings}
            onChange={handleChange}
            baileysState={baileysState}
            baileysQrCode={baileysQrCode}
            baileysLoading={baileysLoading}
            onConnectBaileys={handleConnectBaileys}
            onDisconnectBaileys={handleDisconnectBaileys}
          />
        )}
        {activeTab === 'agente' && (
          <AiAgentSettings settings={settings} onChange={handleChange} />
        )}
        {activeTab === 'simuladores' && (
          <Simuladores
            simEmail={simEmail}
            simSubject={simSubject}
            simText={simText}
            simResult={simResult}
            simulating={simulating}
            onChangeEmail={setSimEmail}
            onChangeSubject={setSimSubject}
            onChangeSimText={setSimText}
            onSimulateEmail={handleSimulateWebhook}
          />
        )}

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
            fontSize: '0.85rem',
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
    </div>
  );
}
