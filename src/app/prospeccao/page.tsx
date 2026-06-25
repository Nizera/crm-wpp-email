'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search, Loader2, MapPin, Check, Plus, AlertCircle,
  Sparkles, Mail, RefreshCw, ExternalLink, Zap, Info
} from 'lucide-react';

interface Lead {
  // OSM fields
  osm_id?: number;
  // Google fields
  place_id?: string;
  rating?: number;
  review_count?: number;
  google_maps_url?: string;
  address?: string;
  // Common
  name: string;
  niche: string;
  phone: string;
  email: string;
  street: string;
  city: string;
  state: string;
}

type SearchSource = 'osm' | 'google';

type EnrichStatus = 'idle' | 'loading' | 'found' | 'not_found' | 'no_key';

const NICHES = [
  { value: 'dentist', label: 'Dentistas (Dentists)' },
  { value: 'plumber', label: 'Encanadores (Plumbers)' },
  { value: 'restaurant', label: 'Restaurantes e Cafés (Restaurants)' },
  { value: 'beauty', label: 'Salões de Beleza (Beauty/Hairdressers)' },
  { value: 'car_repair', label: 'Oficinas Mecânicas (Car Repair)' },
  { value: 'gym', label: 'Academias (Gyms/Fitness)' },
  { value: 'lawyer', label: 'Advogados (Lawyers)' },
  { value: 'hotel', label: 'Hotéis e Motéis (Hotels)' },
  { value: 'bakery', label: 'Padarias (Bakeries)' },
  { value: 'painter', label: 'Pintores (Painters)' },
  { value: 'electrician', label: 'Eletricistas (Electricians)' },
  { value: 'builder', label: 'Construtoras (Builders/Construction)' }
];

export default function ProspeccaoPage() {
  const [city, setCity] = useState('Tampa, FL');
  const [niche, setNiche] = useState('dentist');
  const [source, setSource] = useState<SearchSource>('osm');
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [crmEmails, setCrmEmails] = useState<Set<string>>(new Set());
  const [crmNames, setCrmNames] = useState<Set<string>>(new Set());
  const [importStatus, setImportStatus] = useState<Record<string, 'idle' | 'importing' | 'done' | 'error'>>({});
  const [editedEmails, setEditedEmails] = useState<Record<string, string>>({});
  const [searchSummary, setSearchSummary] = useState<{ total: number; target: number; city: string } | null>(null);
  const [enrichStatus, setEnrichStatus] = useState<Record<string, EnrichStatus>>({});
  const [enrichAll, setEnrichAll] = useState(false);
  const [hasHunterKey, setHasHunterKey] = useState<boolean | null>(null);
  const [hasGoogleKey, setHasGoogleKey] = useState<boolean | null>(null);

  useEffect(() => {
    loadCrmContacts();
    checkHunterKey();
  }, []);

  const checkHunterKey = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const s = await res.json();
        setHasHunterKey(!!(s.hunter_api_key?.trim()));
        setHasGoogleKey(!!(s.google_places_api_key?.trim()));
        // Auto-select Google if key is present
        if (s.google_places_api_key?.trim()) setSource('google');
      }
    } catch {
      setHasHunterKey(false);
      setHasGoogleKey(false);
    }
  };

  const loadCrmContacts = async () => {
    try {
      const res = await fetch('/api/contacts');
      if (res.ok) {
        const contacts = await res.json();
        const emails = new Set<string>();
        const names = new Set<string>();
        contacts.forEach((c: any) => {
          if (c.email) emails.add(c.email.toLowerCase().trim());
          names.add(c.name.toLowerCase().trim());
        });
        setCrmEmails(emails);
        setCrmNames(names);
      }
    } catch (err) {
      console.error('Erro ao buscar contatos do CRM:', err);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!city || !niche) return;

    setLoading(true);
    setLeads([]);
    setSearchSummary(null);
    setEditedEmails({});
    setImportStatus({});
    setEnrichStatus({});

    try {
      const query = new URLSearchParams({ city, niche });
      const endpoint = source === 'google' ? `/api/leads/google?${query}` : `/api/leads/search?${query}`;
      const res = await fetch(endpoint);
      const data = await res.json();

      if (res.ok) {
        setLeads(data.leads || []);
        setSearchSummary({
          total: data.total_found || 0,
          target: data.without_website || 0,
          city: data.city || city,
        });
      } else {
        alert(data.error || 'Ocorreu um erro na busca.');
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao conectar no servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = (leadKey: string, value: string) => {
    setEditedEmails(prev => ({ ...prev, [leadKey]: value }));
  };

  const getLeadKey = (lead: Lead) => lead.place_id || String(lead.osm_id);

  // Enrich a single lead via Hunter.io
  const handleEnrichLead = useCallback(async (lead: Lead) => {
    const key = getLeadKey(lead);
    setEnrichStatus(prev => ({ ...prev, [key]: 'loading' }));

    try {
      const res = await fetch('/api/leads/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: lead.name, city: lead.city, state: lead.state }),
      });

      const data = await res.json();

      if (res.ok && data.email) {
        setEditedEmails(prev => ({ ...prev, [key]: data.email }));
        setEnrichStatus(prev => ({ ...prev, [key]: 'found' }));
      } else if (res.status === 422) {
        setEnrichStatus(prev => ({ ...prev, [key]: 'no_key' }));
      } else {
        setEnrichStatus(prev => ({ ...prev, [key]: 'not_found' }));
      }
    } catch {
      setEnrichStatus(prev => ({ ...prev, [key]: 'not_found' }));
    }
  }, []);

  // Enrich all leads sequentially (to avoid rate limits)
  const handleEnrichAll = async () => {
    if (!hasHunterKey) {
      alert('Configure sua Hunter.io API Key nas Configurações primeiro.');
      return;
    }
    setEnrichAll(true);
    const leadsWithoutEmail = leads.filter(l => {
      const k = getLeadKey(l);
      const current = editedEmails[k] !== undefined ? editedEmails[k] : l.email;
      return !current;
    });

    for (const lead of leadsWithoutEmail) {
      await handleEnrichLead(lead);
      await new Promise(r => setTimeout(r, 600)); // respect rate limits
    }
    setEnrichAll(false);
  };

  const handleImport = async (lead: Lead) => {
    const leadKey = getLeadKey(lead);
    const emailToUse = (editedEmails[leadKey] !== undefined ? editedEmails[leadKey] : lead.email).trim();

    if (!emailToUse) {
      alert('Por favor, insira ou busque um e-mail para este lead antes de importar.');
      return;
    }

    setImportStatus(prev => ({ ...prev, [leadKey]: 'importing' }));

    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: lead.name,
          email: emailToUse,
          phone: lead.phone,
          website: '',
          niche: lead.niche,
          city: lead.city,
          state: lead.state,
          status: 'Novo',
          tags: source === 'google' ? 'Google-Prospect' : 'OSM-Prospect',
          notes: `Importado via ${source === 'google' ? 'Google Places' : 'OpenStreetMap'} — ${lead.address || lead.street || 'Endereço não disponível'}`
        })
      });

      if (res.ok) {
        setImportStatus(prev => ({ ...prev, [leadKey]: 'done' }));
        setCrmEmails(prev => { const s = new Set(prev); s.add(emailToUse.toLowerCase()); return s; });
        setCrmNames(prev => { const s = new Set(prev); s.add(lead.name.toLowerCase().trim()); return s; });
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao importar.');
        setImportStatus(prev => ({ ...prev, [leadKey]: 'error' }));
      }
    } catch {
      setImportStatus(prev => ({ ...prev, [leadKey]: 'error' }));
    }
  };

  const openGoogleSearch = (lead: Lead) => {
    const query = `"${lead.name}" "${lead.city}" email contact`;
    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
  };

  const openYelpSearch = (lead: Lead) => {
    const query = `${lead.name} ${lead.city}`;
    window.open(`https://www.yelp.com/search?find_desc=${encodeURIComponent(query)}`, '_blank');
  };

  const leadsWithEmail = leads.filter(l => {
    const k = getLeadKey(l);
    const e = editedEmails[k] !== undefined ? editedEmails[k] : l.email;
    return !!e;
  }).length;

  return (
    <div className="fade-in">
      <div style={{ marginBottom: '32px' }}>
        <h1>Prospecção de Leads nos EUA</h1>
        <p>Encontre negócios sem website via OpenStreetMap (grátis) ou Google Places (dados mais ricos).</p>
      </div>

      {/* Hunter key warning */}
      {hasHunterKey === false && (
        <div style={{
          display: 'flex', gap: '12px', alignItems: 'flex-start',
          padding: '16px 20px', borderRadius: '10px', marginBottom: '24px',
          background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)'
        }}>
          <Info size={18} style={{ color: 'var(--accent-yellow)', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ color: 'var(--accent-yellow)', fontSize: '0.9rem' }}>Hunter.io não configurado</strong>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Para encontrar e-mails automaticamente, adicione sua{' '}
              <a href="/configuracoes" style={{ color: 'var(--accent-primary)' }}>Hunter.io API Key nas Configurações</a>.
              O plano gratuito tem 25 buscas/mês. Sem a chave, você pode inserir os e-mails manualmente ou buscar via Google/Yelp.
            </p>
          </div>
        </div>
      )}

      {/* Source toggle */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          type="button"
          onClick={() => setSource('osm')}
          className={source === 'osm' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
        >
          🗺️ OpenStreetMap (Grátis)
        </button>
        <button
          type="button"
          onClick={() => { if (!hasGoogleKey) { alert('Configure sua Google Places API Key nas Configurações primeiro.'); return; } setSource('google'); }}
          className={source === 'google' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          title={!hasGoogleKey ? 'Configure a Google Places API Key nas Configurações' : 'Busca com dados mais ricos: telefone, avaliações, mais resultados'}
        >
          {hasGoogleKey ? '✅' : '🔑'} Google Places {!hasGoogleKey && '(Configurar)'}
        </button>
      </div>

      {/* Search form */}
      <form onSubmit={handleSearch} className="glass" style={{ padding: '24px', display: 'flex', gap: '20px', alignItems: 'flex-end', marginBottom: '32px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px' }}>
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={14} style={{ color: 'var(--accent-primary)' }} />
            <span>Cidade e Estado (EUA)</span>
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="ex: Tampa, FL | Charlotte, NC"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            required
          />
        </div>

        <div style={{ flex: '1 1 200px' }}>
          <label className="form-label">Nicho de Negócio</label>
          <select className="form-select" value={niche} onChange={(e) => setNiche(e.target.value)}>
            {NICHES.map((n) => (
              <option key={n.value} value={n.value}>{n.label}</option>
            ))}
          </select>
        </div>

        <button type="submit" disabled={loading} className="btn btn-primary glow-on-hover" style={{ padding: '12px 24px', height: '45px', flexShrink: 0 }}>
          {loading ? (
            <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /><span>Buscando...</span></>
          ) : (
            <><Search size={16} /><span>Buscar Leads</span></>
          )}
        </button>
      </form>

      {/* Summary bar */}
      {searchSummary && !loading && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px', borderRadius: '10px', marginBottom: '24px',
          background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)',
          flexWrap: 'wrap', gap: '12px'
        }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <Sparkles size={20} style={{ color: 'var(--accent-yellow)' }} />
            <span style={{ color: 'white', fontSize: '0.9rem' }}>
              <strong>{searchSummary.target}</strong> leads sem website encontrados em <strong>{searchSummary.city}</strong>
              {leadsWithEmail > 0 && (
                <> · <strong style={{ color: 'var(--accent-green)' }}>{leadsWithEmail}</strong> com e-mail</>
              )}
            </span>
          </div>
          {leads.length > 0 && (
            <button
              onClick={handleEnrichAll}
              disabled={enrichAll || !hasHunterKey}
              className="btn btn-secondary"
              style={{ padding: '8px 16px', fontSize: '0.85rem', flexShrink: 0 }}
              title={!hasHunterKey ? 'Configure a Hunter.io API Key nas Configurações' : 'Buscar e-mail para todos os leads sem e-mail'}
            >
              {enrichAll
                ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /><span>Enriquecendo...</span></>
                : <><Zap size={14} /><span>Enriquecer Todos com Hunter.io</span></>
              }
            </button>
          )}
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <Loader2 size={48} style={{ color: 'var(--accent-primary)', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
          <p style={{ fontWeight: 600 }}>Consultando OpenStreetMap...</p>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Filtrando negócios sem website.</span>
        </div>
      ) : leads.length > 0 ? (
        <div className="table-container fade-in">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Nome da Empresa</th>
                <th>Endereço</th>
                <th>Telefone</th>
                <th>E-mail do Lead</th>
                <th style={{ textAlign: 'center' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => {
                const leadKey = getLeadKey(lead);
                const currentStatus = importStatus[leadKey] || 'idle';
                const currentEmail = editedEmails[leadKey] !== undefined ? editedEmails[leadKey] : lead.email;
                const isAlreadyInCRM = (currentEmail ? crmEmails.has(currentEmail.toLowerCase()) : false) || crmNames.has(lead.name.toLowerCase().trim());
                const eStatus = enrichStatus[leadKey] || 'idle';
                const isDone = isAlreadyInCRM || currentStatus === 'done';

                return (
                  <tr key={leadKey} style={{ opacity: isDone ? 0.6 : 1 }}>
                    <td style={{ fontWeight: 600 }}>{lead.name}</td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {lead.street ? `${lead.street}, ` : ''}{lead.city}, {lead.state}
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{lead.phone || <span style={{ color: 'var(--text-muted)' }}>n/d</span>}</td>

                    {/* Email cell */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="email"
                          className="form-input"
                          style={{
                            padding: '5px 8px', fontSize: '0.82rem', flex: 1,
                            background: 'rgba(7,9,19,0.6)',
                            border: currentEmail
                              ? '1px solid rgba(16,185,129,0.35)'
                              : '1px solid rgba(239,68,68,0.35)'
                          }}
                          placeholder={eStatus === 'not_found' ? 'Não encontrado' : 'Aguardando busca...'}
                          value={currentEmail}
                          onChange={(e) => handleEmailChange(leadKey, e.target.value)}
                        />

                        {/* Hunter.io search button */}
                        <button
                          onClick={() => handleEnrichLead(lead)}
                          disabled={eStatus === 'loading' || isDone}
                          className="btn btn-secondary"
                          style={{ padding: '5px 8px', fontSize: '0.75rem', flexShrink: 0, minWidth: '32px' }}
                          title="Buscar e-mail via Hunter.io"
                        >
                          {eStatus === 'loading'
                            ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                            : eStatus === 'found'
                            ? <Check size={12} style={{ color: 'var(--accent-green)' }} />
                            : <Mail size={12} />
                          }
                        </button>

                        {/* Google search button */}
                        <button
                          onClick={() => openGoogleSearch(lead)}
                          className="btn btn-secondary"
                          style={{ padding: '5px 8px', flexShrink: 0, minWidth: '32px' }}
                          title="Buscar no Google"
                        >
                          <ExternalLink size={12} />
                        </button>
                      </div>

                      {/* Enrichment status messages */}
                      {eStatus === 'not_found' && (
                        <div style={{ display: 'flex', gap: '6px', marginTop: '4px', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Hunter não encontrou.</span>
                          <button onClick={() => openYelpSearch(lead)} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.72rem', cursor: 'pointer', padding: 0 }}>
                            Buscar no Yelp →
                          </button>
                        </div>
                      )}
                      {eStatus === 'no_key' && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--accent-yellow)' }}>
                          Configure a Hunter.io API Key nas{' '}
                          <a href="/configuracoes" style={{ color: 'var(--accent-primary)' }}>Configurações</a>.
                        </span>
                      )}
                      {eStatus === 'found' && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--accent-green)' }}>✓ E-mail encontrado pelo Hunter.io</span>
                      )}
                    </td>

                    {/* Import action */}
                    <td style={{ textAlign: 'center' }}>
                      {isDone ? (
                        <button disabled className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', width: '100%', color: 'var(--accent-green)', borderColor: 'rgba(16,185,129,0.2)' }}>
                          <Check size={13} /> <span>Importado</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleImport(lead)}
                          disabled={currentStatus === 'importing' || !currentEmail}
                          className="btn btn-primary glow-on-hover"
                          style={{ padding: '6px 12px', fontSize: '0.8rem', width: '100%', opacity: !currentEmail ? 0.4 : 1 }}
                          title={!currentEmail ? 'Busque ou insira um e-mail primeiro' : 'Adicionar ao CRM'}
                        >
                          {currentStatus === 'importing'
                            ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /><span>Importando...</span></>
                            : <><Plus size={13} /><span>+ CRM</span></>
                          }
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        searchSummary && (
          <div className="glass" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
            <AlertCircle size={36} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
            <p>Nenhuma empresa sem website encontrada para esses critérios.</p>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Tente uma cidade maior ou mude o nicho.</span>
          </div>
        )
      )}

      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
