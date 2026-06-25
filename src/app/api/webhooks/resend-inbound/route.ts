import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Resend webhook events wrap the email data inside data
    // Format: { type: 'email.received', data: { from: '...', subject: '...', text: '...' } }
    const eventType = body.type;
    const emailData = body.data || body; // Fallback in case raw object is sent

    if (eventType && eventType !== 'email.received') {
      return NextResponse.json({ message: `Ignorando evento do tipo: ${eventType}` });
    }

    const rawFrom = emailData.from || '';
    const subject = emailData.subject || '';
    const textContent = emailData.text || emailData.html || '';

    if (!rawFrom) {
      return NextResponse.json({ error: 'Remetente (from) não encontrado no payload' }, { status: 400 });
    }

    // Extract email from "Name <email@address.com>" or just "email@address.com"
    const emailMatch = rawFrom.match(/<([^>]+)>/) || rawFrom.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/);
    const senderEmail = emailMatch ? emailMatch[1].trim() : rawFrom.trim();

    console.log(`[Resend Inbound Webhook] Novo e-mail recebido de: ${senderEmail}`);

    const db = await getDb();

    // 1. Search for matching contact in database
    const contact = await db.get('SELECT * FROM contacts WHERE email = ? COLLATE NOCASE', senderEmail);

    if (!contact) {
      console.log(`[Resend Inbound Webhook] Contato com e-mail ${senderEmail} não encontrado no CRM. Ignorando.`);
      return NextResponse.json({ message: 'E-mail recebido, mas remetente não consta no CRM' });
    }

    // 2. Begin transaction to update contact status and log email
    await db.exec('BEGIN TRANSACTION');

    // Update status to 'Respondido'
    await db.run(
      "UPDATE contacts SET status = 'Respondido', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      contact.id
    );

    // Insert inbound email log
    await db.run(
      `INSERT INTO email_logs (contact_id, email_type, subject, body, status, sent_at, replied_at, reply_body)
       VALUES (?, 'inbound', ?, ?, 'replied', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)`,
      contact.id,
      subject,
      textContent,
      textContent
    );

    await db.exec('COMMIT');
    console.log(`[Resend Inbound Webhook] Contato ${contact.name} (ID: ${contact.id}) atualizado para "Respondido".`);

    return NextResponse.json({ success: true, message: 'Status do contato atualizado e log gravado' });
  } catch (error: any) {
    console.error('[Resend Inbound Webhook] Erro ao processar webhook:', error);
    return NextResponse.json(
      { error: 'Erro ao processar webhook', details: error.message },
      { status: 500 }
    );
  }
}

// GET method to facilitate manual simulation/testing in development
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const text = searchParams.get('text') || 'Simulated response text';
    const subject = searchParams.get('subject') || 'Re: website proposal';

    if (!email) {
      return NextResponse.json({ 
        error: 'Para testar, envie a query ?email=email_do_contato@dominio.com&text=mensagem_de_teste' 
      }, { status: 400 });
    }

    const db = await getDb();
    const contact = await db.get('SELECT * FROM contacts WHERE email = ? COLLATE NOCASE', email);

    if (!contact) {
      return NextResponse.json({ 
        error: `Contato com o e-mail "${email}" não foi encontrado para simulação.` 
      }, { status: 404 });
    }

    // Trigger simulation
    await db.exec('BEGIN TRANSACTION');
    await db.run("UPDATE contacts SET status = 'Respondido', updated_at = CURRENT_TIMESTAMP WHERE id = ?", contact.id);
    await db.run(
      `INSERT INTO email_logs (contact_id, email_type, subject, body, status, sent_at, replied_at, reply_body)
       VALUES (?, 'inbound', ?, ?, 'replied', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)`,
      contact.id,
      subject,
      text,
      text
    );
    await db.exec('COMMIT');

    return NextResponse.json({ 
      success: true, 
      message: `[SIMULAÇÃO] Contato ${contact.name} atualizado para 'Respondido'. Log de e-mail inserido.`,
      contact: contact
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro na simulação do webhook', details: error.message },
      { status: 500 }
    );
  }
}
