import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sendWhatsappMessage } from '@/lib/whatsapp';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contactId, text } = body;

    if (!contactId || !text) {
      return NextResponse.json({ error: 'Os campos contactId e text são obrigatórios.' }, { status: 400 });
    }

    const db = await getDb();
    const contact = await db.get('SELECT * FROM contacts WHERE id = ?', contactId);

    if (!contact) {
      return NextResponse.json({ error: 'Contato não encontrado.' }, { status: 404 });
    }

    if (!contact.phone) {
      return NextResponse.json({ error: 'Contato não possui número de telefone cadastrado.' }, { status: 400 });
    }

    console.log(`[API WhatsApp Send] Enviando manual para contato ${contactId} (${contact.phone})`);
    
    // Call the helper to send via Baileys.
    const sent = await sendWhatsappMessage(contact.id, contact.phone, text);

    if (!sent) {
      return NextResponse.json(
        { error: 'O Baileys nao confirmou o envio da mensagem. Verifique se o WhatsApp esta conectado.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, message: 'Mensagem enviada com sucesso' });
  } catch (error: any) {
    console.error('[API WhatsApp Send] Erro:', error);
    return NextResponse.json({ error: 'Erro ao enviar mensagem', details: error.message }, { status: 500 });
  }
}
