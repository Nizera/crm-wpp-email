import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, subject, body: templateBody } = body;

    const db = await getDb();

    // Check if exists
    const template = await db.get('SELECT id FROM templates WHERE id = ?', id);
    if (!template) {
      return NextResponse.json({ error: 'Modelo não encontrado.' }, { status: 404 });
    }

    await db.run(
      `UPDATE templates SET 
        name = COALESCE(?, name),
        subject = COALESCE(?, subject),
        body = COALESCE(?, body),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      name,
      subject,
      templateBody,
      id
    );

    const updatedTemplate = await db.get('SELECT * FROM templates WHERE id = ?', id);
    return NextResponse.json(updatedTemplate);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro ao atualizar modelo de e-mail', details: error.message },
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

    // Check if exists
    const template = await db.get('SELECT id FROM templates WHERE id = ?', id);
    if (!template) {
      return NextResponse.json({ error: 'Modelo não encontrado.' }, { status: 404 });
    }

    await db.run('DELETE FROM templates WHERE id = ?', id);

    return NextResponse.json({ success: true, message: 'Modelo excluído com sucesso.' });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro ao excluir modelo de e-mail', details: error.message },
      { status: 500 }
    );
  }
}
