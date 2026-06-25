import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const contactId = searchParams.get('contactId');

    if (!contactId) {
      return NextResponse.json({ error: 'Parâmetro contactId é obrigatório.' }, { status: 400 });
    }

    const db = await getDb();
    
    // Check if contact exists
    const contact = await db.get('SELECT id FROM contacts WHERE id = ?', contactId);
    if (!contact) {
      return NextResponse.json({ error: 'Contato não encontrado.' }, { status: 404 });
    }

    // Retrieve messages
    const messages = await db.all(
      'SELECT * FROM whatsapp_messages WHERE contact_id = ? ORDER BY sent_at ASC',
      contactId
    );

    return NextResponse.json({ success: true, messages });
  } catch (error: any) {
    console.error('[API WhatsApp Messages] Erro:', error);
    return NextResponse.json({ error: 'Erro ao buscar histórico de mensagens', details: error.message }, { status: 500 });
  }
}
