import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
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

    // Fetch all email logs for this contact, ordered by date
    const logs = await db.all(
      `SELECT * FROM email_logs 
       WHERE contact_id = ? 
       ORDER BY sent_at DESC`,
      id
    );

    return NextResponse.json({
      contact,
      logs
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro ao buscar histórico de e-mails', details: error.message },
      { status: 500 }
    );
  }
}
