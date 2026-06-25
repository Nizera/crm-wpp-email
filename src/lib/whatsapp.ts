import { getDb } from './db';

export interface WhatsappMessage {
  id?: number;
  contact_id: number;
  direction: 'inbound' | 'outbound';
  body: string;
  sent_at?: string;
}

// Clean formatting from phone numbers to leave only digits
export function cleanPhoneNumber(phone: string): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

// Helper to replace variable tags in text templates
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

// Send WhatsApp message using Evolution API or Mock Mode
export async function sendWhatsappMessage(contactId: number, phone: string, text: string): Promise<boolean> {
  const db = await getDb();
  
  // Load Settings
  const settingsList = await db.all('SELECT * FROM settings');
  const settings: Record<string, string> = {};
  settingsList.forEach(row => {
    settings[row.key] = row.value || '';
  });

  const url = settings['evolution_api_url'] || '';
  const token = settings['evolution_api_token'] || '';
  const instanceName = settings['evolution_instance_name'] || '';
  const cleanedPhone = cleanPhoneNumber(phone);

  let sentReal = false;

  if (url && token && instanceName && cleanedPhone) {
    try {
      console.log(`[WhatsApp] Tentando enviar mensagem real para ${cleanedPhone} via Evolution API...`);
      // URL endpoint: {api_url}/message/sendText/{instanceName}
      const response = await fetch(`${url.replace(/\/$/, '')}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': token
        },
        body: JSON.stringify({
          number: cleanedPhone,
          text: text
        })
      });

      if (response.ok) {
        console.log(`[WhatsApp] Mensagem enviada com sucesso para ${cleanedPhone} via API.`);
        sentReal = true;
      } else {
        const errorData = await response.text();
        console.error(`[WhatsApp API Error] Status: ${response.status}. Detalhes:`, errorData);
      }
    } catch (error) {
      console.error(`[WhatsApp API Error] Falha de conexão ao enviar mensagem:`, error);
    }
  }

  if (!sentReal) {
    console.log(`\n==================================================`);
    console.log(`[WhatsApp MOCK Outbound]`);
    console.log(`Para: ${phone} (${cleanedPhone})`);
    console.log(`Mensagem: "${text}"`);
    console.log(`==================================================\n`);
  }

  // Save outbound message to DB
  await db.run(
    "INSERT INTO whatsapp_messages (contact_id, direction, body, sent_at) VALUES (?, 'outbound', ?, CURRENT_TIMESTAMP)",
    contactId,
    text
  );

  return true;
}

// Generate Response using Gemini, OpenAI or Mock rules
export async function generateAIResponse(contact: any, history: WhatsappMessage[], systemPromptTemplate: string): Promise<string> {
  const db = await getDb();
  
  // Load Settings
  const settingsList = await db.all('SELECT * FROM settings');
  const settings: Record<string, string> = {};
  settingsList.forEach(row => {
    settings[row.key] = row.value || '';
  });

  const provider = settings['whatsapp_agent_provider'] || 'mock';
  const model = settings['whatsapp_agent_model'] || 'gemini-1.5-flash';
  const apiKey = settings['whatsapp_agent_api_key'] || '';

  // Clean prompt and replace variables
  const systemPrompt = replaceVariables(systemPromptTemplate, contact);

  // Format conversation history
  const historyText = history.map(m => `${m.direction === 'inbound' ? 'Lead' : 'Agente'}: ${m.body}`).join('\n');

  if (provider === 'gemini' && apiKey) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const userContent = `Histórico da conversa:\n${historyText}\n\nResponda ao Lead de forma sucinta e persuasiva no WhatsApp. Responda apenas com a mensagem a ser enviada pelo Agente, sem aspas, prefixos ou formatação Markdown no corpo do texto.`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: userContent }]
            }
          ],
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          }
        })
      });

      if (response.ok) {
        const json = await response.json();
        const generatedText = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (generatedText) {
          return generatedText.trim();
        }
      } else {
        const errText = await response.text();
        console.error('[Gemini API Error]', errText);
      }
    } catch (e) {
      console.error('[Gemini API Connection Error]', e);
    }
  }

  if (provider === 'openai' && apiKey) {
    try {
      const endpoint = `https://api.openai.com/v1/chat/completions`;
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.map(m => ({
          role: m.direction === 'inbound' ? 'user' as const : 'assistant' as const,
          content: m.body
        })),
        { role: 'user' as const, content: 'Gere a próxima resposta de WhatsApp curta para o lead, sem aspas nem prefixos.' }
      ];

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          temperature: 0.7
        })
      });

      if (response.ok) {
        const json = await response.json();
        const reply = json.choices?.[0]?.message?.content;
        if (reply) {
          return reply.trim();
        }
      } else {
        const errText = await response.text();
        console.error('[OpenAI API Error]', errText);
      }
    } catch (e) {
      console.error('[OpenAI API Connection Error]', e);
    }
  }

  // Fallback Rule-Based Mock Agent
  console.log(`[WhatsApp Agent] Usando motor Simulado (Mock) para gerar resposta.`);
  
  const lastInbound = history.filter(m => m.direction === 'inbound').pop()?.body || '';
  const textLower = lastInbound.toLowerCase();

  // Simple heuristic responses in Portuguese and English
  if (textLower.match(/(sim|quero|agendar|pode ser|ok|yes|sure|interest|schedule|appointment)/i)) {
    return `Perfeito! Qual seria o melhor dia e horário na próxima semana para uma rápida conversa de 5 minutos por telefone?`;
  }
  
  if (textLower.match(/(não|nao|obrigado|no thanks|not interested|rejeito)/i)) {
    return `Entendido. Sem problemas! Se precisar de um site profissional no futuro para destacar sua empresa em ${contact.city || 'Google'}, estaremos à disposição. Muito sucesso com seus negócios!`;
  }

  if (history.filter(m => m.direction === 'outbound').length === 0) {
    // Opening pitch
    return `Olá, tudo bem? Vi o perfil da sua empresa, ${contact.name}, que presta serviços em ${contact.city || 'sua região'}. Notei que vocês ainda não possuem um website oficial. Gostaria de agendar um bate-papo rápido de 5 minutos para eu te mostrar como um site profissional pode trazer mais clientes?`;
  }

  return `Entendi! Fico à disposição. Deseja agendar a rápida demonstração de 5 minutos para a próxima segunda ou terça-feira?`;
}

// Process Inbound message from WhatsApp lead
export async function processIncomingWhatsapp(phone: string, text: string): Promise<{ success: boolean; contactMatched: boolean; replyText?: string }> {
  try {
    const db = await getDb();
    const contacts = await db.all("SELECT * FROM contacts");
    const cleanedInput = cleanPhoneNumber(phone);

    // Try matching lead by phone
    const contact = contacts.find(c => {
      if (!c.phone) return false;
      const cleanedC = cleanPhoneNumber(c.phone);
      return cleanedInput.endsWith(cleanedC) || cleanedC.endsWith(cleanedInput);
    });

    if (!contact) {
      console.log(`[WhatsApp Inbound] Mensagem recebida de ${phone}, mas o telefone não consta em nenhum lead do CRM.`);
      return { success: true, contactMatched: false };
    }

    console.log(`[WhatsApp Inbound] Mensagem recebida de ${contact.name} (ID: ${contact.id}): "${text}"`);

    // 1. Insert inbound message to DB
    await db.run(
      "INSERT INTO whatsapp_messages (contact_id, direction, body, sent_at) VALUES (?, 'inbound', ?, CURRENT_TIMESTAMP)",
      contact.id,
      text
    );

    // 2. Update CRM status to 'Respondido'
    await db.run(
      "UPDATE contacts SET status = 'Respondido', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      contact.id
    );

    // 3. If AI agent is active, trigger reply
    if (contact.whatsapp_agent_active === 1) {
      // Get settings for prompt template
      const promptRow = await db.get("SELECT value FROM settings WHERE key = 'whatsapp_agent_prompt'");
      const systemPromptTemplate = promptRow?.value || "Você é um assistente comercial.";

      // Load last 15 messages for context
      const chatHistory = await db.all(
        "SELECT * FROM whatsapp_messages WHERE contact_id = ? ORDER BY sent_at ASC LIMIT 15",
        contact.id
      );

      // Generate AI response
      const aiReply = await generateAIResponse(contact, chatHistory, systemPromptTemplate);

      // Wait 1 second to simulate typing delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Send reply
      await sendWhatsappMessage(contact.id, contact.phone, aiReply);

      return { success: true, contactMatched: true, replyText: aiReply };
    }

    return { success: true, contactMatched: true };
  } catch (error) {
    console.error(`[WhatsApp Inbound Error] Erro ao processar mensagem recebida:`, error);
    return { success: false, contactMatched: false };
  }
}

// Check if a number is registered on WhatsApp using Evolution API
export async function checkWhatsappExists(phone: string): Promise<{ exists: boolean; jid?: string }> {
  const db = await getDb();
  
  // Load Settings
  const settingsList = await db.all('SELECT * FROM settings');
  const settings: Record<string, string> = {};
  settingsList.forEach(row => {
    settings[row.key] = row.value || '';
  });

  const url = settings['evolution_api_url'] || '';
  const token = settings['evolution_api_token'] || '';
  const instanceName = settings['evolution_instance_name'] || '';
  const cleanedPhone = cleanPhoneNumber(phone);

  if (url && token && instanceName && cleanedPhone) {
    try {
      console.log(`[WhatsApp] Verificando existência de WhatsApp para ${cleanedPhone} via Evolution API...`);
      // Endpoint: {api_url}/chat/checkNumber/{instanceName}
      const response = await fetch(`${url.replace(/\/$/, '')}/chat/checkNumber/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': token
        },
        body: JSON.stringify({
          numbers: [cleanedPhone]
        })
      });

      if (response.ok) {
        const data = await response.json();
        // Evolution API usually returns an array of objects
        const result = Array.isArray(data) ? data[0] : data;
        
        console.log(`[WhatsApp Verification] Resultado para ${cleanedPhone}: exists=${result?.exists}`);
        
        return {
          exists: result?.exists === true,
          jid: result?.jid || undefined
        };
      } else {
        const errorText = await response.text();
        console.error(`[WhatsApp Verification Error] Status: ${response.status}. Detalhes:`, errorText);
      }
    } catch (error) {
      console.error(`[WhatsApp Verification Error] Falha ao conectar:`, error);
    }
  }

  // Mock Mode fallback: Default to true for testing, unless phone starts with '999' or '000'
  console.log(`[WhatsApp Verification MOCK] Número ${cleanedPhone} verificado como VÁLIDO por padrão no modo simulado.`);
  if (cleanedPhone.startsWith('999') || cleanedPhone.startsWith('000') || cleanedPhone === '') {
    return { exists: false };
  }
  return { exists: true, jid: `${cleanedPhone}@s.whatsapp.net` };
}

