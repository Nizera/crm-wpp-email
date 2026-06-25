import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { checkWhatsappExists } from '@/lib/whatsapp';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const contactId = searchParams.get('contactId');

    if (!contactId) {
      return NextResponse.json({ error: 'Parâmetro contactId é obrigatório.' }, { status: 400 });
    }

    const db = await getDb();
    const contact = await db.get('SELECT * FROM contacts WHERE id = ?', contactId);

    if (!contact) {
      return NextResponse.json({ error: 'Contato não encontrado.' }, { status: 404 });
    }

    if (!contact.phone) {
      // No phone number, so it doesn't have WhatsApp
      await db.run(
        "UPDATE contacts SET whatsapp_status = 'Sem WhatsApp', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        contactId
      );
      return NextResponse.json({ success: true, exists: false, whatsapp_status: 'Sem WhatsApp' });
    }

    // Call helper to check number
    const check = await checkWhatsappExists(contact.phone);
    const newStatus = check.exists ? 'Válido' : 'Sem WhatsApp';

    // Update in database
    await db.run(
      "UPDATE contacts SET whatsapp_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      newStatus,
      contactId
    );

    console.log(`[API WhatsApp Check] Contato ${contactId} (${contact.phone}) verificado. Novo status: ${newStatus}`);

    return NextResponse.json({ 
      success: true, 
      exists: check.exists, 
      whatsapp_status: newStatus 
    });

  } catch (error: any) {
    console.error('[API WhatsApp Check Number] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao verificar número do WhatsApp', details: error.message },
      { status: 500 }
    );
  }
}
