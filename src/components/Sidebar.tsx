'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { 
  LayoutDashboard, 
  Search, 
  Users, 
  FileText, 
  GitBranch, 
  Settings, 
  Play, 
  Loader2, 
  CheckCircle,
  AlertTriangle,
  MessageSquare
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<{ success: boolean; message: string } | null>(null);

  const menuItems = [
    { name: 'Painel Geral', icon: LayoutDashboard, path: '/' },
    { name: 'Prospecção', icon: Search, path: '/prospeccao' },
    { name: 'Contatos (CRM)', icon: Users, path: '/contatos' },
    { name: 'Mensagens WhatsApp', icon: MessageSquare, path: '/whatsapp' },
    { name: 'Modelos de E-mail', icon: FileText, path: '/modelos' },
    { name: 'Automações', icon: GitBranch, path: '/automacoes' },
    { name: 'Configurações', icon: Settings, path: '/configuracoes' },
  ];

  const triggerAutomation = async () => {
    setIsRunning(true);
    setRunResult(null);
    try {
      const res = await fetch('/api/automation/run', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setRunResult({ success: true, message: 'Automação executada com sucesso!' });
      } else {
        setRunResult({ success: false, message: data.error || 'Falha ao rodar automação' });
      }
    } catch (e: any) {
      setRunResult({ success: false, message: e.message || 'Erro de conexão' });
    } finally {
      setIsRunning(false);
      // Auto-hide alert after 4 seconds
      setTimeout(() => setRunResult(null), 4000);
    }
  };

  return (
    <aside className="glass" style={{
      width: '260px',
      height: '100vh',
      position: 'fixed',
      left: 0,
      top: 0,
      borderRadius: 0,
      borderTop: 'none',
      borderLeft: 'none',
      borderBottom: 'none',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '24px 16px',
      zIndex: 100
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px', paddingLeft: '8px' }}>
          <div style={{ 
            background: 'var(--accent-gradient)',
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-neon)'
          }}>
            <GitBranch size={22} color="white" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Antigravity</h3>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>EMAIL OUTREACH CRM</span>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {menuItems.map((item) => {
            const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
            const Icon = item.icon;

            return (
              <Link 
                key={item.path} 
                href={item.path}
                className="glow-on-hover"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  fontSize: '0.95rem',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#white' : 'var(--text-secondary)',
                  background: isActive ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                  border: isActive ? '1px solid rgba(99, 102, 241, 0.25)' : '1px solid transparent',
                  transition: 'all 0.2s ease'
                }}
              >
                <Icon size={18} style={{ color: isActive ? 'var(--accent-primary)' : 'inherit' }} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <button 
          onClick={triggerAutomation}
          disabled={isRunning}
          className="btn btn-primary glow-on-hover"
          style={{
            width: '100%',
            justifyContent: 'center',
            padding: '12px',
            fontSize: '0.85rem',
            opacity: isRunning ? 0.8 : 1
          }}
        >
          {isRunning ? (
            <>
              <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
              <span>Executando...</span>
            </>
          ) : (
            <>
              <Play size={14} fill="currentColor" />
              <span>Rodar Automação</span>
            </>
          )}
        </button>

        {runResult && (
          <div style={{
            padding: '10px 12px',
            borderRadius: '6px',
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: runResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${runResult.success ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
            color: runResult.success ? 'var(--accent-green)' : 'var(--accent-red)',
            animation: 'fadeIn 0.2s ease'
          }}>
            {runResult.success ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
            <span style={{ fontWeight: 600 }}>{runResult.message}</span>
          </div>
        )}

        <div style={{
          padding: '12px',
          borderRadius: '8px',
          background: 'rgba(20, 26, 57, 0.3)',
          border: '1px solid var(--border-color)',
          fontSize: '0.75rem',
          textAlign: 'center',
          color: 'var(--text-muted)'
        }}>
          <span style={{ display: 'block', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Status do Servidor</span>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-green)', display: 'inline-block' }}></span>
            <span>Online e Pronto</span>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </aside>
  );
}
