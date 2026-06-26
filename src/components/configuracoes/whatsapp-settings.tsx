'use client';

import { Smartphone, RefreshCw, Wifi, WifiOff, QrCode, LogOut, Play } from 'lucide-react';

interface Props {
  settings: Record<string, string>;
  onChange: (key: string, value: string) => void;
  baileysState: string;
  baileysQrCode: string | null;
  baileysLoading: boolean;
  onConnectBaileys: () => void;
  onDisconnectBaileys: () => void;
}

export default function WhatsappSettings({
  baileysState,
  baileysQrCode,
  baileysLoading,
  onConnectBaileys,
  onDisconnectBaileys,
}: Props) {
  const isConnected = baileysState === 'connected';
  const isConnecting = baileysState === 'connecting';

  return (
    <div>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.15rem', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        <Smartphone size={18} style={{ color: 'var(--accent-green)' }} />
        <span>WhatsApp Direto (Baileys)</span>
      </h2>

      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
        Conecte o WhatsApp Web diretamente ao CRM. Essa conexao e usada para enviar, receber e validar numeros de WhatsApp.
      </p>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '16px',
        padding: '12px',
        borderRadius: '8px',
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isConnected
            ? 'rgba(16, 185, 129, 0.15)'
            : isConnecting
              ? 'rgba(245, 158, 11, 0.15)'
              : 'rgba(239, 68, 68, 0.15)',
          color: isConnected
            ? 'var(--accent-green)'
            : isConnecting
              ? 'var(--accent-yellow)'
              : 'var(--accent-red)',
        }}>
          {isConnected ? <Wifi size={18} /> : isConnecting ? <RefreshCw size={18} /> : <WifiOff size={18} />}
        </div>

        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
            Status: {
              isConnected ? 'Conectado'
              : isConnecting ? 'Conectando...'
              : baileysState === 'logged_out' ? 'Desconectado'
              : baileysState === 'disconnected' ? 'Desconectado'
              : 'Inativo'
            }
          </span>
          <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {isConnected
              ? 'WhatsApp conectado e pronto para enviar, receber e validar contatos.'
              : isConnecting
                ? 'Aguardando leitura do QR Code pelo celular...'
                : 'Clique em Conectar para iniciar.'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {!isConnected && !isConnecting && (
            <button
              type="button"
              disabled={baileysLoading}
              onClick={onConnectBaileys}
              className="btn btn-secondary"
              style={{ padding: '6px 14px', fontSize: '0.78rem' }}
            >
              <Play size={14} />
              <span>Conectar</span>
            </button>
          )}
          {isConnected && (
            <button
              type="button"
              disabled={baileysLoading}
              onClick={onDisconnectBaileys}
              className="btn btn-secondary"
              style={{ padding: '6px 14px', fontSize: '0.78rem', borderColor: 'rgba(239, 68, 68, 0.3)', color: 'var(--accent-red)' }}
            >
              <LogOut size={14} />
              <span>Desconectar</span>
            </button>
          )}
        </div>
      </div>

      {isConnecting && baileysQrCode && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '20px',
          background: 'white',
          borderRadius: '12px',
          marginTop: '8px',
          marginBottom: '12px',
        }}>
          <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <QrCode size={18} color="#333" />
            <span style={{ color: '#333', fontWeight: 700, fontSize: '0.85rem' }}>Escaneie o QR Code com o WhatsApp</span>
          </div>
          <img
            src={baileysQrCode}
            alt="QR Code do WhatsApp"
            style={{ width: '220px', height: '220px', imageRendering: 'pixelated' }}
          />
          <span style={{ color: '#666', fontSize: '0.75rem', marginTop: '8px' }}>
            Abra o WhatsApp &gt; Menu &gt; Dispositivos conectados &gt; Conectar
          </span>
        </div>
      )}

      {isConnecting && !baileysQrCode && (
        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 10px' }} />
          <p>Gerando QR Code...</p>
        </div>
      )}
    </div>
  );
}
