import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = await getDb();
    const automation = await db.get('SELECT * FROM automations WHERE id = ?', id);
    
    if (!automation) {
      return NextResponse.json({ error: 'Automação não encontrada.' }, { status: 404 });
    }

    return NextResponse.json(automation);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro ao buscar automação', details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, status, flow_json } = body;

    const db = await getDb();

    // Check if exists
    const automation = await db.get('SELECT id FROM automations WHERE id = ?', id);
    if (!automation) {
      return NextResponse.json({ error: 'Automação não encontrada.' }, { status: 404 });
    }

    await db.run(
      `UPDATE automations SET 
        name = COALESCE(?, name),
        status = COALESCE(?, status),
        flow_json = COALESCE(?, flow_json),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      name,
      status,
      flow_json,
      id
    );

    const updatedAutomation = await db.get('SELECT * FROM automations WHERE id = ?', id);
    return NextResponse.json(updatedAutomation);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro ao atualizar automação', details: error.message },
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
    const automation = await db.get('SELECT id FROM automations WHERE id = ?', id);
    if (!automation) {
      return NextResponse.json({ error: 'Automação não encontrada.' }, { status: 404 });
    }

    await db.run('DELETE FROM automations WHERE id = ?', id);

    return NextResponse.json({ success: true, message: 'Automação excluída com sucesso.' });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro ao excluir automação', details: error.message },
      { status: 500 }
    );
  }
}
