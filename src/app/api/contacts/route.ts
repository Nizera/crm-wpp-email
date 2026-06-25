import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { checkWhatsappExists } from '@/lib/whatsapp';


// GET all contacts
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const niche = searchParams.get('niche') || '';
    const tag = searchParams.get('tag') || '';

    const db = await getDb();
    
    let query = 'SELECT * FROM contacts WHERE 1=1';
    const params: any[] = [];

    if (search) {
      query += ' AND (name LIKE ? OR email LIKE ? OR notes LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (niche) {
      query += ' AND niche = ?';
      params.push(niche);
    }

    if (tag) {
      query += ' AND tags LIKE ?';
      params.push(`%${tag}%`);
    }

    query += ' ORDER BY created_at DESC';

    const contacts = await db.all(query, ...params);
    return NextResponse.json(contacts);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro ao buscar contatos', details: error.message },
      { status: 500 }
    );
  }
}

// POST create contact
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, website, niche, city, state, status, tags, notes } = body;

    if (!name) {
      return NextResponse.json({ error: 'O nome do contato é obrigatório.' }, { status: 400 });
    }

    const db = await getDb();
    
    // Check if email already exists to avoid duplicates
    if (email) {
      const existing = await db.get('SELECT id FROM contacts WHERE email = ?', email);
      if (existing) {
        return NextResponse.json(
          { error: 'Um contato com este endereço de e-mail já existe.' },
          { status: 409 }
        );
      }
    }

    // Validate WhatsApp status automatically
    let whatsappStatus = 'Não Verificado';
    if (phone) {
      try {
        const check = await checkWhatsappExists(phone);
        whatsappStatus = check.exists ? 'Válido' : 'Sem WhatsApp';
      } catch (err) {
        console.error('Erro ao verificar WhatsApp ao criar contato:', err);
      }
    } else {
      whatsappStatus = 'Sem WhatsApp';
    }

    const result = await db.run(
      `INSERT INTO contacts (name, email, phone, website, niche, city, state, status, tags, notes, whatsapp_status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      name,
      email || '',
      phone || '',
      website || '',
      niche || '',
      city || '',
      state || '',
      status || 'Novo',
      tags || '',
      notes || '',
      whatsappStatus
    );

    const newContact = await db.get('SELECT * FROM contacts WHERE id = ?', result.lastID);

    return NextResponse.json(newContact, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro ao criar contato', details: error.message },
      { status: 500 }
    );
  }
}
