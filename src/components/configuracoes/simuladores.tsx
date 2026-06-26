'use client';

import { TestTube, Send, CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  simEmail: string;
  simSubject: string;
  simText: string;
  simResult: { success: boolean; text: string } | null;
  simulating: boolean;
  onChangeEmail: (email: string) => void;
  onChangeSubject: (subject: string) => void;
  onChangeSimText: (text: string) => void;
  onSimulateEmail: () => void;
}

export default function Simuladores({
  simEmail,
  simSubject,
  simText,
  simResult,
  simulating,
  onChangeEmail,
  onChangeSubject,
  onChangeSimText,
  onSimulateEmail,
}: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* SIMULADOR RESEND (EMAIL) */}
      <div className="glass" style={{ padding: '28px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.25rem', marginBottom: '16px', color: 'var(--accent-secondary)' }}>
          <TestTube size={20} />
          <span>Simulador de E-mail (Inbound)</span>
        </h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
          Simule o recebimento de uma resposta de e-mail de um lead para ver o CRM e as automações rodarem.
        </p>

        <div>
          <div className="form-group">
            <label className="form-label">E-mail do Contato a Responder</label>
            <input
              type="email"
              className="form-input"
              placeholder="ex: plumber@miamipipes.com"
              value={simEmail}
              onChange={(e) => onChangeEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Assunto da Resposta</label>
            <input
              type="text"
              className="form-input"
              value={simSubject}
              onChange={(e) => onChangeSubject(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Corpo do E-mail</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={simText}
              onChange={(e) => onChangeSimText(e.target.value)}
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
              fontSize: '0.85rem',
            }}>
              {simResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span style={{ fontWeight: 600 }}>{simResult.text}</span>
            </div>
          )}

          <button type="button" disabled={simulating} onClick={onSimulateEmail} className="btn btn-secondary glow-on-hover" style={{ width: '100%', justifyContent: 'center' }}>
            <Send size={16} />
            <span>{simulating ? 'Processando...' : 'Simular Resposta E-mail'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
