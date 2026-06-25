import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// ─────────────────────────────────────────────────────────────
// Google Places API (New) — Nearby Search + Place Details
// Docs: https://developers.google.com/maps/documentation/places/web-service
// Cost: $32/1000 Nearby Search + $17/1000 Details → $200 free credit/month
// Free tier covers ~4,000 full searches/month (Nearby + Details)
// ─────────────────────────────────────────────────────────────

const GOOGLE_PLACES_BASE = 'https://maps.googleapis.com/maps/api/place';

// Map our niche slugs to Google Places types
const NICHE_TO_GOOGLE_TYPE: Record<string, string> = {
  dentist: 'dentist',
  plumber: 'plumber',
  restaurant: 'restaurant',
  beauty: 'beauty_salon',
  car_repair: 'car_repair',
  gym: 'gym',
  lawyer: 'lawyer',
  hotel: 'lodging',
  bakery: 'bakery',
  painter: 'painter',
  electrician: 'electrician',
  builder: 'general_contractor',
};

// Pre-defined coordinates for major US cities (same as OSM route)
const US_CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  'miami': { lat: 25.7617, lon: -80.1918 },
  'miami, fl': { lat: 25.7617, lon: -80.1918 },
  'orlando': { lat: 28.5383, lon: -81.3792 },
  'orlando, fl': { lat: 28.5383, lon: -81.3792 },
  'tampa': { lat: 27.9506, lon: -82.4572 },
  'tampa, fl': { lat: 27.9506, lon: -82.4572 },
  'jacksonville': { lat: 30.3322, lon: -81.6557 },
  'jacksonville, fl': { lat: 30.3322, lon: -81.6557 },
  'houston': { lat: 29.7604, lon: -95.3698 },
  'houston, tx': { lat: 29.7604, lon: -95.3698 },
  'dallas': { lat: 32.7767, lon: -96.7970 },
  'dallas, tx': { lat: 32.7767, lon: -96.7970 },
  'austin': { lat: 30.2672, lon: -97.7431 },
  'austin, tx': { lat: 30.2672, lon: -97.7431 },
  'san antonio': { lat: 29.4241, lon: -98.4936 },
  'san antonio, tx': { lat: 29.4241, lon: -98.4936 },
  'los angeles': { lat: 34.0522, lon: -118.2437 },
  'los angeles, ca': { lat: 34.0522, lon: -118.2437 },
  'san francisco': { lat: 37.7749, lon: -122.4194 },
  'san francisco, ca': { lat: 37.7749, lon: -122.4194 },
  'san diego': { lat: 32.7157, lon: -117.1611 },
  'san diego, ca': { lat: 32.7157, lon: -117.1611 },
  'new york': { lat: 40.7128, lon: -74.0060 },
  'new york, ny': { lat: 40.7128, lon: -74.0060 },
  'chicago': { lat: 41.8781, lon: -87.6298 },
  'chicago, il': { lat: 41.8781, lon: -87.6298 },
  'phoenix': { lat: 33.4484, lon: -112.0740 },
  'phoenix, az': { lat: 33.4484, lon: -112.0740 },
  'charlotte': { lat: 35.2271, lon: -80.8431 },
  'charlotte, nc': { lat: 35.2271, lon: -80.8431 },
  'seattle': { lat: 47.6062, lon: -122.3321 },
  'seattle, wa': { lat: 47.6062, lon: -122.3321 },
  'denver': { lat: 39.7392, lon: -104.9903 },
  'denver, co': { lat: 39.7392, lon: -104.9903 },
  'boston': { lat: 42.3601, lon: -71.0589 },
  'boston, ma': { lat: 42.3601, lon: -71.0589 },
  'nashville': { lat: 36.1627, lon: -86.7816 },
  'nashville, tn': { lat: 36.1627, lon: -86.7816 },
  'las vegas': { lat: 36.1699, lon: -115.1398 },
  'las vegas, nv': { lat: 36.1699, lon: -115.1398 },
  'atlanta': { lat: 33.7490, lon: -84.3880 },
  'atlanta, ga': { lat: 33.7490, lon: -84.3880 },
  'philadelphia': { lat: 39.9526, lon: -75.1652 },
  'philadelphia, pa': { lat: 39.9526, lon: -75.1652 },
  'portland': { lat: 45.5051, lon: -122.6750 },
  'portland, or': { lat: 45.5051, lon: -122.6750 },
};

async function geocodeWithGoogle(city: string, apiKey: string): Promise<{ lat: number; lon: number } | null> {
  // Check cache first
  const normalized = city.toLowerCase().trim();
  for (const [key, coords] of Object.entries(US_CITY_COORDS)) {
    if (normalized === key || normalized.startsWith(key.split(',')[0])) {
      return coords;
    }
  }

  // Use Google Geocoding API
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(city + ', USA')}&key=${apiKey}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;

  const data = await res.json();
  if (data.status !== 'OK' || !data.results?.[0]) return null;

  const loc = data.results[0].geometry.location;
  return { lat: loc.lat, lon: loc.lng };
}

async function nearbySearch(
  lat: number,
  lon: number,
  type: string,
  apiKey: string,
  pageToken?: string
): Promise<{ results: any[]; nextPageToken?: string }> {
  const params = new URLSearchParams({
    location: `${lat},${lon}`,
    radius: '8000', // 8km radius
    type,
    key: apiKey,
  });

  if (pageToken) {
    params.set('pagetoken', pageToken);
    // Google requires a short delay before using page tokens
    await new Promise(r => setTimeout(r, 2000));
  }

  const url = `${GOOGLE_PLACES_BASE}/nearbysearch/json?${params.toString()}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Nearby Search HTTP ${res.status}`);

  const data = await res.json();

  if (data.status === 'REQUEST_DENIED') {
    throw new Error(`Google API Key inválida ou Places API não ativada: ${data.error_message}`);
  }
  if (data.status === 'OVER_QUERY_LIMIT') {
    throw new Error('Limite de requisições do Google atingido. Tente novamente em alguns instantes.');
  }

  return {
    results: data.results || [],
    nextPageToken: data.next_page_token,
  };
}

async function getPlaceDetails(placeId: string, apiKey: string): Promise<any> {
  const params = new URLSearchParams({
    place_id: placeId,
    fields: 'name,formatted_phone_number,formatted_address,website,rating,user_ratings_total,opening_hours,types',
    key: apiKey,
  });

  const url = `${GOOGLE_PLACES_BASE}/details/json?${params.toString()}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;

  const data = await res.json();
  return data.status === 'OK' ? data.result : null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const city = searchParams.get('city')?.trim();
    const niche = searchParams.get('niche')?.trim();
    const withDetails = searchParams.get('details') !== 'false'; // default: fetch details

    if (!city || !niche) {
      return NextResponse.json(
        { error: 'Parâmetros "city" e "niche" são obrigatórios.' },
        { status: 400 }
      );
    }

    // Get Google API key from settings
    const db = await getDb();
    const setting = await db.get("SELECT value FROM settings WHERE key = 'google_places_api_key'");
    const apiKey = setting?.value?.trim();

    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'Google Places API Key não configurada.',
          hint: 'Acesse Configurações e adicione sua chave do Google Places API.',
          setup_url: 'https://console.cloud.google.com/apis/library/places-backend.googleapis.com',
        },
        { status: 422 }
      );
    }

    // Step 1: Geocode city
    const coords = await geocodeWithGoogle(city, apiKey);
    if (!coords) {
      return NextResponse.json(
        { error: `Cidade "${city}" não encontrada. Tente o formato "Tampa, FL" ou "Nashville, TN".` },
        { status: 404 }
      );
    }

    // Step 2: Nearby Search (up to 60 results = 3 pages of 20)
    const googleType = NICHE_TO_GOOGLE_TYPE[niche] || niche;
    let allResults: any[] = [];

    const page1 = await nearbySearch(coords.lat, coords.lon, googleType, apiKey);
    allResults = [...page1.results];

    // Fetch up to 2 more pages for more results (costs more credits)
    if (page1.nextPageToken && allResults.length < 40) {
      try {
        const page2 = await nearbySearch(coords.lat, coords.lon, googleType, apiKey, page1.nextPageToken);
        allResults = [...allResults, ...page2.results];
      } catch {
        // Page 2 optional, ignore errors
      }
    }

    // Step 3: Filter businesses without website
    const withoutWebsite = allResults.filter(p => !p.website);
    const withWebsite = allResults.filter(p => !!p.website);

    // Step 4: Get details (phone numbers) for leads without website
    // Limit to 20 details calls to save API credits
    const leadsToDetail = withoutWebsite.slice(0, 20);
    const leads = [];

    for (const place of leadsToDetail) {
      let phone = '';
      let address = place.vicinity || '';
      let rating = place.rating || 0;
      let reviewCount = place.user_ratings_total || 0;

      if (withDetails) {
        try {
          const details = await getPlaceDetails(place.place_id, apiKey);
          if (details) {
            phone = details.formatted_phone_number || '';
            address = details.formatted_address || address;
            rating = details.rating || rating;
            reviewCount = details.user_ratings_total || reviewCount;
          }
        } catch {
          // Details optional
        }
      }

      // Parse city/state from address
      const addressParts = address.split(',').map((s: string) => s.trim());
      const stateZip = addressParts[addressParts.length - 2] || '';
      const stateMatch = stateZip.match(/([A-Z]{2})\s*\d*/);
      const state = stateMatch?.[1] || city.includes(',') ? city.split(',')[1]?.trim() : '';

      leads.push({
        place_id: place.place_id,
        name: place.name,
        niche,
        phone,
        email: '', // Google does not provide emails — use Hunter.io enrichment
        website: '',
        address,
        city: city.split(',')[0].trim(),
        state,
        rating,
        review_count: reviewCount,
        google_maps_url: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
        latitude: place.geometry?.location?.lat,
        longitude: place.geometry?.location?.lng,
      });
    }

    return NextResponse.json({
      source: 'google_places',
      city,
      google_type: googleType,
      total_found: allResults.length,
      with_website: withWebsite.length,
      without_website: withoutWebsite.length,
      returned: leads.length,
      leads,
    });
  } catch (error: any) {
    console.error('[leads/google] error:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno na busca via Google Places.' },
      { status: 500 }
    );
  }
}
