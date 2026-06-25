import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sendOutreachEmail } from '@/lib/resend';

interface FlowNode {
  id: string;
  type: 'trigger' | 'send_email' | 'wait' | 'condition' | 'update_status' | 'add_tag' | 'remove_tag';
  title?: string;
  description?: string;
  config: any;
  nextId?: string | null;
  yesId?: string | null;
  noId?: string | null;
}

type Flow = Record<string, FlowNode>;

function replaceVariables(text: string, contact: any): string {
  if (!text) return '';
  return text
    .replace(/\{\{name\}\}/gi, contact.name || '')
    .replace(/\{\{business_name\}\}/gi, contact.name || '')
    .replace(/\{\{email\}\}/gi, contact.email || '')
    .replace(/\{\{phone\}\}/gi, contact.phone || '')
    .replace(/\{\{niche\}\}/gi, contact.niche || '')
    .replace(/\{\{city\}\}/gi, contact.city || '')
    .replace(/\{\{state\}\}/gi, contact.state || '');
}

export async function POST() {
  const executionLogs: string[] = [];
  try {
    const db = await getDb();
    
    // 1. Get all active automations
    const activeAutomations = await db.all("SELECT * FROM automations WHERE status = 'active'");
    executionLogs.push(`Encontradas ${activeAutomations.length} automações ativas.`);

    for (const automation of activeAutomations) {
      executionLogs.push(`Processando automação: "${automation.name}" (ID: ${automation.id})`);
      
      let flow: Flow = {};
      try {
        flow = JSON.parse(automation.flow_json || '{}');
      } catch (e) {
        executionLogs.push(`[ERRO] Falha ao analisar o JSON do fluxo da automação ID ${automation.id}. Pulando.`);
        continue;
      }

      // 2. Enroll new contacts (status = 'Novo') that are not already enrolled in this automation
      const newContacts = await db.all(`
        SELECT c.* FROM contacts c
        LEFT JOIN automation_states s ON s.contact_id = c.id AND s.automation_id = ?
        WHERE c.status = 'Novo' AND s.contact_id IS NULL AND c.email IS NOT NULL AND c.email != ''
      `, automation.id);

      if (newContacts.length > 0) {
        executionLogs.push(`Enrolando ${newContacts.length} novos contatos na automação.`);
        for (const contact of newContacts) {
          await db.run(`
            INSERT INTO automation_states (contact_id, automation_id, current_node_id, status, scheduled_at)
            VALUES (?, ?, 'trigger', 'running', CURRENT_TIMESTAMP)
          `, contact.id, automation.id);
        }
      }

      // 3. Process active contacts in this automation (scheduled_at <= now, status = 'running' or 'waiting')
      const activeStates = await db.all(`
        SELECT s.*, c.name as contact_name, c.email as contact_email, c.phone as contact_phone, 
               c.niche as contact_niche, c.city as contact_city, c.state as contact_state, c.status as contact_status, c.tags as contact_tags
        FROM automation_states s
        JOIN contacts c ON c.id = s.contact_id
        WHERE s.automation_id = ? 
          AND (s.status = 'running' OR (s.status = 'waiting' AND s.scheduled_at <= datetime('now', 'localtime') OR s.scheduled_at <= CURRENT_TIMESTAMP))
      `, automation.id);

      executionLogs.push(`Encontrados ${activeStates.length} contatos prontos para execução.`);

      for (const state of activeStates) {
        let currentNodeId = state.current_node_id;
        let stateStatus = 'running';
        let scheduledAt: string | null = null;
        let iterations = 0;
        const maxIterations = 15; // Prevent infinite loops in configuration

        executionLogs.push(`> Contato: ${state.contact_name} (ID: ${state.contact_id}) na etapa ${currentNodeId}`);

        // Get contact details for condition evaluation
        const contactData = {
          id: state.contact_id,
          name: state.contact_name,
          email: state.contact_email,
          phone: state.contact_phone,
          niche: state.contact_niche,
          city: state.contact_city,
          state: state.contact_state,
          status: state.contact_status,
          tags: state.contact_tags
        };

        while (currentNodeId && stateStatus === 'running' && iterations < maxIterations) {
          iterations++;
          const node = flow[currentNodeId];

          if (!node) {
            executionLogs.push(`  [AVISO] Nó ID "${currentNodeId}" não encontrado no fluxo. Finalizando automação.`);
            stateStatus = 'completed';
            currentNodeId = '';
            break;
          }

          executionLogs.push(`  Executando nó "${node.title || node.type}" (Tipo: ${node.type}, ID: ${node.id})`);

          if (node.type === 'trigger') {
            // Trigger is completed instantly, proceed to next
            currentNodeId = node.nextId || null;
          } 
          else if (node.type === 'send_email') {
            const templateId = node.config?.templateId;
            if (!templateId) {
              executionLogs.push(`  [ERRO] ID do template não configurado no nó ${node.id}. Pulando.`);
              currentNodeId = node.nextId || null;
              continue;
            }

            // Get template
            const template = await db.get('SELECT * FROM templates WHERE id = ?', templateId);
            if (!template) {
              executionLogs.push(`  [ERRO] Template ID ${templateId} não encontrado no banco de dados. Pulando.`);
              currentNodeId = node.nextId || null;
              continue;
            }

            // Replace variables
            const subject = replaceVariables(template.subject, contactData);
            const body = replaceVariables(template.body, contactData);

            try {
              executionLogs.push(`  Enviando e-mail para ${contactData.email}...`);
              await sendOutreachEmail({
                to: contactData.email,
                subject: subject,
                body: body,
                contactId: contactData.id,
                templateId: template.id,
                emailType: 'campaign_step'
              });
              executionLogs.push(`  E-mail enviado com sucesso.`);
            } catch (err: any) {
              executionLogs.push(`  [ERRO] Falha ao enviar e-mail: ${err.message}`);
            }

            currentNodeId = node.nextId || null;
          } 
          else if (node.type === 'wait') {
            const duration = parseInt(node.config?.duration || '1');
            const unit = node.config?.unit || 'days'; // 'minutes', 'hours', 'days'

            let intervalString = `+${duration} day`;
            if (unit === 'minutes') intervalString = `+${duration} minute`;
            else if (unit === 'hours') intervalString = `+${duration} hour`;

            // Calculate next execution time using SQLite datetime functions
            const timeResult = await db.get(`SELECT datetime('now', 'localtime', ?) as next_time`, intervalString);
            scheduledAt = timeResult.next_time;
            stateStatus = 'waiting';
            
            executionLogs.push(`  Agendado para aguardar até: ${scheduledAt}`);
            // Do not advance currentNodeId yet, contact stays on wait node until timer triggers
            break;
          } 
          else if (node.type === 'condition') {
            const condType = node.config?.conditionType; // 'replied', 'has_tag', 'status'
            let evaluation = false;

            if (condType === 'replied') {
              // A contact is considered replied if status is 'Respondido' or has any logs with 'replied'
              evaluation = contactData.status === 'Respondido';
              if (!evaluation) {
                // Double check in logs if they replied
                const repliedLog = await db.get(`
                  SELECT id FROM email_logs 
                  WHERE contact_id = ? AND (status = 'replied' OR replied_at IS NOT NULL)
                `, contactData.id);
                if (repliedLog) evaluation = true;
              }
            } 
            else if (condType === 'has_tag') {
              const checkTag = node.config?.tag || '';
              const tagsList = contactData.tags ? contactData.tags.split(',').map((t: string) => t.trim()) : [];
              evaluation = tagsList.includes(checkTag.trim());
            } 
            else if (condType === 'status') {
              const checkStatus = node.config?.status || '';
              evaluation = contactData.status === checkStatus;
            }

            executionLogs.push(`  Avaliação da condição (${condType}): ${evaluation ? 'SIM' : 'NÃO'}`);
            currentNodeId = evaluation ? (node.yesId || null) : (node.noId || null);
          } 
          else if (node.type === 'update_status') {
            const newStatus = node.config?.status;
            if (newStatus) {
              await db.run('UPDATE contacts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', newStatus, contactData.id);
              contactData.status = newStatus; // Update local state for subsequent nodes
              executionLogs.push(`  Status do contato atualizado para: ${newStatus}`);
            }
            currentNodeId = node.nextId || null;
          } 
          else if (node.type === 'add_tag') {
            const addTag = node.config?.tag;
            if (addTag) {
              let tagsList = contactData.tags ? contactData.tags.split(',').map((t: string) => t.trim()) : [];
              if (!tagsList.includes(addTag.trim())) {
                tagsList.push(addTag.trim());
                const tagsStr = tagsList.filter(Boolean).join(',');
                await db.run('UPDATE contacts SET tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', tagsStr, contactData.id);
                contactData.tags = tagsStr;
                executionLogs.push(`  Tag adicionada: ${addTag}`);
              }
            }
            currentNodeId = node.nextId || null;
          } 
          else if (node.type === 'remove_tag') {
            const removeTag = node.config?.tag;
            if (removeTag) {
              let tagsList = contactData.tags ? contactData.tags.split(',').map((t: string) => t.trim()) : [];
              tagsList = tagsList.filter((t: string) => t !== removeTag.trim());
              const tagsStr = tagsList.join(',');
              await db.run('UPDATE contacts SET tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', tagsStr, contactData.id);
              contactData.tags = tagsStr;
              executionLogs.push(`  Tag removida: ${removeTag}`);
            }
            currentNodeId = node.nextId || null;
          } 
          else {
            executionLogs.push(`  [AVISO] Tipo de nó desconhecido "${node.type}". Pulando.`);
            currentNodeId = node.nextId || null;
          }
        }

        if (iterations >= maxIterations) {
          executionLogs.push(`  [AVISO] Limite de segurança de iterações atingido. Loop infinito evitado.`);
          stateStatus = 'failed';
        }

        // Update database automation state for the contact
        if (!currentNodeId) {
          stateStatus = 'completed';
        }

        await db.run(`
          UPDATE automation_states 
          SET current_node_id = ?, 
              status = ?, 
              scheduled_at = ?, 
              updated_at = CURRENT_TIMESTAMP
          WHERE contact_id = ? AND automation_id = ?
        `, currentNodeId, stateStatus, scheduledAt, state.contact_id, automation.id);

        executionLogs.push(`  Estado final do contato: ${stateStatus}. Próxima etapa: ${currentNodeId || 'Nenhuma (Fim)'}`);
      }
    }

    return NextResponse.json({ success: true, logs: executionLogs });
  } catch (error: any) {
    executionLogs.push(`[ERRO FATAL] ${error.message}`);
    return NextResponse.json(
      { error: 'Erro ao rodar automação', details: error.message, logs: executionLogs },
      { status: 500 }
    );
  }
}
