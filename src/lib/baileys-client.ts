import 'server-only';

import { makeWASocket, useMultiFileAuthState, DisconnectReason, type WASocket, type WAMessageKey } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';

const AUTH_DIR = path.join(process.cwd(), 'wa_auth_session');

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'logged_out';

type MessageDirection = 'inbound' | 'outbound';
type MessageHandler = (
  phone: string,
  text: string,
  key: WAMessageKey,
  direction: MessageDirection,
  pushName?: string
) => Promise<void>;

const globalForBaileys = globalThis as unknown as {
  baileysSock: WASocket | null;
  baileysConnectionState: ConnectionState;
  baileysQRCode: string | null;
  baileysQRBase64: string | null;
  baileysMessageHandler: MessageHandler | null;
  baileysListenerAttached: boolean;
  jidMap: Map<string, string>; // JID (ex: "93407166857460@s.whatsapp.net") → phone number (ex: "5515997466814")
  pendingJidMap: Map<string, { phone: string; timestamp: number }>; // message ID → { phone, timestamp } — captures LID JIDs from server echo
  onConnectedCallbacks: Array<() => void>;
  pendingCleanupInterval: ReturnType<typeof setInterval> | null;
};

if (!globalForBaileys.jidMap) {
  globalForBaileys.jidMap = new Map();
}

if (!globalForBaileys.pendingJidMap) {
  globalForBaileys.pendingJidMap = new Map();
}

if (!globalForBaileys.onConnectedCallbacks) {
  globalForBaileys.onConnectedCallbacks = [];
}

if (!globalForBaileys.baileysSock) {
  globalForBaileys.baileysSock = null;
  globalForBaileys.baileysConnectionState = 'idle';
  globalForBaileys.baileysQRCode = null;
  globalForBaileys.baileysQRBase64 = null;
  globalForBaileys.baileysMessageHandler = null;
  globalForBaileys.baileysListenerAttached = false;
  globalForBaileys.pendingCleanupInterval = null;
}

// Clean up stale pending entries every 30 seconds
if (!globalForBaileys.pendingCleanupInterval) {
  globalForBaileys.pendingCleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of globalForBaileys.pendingJidMap) {
      if (now - entry.timestamp > 120_000) {
        globalForBaileys.pendingJidMap.delete(id);
      }
    }
  }, 30_000);
}

export function setBaileysMessageHandler(handler: MessageHandler) {
  globalForBaileys.baileysMessageHandler = handler;
}

export function onBaileysConnected(cb: () => void) {
  globalForBaileys.onConnectedCallbacks.push(cb);
  // Fire immediately if already connected
  if (globalForBaileys.baileysConnectionState === 'connected') {
    setTimeout(() => {
      try { cb(); } catch (e) { console.warn('[Baileys] Erro em callback onConnected (imediato):', e); }
    }, 0);
  }
}

export function getBaileysSock(): WASocket | null {
  return globalForBaileys.baileysSock;
}

// Resolve a phone number to the actual WhatsApp JID (handles LID migration)
export async function resolveJid(phone: string): Promise<string | null> {
  try {
    const sock = globalForBaileys.baileysSock;
    if (!sock) return null;
    const result = await sock.onWhatsApp(phone);
    if (result && result.length > 0 && result[0].exists) {
      return result[0].jid;
    }
  } catch (e) {
    console.warn(`[Baileys] Erro ao resolver JID para ${phone}:`, e);
  }
  return null;
}

// Register a JID → phone mapping so inbound messages can be matched
export function registerJidMapping(jid: string, phone: string) {
  globalForBaileys.jidMap.set(jid, phone);
}

// Look up a phone number from a JID (reverse map)
export function lookupPhoneByJid(jid: string): string | undefined {
  return globalForBaileys.jidMap.get(jid);
}

function getJidPhone(jid?: string | null): string | null {
  if (!jid || jid.includes('@g.us')) return null;
  if (!jid.endsWith('@s.whatsapp.net')) return null;
  return jid.split('@')[0]?.split(':')[0] || null;
}

function resolvePhoneFromMessageKey(key: WAMessageKey): { phone: string; rawJid: string; altJid?: string } | null {
  const rawJid = key.remoteJid;
  if (!rawJid || rawJid.includes('@g.us')) return null;

  const keyWithAlt = key as WAMessageKey & {
    remoteJidAlt?: string;
    participantAlt?: string;
    participant?: string;
  };

  const mappedPhone = lookupPhoneByJid(rawJid);
  if (mappedPhone) {
    return { phone: mappedPhone, rawJid };
  }

  const altJids = [
    keyWithAlt.remoteJidAlt,
    keyWithAlt.participantAlt,
    keyWithAlt.participant,
  ].filter(Boolean) as string[];

  for (const altJid of altJids) {
    const mappedAltPhone = lookupPhoneByJid(altJid);
    const phoneFromAlt = mappedAltPhone || getJidPhone(altJid);

    if (phoneFromAlt) {
      globalForBaileys.jidMap.set(rawJid, phoneFromAlt);
      return { phone: phoneFromAlt, rawJid, altJid };
    }
  }

  const phoneFromRaw = getJidPhone(rawJid);
  if (phoneFromRaw) {
    return { phone: phoneFromRaw, rawJid };
  }

  return { phone: rawJid.split('@')[0], rawJid };
}

function getMessageText(msg: any): string {
  const message = msg.message;
  if (!message) return '';

  const text = message.conversation
    || message.extendedTextMessage?.text
    || message.imageMessage?.caption
    || message.videoMessage?.caption
    || '';

  if (text) return text;

  if (message.imageMessage) return '[Imagem]';
  if (message.videoMessage) return '[Video]';
  if (message.audioMessage) return '[Audio]';
  if (message.documentMessage) {
    const fileName = message.documentMessage.fileName;
    return fileName ? `[Documento: ${fileName}]` : '[Documento]';
  }
  if (message.stickerMessage) return '[Sticker]';
  if (message.locationMessage || message.liveLocationMessage) return '[Localizacao]';
  if (message.contactMessage || message.contactsArrayMessage) return '[Contato]';
  if (message.pollCreationMessage || message.pollCreationMessageV3) return '[Enquete]';

  return '';
}

// Pre-build JID map for all CRM phone numbers so inbound messages can be matched
export async function buildJidMap(phones: string[]): Promise<void> {
  const sock = globalForBaileys.baileysSock;
  if (!sock) return;
  const uniquePhones = [...new Set(phones.filter(Boolean))];
  let mapped = 0;
  // Process individually since onWhatsApp accepts string, not string[]
  // Do parallel batches of 5 to speed up without rate limiting
  for (let i = 0; i < uniquePhones.length; i += 5) {
    const batch = uniquePhones.slice(i, i + 5);
    await Promise.all(batch.map(async (phone) => {
      try {
        const results = await sock.onWhatsApp(phone);
        if (results && results.length > 0 && results[0].exists) {
          const jid = results[0].jid;
          globalForBaileys.jidMap.set(jid, phone);
          mapped++;
        }
      } catch {
        // Ignore individual errors
      }
    }));
  }
  console.log(`[Baileys] Mapa JID construído: ${mapped} contatos mapeados`);
}

export function getBaileysStatus() {
  return {
    state: globalForBaileys.baileysConnectionState,
    qrCode: globalForBaileys.baileysQRBase64,
    hasQrCode: !!globalForBaileys.baileysQRBase64,
  };
}

export async function startBaileys(): Promise<void> {
  if (globalForBaileys.baileysSock) {
    return;
  }

  if (globalForBaileys.baileysConnectionState === 'connecting') {
    return;
  }

  globalForBaileys.baileysConnectionState = 'connecting';

  try {
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      syncFullHistory: false,
      emitOwnEvents: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        globalForBaileys.baileysQRCode = qr;
        try {
          globalForBaileys.baileysQRBase64 = await QRCode.toDataURL(qr);
        } catch {
          globalForBaileys.baileysQRBase64 = null;
        }
        globalForBaileys.baileysConnectionState = 'connecting';
      }

      if (connection) {
        if (connection === 'open') {
          globalForBaileys.baileysConnectionState = 'connected';
          globalForBaileys.baileysQRCode = null;
          globalForBaileys.baileysQRBase64 = null;
          console.log('[Baileys] Conectado ao WhatsApp!');
          // Fire on-connected callbacks (build JID map, etc.)
          for (const cb of globalForBaileys.onConnectedCallbacks) {
            try { cb(); } catch (e) { console.warn('[Baileys] Erro em callback onConnected:', e); }
          }
        } else if (connection === 'close') {
          const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;

          if (shouldReconnect) {
            globalForBaileys.baileysConnectionState = 'disconnected';
            console.log('[Baileys] Conexão fechada, reconectando em 5s...');
            setTimeout(() => {
              globalForBaileys.baileysSock = null;
              globalForBaileys.baileysListenerAttached = false;
              startBaileys();
            }, 5000);
          } else {
            globalForBaileys.baileysConnectionState = 'logged_out';
            console.log('[Baileys] Sessão expirada/inválida, limpando credenciais...');
            // Remove stale auth session so next connection gets a fresh QR
            try {
              if (fs.existsSync(AUTH_DIR)) {
                fs.rmSync(AUTH_DIR, { recursive: true, force: true });
              }
            } catch (e) {
              console.warn('[Baileys] Erro ao limpar sessão:', e);
            }
          }

          globalForBaileys.baileysSock = null;
          globalForBaileys.baileysListenerAttached = false;
          globalForBaileys.baileysQRCode = null;
          globalForBaileys.baileysQRBase64 = null;

          // After cleanup, allow a fresh connection with QR
          if (globalForBaileys.baileysConnectionState === 'logged_out') {
            setTimeout(() => {
              globalForBaileys.baileysConnectionState = 'idle';
              console.log('[Baileys] Pronto para nova conexão com QR Code.');
            }, 1000);
          }
        }
      }
    });

    if (!globalForBaileys.baileysListenerAttached) {
      sock.ev.on('messages.upsert', async (msgEvent) => {
        // Process pending JID mapping from outgoing messages (captures LID JIDs from server echoes)
        for (const msg of msgEvent.messages) {
          const key = msg.key;
          if (!key || !key.remoteJid || key.remoteJid.includes('@g.us')) continue;

          const pending = key.id ? globalForBaileys.pendingJidMap.get(key.id) : undefined;
          if (pending) {
            globalForBaileys.jidMap.set(key.remoteJid, pending.phone);
            const keyWithAlt = key as WAMessageKey & { remoteJidAlt?: string; participantAlt?: string; participant?: string };
            [keyWithAlt.remoteJidAlt, keyWithAlt.participantAlt, keyWithAlt.participant]
              .filter(Boolean)
              .forEach((jid) => globalForBaileys.jidMap.set(jid as string, pending.phone));
            console.log(`[Baileys] Mapeamento JID registrado (msg ${key.id}): ${key.remoteJid} -> ${pending.phone}`);
          }
        }

        const handler = globalForBaileys.baileysMessageHandler;
        if (!handler) {
          if (msgEvent.messages.length > 0) {
            const msg = msgEvent.messages[0];
            const key = msg.key;
            if (key && key.remoteJid && !key.remoteJid.includes('@g.us')) {
              const resolved = resolvePhoneFromMessageKey(key);
              const text = getMessageText(msg);
              if (resolved?.phone) {
                const direction = key.fromMe ? 'outbound' : 'inbound';
                console.log(`[Baileys] Mensagem ${direction} (sem handler) de ${key.remoteJid} (telefone: ${resolved.phone}): "${text}"`);
              }
            }
          }
          return;
        }

        for (const msg of msgEvent.messages) {
          const key = msg.key;
          if (!key || !key.remoteJid || key.remoteJid.includes('@g.us')) {
            continue;
          }

          const resolved = resolvePhoneFromMessageKey(key);
          const text = getMessageText(msg);

          if (resolved?.phone && text) {
            const direction = key.fromMe ? 'outbound' : 'inbound';
            const altInfo = resolved.altJid ? ` alt=${resolved.altJid}` : '';
            console.log(`[Baileys] Mensagem ${direction} de ${resolved.rawJid}${altInfo} (telefone: ${resolved.phone}): "${text}"`);
            await handler(resolved.phone, text, key, direction, msg.pushName || undefined);
          } else if (key.remoteJid?.endsWith('@lid')) {
            console.warn('[Baileys] Mensagem @lid sem telefone alternativo detectado:', key);
          }
        }
      });

      globalForBaileys.baileysListenerAttached = true;
    }
    globalForBaileys.baileysSock = sock;
  } catch (error) {
    console.error('[Baileys] Erro ao iniciar:', error);
    globalForBaileys.baileysConnectionState = 'disconnected';
    globalForBaileys.baileysSock = null;
  }
}

export async function sendBaileysMessage(jid: string, text: string, phone?: string): Promise<string | false> {
  const sock = globalForBaileys.baileysSock;
  if (!sock) {
    console.warn('[Baileys] Socket não disponível para envio.');
    return false;
  }

  try {
    const result = await sock.sendMessage(jid, { text });
    if (result?.key?.id && phone) {
      globalForBaileys.pendingJidMap.set(result.key.id, { phone, timestamp: Date.now() });
    }
    console.log(`[Baileys] Mensagem enviada para ${jid}`);
    return result?.key?.id || 'sent';
  } catch (error) {
    console.error(`[Baileys] Erro ao enviar mensagem para ${jid}:`, error);
    return false;
  }
}

export async function stopBaileys(): Promise<void> {
  const sock = globalForBaileys.baileysSock;
  if (sock) {
    try {
      await sock.logout();
    } catch {
      sock.ws.close();
    }
  }

  globalForBaileys.baileysSock = null;
  globalForBaileys.baileysConnectionState = 'idle';
  globalForBaileys.baileysQRCode = null;
  globalForBaileys.baileysQRBase64 = null;
  globalForBaileys.baileysListenerAttached = false;

  try {
    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    }
  } catch (e) {
    console.warn('[Baileys] Erro ao limpar sessão:', e);
  }
}
