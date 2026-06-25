import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = await getDb();
    const automations = await db.all('SELECT * FROM automations ORDER BY created_at DESC');
    return NextResponse.json(automations);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro ao buscar automações', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'O nome da automação é obrigatório.' },
        { status: 400 }
      );
    }

    const db = await getDb();
    
    // Create a default initial flow structure with a single trigger node
    const defaultFlow = {
      id: 'trigger',
      type: 'trigger',
      title: 'Gatilho: Novo Contato Adicionado',
      description: 'Disparado quando um contato é salvo com status Novo.',
      config: { event: 'contact_added' },
      nextId: null
    };

    const flowJson = JSON.stringify(defaultFlow);

    const result = await db.run(
      'INSERT INTO automations (name, status, flow_json) VALUES (?, ?, ?)',
      name,
      'inactive',
      flowJson
    );

    const newAutomation = await db.get('SELECT * FROM automations WHERE id = ?', result.lastID);
    return NextResponse.json(newAutomation, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro ao criar automação', details: error.message },
      { status: 500 }
    );
  }
}
