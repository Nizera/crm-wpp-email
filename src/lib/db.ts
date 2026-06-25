import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let dbInstance: Database | null = null;

export async function getDb(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = path.resolve(process.cwd(), 'database.sqlite');
  
  dbInstance = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  // Enable foreign keys
  await dbInstance.exec('PRAGMA foreign_keys = ON;');

  // Initialize schemas
  await initializeDatabase(dbInstance);

  return dbInstance;
}

async function initializeDatabase(db: Database) {
  // 1. Settings Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  // 2. Contacts Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      website TEXT,
      niche TEXT,
      city TEXT,
      state TEXT,
      status TEXT DEFAULT 'Novo',
      tags TEXT DEFAULT '',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 3. Templates Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 4. Email Logs Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS email_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER,
      template_id INTEGER,
      email_type TEXT,
      resend_id TEXT,
      subject TEXT,
      body TEXT,
      status TEXT DEFAULT 'sent',
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      replied_at DATETIME,
      reply_body TEXT,
      FOREIGN KEY (contact_id) REFERENCES contacts (id) ON DELETE CASCADE,
      FOREIGN KEY (template_id) REFERENCES templates (id) ON DELETE SET NULL
    )
  `);

  // 5. Automations Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS automations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'inactive',
      flow_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 6. Automation States Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS automation_states (
      contact_id INTEGER,
      automation_id INTEGER,
      current_node_id TEXT,
      status TEXT DEFAULT 'running', -- 'running', 'waiting', 'completed', 'failed'
      scheduled_at DATETIME,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (contact_id, automation_id),
      FOREIGN KEY (contact_id) REFERENCES contacts (id) ON DELETE CASCADE,
      FOREIGN KEY (automation_id) REFERENCES automations (id) ON DELETE CASCADE
    )
  `);

  // 7. Whatsapp Messages Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS whatsapp_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER,
      direction TEXT, -- 'inbound' or 'outbound'
      body TEXT,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contact_id) REFERENCES contacts (id) ON DELETE CASCADE
    )
  `);

  // Alter contacts table safely if columns do not exist
  const tableInfo = await db.all("PRAGMA table_info(contacts)");
  const hasAgentActive = tableInfo.some((col) => col.name === 'whatsapp_agent_active');
  if (!hasAgentActive) {
    await db.exec("ALTER TABLE contacts ADD COLUMN whatsapp_agent_active INTEGER DEFAULT 0");
  }
  const hasWhatsappStatus = tableInfo.some((col) => col.name === 'whatsapp_status');
  if (!hasWhatsappStatus) {
    await db.exec("ALTER TABLE contacts ADD COLUMN whatsapp_status TEXT DEFAULT 'Desconectado'");
  }

  // Seed default templates if empty
  const templatesCount = await db.get('SELECT COUNT(*) as count FROM templates');
  if (templatesCount.count === 0) {
    await db.run(
      `INSERT INTO templates (name, subject, body) VALUES (?, ?, ?)`,
      'Outreach 1: Website Proposal',
      'Website proposal for {{business_name}}',
      `Hi {{business_name}} Team,

I was looking for local businesses in {{city}} and noticed your business, but couldn't find a website for it. 

In today's digital world, having a professional website is crucial to show up on Google, build trust, and drive new clients. We specialize in building fast, beautiful, and mobile-friendly websites for businesses like yours.

Would you be open to a quick chat next week to see how we can help you get more clients?

Best regards,
[Your Name]`
    );

    await db.run(
      `INSERT INTO templates (name, subject, body) VALUES (?, ?, ?)`,
      'Outreach 2: Follow-up',
      'Quick follow up: Website for {{business_name}}',
      `Hi {{business_name}} Team,

I'm just following up on my email from a few days ago. 

I understand you're busy running {{business_name}}. I wanted to share a quick mock-up of what your website could look like, or discuss how we can build a simple page to start bringing in online leads.

If you're interested, let know, and we can set up a 5-minute call.

Best regards,
[Your Name]`
    );
  }

  // Seed settings if empty
  const resendKey = await db.get("SELECT value FROM settings WHERE key = 'resend_api_key'");
  if (!resendKey) {
    await db.run("INSERT INTO settings (key, value) VALUES ('resend_api_key', '')");
    await db.run("INSERT INTO settings (key, value) VALUES ('resend_from_email', 'onboarding@resend.dev')");
    await db.run("INSERT INTO settings (key, value) VALUES ('inbound_domain', '')");
  }

  // Seed WhatsApp / Evolution API default settings if they don't exist
  const evolutionUrl = await db.get("SELECT value FROM settings WHERE key = 'evolution_api_url'");
  if (!evolutionUrl) {
    await db.run("INSERT INTO settings (key, value) VALUES ('evolution_api_url', 'http://localhost:8080')");
    await db.run("INSERT INTO settings (key, value) VALUES ('evolution_api_token', '')");
    await db.run("INSERT INTO settings (key, value) VALUES ('evolution_instance_name', '')");
    await db.run("INSERT INTO settings (key, value) VALUES ('whatsapp_agent_provider', 'gemini')");
    await db.run("INSERT INTO settings (key, value) VALUES ('whatsapp_agent_model', 'gemini-1.5-flash')");
    await db.run("INSERT INTO settings (key, value) VALUES ('whatsapp_agent_api_key', '')");
    await db.run(
      "INSERT INTO settings (key, value) VALUES ('whatsapp_agent_prompt', ?)",
      "Você é um assistente comercial inteligente para agência de desenvolvimento web. Seu objetivo é conversar com o dono da empresa {{business_name}} no nicho de {{niche}} em {{city}}, e agendar uma ligação/reunião curta de 5 minutos para apresentar uma proposta de criação de website para eles (já que eles não possuem um site atualmente). Seja simpático, breve, profissional e responda na mesma língua que o lead falar. Quando o lead aceitar agendar a reunião ou demonstrar interesse claro, pergunte qual o melhor dia e horário ou agende diretamente."
    );
  }
}
