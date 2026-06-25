import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { processIncomingWhatsapp } from '@/lib/whatsapp';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, text } = body;

    if (!phone || !text) {
      return NextResponse.json({ error: 'Os campos phone e text são obrigatórios.' }, { status: 400 });
    }

    console.log(`[API WhatsApp Simulate] Simulando mensagem de ${phone}: "${text}"`);
    const result = await processIncomingWhatsapp(phone, text);

    return NextResponse.json({ 
      success: true, 
      contactMatched: result.contactMatched,
      replyText: result.replyText 
    });
  } catch (error: any) {
    console.error('[API WhatsApp Simulate] Erro:', error);
    return NextResponse.json({ error: 'Erro ao processar simulação', details: error.message }, { status: 500 });
  }
}

// GET method to facilitate testing via browser query params
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');
    const text = searchParams.get('text');

    if (!phone || !text) {
      return NextResponse.json({ 
        error: 'Por favor envie a query ?phone=telefone_do_lead&text=mensagem_de_teste' 
      }, { status: 400 });
    }

    console.log(`[API WhatsApp Simulate GET] Simulando mensagem de ${phone}: "${text}"`);
    const result = await processIncomingWhatsapp(phone, text);

    return NextResponse.json({ 
      success: true, 
      contactMatched: result.contactMatched,
      replyText: result.replyText 
    });
  } catch (error: any) {
    console.error('[API WhatsApp Simulate GET] Erro:', error);
    return NextResponse.json({ error: 'Erro ao processar simulação', details: error.message }, { status: 500 });
  }
}
