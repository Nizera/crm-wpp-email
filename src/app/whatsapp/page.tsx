'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  MoreVertical, 
  Smile, 
  Mic, 
  Send, 
  MessageSquare, 
  Bot, 
  Video, 
  Phone, 
  ExternalLink, 
  CheckCheck,
  Plus,
  ArrowLeft,
  RefreshCw
} from 'lucide-react';
import Link from 'next/link';

interface Chat {
  id: number;
  name: string;
  phone: string;
  niche: string;
  city: string;
  state: string;
  status: string;
  whatsapp_agent_active: number;
  whatsapp_status?: string;
  last_msg_body: string | null;
  last_msg_time: string | null;
}

interface Message {
  id: number;
  contact_id: number;
  direction: 'inbound' | 'outbound';
  body: string;
  sent_at: string;
}

export default function WhatsAppPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isAgentActive, setIsAgentActive] = useState(false);
  const [verifyingWaStatus, setVerifyingWaStatus] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  // Load chats on mount
  useEffect(() => {
    loadChats(true);
    
    // Set up polling interval to check for new messages/chats every 3 seconds
    pollingInterval.current = setInterval(() => {
      loadChats(false);
    }, 3000);

    return () => {
      if (pollingInterval.current) clearInterval(pollingInterval.current);
    };
  }, []);

  // Poll active chat messages when selectedChat changes
  useEffect(() => {
    if (!selectedChat) return;

    loadMessages(selectedChat.id, false);
    setIsAgentActive(selectedChat.whatsapp_agent_active === 1);

    // Set up rapid polling for active chat (every 2 seconds)
    const activeChatInterval = setInterval(() => {
      loadMessages(selectedChat.id, false);
    }, 2000);

    return () => {
      clearInterval(activeChatInterval);
    };
  }, [selectedChat?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadChats = async (showLoading = false) => {
    if (showLoading) setLoadingChats(true);
    try {
      const res = await fetch('/api/whatsapp/chats');
      if (res.ok) {
        const data = await res.json();
        setChats(data);
        
        // If selected chat is active, update its reference to get updated values (like last message/agent status)
        if (selectedChat) {
          const updatedSelected = data.find((c: Chat) => c.id === selectedChat.id);
          if (updatedSelected) {
            setSelectedChat(updatedSelected);
          }
        }
      }
    } catch (err) {
      console.error('Erro ao buscar conversas:', err);
    } finally {
      if (showLoading) setLoadingChats(false);
    }
  };

  const loadMessages = async (contactId: number, showLoading = false) => {
    if (showLoading) setLoadingMessages(true);
    try {
      const res = await fetch(`/api/whatsapp/messages?contactId=${contactId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Erro ao carregar mensagens:', err);
    } finally {
      if (showLoading) setLoadingMessages(false);
    }
  };

  const handleSelectChat = (chat: Chat) => {
    setSelectedChat(chat);
    loadMessages(chat.id, true);
  };

  const verifyWhatsappNumber = async (contactId: number) => {
    setVerifyingWaStatus(true);
    try {
      const res = await fetch(`/api/whatsapp/check-number?contactId=${contactId}`);
      if (res.ok) {
        const data = await res.json();
        // Update selectedChat status
        if (selectedChat && selectedChat.id === contactId) {
          setSelectedChat({
            ...selectedChat,
            whatsapp_status: data.whatsapp_status
          });
        }
        // Update chats list
        setChats(prev => prev.map(c => c.id === contactId ? { ...c, whatsapp_status: data.whatsapp_status } : c));
      } else {
        alert('Erro ao verificar número do WhatsApp.');
      }
    } catch (err) {
      console.error('Erro ao verificar WhatsApp:', err);
      alert('Erro de rede ao verificar WhatsApp.');
    } finally {
      setVerifyingWaStatus(false);
    }
  };

  const toggleAiAgent = async () => {
    if (!selectedChat) return;
    const nextState = !isAgentActive;
    setIsAgentActive(nextState); // Optimistic UI update
    
    try {
      const res = await fetch('/api/whatsapp/toggle-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: selectedChat.id,
          active: nextState
        })
      });
      if (res.ok) {
        // Reload chats to refresh the list state
        loadChats(false);
      } else {
        setIsAgentActive(!nextState); // Rollback
        alert('Erro ao alterar estado do agente de IA.');
      }
    } catch (err) {
      setIsAgentActive(!nextState); // Rollback
      alert('Erro de conexão.');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChat || !messageInput.trim() || sendingMessage) return;

    setSendingMessage(true);
    const textToSend = messageInput;
    setMessageInput('');

    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: selectedChat.id,
          text: textToSend
        })
      });

      if (res.ok) {
        // Refresh local messages
        await loadMessages(selectedChat.id, false);
        loadChats(false);
      } else {
        alert('Erro ao enviar mensagem.');
        setMessageInput(textToSend); // Restore text
      }
    } catch (err) {
      alert('Erro de conexão.');
      setMessageInput(textToSend);
    } finally {
      setSendingMessage(false);
    }
  };

  // Filter chats by name or niche in search bar
  const filteredChats = chats.filter(chat => {
    const term = search.toLowerCase();
    return (
      chat.name.toLowerCase().includes(term) ||
      (chat.niche && chat.niche.toLowerCase().includes(term)) ||
      chat.phone.includes(term)
    );
  });

  // Group messages by date pill
  const groupMessagesByDate = (msgList: Message[]) => {
    const groups: Record<string, Message[]> = {};
    msgList.forEach(m => {
      const dateStr = new Date(m.sent_at).toLocaleDateString('pt-BR');
      let label = dateStr;
      
      const today = new Date().toLocaleDateString('pt-BR');
      const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('pt-BR');

      if (dateStr === today) {
        label = 'Hoje';
      } else if (dateStr === yesterday) {
        label = 'Ontem';
      }

      if (!groups[label]) groups[label] = [];
      groups[label].push(m);
    });
    return groups;
  };

  const messageGroups = groupMessagesByDate(messages);

  const getFormatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fade-in" style={{ width: '100%', paddingRight: '20px' }}>
      <div className="wa-chat-container">
        
        {/* SIDEBAR DA ESQUERDA (LISTA DE CHATS) */}
        <aside className="wa-sidebar">
          <header className="wa-sidebar-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                background: 'var(--accent-gradient)',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-neon)'
              }}>
                <MessageSquare size={18} color="white" />
              </div>
              <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#e9edef' }}>WhatsApp CRM</span>
            </div>
            
            <button onClick={() => loadChats(true)} className="wa-icon-btn" title="Atualizar conversas">
              <RefreshCw size={16} />
            </button>
          </header>

          {/* Busca de Contatos */}
          <div className="wa-search-bar">
            <div className="wa-search-input-wrapper">
              <Search size={16} style={{ color: '#8696a0' }} />
              <input
                type="text"
                placeholder="Pesquisar ou começar uma nova conversa"
                className="wa-search-input"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Lista de Contatos */}
          <div className="wa-chat-list">
            {loadingChats ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#8696a0' }}>
                <p style={{ fontSize: '0.85rem' }}>Carregando conversas...</p>
              </div>
            ) : filteredChats.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8696a0' }}>
                <p style={{ fontSize: '0.85rem' }}>Nenhum lead com telefone encontrado.</p>
                <span style={{ fontSize: '0.75rem', display: 'block', marginTop: '6px', color: 'var(--text-muted)' }}>
                  Certifique-se de prospectar leads e cadastrá-los com telefone.
                </span>
              </div>
            ) : (
              filteredChats.map((chat) => {
                const isActive = selectedChat?.id === chat.id;
                const lastMsgDate = chat.last_msg_time ? new Date(chat.last_msg_time) : null;
                const displayTime = lastMsgDate 
                  ? lastMsgDate.toLocaleDateString('pt-BR') === new Date().toLocaleDateString('pt-BR')
                    ? lastMsgDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    : lastMsgDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                  : '';

                return (
                  <div
                    key={chat.id}
                    className={`wa-chat-item ${isActive ? 'active' : ''}`}
                    onClick={() => handleSelectChat(chat)}
                  >
                    <div className="wa-avatar" style={{ background: chat.whatsapp_agent_active === 1 ? 'var(--accent-green)' : '#6366f1' }}>
                      {chat.whatsapp_agent_active === 1 ? <Bot size={22} color="#070913" /> : chat.name.charAt(0).toUpperCase()}
                    </div>
                    
                    <div className="wa-chat-details">
                      <div className="wa-chat-meta">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="wa-chat-name" style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chat.name}</span>
                          {chat.phone && (
                            <span 
                              title={`WhatsApp: ${chat.whatsapp_status || 'Não Verificado'}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '14px',
                                height: '14px',
                                borderRadius: '50%',
                                background: chat.whatsapp_status === 'Válido' 
                                  ? 'rgba(16, 185, 129, 0.15)' 
                                  : chat.whatsapp_status === 'Sem WhatsApp' 
                                    ? 'rgba(239, 68, 68, 0.15)' 
                                    : 'rgba(245, 158, 11, 0.15)',
                                color: chat.whatsapp_status === 'Válido' 
                                  ? 'var(--accent-green)' 
                                  : chat.whatsapp_status === 'Sem WhatsApp' 
                                    ? 'var(--accent-red)' 
                                    : 'var(--accent-yellow)',
                              }}
                            >
                              <Phone size={8} />
                            </span>
                          )}
                        </div>
                        {displayTime && <span className="wa-chat-time">{displayTime}</span>}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="wa-chat-last-msg">
                          {chat.last_msg_body || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Nenhuma mensagem</span>}
                        </span>
                        {chat.whatsapp_agent_active === 1 && (
                          <span style={{
                            fontSize: '0.65rem',
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: 'var(--accent-green)',
                            padding: '2px 6px',
                            borderRadius: '10px',
                            fontWeight: 700
                          }}>
                            IA
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* TELA DA DIREITA (CHAT DO CLIENTE SELECIONADO) */}
        <main className="wa-main">
          {!selectedChat ? (
            <div className="wa-main-welcome">
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '30px',
                borderRadius: '50%',
                marginBottom: '20px',
                border: '1px solid rgba(255,255,255,0.05)',
                display: 'inline-flex'
              }}>
                <MessageSquare size={64} style={{ color: '#00a884', filter: 'drop-shadow(0 0 10px rgba(0, 168, 132, 0.2))' }} />
              </div>
              <h2 style={{ color: '#e9edef', fontSize: '1.75rem', fontWeight: 300, marginBottom: '10px' }}>Antigravity WhatsApp Web</h2>
              <p style={{ maxWidth: '400px', fontSize: '0.9rem', lineHeight: '1.5', color: '#8696a0' }}>
                Selecione uma conversa na lista lateral para visualizar as mensagens e responder em tempo real.
              </p>
              <div style={{ marginTop: '30px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span>🔒 Criptografado de ponta a ponta com Evolution API</span>
              </div>
            </div>
          ) : (
            <>
              {/* Header do Chat */}
              <header className="wa-main-header">
                <div className="wa-main-header-info">
                  <div className="wa-avatar" style={{ background: selectedChat.whatsapp_agent_active === 1 ? 'var(--accent-green)' : '#6366f1' }}>
                    {selectedChat.whatsapp_agent_active === 1 ? <Bot size={22} color="#070913" /> : selectedChat.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="wa-chat-name" style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{selectedChat.name}</span>
                      <span style={{ fontSize: '0.72rem', color: '#8696a0', fontWeight: 'normal' }}>
                        ({selectedChat.niche} em {selectedChat.city})
                      </span>
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#8696a0' }}>
                        {selectedChat.phone}
                      </span>
                      {selectedChat.whatsapp_status && (
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: selectedChat.whatsapp_status === 'Válido' 
                            ? 'rgba(16, 185, 129, 0.15)' 
                            : selectedChat.whatsapp_status === 'Sem WhatsApp' 
                              ? 'rgba(239, 68, 68, 0.15)' 
                              : 'rgba(245, 158, 11, 0.15)',
                          color: selectedChat.whatsapp_status === 'Válido' 
                            ? 'var(--accent-green)' 
                            : selectedChat.whatsapp_status === 'Sem WhatsApp' 
                              ? 'var(--accent-red)' 
                              : 'var(--accent-yellow)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          {selectedChat.whatsapp_status === 'Válido' ? '🟢 Válido' : selectedChat.whatsapp_status === 'Sem WhatsApp' ? '🔴 Sem WhatsApp' : '🟡 Não Verificado'}
                        </span>
                      )}
                      {selectedChat.whatsapp_status === 'Não Verificado' && (
                        <button
                          type="button"
                          disabled={verifyingWaStatus}
                          onClick={() => verifyWhatsappNumber(selectedChat.id)}
                          style={{
                            background: 'rgba(99, 102, 241, 0.2)',
                            border: '1px solid rgba(99, 102, 241, 0.4)',
                            color: '#e9edef',
                            borderRadius: '4px',
                            padding: '1px 6px',
                            cursor: 'pointer',
                            fontSize: '0.65rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.2s'
                          }}
                        >
                          {verifyingWaStatus ? 'Verificando...' : 'Verificar'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="wa-main-header-actions">
                  {/* Toggle do Robô de IA */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '4px 12px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <Bot size={15} style={{ color: isAgentActive ? 'var(--accent-green)' : '#8696a0' }} />
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#e9edef' }}>Robô Comercial</span>
                    <button
                      type="button"
                      onClick={toggleAiAgent}
                      style={{
                        background: isAgentActive ? '#00a884' : 'rgba(255,255,255,0.1)',
                        color: isAgentActive ? '#0b141a' : '#8696a0',
                        border: 'none',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontWeight: 700,
                        fontSize: '0.65rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {isAgentActive ? 'LIGADO' : 'DESLIGADO'}
                    </button>
                  </div>

                  <Link href="/contatos" className="wa-icon-btn" title="Ver lead no CRM">
                    <ExternalLink size={16} />
                  </Link>

                  <button className="wa-icon-btn" title="Mais opções">
                    <MoreVertical size={16} />
                  </button>
                </div>
              </header>

              {/* Área do Chat */}
              <div className="wa-chat-area">
                {loadingMessages ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#8696a0' }}>
                    <p style={{ fontSize: '0.9rem' }}>Carregando histórico de mensagens...</p>
                  </div>
                ) : Object.keys(messageGroups).length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#8696a0', textAlign: 'center', padding: '20px' }}>
                    <MessageSquare size={32} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
                    <p style={{ fontSize: '0.85rem' }}>Nenhuma mensagem registrada com este lead.</p>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Envie uma mensagem abaixo para iniciar o diálogo comercial.</span>
                  </div>
                ) : (
                  Object.entries(messageGroups).map(([dateLabel, groupMessages]) => (
                    <div key={dateLabel} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span className="wa-date-pill">{dateLabel}</span>
                      
                      {groupMessages.map((msg) => {
                        const isOut = msg.direction === 'outbound';
                        return (
                          <div 
                            key={msg.id}
                            className={`wa-bubble ${isOut ? 'out' : 'in'}`}
                          >
                            <div className="wa-bubble-text">{msg.body}</div>
                            <div className="wa-bubble-meta">
                              <span>{getFormatTime(msg.sent_at)}</span>
                              {isOut && <CheckCheck size={14} style={{ color: '#53bdeb' }} />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Barra de Digitação */}
              <form onSubmit={handleSendMessage} className="wa-input-area">
                <button type="button" className="wa-icon-btn" title="Adicionar arquivo/mídia">
                  <Plus size={20} />
                </button>
                
                <button type="button" className="wa-icon-btn" title="Emojis">
                  <Smile size={20} />
                </button>

                <input
                  type="text"
                  placeholder="Digite uma mensagem"
                  className="wa-input-field"
                  value={messageInput}
                  onChange={e => setMessageInput(e.target.value)}
                  disabled={sendingMessage}
                />

                {messageInput.trim() ? (
                  <button type="submit" className="wa-icon-btn active" title="Enviar mensagem">
                    <Send size={20} />
                  </button>
                ) : (
                  <button type="button" className="wa-icon-btn" title="Mensagem de voz">
                    <Mic size={20} />
                  </button>
                )}
              </form>
            </>
          )}
        </main>

      </div>
    </div>
  );
}
