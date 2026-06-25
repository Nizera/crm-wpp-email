import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = await getDb();

    // 1. Total Contacts
    const contactsCount = await db.get('SELECT COUNT(*) as count FROM contacts');
    const totalContacts = contactsCount?.count || 0;

    // 2. Total Sent
    const sentCount = await db.get("SELECT COUNT(*) as count FROM email_logs WHERE email_type != 'inbound' AND status = 'sent'");
    const totalSent = sentCount?.count || 0;

    // 3. Total Replied
    const repliedCount = await db.get("SELECT COUNT(*) as count FROM contacts WHERE status = 'Respondido'");
    const totalReplied = repliedCount?.count || 0;

    // 4. Calculate Conversion Rate
    const conversionRate = totalSent > 0 ? (totalReplied / totalSent) * 100 : 0;

    // 5. Fetch Recent Activities (Last 5 email logs)
    const recentActivities = await db.all(`
      SELECT l.*, c.name as contact_name
      FROM email_logs l
      JOIN contacts c ON c.id = l.contact_id
      ORDER BY l.sent_at DESC
      LIMIT 5
    `);

    return NextResponse.json({
      stats: {
        totalContacts,
        totalSent,
        totalReplied,
        conversionRate: Math.min(100, conversionRate)
      },
      recentActivities
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro ao calcular estatísticas do dashboard', details: error.message },
      { status: 500 }
    );
  }
}
