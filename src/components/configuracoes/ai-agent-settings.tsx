'use client';

import { Bot } from 'lucide-react';

interface Props {
  settings: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export default function AiAgentSettings({ settings, onChange }: Props) {
  return (
    <div>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.15rem', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        <Bot size={18} style={{ color: 'var(--accent-secondary)' }} />
        <span>Agente Comercial de IA</span>
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '12px' }}>
        <div className="form-group">
          <label className="form-label">Provedor de IA</label>
          <select
            className="form-select"
            value={settings.whatsapp_agent_provider}
            onChange={(e) => onChange('whatsapp_agent_provider', e.target.value)}
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
            onChange={(e) => onChange('whatsapp_agent_model', e.target.value)}
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
            onChange={(e) => onChange('whatsapp_agent_api_key', e.target.value)}
          />
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Prompt de Instruções do Agente</label>
        <textarea
          className="form-textarea"
          rows={5}
          value={settings.whatsapp_agent_prompt}
          onChange={(e) => onChange('whatsapp_agent_prompt', e.target.value)}
          placeholder="Instruções para guiar a conversa do agente no WhatsApp..."
        />
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
          Use as tags dinâmicas: <code>{'{{business_name}}'}</code>, <code>{'{{niche}}'}</code>, <code>{'{{city}}'}</code>, <code>{'{{phone}}'}</code>.
        </span>
      </div>
    </div>
  );
}
