import { NextResponse } from 'next/server';
import { getBaileysStatus } from '@/lib/baileys-client';
import { initializeBaileysHandler } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    initializeBaileysHandler();
    const status = getBaileysStatus();
    return NextResponse.json({ success: true, ...status });
  } catch (error: any) {
    console.error('[API Baileys Status] Erro:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao obter status' },
      { status: 500 }
    );
  }
}
