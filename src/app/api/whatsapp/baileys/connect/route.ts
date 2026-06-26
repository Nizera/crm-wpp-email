import { NextResponse } from 'next/server';
import { startBaileys } from '@/lib/baileys-client';
import { initializeBaileysHandler } from '@/lib/whatsapp';

export async function POST() {
  try {
    initializeBaileysHandler();
    await startBaileys();
    return NextResponse.json({ success: true, message: 'Conectando ao WhatsApp via Baileys...' });
  } catch (error: any) {
    console.error('[API Baileys Connect] Erro:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao iniciar conexão' },
      { status: 500 }
    );
  }
}
