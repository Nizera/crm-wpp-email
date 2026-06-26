import { NextResponse } from 'next/server';
import { stopBaileys } from '@/lib/baileys-client';

export async function POST() {
  try {
    await stopBaileys();
    return NextResponse.json({ success: true, message: 'Desconectado do WhatsApp.' });
  } catch (error: any) {
    console.error('[API Baileys Logout] Erro:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao desconectar' },
      { status: 500 }
    );
  }
}
