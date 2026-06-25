import { NextRequest, NextResponse } from 'next/server';
import { processIncomingWhatsapp } from '@/lib/whatsapp';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('[WhatsApp Webhook] Evento recebido:', body.event || 'desconhecido');

    // Evolution API sends 'messages.upsert' event when a message is received or sent
    if (body.event !== 'messages.upsert') {
      return NextResponse.json({ success: true, message: `Ignorando evento: ${body.event}` });
    }

    const messageData = body.data;
    if (!messageData) {
      return NextResponse.json({ error: 'Data não encontrado no payload' }, { status: 400 });
    }

    const key = messageData.key;
    if (!key) {
      return NextResponse.json({ error: 'Key não encontrada na data' }, { status: 400 });
    }

    // Ignore if message was sent by ourselves
    if (key.fromMe) {
      return NextResponse.json({ success: true, message: 'Ignorando mensagem enviada por nós (fromMe: true)' });
    }

    const remoteJid = key.remoteJid || '';
    if (!remoteJid || remoteJid.includes('@g.us')) {
      return NextResponse.json({ success: true, message: 'Ignorando mensagem de grupo ou JID inválido' });
    }

    // Phone number is the part before the @
    const phone = remoteJid.split('@')[0];

    // Extract text from various message types
    let text = '';
    const message = messageData.message;
    if (message) {
      if (message.conversation) {
        text = message.conversation;
      } else if (message.extendedTextMessage?.text) {
        text = message.extendedTextMessage.text;
      } else if (message.imageMessage?.caption) {
        text = message.imageMessage.caption;
      } else if (message.videoMessage?.caption) {
        text = message.videoMessage.caption;
      } else {
        text = '[Mensagem não textual]';
      }
    }

    if (!phone) {
      return NextResponse.json({ error: 'Telefone do remetente não identificado' }, { status: 400 });
    }

    console.log(`[WhatsApp Webhook] Processando mensagem de ${phone}: "${text}"`);
    const result = await processIncomingWhatsapp(phone, text);

    return NextResponse.json({ 
      success: true, 
      contactMatched: result.contactMatched,
      replyText: result.replyText 
    });
  } catch (error: any) {
    console.error('[WhatsApp Webhook] Erro ao processar webhook:', error);
    return NextResponse.json({ error: 'Erro interno', details: error.message }, { status: 500 });
  }
}
