import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = await getDb();
    const settingsList = await db.all('SELECT * FROM settings');
    
    // Map list of settings to key-value object
    const settingsObj: Record<string, string> = {};
    settingsList.forEach((row) => {
      settingsObj[row.key] = row.value || '';
    });

    return NextResponse.json(settingsObj);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro ao buscar configurações', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const db = await getDb();

    // Begin a transaction to ensure all settings are updated successfully
    await db.exec('BEGIN TRANSACTION');

    for (const [key, value] of Object.entries(body)) {
      await db.run(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?',
        key,
        value,
        value
      );
    }

    await db.exec('COMMIT');

    return NextResponse.json({ success: true, message: 'Configurações atualizadas' });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro ao atualizar configurações', details: error.message },
      { status: 500 }
    );
  }
}
