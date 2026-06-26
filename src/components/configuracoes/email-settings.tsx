'use client';

import { Settings } from 'lucide-react';

interface Props {
  settings: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export default function EmailSettings({ settings, onChange }: Props) {
  return (
    <div>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.15rem', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        <Settings size={18} style={{ color: 'var(--accent-primary)' }} />
        <span>Resend (E-mail)</span>
      </h2>

      <div className="form-group">
        <label className="form-label">Resend API Key</label>
        <input
          type="password"
          className="form-input"
          placeholder="re_..."
          value={settings.resend_api_key}
          onChange={(e) => onChange('resend_api_key', e.target.value)}
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
            onChange={(e) => onChange('resend_from_email', e.target.value)}
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
            onChange={(e) => onChange('inbound_domain', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
