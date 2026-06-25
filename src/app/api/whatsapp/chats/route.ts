import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = await getDb();
    
    // Retrieve contacts with phone and their last WhatsApp message information
    const chats = await db.all(`
      SELECT c.id, c.name, c.phone, c.niche, c.city, c.state, c.status, c.whatsapp_agent_active, c.whatsapp_status,
             (SELECT body FROM whatsapp_messages WHERE contact_id = c.id ORDER BY sent_at DESC LIMIT 1) as last_msg_body,
             (SELECT sent_at FROM whatsapp_messages WHERE contact_id = c.id ORDER BY sent_at DESC LIMIT 1) as last_msg_time
      FROM contacts c
      WHERE c.phone IS NOT NULL AND c.phone != ''
      ORDER BY last_msg_time DESC, c.created_at DESC
    `);

    return NextResponse.json(chats);
  } catch (error: any) {
    console.error('[API WhatsApp Chats] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar conversas', details: error.message },
      { status: 500 }
    );
  }
}
