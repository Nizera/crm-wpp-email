import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contactId, active } = body;

    if (contactId === undefined || active === undefined) {
      return NextResponse.json({ error: 'Os campos contactId e active são obrigatórios.' }, { status: 400 });
    }

    const db = await getDb();
    
    // Verify contact exists
    const contact = await db.get('SELECT id FROM contacts WHERE id = ?', contactId);
    if (!contact) {
      return NextResponse.json({ error: 'Contato não encontrado.' }, { status: 404 });
    }

    const val = active ? 1 : 0;
    await db.run(
      'UPDATE contacts SET whatsapp_agent_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      val,
      contactId
    );

    console.log(`[API WhatsApp Toggle Agent] IA ativa para contato ${contactId} atualizada para: ${val}`);

    return NextResponse.json({ success: true, whatsapp_agent_active: val });
  } catch (error: any) {
    console.error('[API WhatsApp Toggle Agent] Erro:', error);
    return NextResponse.json({ error: 'Erro ao alternar estado do agente de IA', details: error.message }, { status: 500 });
  }
}
