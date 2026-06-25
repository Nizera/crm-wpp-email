import { Resend } from 'resend';
import { getDb } from './db';

interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  contactId: number;
  templateId?: number;
  emailType?: string;
}

export async function sendOutreachEmail(params: SendEmailParams) {
  const db = await getDb();
  
  // Fetch Resend configuration from DB
  const apiKeyRow = await db.get("SELECT value FROM settings WHERE key = 'resend_api_key'");
  const fromEmailRow = await db.get("SELECT value FROM settings WHERE key = 'resend_from_email'");
  
  const apiKey = apiKeyRow?.value || '';
  const fromEmail = fromEmailRow?.value || 'onboarding@resend.dev';

  const subject = params.subject;
  const body = params.body;
  const to = params.to;

  let resendId = '';
  let status = 'sent';

  if (!apiKey || apiKey.trim() === '') {
    // Mock Mode
    console.log(`[MOCK EMAIL SEND] - API Key não configurada.`);
    console.log(`De: ${fromEmail}`);
    console.log(`Para: ${to}`);
    console.log(`Assunto: ${subject}`);
    console.log(`Conteúdo:\n${body}\n--------------------`);
    
    resendId = `mock_${Math.random().toString(36).substring(2, 11)}`;
    status = 'sent';
  } else {
    try {
      const resend = new Resend(apiKey);
      const data = await resend.emails.send({
        from: fromEmail,
        to: [to],
        subject: subject,
        html: body.replace(/\n/g, '<br>'), // Simple text-to-html translation
      });

      if (data.error) {
        throw new Error(data.error.message);
      }

      resendId = data.data?.id || '';
      status = 'sent';
    } catch (error: any) {
      console.error('Erro ao enviar e-mail via Resend API:', error);
      status = 'failed';
      throw error;
    }
  }

  // Log the email in SQLite
  await db.run(
    `INSERT INTO email_logs (contact_id, template_id, email_type, resend_id, subject, body, status, sent_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    params.contactId,
    params.templateId || null,
    params.emailType || 'initial',
    resendId,
    subject,
    body,
    status
  );

  // Update contact status to reflect email sent (if it was Novo)
  const contact = await db.get('SELECT status FROM contacts WHERE id = ?', params.contactId);
  if (contact && contact.status === 'Novo') {
    const newStatus = params.emailType === 'initial' ? 'Enviado' : 'Reenviado';
    await db.run(
      'UPDATE contacts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      newStatus,
      params.contactId
    );
  }

  return { success: status === 'sent', resendId };
}
