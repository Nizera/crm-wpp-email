'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { 
  GitBranch, 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  Settings, 
  Mail, 
  Clock, 
  HelpCircle, 
  Tag, 
  UserCheck, 
  AlertTriangle,
  Play,
  Pause,
  ArrowDown
} from 'lucide-react';

interface FlowNode {
  id: string;
  type: 'trigger' | 'send_email' | 'wait' | 'condition' | 'update_status' | 'add_tag' | 'remove_tag';
  title: string;
  description: string;
  config: any;
  nextId?: string | null;
  yesId?: string | null;
  noId?: string | null;
}

type Flow = Record<string, FlowNode>;

interface Template {
  id: number;
  name: string;
}

export default function AutomationBuilderPage() {
  const { id } = useParams() as { id: string };
  const [automationName, setAutomationName] = useState('');
  const [status, setStatus] = useState('inactive');
  const [flow, setFlow] = useState<Flow>({});
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modals / Dropdowns states
  const [addNodeModal, setAddNodeModal] = useState<{ parentId: string; branch: 'next' | 'yes' | 'no' } | null>(null);
  const [editNodeId, setEditNodeId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load templates for dropdown selection
      const tplRes = await fetch('/api/templates');
      if (tplRes.ok) {
        setTemplates(await tplRes.json());
      }

      // Load automation
      const res = await fetch(`/api/automations/${id}`);
      if (res.ok) {
        const data = await res.json();
        setAutomationName(data.name);
        setStatus(data.status);
        try {
          const parsedFlow = JSON.parse(data.flow_json || '{}');
          setFlow(parsedFlow);
        } catch {
          // Fallback if flow is corrupt or empty
          setFlow({
            trigger: {
              id: 'trigger',
              type: 'trigger',
              title: 'Gatilho: Novo Contato Adicionado',
              description: 'Disparado quando um contato entra com status Novo.',
              config: { event: 'contact_added' },
              nextId: null
            }
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFlow = async (updatedStatus?: string) => {
    setSaving(true);
    const targetStatus = updatedStatus || status;
    try {
      const res = await fetch(`/api/automations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: automationName,
          status: targetStatus,
          flow_json: JSON.stringify(flow)
        })
      });

      if (res.ok) {
        alert('Automação salva com sucesso!');
        if (updatedStatus) setStatus(updatedStatus);
      } else {
        alert('Erro ao salvar automação.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = () => {
    const nextStatus = status === 'active' ? 'inactive' : 'active';
    handleSaveFlow(nextStatus);
  };

  // Node insertion logic
  const handleSelectNodeType = (type: FlowNode['type']) => {
    if (!addNodeModal) return;
    const { parentId, branch } = addNodeModal;

    const newNodeId = `node_${Date.now()}`;
    let title = '';
    let description = '';
    let config: any = {};

    switch (type) {
      case 'send_email':
        title = 'Enviar E-mail';
        description = 'Selecionar template para envio';
        config = { templateId: templates[0]?.id || '' };
        break;
      case 'wait':
        title = 'Aguardar Atraso';
        description = 'Aguardar 3 dias';
        config = { duration: 3, unit: 'days' };
        break;
      case 'condition':
        title = 'Condição (Se / Então)';
        description = 'Avaliar se contato respondeu';
        config = { conditionType: 'replied' };
        break;
      case 'update_status':
        title = 'Atualizar Status';
        description = 'Definir status do contato';
        config = { status: 'Novo' };
        break;
      case 'add_tag':
        title = 'Adicionar Tag';
        description = 'Adicionar tag ao contato';
        config = { tag: '' };
        break;
      case 'remove_tag':
        title = 'Remover Tag';
        description = 'Remover tag do contato';
        config = { tag: '' };
        break;
    }

    const newNode: FlowNode = {
      id: newNodeId,
      type,
      title,
      description,
      config,
      nextId: null,
      yesId: null,
      noId: null
    };

    setFlow(prev => {
      const updated = { ...prev };
      const parentNode = updated[parentId];

      if (parentNode) {
        if (branch === 'next') {
          newNode.nextId = parentNode.nextId;
          parentNode.nextId = newNodeId;
        } else if (branch === 'yes') {
          newNode.nextId = parentNode.yesId;
          parentNode.yesId = newNodeId;
        } else if (branch === 'no') {
          newNode.nextId = parentNode.noId;
          parentNode.noId = newNodeId;
        }
      }

      updated[newNodeId] = newNode;
      return updated;
    });

    setAddNodeModal(null);
    setEditNodeId(newNodeId); // Auto-open settings for the newly created node
  };

  // Node deletion logic
  const handleDeleteNode = (nodeId: string) => {
    if (nodeId === 'trigger') return;
    
    // Check if the node is a conditional and has branched nodes
    const nodeToDelete = flow[nodeId];
    if (nodeToDelete && (nodeToDelete.yesId || nodeToDelete.noId)) {
      if (!confirm('Esta é uma etapa condicional com ramificações. Excluí-la apagará permanentemente todos os fluxos de "Sim" e "Não" vinculados a ela. Deseja continuar?')) {
        return;
      }
    }

    setFlow(prev => {
      const updated = { ...prev };
      
      // Find parent node pointing to nodeId
      let parentId = '';
      let parentBranch: 'next' | 'yes' | 'no' = 'next';

      for (const [key, n] of Object.entries(updated)) {
        if (n.nextId === nodeId) {
          parentId = key;
          parentBranch = 'next';
          break;
        }
        if (n.yesId === nodeId) {
          parentId = key;
          parentBranch = 'yes';
          break;
        }
        if (n.noId === nodeId) {
          parentId = key;
          parentBranch = 'no';
          break;
        }
      }

      const nextIdToAttach = updated[nodeId]?.nextId || null;

      if (parentId) {
        if (parentBranch === 'next') {
          updated[parentId].nextId = nextIdToAttach;
        } else if (parentBranch === 'yes') {
          updated[parentId].yesId = nextIdToAttach;
        } else if (parentBranch === 'no') {
          updated[parentId].noId = nextIdToAttach;
        }
      }

      // Helper function to recursively delete branches (in case of condition nodes)
      const deleteRecursive = (id: string | null | undefined) => {
        if (!id) return;
        const node = updated[id];
        if (node) {
          deleteRecursive(node.nextId);
          deleteRecursive(node.yesId);
          deleteRecursive(node.noId);
          delete updated[id];
        }
      };

      if (nodeToDelete.type === 'condition') {
        deleteRecursive(nodeToDelete.yesId);
        deleteRecursive(nodeToDelete.noId);
      }

      delete updated[nodeId];
      return updated;
    });
  };

  const handleUpdateNodeConfig = (nodeId: string, updatedConfig: any) => {
    setFlow(prev => {
      const updated = { ...prev };
      const node = updated[nodeId];
      if (node) {
        node.config = updatedConfig;
        
        // Dynamically update description based on config
        if (node.type === 'send_email') {
          const tpl = templates.find(t => t.id === parseInt(updatedConfig.templateId));
          node.description = tpl ? `Enviar e-mail: ${tpl.name}` : 'Template não selecionado';
        } else if (node.type === 'wait') {
          node.description = `Aguardar ${updatedConfig.duration} ${updatedConfig.unit === 'days' ? 'dias' : updatedConfig.unit === 'hours' ? 'horas' : 'minutos'}`;
        } else if (node.type === 'condition') {
          node.description = `Se ${updatedConfig.conditionType === 'replied' ? 'respondeu' : updatedConfig.conditionType === 'has_tag' ? `tem tag "${updatedConfig.tag}"` : `status é "${updatedConfig.status}"`}`;
        } else if (node.type === 'update_status') {
          node.description = `Mudar status para: ${updatedConfig.status}`;
        } else if (node.type === 'add_tag') {
          node.description = `Adicionar tag: ${updatedConfig.tag}`;
        } else if (node.type === 'remove_tag') {
          node.description = `Remover tag: ${updatedConfig.tag}`;
        }
      }
      return updated;
    });
    setEditNodeId(null);
  };

  // Visual layout rendering
  const renderNode = (nodeId: string | null | undefined): React.ReactNode => {
    if (!nodeId) return null;
    const node = flow[nodeId];
    if (!node) return null;

    const getNodeIcon = () => {
      switch (node.type) {
        case 'trigger': return <GitBranch size={16} color="var(--accent-primary)" />;
        case 'send_email': return <Mail size={16} color="var(--accent-blue)" />;
        case 'wait': return <Clock size={16} color="var(--accent-yellow)" />;
        case 'condition': return <AlertTriangle size={16} color="var(--accent-secondary)" />;
        case 'update_status': return <UserCheck size={16} color="var(--accent-green)" />;
        case 'add_tag': return <Tag size={16} color="var(--accent-green)" />;
        case 'remove_tag': return <Tag size={16} color="var(--accent-red)" />;
      }
    };

    return (
      <div key={nodeId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Node Card */}
        <div 
          className="glass glow-on-hover"
          style={{
            width: '280px',
            padding: '16px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            background: node.type === 'trigger' ? 'rgba(99, 102, 241, 0.1)' : 'var(--card-bg)',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            boxShadow: 'var(--shadow-sm)',
            zIndex: 10
          }}
        >
          <div style={{
            background: 'rgba(20, 26, 57, 0.6)',
            padding: '8px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {getNodeIcon()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
              {node.type === 'trigger' ? 'Gatilho' : 'Ação'}
            </span>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, display: 'block', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {node.title}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
              {node.description}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {node.type !== 'trigger' && (
              <>
                <button 
                  onClick={() => setEditNodeId(nodeId)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px' }}
                  title="Configurar etapa"
                >
                  <Settings size={14} />
                </button>
                <button 
                  onClick={() => handleDeleteNode(nodeId)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', padding: '2px' }}
                  title="Excluir etapa"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Branching / Connective Line */}
        {node.type === 'condition' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', marginTop: '16px' }}>
            {/* Split lines visualizer */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', width: '600px', position: 'relative' }}>
              
              {/* Branch Sim (Yes) */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', borderRight: '1px dashed rgba(16, 185, 129, 0.3)', paddingRight: '20px' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-green)', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)', marginBottom: '16px' }}>
                  SIM / VERDADEIRO
                </span>
                
                {/* Node insertion button for Yes branch */}
                <button 
                  onClick={() => setAddNodeModal({ parentId: nodeId, branch: 'yes' })}
                  style={{
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px dashed var(--accent-green)',
                    color: 'var(--accent-green)',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    marginBottom: '16px'
                  }}
                  title="Adicionar ação se Sim"
                >
                  <Plus size={14} />
                </button>

                {node.yesId ? renderNode(node.yesId) : (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Fim do fluxo (Sim)</span>
                )}
              </div>

              {/* Branch Não (No) */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', borderLeft: '1px dashed rgba(239, 68, 68, 0.3)', paddingLeft: '20px' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-red)', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', marginBottom: '16px' }}>
                  NÃO / FALSO
                </span>

                {/* Node insertion button for No branch */}
                <button 
                  onClick={() => setAddNodeModal({ parentId: nodeId, branch: 'no' })}
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px dashed var(--accent-red)',
                    color: 'var(--accent-red)',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    marginBottom: '16px'
                  }}
                  title="Adicionar ação se Não"
                >
                  <Plus size={14} />
                </button>

                {node.noId ? renderNode(node.noId) : (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Fim do fluxo (Não)</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Connection Line */}
            <div style={{ width: '2px', height: '30px', background: 'var(--border-color)', borderStyle: 'dashed' }}></div>
            
            {/* Standard Insertion Button */}
            <button 
              onClick={() => setAddNodeModal({ parentId: nodeId, branch: 'next' })}
              style={{
                background: 'rgba(99, 102, 241, 0.15)',
                border: '1px dashed var(--accent-primary)',
                color: 'var(--accent-primary)',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 10
              }}
              title="Inserir etapa"
            >
              <Plus size={14} />
            </button>

            <div style={{ width: '2px', height: '30px', background: 'var(--border-color)', borderStyle: 'dashed' }}></div>

            {node.nextId ? renderNode(node.nextId) : (
              <div style={{
                background: 'rgba(20, 26, 57, 0.3)',
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                fontSize: '0.75rem',
                color: 'var(--text-muted)'
              }}>
                Fim da Automação
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <p>Carregando construtor visual...</p>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/automacoes" className="btn btn-secondary" style={{ padding: '8px' }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="text" 
                value={automationName} 
                onChange={(e) => setAutomationName(e.target.value)}
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  fontSize: '1.5rem', 
                  fontWeight: 800, 
                  color: 'white', 
                  width: '320px',
                  borderBottom: '1px solid transparent'
                }}
                className="form-input"
                onFocus={(e) => e.target.style.borderBottomColor = 'var(--accent-primary)'}
                onBlur={(e) => e.target.style.borderBottomColor = 'transparent'}
              />
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>ID da Automação: #{id}</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button 
            onClick={handleToggleStatus}
            className={`btn ${status === 'active' ? 'btn-secondary' : 'btn-primary'}`}
            style={{ 
              borderColor: status === 'active' ? 'var(--accent-yellow)' : 'transparent',
              color: status === 'active' ? 'var(--accent-yellow)' : 'white'
            }}
          >
            {status === 'active' ? <Pause size={14} /> : <Play size={14} />}
            <span>{status === 'active' ? 'Pausar Automação' : 'Ativar Automação'}</span>
          </button>
          
          <button onClick={() => handleSaveFlow()} disabled={saving} className="btn btn-primary glow-on-hover">
            <Save size={16} />
            <span>Salvar Fluxo</span>
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div 
        className="grid-bg glass" 
        style={{ 
          flex: 1, 
          borderRadius: '12px', 
          border: '1px solid var(--border-color)', 
          overflow: 'auto',
          padding: '60px 40px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          position: 'relative'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {renderNode('trigger')}
        </div>
      </div>

      {/* MODAL: SELECIONAR TIPO DE NÓ (CLIQUE NO "+") */}
      {addNodeModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          padding: '20px',
          backdropFilter: 'blur(4px)'
        }}>
          <div className="glass fade-in" style={{ width: '480px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.2rem', color: 'white', margin: 0 }}>Adicionar Etapa</h3>
              <button onClick={() => setAddNodeModal(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button onClick={() => handleSelectNodeType('send_email')} className="btn btn-secondary glow-on-hover" style={{ justifyContent: 'flex-start', padding: '14px 18px', gap: '14px' }}>
                <Mail size={18} style={{ color: 'var(--accent-blue)' }} />
                <div style={{ textAlign: 'left' }}>
                  <span style={{ display: 'block', fontWeight: 700 }}>Enviar E-mail</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Disparar um modelo de e-mail de prospecção</span>
                </div>
              </button>

              <button onClick={() => handleSelectNodeType('wait')} className="btn btn-secondary glow-on-hover" style={{ justifyContent: 'flex-start', padding: '14px 18px', gap: '14px' }}>
                <Clock size={18} style={{ color: 'var(--accent-yellow)' }} />
                <div style={{ textAlign: 'left' }}>
                  <span style={{ display: 'block', fontWeight: 700 }}>Aguardar Atraso (Wait)</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pausar o fluxo por X minutos, horas ou dias</span>
                </div>
              </button>

              <button onClick={() => handleSelectNodeType('condition')} className="btn btn-secondary glow-on-hover" style={{ justifyContent: 'flex-start', padding: '14px 18px', gap: '14px' }}>
                <AlertTriangle size={18} style={{ color: 'var(--accent-secondary)' }} />
                <div style={{ textAlign: 'left' }}>
                  <span style={{ display: 'block', fontWeight: 700 }}>Condição (Se / Então)</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ramificar o fluxo caso tenha respondido, tenha tag, etc.</span>
                </div>
              </button>

              <button onClick={() => handleSelectNodeType('update_status')} className="btn btn-secondary glow-on-hover" style={{ justifyContent: 'flex-start', padding: '14px 18px', gap: '14px' }}>
                <UserCheck size={18} style={{ color: 'var(--accent-green)' }} />
                <div style={{ textAlign: 'left' }}>
                  <span style={{ display: 'block', fontWeight: 700 }}>Atualizar Status</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mudar o status do contato no CRM (ex: Sem Interesse)</span>
                </div>
              </button>

              <button onClick={() => handleSelectNodeType('add_tag')} className="btn btn-secondary glow-on-hover" style={{ justifyContent: 'flex-start', padding: '14px 18px', gap: '14px' }}>
                <Tag size={18} style={{ color: 'var(--accent-green)' }} />
                <div style={{ textAlign: 'left' }}>
                  <span style={{ display: 'block', fontWeight: 700 }}>Adicionar Tag</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Vincular uma tag de controle ao lead</span>
                </div>
              </button>

              <button onClick={() => handleSelectNodeType('remove_tag')} className="btn btn-secondary glow-on-hover" style={{ justifyContent: 'flex-start', padding: '14px 18px', gap: '14px' }}>
                <Tag size={18} style={{ color: 'var(--accent-red)' }} />
                <div style={{ textAlign: 'left' }}>
                  <span style={{ display: 'block', fontWeight: 700 }}>Remover Tag</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Desvincular uma tag existente do lead</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR / CONFIGURAR NÓ */}
      {editNodeId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          padding: '20px',
          backdropFilter: 'blur(4px)'
        }}>
          <NodeConfigForm 
            node={flow[editNodeId]} 
            templates={templates}
            onCancel={() => setEditNodeId(null)}
            onSave={(config) => handleUpdateNodeConfig(editNodeId, config)}
          />
        </div>
      )}
    </div>
  );
}

// Sub-Component for configuring node details
interface NodeConfigFormProps {
  node: FlowNode;
  templates: Template[];
  onCancel: () => void;
  onSave: (config: any) => void;
}

function NodeConfigForm({ node, templates, onCancel, onSave }: NodeConfigFormProps) {
  const [config, setConfig] = useState({ ...node.config });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(config);
  };

  return (
    <form onSubmit={handleSubmit} className="glass fade-in" style={{ width: '480px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <h3 style={{ fontSize: '1.20rem', color: 'white', margin: 0 }}>Configurar: {node.title}</h3>
      <div style={{ borderBottom: '1px solid var(--border-color)' }}></div>

      {node.type === 'send_email' && (
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Modelo de E-mail (Template)</label>
          <select 
            className="form-select"
            value={config.templateId} 
            onChange={(e) => setConfig({ ...config, templateId: e.target.value })}
            required
          >
            <option value="">Selecione um template...</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
            Selecione o e-mail em inglês que será enviado ao lead nessa etapa.
          </span>
        </div>
      )}

      {node.type === 'wait' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Duração do Atraso</label>
            <input 
              type="number" 
              className="form-input"
              value={config.duration} 
              onChange={(e) => setConfig({ ...config, duration: parseInt(e.target.value) })}
              min={1}
              required
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Unidade de Tempo</label>
            <select 
              className="form-select"
              value={config.unit} 
              onChange={(e) => setConfig({ ...config, unit: e.target.value })}
            >
              <option value="minutes">Minuto(s)</option>
              <option value="hours">Hora(s)</option>
              <option value="days">Dia(s)</option>
            </select>
          </div>
        </div>
      )}

      {node.type === 'condition' && (
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Gatilho de Condição</label>
          <select 
            className="form-select"
            value={config.conditionType} 
            onChange={(e) => setConfig({ ...config, conditionType: e.target.value })}
          >
            <option value="replied">Se o Lead Respondeu (Email Reply)</option>
            <option value="has_tag">Se o Lead Possui Tag específica</option>
            <option value="status">Se o Status no CRM é igual a</option>
          </select>

          {config.conditionType === 'has_tag' && (
            <div style={{ marginTop: '14px' }}>
              <label className="form-label">Nome da Tag</label>
              <input 
                type="text" 
                className="form-input"
                placeholder="ex: Interessado"
                value={config.tag || ''} 
                onChange={(e) => setConfig({ ...config, tag: e.target.value })}
                required
              />
            </div>
          )}

          {config.conditionType === 'status' && (
            <div style={{ marginTop: '14px' }}>
              <label className="form-label">Status Alvo</label>
              <select 
                className="form-select"
                value={config.status || ''} 
                onChange={(e) => setConfig({ ...config, status: e.target.value })}
                required
              >
                <option value="Novo">Novo</option>
                <option value="Enviado">Enviado</option>
                <option value="Reenviado">Reenviado</option>
                <option value="Respondido">Respondido</option>
                <option value="Sem Interesse">Sem Interesse</option>
                <option value="Convertido">Convertido</option>
              </select>
            </div>
          )}
        </div>
      )}

      {node.type === 'update_status' && (
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Alterar Status no CRM para:</label>
          <select 
            className="form-select"
            value={config.status} 
            onChange={(e) => setConfig({ ...config, status: e.target.value })}
          >
            <option value="Novo">Novo</option>
            <option value="Enviado">Enviado</option>
            <option value="Reenviado">Reenviado</option>
            <option value="Respondido">Respondido</option>
            <option value="Sem Interesse">Sem Interesse</option>
            <option value="Convertido">Convertido</option>
          </select>
        </div>
      )}

      {node.type === 'add_tag' && (
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Tag a Adicionar</label>
          <input 
            type="text" 
            className="form-input"
            value={config.tag || ''} 
            onChange={(e) => setConfig({ ...config, tag: e.target.value })}
            placeholder="ex: Lead Quente"
            required
          />
        </div>
      )}

      {node.type === 'remove_tag' && (
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Tag a Remover</label>
          <input 
            type="text" 
            className="form-input"
            value={config.tag || ''} 
            onChange={(e) => setConfig({ ...config, tag: e.target.value })}
            placeholder="ex: Lead Quente"
            required
          />
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
        <button type="button" onClick={onCancel} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancelar</button>
        <button type="submit" className="btn btn-primary" style={{ flex: 1.5, justifyContent: 'center' }}>Confirmar</button>
      </div>
    </form>
  );
}

// Simple close button helper
function X({ size, color }: { size?: number; color?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  );
}
