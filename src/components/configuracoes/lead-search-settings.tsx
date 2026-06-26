'use client';

import { Search } from 'lucide-react';

interface Props {
  settings: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export default function LeadSearchSettings({ settings, onChange }: Props) {
  return (
    <div>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.15rem', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        <Search size={18} style={{ color: 'var(--accent-blue)' }} />
        <span>Busca de Leads</span>
      </h2>

      <div className="form-group">
        <label className="form-label">Serper API Key</label>
        <input
          type="password"
          className="form-input"
          placeholder="Chave Serper..."
          value={settings.serper_api_key}
          onChange={(e) => onChange('serper_api_key', e.target.value)}
        />
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
          Usada na busca principal de leads via Google Maps/Google Search pela Serper.
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div className="form-group">
          <label className="form-label">Google Places API Key</label>
          <input
            type="password"
            className="form-input"
            placeholder="AIza..."
            value={settings.google_places_api_key}
            onChange={(e) => onChange('google_places_api_key', e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Hunter.io API Key</label>
          <input
            type="password"
            className="form-input"
            placeholder="Chave Hunter.io..."
            value={settings.hunter_api_key}
            onChange={(e) => onChange('hunter_api_key', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
