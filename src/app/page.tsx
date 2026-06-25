'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Users, 
  Send, 
  MessageSquare, 
  TrendingUp, 
  Search, 
  Plus, 
  Settings, 
  ArrowUpRight, 
  Mail, 
  Clock 
} from 'lucide-react';

interface Stats {
  totalContacts: number;
  totalSent: number;
  totalReplied: number;
  conversionRate: number;
}

interface Activity {
  id: number;
  contact_id: number;
  contact_name: string;
  email_type: string;
  subject: string;
  status: string;
  sent_at: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalContacts: 0,
    totalSent: 0,
    totalReplied: 0,
    conversionRate: 0
  });
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch contacts to calculate stats
        const contactsRes = await fetch('/api/contacts');
        const contacts = await contactsRes.json();
        
        // Fetch email logs for recent activity
        // We will create a small helper endpoint or query contacts for logs.
        // For simplicity, we can fetch from contacts and compile activities.
        // Let's create an api route `/api/dashboard/stats` to get these cleanly.
        const statsRes = await fetch('/api/dashboard/stats');
        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats(data.stats);
          setRecentActivities(data.recentActivities);
        }
      } catch (error) {
        console.error('Erro ao buscar dados do dashboard:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh', flexDirection: 'column', gap: '16px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid rgba(99, 102, 241, 0.2)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Carregando estatísticas...</p>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1>Painel Geral</h1>
          <p>Visão geral do seu CRM de prospecção de negócios e status das automações.</p>
        </div>
        <Link href="/prospeccao" className="btn btn-primary glow-on-hover">
          <Search size={16} />
          <span>Iniciar Prospecção</span>
        </Link>
      </div>

      {/* Grid de Estatísticas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '20px',
        marginBottom: '32px'
      }}>
        {/* Card 1 */}
        <div className="glass glow-on-hover" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Total de Contatos</span>
            <div style={{ background: 'rgba(14, 165, 233, 0.1)', padding: '8px', borderRadius: '8px', color: 'var(--accent-blue)' }}>
              <Users size={20} />
            </div>
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: 0 }}>{stats.totalContacts}</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '8px' }}>Empresas importadas no CRM</span>
        </div>

        {/* Card 2 */}
        <div className="glass glow-on-hover" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>E-mails Enviados</span>
            <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '8px', borderRadius: '8px', color: 'var(--accent-primary)' }}>
              <Send size={20} />
            </div>
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: 0 }}>{stats.totalSent}</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '8px' }}>Disparados pela automação</span>
        </div>

        {/* Card 3 */}
        <div className="glass glow-on-hover" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Respostas Recebidas</span>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '8px', borderRadius: '8px', color: 'var(--accent-green)' }}>
              <MessageSquare size={20} />
            </div>
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: 0 }}>{stats.totalReplied}</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '8px' }}>Respostas capturadas via webhook</span>
        </div>

        {/* Card 4 */}
        <div className="glass glow-on-hover" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Taxa de Resposta</span>
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '8px', borderRadius: '8px', color: 'var(--accent-yellow)' }}>
              <TrendingUp size={20} />
            </div>
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: 0 }}>{stats.conversionRate.toFixed(1)}%</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '8px' }}>Porcentagem de contatos respondidos</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
        {/* Atividades Recentes */}
        <div className="glass" style={{ padding: '24px' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem', marginBottom: '20px' }}>
            <Clock size={18} style={{ color: 'var(--accent-primary)' }} />
            <span>Atividade Recente de E-mails</span>
          </h2>

          {recentActivities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
              <Mail size={32} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
              <p>Nenhum e-mail enviado ou recebido ainda.</p>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Inicie a busca de leads e ative as automações para ver logs aqui.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {recentActivities.map((act) => (
                <div key={act.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  background: 'rgba(20, 26, 57, 0.3)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  fontSize: '0.9rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      background: act.email_type === 'inbound' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                      color: act.email_type === 'inbound' ? 'var(--accent-green)' : 'var(--accent-primary)',
                      padding: '8px',
                      borderRadius: '50%'
                    }}>
                      <Mail size={16} />
                    </div>
                    <div>
                      <span style={{ fontWeight: 600, display: 'block' }}>{act.contact_name}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{act.subject}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className={`badge ${act.email_type === 'inbound' ? 'badge-replied' : 'badge-sent'}`} style={{ marginBottom: '4px' }}>
                      {act.email_type === 'inbound' ? 'Resposta' : 'Enviado'}
                    </span>
                    <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {new Date(act.sent_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Atalhos e Dicas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="glass" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '20px' }}>Ações Rápidas</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Link href="/prospeccao" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'space-between' }}>
                <span>Buscar Novos Leads</span>
                <ArrowUpRight size={16} />
              </Link>
              <Link href="/contatos" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'space-between' }}>
                <span>Gerenciar Contatos</span>
                <ArrowUpRight size={16} />
              </Link>
              <Link href="/automacoes" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'space-between' }}>
                <span>Criar Automação</span>
                <ArrowUpRight size={16} />
              </Link>
              <Link href="/configuracoes" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'space-between' }}>
                <span>Configurar Resend</span>
                <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>

          <div className="glass" style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%)' }}>
            <h2 style={{ fontSize: '1.1rem', color: 'white', marginBottom: '10px' }}>Dica de Prospecção</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Empresas sem website listadas no OpenStreetMap nos EUA são ideais para venda de sites. Ofereça um layout rápido e focado em captação de clientes locais. 
              <br /><br />
              Certifique-se de configurar sua API Key nas <strong>Configurações</strong> para iniciar os envios.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
