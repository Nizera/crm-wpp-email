import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// Hunter.io Domain Search + Email Finder
// Docs: https://hunter.io/api-documentation/v2

async function findEmailViaHunter(
  apiKey: string,
  companyName: string,
  city: string,
  state: string
): Promise<{ email: string | null; score: number; sources: string[] }> {
  // Step 1: Try to find the domain for this company via Hunter domain search
  const domainSearchUrl = new URL('https://api.hunter.io/v2/domain-search');
  domainSearchUrl.searchParams.set('company', companyName);
  domainSearchUrl.searchParams.set('api_key', apiKey);
  domainSearchUrl.searchParams.set('limit', '5');
  domainSearchUrl.searchParams.set('type', 'generic');

  try {
    const domainRes = await fetch(domainSearchUrl.toString(), {
      signal: AbortSignal.timeout(10000),
    });

    if (domainRes.ok) {
      const domainData = await domainRes.json();
      const emails = domainData.data?.emails || [];

      if (emails.length > 0) {
        // Pick highest score email
        const best = emails.sort((a: any, b: any) => b.confidence - a.confidence)[0];
        return {
          email: best.value,
          score: best.confidence,
          sources: best.sources?.map((s: any) => s.uri) || [],
        };
      }

      // If domain found but no emails listed, try email finder with generic pattern
      const domain = domainData.data?.domain;
      const pattern = domainData.data?.pattern; // e.g. "{first}.{last}"

      if (domain && pattern) {
        return {
          email: `info@${domain}`,
          score: 30,
          sources: [],
        };
      }

      if (domain) {
        return {
          email: `info@${domain}`,
          score: 20,
          sources: [],
        };
      }
    }
  } catch (err) {
    console.warn('[hunter] domain-search failed:', (err as Error).message);
  }

  return { email: null, score: 0, sources: [] };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, city, state } = body;

    if (!name) {
      return NextResponse.json({ error: 'O campo "name" é obrigatório.' }, { status: 400 });
    }

    // Get Hunter API key from settings
    const db = await getDb();
    const setting = await db.get("SELECT value FROM settings WHERE key = 'hunter_api_key'");
    const apiKey = setting?.value?.trim();

    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'Hunter.io API Key não configurada.',
          hint: 'Acesse Configurações e adicione sua chave da Hunter.io (hunterApiKey). O plano gratuito permite 25 buscas/mês.',
        },
        { status: 422 }
      );
    }

    const result = await findEmailViaHunter(apiKey, name, city || '', state || '');

    if (result.email) {
      return NextResponse.json({
        email: result.email,
        confidence: result.score,
        sources: result.sources,
      });
    }

    return NextResponse.json(
      {
        error: 'E-mail não encontrado para esta empresa via Hunter.io.',
        hint: 'Tente buscar manualmente no Google ou Yelp.',
      },
      { status: 404 }
    );
  } catch (error: any) {
    console.error('[leads/enrich] error:', error);
    return NextResponse.json(
      { error: 'Erro interno ao buscar e-mail.', details: error.message },
      { status: 500 }
    );
  }
}
