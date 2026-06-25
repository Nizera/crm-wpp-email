import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { checkWhatsappExists } from '@/lib/whatsapp';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, email, phone, website, niche, city, state, status, tags, notes } = body;

    const db = await getDb();

    // Verify contact exists
    const contact = await db.get('SELECT id, phone, whatsapp_status FROM contacts WHERE id = ?', id);
    if (!contact) {
      return NextResponse.json({ error: 'Contato não encontrado.' }, { status: 404 });
    }

    // Handle WhatsApp validation if phone number changes
    let newWhatsappStatus = contact.whatsapp_status;
    if (phone !== undefined && phone !== contact.phone) {
      if (phone) {
        try {
          const check = await checkWhatsappExists(phone);
          newWhatsappStatus = check.exists ? 'Válido' : 'Sem WhatsApp';
        } catch (err) {
          console.error('Erro ao verificar WhatsApp ao atualizar contato:', err);
          newWhatsappStatus = 'Não Verificado';
        }
      } else {
        newWhatsappStatus = 'Sem WhatsApp';
      }
    }

    await db.run(
      `UPDATE contacts SET 
        name = COALESCE(?, name),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        website = COALESCE(?, website),
        niche = COALESCE(?, niche),
        city = COALESCE(?, city),
        state = COALESCE(?, state),
        status = COALESCE(?, status),
        tags = COALESCE(?, tags),
        notes = COALESCE(?, notes),
        whatsapp_status = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      name,
      email,
      phone,
      website,
      niche,
      city,
      state,
      status,
      tags,
      notes,
      newWhatsappStatus,
      id
    );

    const updatedContact = await db.get('SELECT * FROM contacts WHERE id = ?', id);
    return NextResponse.json(updatedContact);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro ao atualizar contato', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = await getDb();

    // Verify contact exists
    const contact = await db.get('SELECT id FROM contacts WHERE id = ?', id);
    if (!contact) {
      return NextResponse.json({ error: 'Contato não encontrado.' }, { status: 404 });
    }

    await db.run('DELETE FROM contacts WHERE id = ?', id);

    return NextResponse.json({ success: true, message: 'Contato excluído com sucesso.' });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro ao excluir contato', details: error.message },
      { status: 500 }
    );
  }
}
