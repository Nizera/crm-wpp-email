import { getDb } from './db';
import {
  buildJidMap,
  getBaileysSock,
  getBaileysStatus,
  onBaileysConnected,
  registerJidMapping,
  resolveJid,
  sendBaileysMessage,
  setBaileysMessageHandler,
  startBaileys,
} from './baileys-client';

export interface WhatsappMessage {
  id?: number;
  contact_id: number;
  direction: 'inbound' | 'outbound';
  body: string;
  sent_at?: string;
  whatsapp_message_id?: string;
}

export function cleanPhoneNumber(phone: string): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

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

async function findOrCreateWhatsappContact(
  phone: string,
  pushName?: string,
  direction: 'inbound' | 'outbound' = 'inbound'
) {
  const db = await getDb();
  const contacts = await db.all('SELECT * FROM contacts');
  const cleanedInput = cleanPhoneNumber(phone);

  const contact = contacts.find((c: any) => {
    if (!c.phone) return false;
    const cleanedC = cleanPhoneNumber(c.phone);
    return cleanedInput.endsWith(cleanedC) || cleanedC.endsWith(cleanedInput);
  });

  if (contact) return { contact, created: false };

  const name = direction === 'inbound'
    ? (pushName?.trim() || cleanedInput || 'Contato WhatsApp')
    : (cleanedInput || 'Contato WhatsApp');

  const result = await db.run(
    `INSERT INTO contacts (name, phone, status, tags, notes, whatsapp_status, updated_at)
     VALUES (?, ?, 'Novo', 'WhatsApp', 'Criado automaticamente ao sincronizar mensagem do WhatsApp.', 'Válido', CURRENT_TIMESTAMP)`,
    name,
    cleanedInput
  );

  const createdContact = await db.get('SELECT * FROM contacts WHERE id = ?', result.lastID);
  console.log(`[WhatsApp Sync] Contato criado automaticamente: ${name} (${cleanedInput})`);

  return { contact: createdContact, created: true };
}

async function saveWhatsappMessageOnce(
  contactId: number,
  direction: 'inbound' | 'outbound',
  text: string,
  whatsappMessageId?: string
) {
  const db = await getDb();

  if (whatsappMessageId) {
    const existing = await db.get(
      'SELECT id FROM whatsapp_messages WHERE whatsapp_message_id = ?',
      whatsappMessageId
    );

    if (existing) {
      return { inserted: false, id: existing.id };
    }
  }

  const result = await db.run(
    'INSERT INTO whatsapp_messages (contact_id, direction, body, sent_at, whatsapp_message_id) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)',
    contactId,
    direction,
    text,
    whatsappMessageId || null
  );

  return { inserted: true, id: result.lastID };
}

export async function sendWhatsappMessage(contactId: number, phone: string, text: string): Promise<boolean> {
  const db = await getDb();
  const cleanedPhone = cleanPhoneNumber(phone);
  const savedMessage = await saveWhatsappMessageOnce(contactId, 'outbound', text);

  const baileysStatus = getBaileysStatus();
  if (baileysStatus.state !== 'connected' || !cleanedPhone) {
    console.warn(`[WhatsApp] Baileys nao esta conectado. Mensagem nao enviada para ${cleanedPhone || phone}.`);
    return false;
  }

  const actualJid = await resolveJid(cleanedPhone);
  const jid = actualJid || `${cleanedPhone}@s.whatsapp.net`;

  if (actualJid) {
    registerJidMapping(actualJid, cleanedPhone);
    console.log(`[WhatsApp] JID real resolvido para ${cleanedPhone}: ${actualJid}`);
  }

  console.log(`[WhatsApp] Tentando enviar via Baileys para ${jid}...`);
  const messageId = await sendBaileysMessage(jid, text, cleanedPhone);
  if (!messageId) {
    console.error(`[WhatsApp] Baileys falhou ao enviar para ${jid}`);
    return false;
  }

  if (savedMessage.id && messageId !== 'sent') {
    await db.run(
      'UPDATE whatsapp_messages SET whatsapp_message_id = ? WHERE id = ? AND whatsapp_message_id IS NULL',
      messageId,
      savedMessage.id
    );
  }

  console.log(`[WhatsApp] Mensagem enviada via Baileys para ${jid}`);
  return true;
}

export async function generateAIResponse(
  contact: any,
  history: WhatsappMessage[],
  systemPromptTemplate: string
): Promise<string> {
  const db = await getDb();
  const settingsList = await db.all('SELECT * FROM settings');
  const settings: Record<string, string> = {};
  settingsList.forEach((row: any) => {
    settings[row.key] = row.value || '';
  });

  const provider = settings.whatsapp_agent_provider || 'mock';
  const model = settings.whatsapp_agent_model || 'gemini-1.5-flash';
  const apiKey = settings.whatsapp_agent_api_key || '';
  const systemPrompt = replaceVariables(systemPromptTemplate, contact);
  const historyText = history
    .map((m) => `${m.direction === 'inbound' ? 'Lead' : 'Agente'}: ${m.body}`)
    .join('\n');

  if (provider === 'gemini' && apiKey) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const userContent = `Historico da conversa:\n${historyText}\n\nResponda ao lead de forma sucinta e persuasiva no WhatsApp. Responda apenas com a mensagem a ser enviada pelo agente, sem aspas, prefixos ou Markdown.`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: userContent }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
        }),
      });

      if (response.ok) {
        const json = await response.json();
        const generatedText = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (generatedText) return generatedText.trim();
      } else {
        console.error('[Gemini API Error]', await response.text());
      }
    } catch (e) {
      console.error('[Gemini API Connection Error]', e);
    }
  }

  if (provider === 'openai' && apiKey) {
    try {
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        ...history.map((m) => ({
          role: m.direction === 'inbound' ? 'user' as const : 'assistant' as const,
          content: m.body,
        })),
        { role: 'user' as const, content: 'Gere a proxima resposta curta de WhatsApp para o lead, sem aspas nem prefixos.' },
      ];

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, messages, temperature: 0.7 }),
      });

      if (response.ok) {
        const json = await response.json();
        const reply = json.choices?.[0]?.message?.content;
        if (reply) return reply.trim();
      } else {
        console.error('[OpenAI API Error]', await response.text());
      }
    } catch (e) {
      console.error('[OpenAI API Connection Error]', e);
    }
  }

  console.log('[WhatsApp Agent] Usando motor simulado para gerar resposta.');
  const lastInbound = history.filter((m) => m.direction === 'inbound').pop()?.body || '';
  const textLower = lastInbound.toLowerCase();

  if (textLower.match(/(sim|quero|agendar|pode ser|ok|yes|sure|interest|schedule|appointment)/i)) {
    return 'Perfeito! Qual seria o melhor dia e horario na proxima semana para uma rapida conversa de 5 minutos por telefone?';
  }

  if (textLower.match(/(nao|obrigado|no thanks|not interested|rejeito)/i)) {
    return `Entendido. Sem problemas! Se precisar de um site profissional no futuro para destacar sua empresa em ${contact.city || 'Google'}, estaremos a disposicao. Muito sucesso com seus negocios!`;
  }

  if (history.filter((m) => m.direction === 'outbound').length === 0) {
    return `Ola, tudo bem? Vi o perfil da sua empresa, ${contact.name}, que presta servicos em ${contact.city || 'sua regiao'}. Notei que voces ainda nao possuem um website oficial. Gostaria de agendar um bate-papo rapido de 5 minutos para eu te mostrar como um site profissional pode trazer mais clientes?`;
  }

  return 'Entendi! Fico a disposicao. Deseja agendar a rapida demonstracao de 5 minutos para a proxima segunda ou terca-feira?';
}

export async function processWhatsappSyncMessage(
  phone: string,
  text: string,
  direction: 'inbound' | 'outbound' = 'inbound',
  whatsappMessageId?: string,
  pushName?: string
): Promise<{ success: boolean; contactMatched: boolean; replyText?: string }> {
  try {
    const db = await getDb();
    const { contact, created } = await findOrCreateWhatsappContact(phone, pushName, direction);

    console.log(`[WhatsApp Sync] Mensagem ${direction} de ${contact.name} (ID: ${contact.id}): "${text}"`);

    const saved = await saveWhatsappMessageOnce(contact.id, direction, text, whatsappMessageId);
    if (!saved.inserted) {
      return { success: true, contactMatched: true };
    }

    if (direction === 'inbound') {
      await db.run(
        "UPDATE contacts SET status = 'Respondido', whatsapp_status = 'Válido', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        contact.id
      );
    } else if (created) {
      await db.run(
        "UPDATE contacts SET whatsapp_status = 'Válido', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        contact.id
      );
    }

    if (direction === 'inbound' && contact.whatsapp_agent_active === 1) {
      const promptRow = await db.get("SELECT value FROM settings WHERE key = 'whatsapp_agent_prompt'");
      const systemPromptTemplate = promptRow?.value || 'Voce e um assistente comercial.';
      const chatHistory = await db.all(
        'SELECT * FROM whatsapp_messages WHERE contact_id = ? ORDER BY sent_at ASC LIMIT 15',
        contact.id
      );
      const aiReply = await generateAIResponse(contact, chatHistory, systemPromptTemplate);

      await new Promise((resolve) => setTimeout(resolve, 1000));
      await sendWhatsappMessage(contact.id, contact.phone, aiReply);

      return { success: true, contactMatched: true, replyText: aiReply };
    }

    return { success: true, contactMatched: true };
  } catch (error) {
    console.error('[WhatsApp Sync Error] Erro ao processar mensagem do WhatsApp:', error);
    return { success: false, contactMatched: false };
  }
}

export async function processIncomingWhatsapp(
  phone: string,
  text: string
): Promise<{ success: boolean; contactMatched: boolean; replyText?: string }> {
  return processWhatsappSyncMessage(phone, text, 'inbound');
}

export async function checkWhatsappExists(phone: string): Promise<{ exists: boolean; jid?: string }> {
  const cleanedPhone = cleanPhoneNumber(phone);
  const baileysStatus = getBaileysStatus();

  if (baileysStatus.state !== 'connected' || !cleanedPhone) {
    console.warn(`[WhatsApp Verification] Baileys nao conectado. Nao foi possivel validar ${cleanedPhone || phone}.`);
    return { exists: false };
  }

  try {
    const sock = getBaileysSock();
    if (sock && typeof sock.onWhatsApp === 'function') {
      console.log(`[WhatsApp] Verificando ${cleanedPhone} via Baileys...`);
      const result = await sock.onWhatsApp(cleanedPhone);
      if (result && result.length > 0) {
        const exists = result[0].exists === true;
        console.log(`[WhatsApp Verification] Baileys: ${cleanedPhone} exists=${exists}`);
        return { exists, jid: exists ? result[0].jid : undefined };
      }
    }
  } catch (error) {
    console.warn('[WhatsApp Verification] Baileys check falhou:', error);
  }

  return { exists: false };
}

let baileysHandlerInitialized = false;

export function initializeBaileysHandler() {
  if (baileysHandlerInitialized) return;
  baileysHandlerInitialized = true;

  setBaileysMessageHandler(async (phone, text, key, direction, pushName) => {
    await processWhatsappSyncMessage(phone, text, direction, key.id || undefined, pushName);
  });

  onBaileysConnected(async () => {
    try {
      const db = await getDb();
      const contacts = await db.all("SELECT phone FROM contacts WHERE phone IS NOT NULL AND phone != ''");
      const phones = contacts.map((c: any) => cleanPhoneNumber(c.phone));
      await buildJidMap(phones);
    } catch (e) {
      console.warn('[WhatsApp] Erro ao construir mapa JID na conexao:', e);
    }
  });

  startBaileys().catch((err) => {
    console.warn('[WhatsApp] Baileys auto-start falhou:', err);
  });

  console.log('[WhatsApp] Baileys handler registrado e conexao iniciada.');
}

if (
  typeof process !== 'undefined'
  && process.env.NEXT_RUNTIME !== 'edge'
  && process.env.NEXT_PHASE !== 'phase-production-build'
) {
  initializeBaileysHandler();
}
