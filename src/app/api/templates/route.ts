import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = await getDb();
    const templates = await db.all('SELECT * FROM templates ORDER BY created_at DESC');
    return NextResponse.json(templates);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro ao buscar modelos de e-mail', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, subject, body: templateBody } = body;

    if (!name || !subject || !templateBody) {
      return NextResponse.json(
        { error: 'Nome, assunto e corpo do modelo são obrigatórios.' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const result = await db.run(
      'INSERT INTO templates (name, subject, body) VALUES (?, ?, ?)',
      name,
      subject,
      templateBody
    );

    const newTemplate = await db.get('SELECT * FROM templates WHERE id = ?', result.lastID);
    return NextResponse.json(newTemplate, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro ao criar modelo de e-mail', details: error.message },
      { status: 500 }
    );
  }
}
