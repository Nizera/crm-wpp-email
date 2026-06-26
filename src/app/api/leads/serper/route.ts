import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { checkWhatsappExists, cleanPhoneNumber } from '@/lib/whatsapp';
import { getBaileysStatus } from '@/lib/baileys-client';

const SERPER_MAPS_URL = 'https://google.serper.dev/maps';
const SERPER_SEARCH_URL = 'https://google.serper.dev/search';
const TARGET_LEADS = 100;
const MAX_CITY_PAGES = 6;
const MAX_AREA_PAGES = 2;

const NICHE_QUERIES: Record<string, string> = {
  dentist: 'dentists',
  plumber: 'plumbers',
  restaurant: 'restaurants cafes',
  beauty: 'beauty salons hairdressers',
  car_repair: 'auto repair shops mechanics',
  gym: 'gyms fitness centers',
  lawyer: 'law firms lawyers',
  hotel: 'hotels motels',
  bakery: 'bakeries',
  painter: 'painters painting contractors',
  electrician: 'electricians electrical contractors',
  builder: 'builders construction contractors',
};

const US_SEARCH_AREAS = [
  ['New York, NY', 'NY', 40.7128, -74.0060],
  ['Los Angeles, CA', 'CA', 34.0522, -118.2437],
  ['Chicago, IL', 'IL', 41.8781, -87.6298],
  ['Houston, TX', 'TX', 29.7604, -95.3698],
  ['Phoenix, AZ', 'AZ', 33.4484, -112.0740],
  ['Philadelphia, PA', 'PA', 39.9526, -75.1652],
  ['San Antonio, TX', 'TX', 29.4241, -98.4936],
  ['San Diego, CA', 'CA', 32.7157, -117.1611],
  ['Dallas, TX', 'TX', 32.7767, -96.7970],
  ['San Jose, CA', 'CA', 37.3382, -121.8863],
  ['Austin, TX', 'TX', 30.2672, -97.7431],
  ['Jacksonville, FL', 'FL', 30.3322, -81.6557],
  ['Fort Worth, TX', 'TX', 32.7555, -97.3308],
  ['Columbus, OH', 'OH', 39.9612, -82.9988],
  ['Charlotte, NC', 'NC', 35.2271, -80.8431],
  ['San Francisco, CA', 'CA', 37.7749, -122.4194],
  ['Indianapolis, IN', 'IN', 39.7684, -86.1581],
  ['Seattle, WA', 'WA', 47.6062, -122.3321],
  ['Denver, CO', 'CO', 39.7392, -104.9903],
  ['Washington, DC', 'DC', 38.9072, -77.0369],
  ['Boston, MA', 'MA', 42.3601, -71.0589],
  ['El Paso, TX', 'TX', 31.7619, -106.4850],
  ['Nashville, TN', 'TN', 36.1627, -86.7816],
  ['Detroit, MI', 'MI', 42.3314, -83.0458],
  ['Oklahoma City, OK', 'OK', 35.4676, -97.5164],
  ['Portland, OR', 'OR', 45.5152, -122.6784],
  ['Las Vegas, NV', 'NV', 36.1699, -115.1398],
  ['Memphis, TN', 'TN', 35.1495, -90.0490],
  ['Louisville, KY', 'KY', 38.2527, -85.7585],
  ['Baltimore, MD', 'MD', 39.2904, -76.6122],
  ['Milwaukee, WI', 'WI', 43.0389, -87.9065],
  ['Albuquerque, NM', 'NM', 35.0844, -106.6504],
  ['Tucson, AZ', 'AZ', 32.2226, -110.9747],
  ['Fresno, CA', 'CA', 36.7378, -119.7871],
  ['Sacramento, CA', 'CA', 38.5816, -121.4944],
  ['Kansas City, MO', 'MO', 39.0997, -94.5786],
  ['Mesa, AZ', 'AZ', 33.4152, -111.8315],
  ['Atlanta, GA', 'GA', 33.7490, -84.3880],
  ['Omaha, NE', 'NE', 41.2565, -95.9345],
  ['Raleigh, NC', 'NC', 35.7796, -78.6382],
  ['Miami, FL', 'FL', 25.7617, -80.1918],
  ['Tampa, FL', 'FL', 27.9506, -82.4572],
  ['Orlando, FL', 'FL', 28.5383, -81.3792],
].map(([label, state, lat, lon]) => ({ label: String(label), state: String(state), lat: Number(lat), lon: Number(lon) }));

type SearchScope = 'city' | 'state' | 'country';

type SerperPlace = {
  position?: number;
  title?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  ratingCount?: number;
  category?: string;
  phoneNumber?: string;
  website?: string;
  cid?: string;
  placeId?: string;
};

type Lead = {
  place_id: string;
  name: string;
  niche: string;
  phone: string;
  email: string;
  website: string;
  street: string;
  address: string;
  city: string;
  state: string;
  rating: number;
  review_count: number;
  google_maps_url: string;
  latitude?: number;
  longitude?: number;
  whatsapp_valid: boolean;
  whatsapp_jid?: string;
  contact_method: 'whatsapp' | 'email';
};

function parseAddress(address: string, fallbackLocation: string) {
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
  const city = parts.length >= 2 ? parts[parts.length - 2] : fallbackLocation.split(',')[0].trim();
  const stateZip = parts.length >= 1 ? parts[parts.length - 1] : '';
  const state = stateZip.match(/\b([A-Z]{2})\b/)?.[1] || extractState(fallbackLocation);

  return {
    street: parts.length >= 3 ? parts.slice(0, -2).join(', ') : parts[0] || '',
    city,
    state,
  };
}

function extractState(value: string) {
  return value.match(/\b([A-Z]{2})\b/i)?.[1]?.toUpperCase() || '';
}

function isRealEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function extractEmailFromText(text: string) {
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const email = match?.[0]?.toLowerCase() || '';
  if (!isRealEmail(email)) return '';
  if (email.includes('example.') || email.endsWith('.png') || email.endsWith('.jpg')) return '';
  return email;
}

function formatLl(lat?: number, lon?: number, zoom = 12) {
  if (typeof lat !== 'number' || typeof lon !== 'number') return undefined;
  return `@${lat},${lon},${zoom}z`;
}

async function serperRequest(apiKey: string, url: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.error || `Serper retornou HTTP ${res.status}`);
  }

  return data;
}

async function searchEmail(apiKey: string, place: SerperPlace, location: string) {
  const name = place.title?.trim();
  if (!name) return '';

  const data = await serperRequest(apiKey, SERPER_SEARCH_URL, {
    q: `"${name}" "${location}" email OR contact`,
    gl: 'us',
    hl: 'en',
    num: 10,
  });

  const texts = [
    data.knowledgeGraph?.description,
    ...(data.organic || []).flatMap((item: any) => [item.snippet, item.title, item.link]),
  ].filter(Boolean);

  for (const text of texts) {
    const email = extractEmailFromText(String(text));
    if (email) return email;
  }

  return '';
}

function getLeadKey(place: SerperPlace) {
  return place.placeId || place.cid || `${place.title || ''}-${place.address || ''}`;
}

function getAreas(scope: SearchScope, city: string, state: string) {
  if (scope === 'country') return US_SEARCH_AREAS;

  const normalizedState = state || extractState(city);
  if (scope === 'state' && normalizedState) {
    const stateAreas = US_SEARCH_AREAS.filter((area) => area.state === normalizedState);
    if (stateAreas.length > 0) return stateAreas;
  }

  const known = US_SEARCH_AREAS.find((area) => area.label.toLowerCase() === city.toLowerCase());
  return known
    ? [known]
    : [{ label: city, state: normalizedState, lat: undefined as number | undefined, lon: undefined as number | undefined }];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const city = searchParams.get('city')?.trim() || '';
    const state = searchParams.get('state')?.trim().toUpperCase() || '';
    const niche = searchParams.get('niche')?.trim();
    const scope = (searchParams.get('scope') || 'city') as SearchScope;
    const target = Math.min(Math.max(Number(searchParams.get('target') || TARGET_LEADS), 1), 150);

    if (!niche || (scope !== 'country' && !city && !state)) {
      return NextResponse.json(
        { error: 'Informe o nicho e uma localizacao, ou use o escopo pais inteiro.' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const setting = await db.get("SELECT value FROM settings WHERE key = 'serper_api_key'");
    const apiKey = setting?.value?.trim();

    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'Serper API Key nao configurada.',
          hint: 'Acesse Configuracoes e adicione sua chave da Serper. A busca usa Google Maps via Serper e valida WhatsApp pelo Baileys.',
          setup_url: 'https://serper.dev',
        },
        { status: 422 }
      );
    }

    const areas = getAreas(scope, city, state);
    const pagesPerArea = scope === 'city' ? MAX_CITY_PAGES : MAX_AREA_PAGES;
    const seen = new Set<string>();
    const leads: Lead[] = [];
    const warnings: string[] = [];
    let totalFound = 0;
    let withoutWebsite = 0;
    let whatsappValid = 0;
    let emailOnly = 0;
    let checkedPhones = 0;
    const canValidateWhatsapp = getBaileysStatus().state === 'connected';

    for (const area of areas) {
      if (leads.length >= target) break;

      const queryLocation = area.label;
      const q = `${NICHE_QUERIES[niche] || niche} in ${queryLocation}`;
      let ll = formatLl(area.lat, area.lon);

      for (let page = 1; page <= pagesPerArea && leads.length < target; page++) {
        if (page > 1 && !ll) {
          warnings.push(`Sem coordenadas GPS para paginar em ${queryLocation}.`);
          break;
        }

        const body: Record<string, unknown> = {
          q,
          gl: 'us',
          hl: 'en',
          num: 20,
        };

        if (page > 1) {
          body.page = page;
          body.ll = ll;
        } else if (ll) {
          body.ll = ll;
        }

        let data: any;
        try {
          data = await serperRequest(apiKey, SERPER_MAPS_URL, body);
        } catch (error: any) {
          warnings.push(`${queryLocation}: ${error.message}`);
          break;
        }

        const places: SerperPlace[] = data.places || [];
        if (places.length === 0) break;

        if (!ll) {
          const placeWithCoords = places.find((place) => place.latitude && place.longitude);
          ll = formatLl(placeWithCoords?.latitude, placeWithCoords?.longitude);
        }

        totalFound += places.length;

        for (const place of places) {
          if (leads.length >= target) break;

          const key = getLeadKey(place);
          const phone = place.phoneNumber || '';
          const cleanedPhone = cleanPhoneNumber(phone);
          const dedupeKey = cleanedPhone || key;

          if (!place.title || seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);

          if (place.website) continue;
          withoutWebsite += 1;

          let hasWhatsapp = false;
          let whatsappJid: string | undefined;

          if (cleanedPhone && canValidateWhatsapp) {
            checkedPhones += 1;
            const check = await checkWhatsappExists(cleanedPhone);
            hasWhatsapp = check.exists;
            whatsappJid = check.jid;
          }

          let email = '';
          if (!hasWhatsapp) {
            try {
              email = await searchEmail(apiKey, place, queryLocation);
            } catch (emailError) {
              console.warn('[serper] Email search failed:', (emailError as Error).message);
            }
          }

          if (!hasWhatsapp && !email) continue;

          const address = place.address || '';
          const parsed = parseAddress(address, queryLocation);

          if (hasWhatsapp) whatsappValid += 1;
          else emailOnly += 1;

          leads.push({
            place_id: key,
            name: place.title,
            niche,
            phone,
            email,
            website: '',
            street: parsed.street,
            address,
            city: parsed.city,
            state: parsed.state,
            rating: place.rating || 0,
            review_count: place.ratingCount || 0,
            google_maps_url: place.placeId
              ? `https://www.google.com/maps/place/?q=place_id:${place.placeId}`
              : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.title} ${address}`)}`,
            latitude: place.latitude,
            longitude: place.longitude,
            whatsapp_valid: hasWhatsapp,
            whatsapp_jid: whatsappJid,
            contact_method: hasWhatsapp ? 'whatsapp' : 'email',
          });
        }
      }
    }

    return NextResponse.json({
      source: 'serper',
      scope,
      city: scope === 'country' ? 'United States' : city || state,
      query: `${NICHE_QUERIES[niche] || niche} - ${scope}`,
      areas_searched: areas.map((area) => area.label),
      total_found: totalFound,
      without_website: withoutWebsite,
      checked_phones: checkedPhones,
      whatsapp_valid: whatsappValid,
      email_only: emailOnly,
      whatsapp_validation: canValidateWhatsapp ? 'baileys_connected' : 'baileys_not_connected',
      target,
      returned: leads.length,
      leads,
      warning: leads.length < target
        ? `A Serper retornou ${leads.length} leads qualificados. Tente ampliar o escopo, trocar o nicho ou conectar o WhatsApp para validar telefones.`
        : undefined,
      warnings,
    });
  } catch (error: any) {
    console.error('[leads/serper] error:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno na busca via Serper.' },
      { status: 500 }
    );
  }
}
