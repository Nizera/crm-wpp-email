import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// ─────────────────────────────────────────────────────────────────
// Multiple Overpass endpoints for automatic failover
// ─────────────────────────────────────────────────────────────────
const OVERPASS_ENDPOINTS = [
  'https://z.overpass-api.de/api/interpreter',   // Primary (confirmed working)
  'https://overpass-api.de/api/interpreter',      // Fallback 1
  'https://lz4.overpass-api.de/api/interpreter',  // Fallback 2
];

const USER_AGENT = 'EmailOutreachCRM/1.0 (contact@example.com)';

// ─────────────────────────────────────────────────────────────────
// Pre-defined coordinates for major US cities to avoid Nominatim blocks.
// Format: "city, state" → { lat, lon }
// ─────────────────────────────────────────────────────────────────
const US_CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  // Florida
  'miami': { lat: 25.7617, lon: -80.1918 },
  'miami, fl': { lat: 25.7617, lon: -80.1918 },
  'orlando': { lat: 28.5383, lon: -81.3792 },
  'orlando, fl': { lat: 28.5383, lon: -81.3792 },
  'tampa': { lat: 27.9506, lon: -82.4572 },
  'tampa, fl': { lat: 27.9506, lon: -82.4572 },
  'jacksonville': { lat: 30.3322, lon: -81.6557 },
  'jacksonville, fl': { lat: 30.3322, lon: -81.6557 },
  // Texas
  'houston': { lat: 29.7604, lon: -95.3698 },
  'houston, tx': { lat: 29.7604, lon: -95.3698 },
  'dallas': { lat: 32.7767, lon: -96.7970 },
  'dallas, tx': { lat: 32.7767, lon: -96.7970 },
  'austin': { lat: 30.2672, lon: -97.7431 },
  'austin, tx': { lat: 30.2672, lon: -97.7431 },
  'san antonio': { lat: 29.4241, lon: -98.4936 },
  'san antonio, tx': { lat: 29.4241, lon: -98.4936 },
  // California
  'los angeles': { lat: 34.0522, lon: -118.2437 },
  'los angeles, ca': { lat: 34.0522, lon: -118.2437 },
  'san francisco': { lat: 37.7749, lon: -122.4194 },
  'san francisco, ca': { lat: 37.7749, lon: -122.4194 },
  'san diego': { lat: 32.7157, lon: -117.1611 },
  'san diego, ca': { lat: 32.7157, lon: -117.1611 },
  // New York
  'new york': { lat: 40.7128, lon: -74.0060 },
  'new york, ny': { lat: 40.7128, lon: -74.0060 },
  'brooklyn': { lat: 40.6782, lon: -73.9442 },
  'bronx': { lat: 40.8448, lon: -73.8648 },
  // Others
  'chicago': { lat: 41.8781, lon: -87.6298 },
  'chicago, il': { lat: 41.8781, lon: -87.6298 },
  'phoenix': { lat: 33.4484, lon: -112.0740 },
  'phoenix, az': { lat: 33.4484, lon: -112.0740 },
  'philadelphia': { lat: 39.9526, lon: -75.1652 },
  'philadelphia, pa': { lat: 39.9526, lon: -75.1652 },
  'san jose': { lat: 37.3382, lon: -121.8863 },
  'san jose, ca': { lat: 37.3382, lon: -121.8863 },
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
  'minneapolis': { lat: 44.9778, lon: -93.2650 },
  'minneapolis, mn': { lat: 44.9778, lon: -93.2650 },
  'portland': { lat: 45.5051, lon: -122.6750 },
  'portland, or': { lat: 45.5051, lon: -122.6750 },
};

// ─────────────────────────────────────────────────────────────────
// Niche → OSM amenity/craft/shop tag mapping
// ─────────────────────────────────────────────────────────────────
const NICHE_OSM_TAGS: Record<string, { key: string; value: string }> = {
  dentist: { key: 'amenity', value: 'dentist' },
  plumber: { key: 'craft', value: 'plumber' },
  restaurant: { key: 'amenity', value: 'restaurant' },
  beauty: { key: 'shop', value: 'hairdresser' },
  car_repair: { key: 'shop', value: 'car_repair' },
  gym: { key: 'leisure', value: 'fitness_centre' },
  lawyer: { key: 'office', value: 'lawyer' },
  hotel: { key: 'tourism', value: 'hotel' },
  bakery: { key: 'shop', value: 'bakery' },
  painter: { key: 'craft', value: 'painter' },
  electrician: { key: 'craft', value: 'electrician' },
  builder: { key: 'craft', value: 'builder' },
};

// ─────────────────────────────────────────────────────────────────
// Geocode with pre-defined cache → Photon fallback → Nominatim fallback
// ─────────────────────────────────────────────────────────────────
async function geocodeCity(city: string): Promise<{ lat: number; lon: number; displayName: string } | null> {
  const normalized = city.toLowerCase().trim();

  // 1. Check pre-defined cache (instant, no network)
  for (const [key, coords] of Object.entries(US_CITY_COORDS)) {
    if (normalized.includes(key) || key.includes(normalized.split(',')[0].trim())) {
      return { ...coords, displayName: city };
    }
  }

  // 2. Try Photon (Komoot) - no server-side blocks, OSM-based
  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(city + ', USA')}&limit=5&lang=en`;
    const res = await fetch(photonUrl, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': USER_AGENT },
    });

    if (res.ok) {
      const data = await res.json();
      const features = data.features || [];

      // Prioritize actual cities/towns in the US
      const cityFeature = features.find(
        (f: any) =>
          f.properties?.country_code === 'us' &&
          ['city', 'town', 'village', 'municipality'].includes(f.properties?.osm_value || f.properties?.type)
      );

      const chosen = cityFeature || features.find((f: any) => f.properties?.country_code === 'us') || features[0];

      if (chosen) {
        const [lon, lat] = chosen.geometry.coordinates;
        return {
          lat,
          lon,
          displayName: [chosen.properties?.name, chosen.properties?.state, 'USA'].filter(Boolean).join(', '),
        };
      }
    }
  } catch (e) {
    console.warn('[geocode] Photon failed:', (e as Error).message);
  }

  // 3. Try Nominatim as last resort with browser UA
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city + ', USA')}&format=json&limit=1&email=contact@emailcrm.dev`;
    const res = await fetch(nomUrl, {
      signal: AbortSignal.timeout(6000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon),
          displayName: data[0].display_name,
        };
      }
    }
  } catch (e) {
    console.warn('[geocode] Nominatim failed:', (e as Error).message);
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────
// Query Overpass with retry + endpoint failover
// Uses `around:radius` (more reliable than bounding box queries)
// Uses URLSearchParams body (fixes 406 on some endpoints)
// ─────────────────────────────────────────────────────────────────
async function queryOverpass(lat: number, lon: number, osmKey: string, osmValue: string, radiusMeters = 8000): Promise<any[]> {
  const query = `[out:json][timeout:25];
(
  node["${osmKey}"="${osmValue}"](around:${radiusMeters},${lat},${lon});
  way["${osmKey}"="${osmValue}"](around:${radiusMeters},${lat},${lon});
);
out center;`;

  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const endpointIndex = (attempt - 1) % OVERPASS_ENDPOINTS.length;
    const endpoint = OVERPASS_ENDPOINTS[endpointIndex];

    console.log(`[overpass] Attempt ${attempt} via endpoint ${endpointIndex + 1}: ${endpoint}`);

    try {
      // Use URLSearchParams body (avoids 406 on certain servers)
      const formData = new URLSearchParams();
      formData.append('data', query);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT,
        },
        body: formData.toString(),
        signal: AbortSignal.timeout(20000),
      });

      if (res.status === 429) {
        const wait = attempt * 3000;
        console.warn(`[overpass] Rate limited, waiting ${wait}ms`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      if (data.error) throw new Error(`Overpass error: ${data.error}`);

      console.log(`[overpass] Success: ${data.elements?.length || 0} elements`);
      return data.elements || [];

    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[overpass] Attempt ${attempt} failed: ${lastError.message}`);

      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, attempt * 2000));
      }
    }
  }

  console.error('[overpass] All endpoints failed:', lastError?.message);
  return [];
}

// ─────────────────────────────────────────────────────────────────
// Main route handler
// ─────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const city = searchParams.get('city')?.trim();
    const niche = searchParams.get('niche')?.trim();

    if (!city || !niche) {
      return NextResponse.json(
        { error: 'Parâmetros "city" e "niche" são obrigatórios.' },
        { status: 400 }
      );
    }

    // Check if Google Places API Key is configured
    const db = await getDb();
    const keyRow = await db.get("SELECT value FROM settings WHERE key = 'google_places_api_key'");
    const apiKey = keyRow?.value || '';

    if (apiKey) {
      console.log(`[Google Places] Searching for ${niche} in ${city} using Google Places API...`);
      // 1. Text Search to get place list
      const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(niche + ' in ' + city)}&key=${apiKey}`;
      const searchRes = await fetch(searchUrl);
      if (!searchRes.ok) {
        throw new Error(`Google Places Search API returned status ${searchRes.status}`);
      }
      const searchData = await searchRes.json();
      const results = searchData.results || [];
      console.log(`[Google Places] Found ${results.length} initial results.`);

      // 2. Fetch details for each place to get phone and website (cap to top 20 to save quota and time)
      const leads = [];
      const limitedResults = results.slice(0, 20);

      for (const place of limitedResults) {
        try {
          const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_phone_number,website,formatted_address,geometry,address_components&key=${apiKey}`;
          const detailsRes = await fetch(detailsUrl);
          if (detailsRes.ok) {
            const detailsData = await detailsRes.json();
            const result = detailsData.result;
            if (result) {
              // We only want leads without website (matching the Overpass filtering criteria)
              if (!result.website) {
                // Find state and city from address_components if possible
                let foundCity = city.split(',')[0].trim();
                let foundState = city.includes(',') ? city.split(',')[1].trim() : '';

                if (result.address_components) {
                  const cityComp = result.address_components.find((c: any) => c.types.includes('locality'));
                  const stateComp = result.address_components.find((c: any) => c.types.includes('administrative_area_level_1'));
                  if (cityComp) foundCity = cityComp.long_name;
                  if (stateComp) foundState = stateComp.short_name;
                }

                leads.push({
                  osm_id: place.place_id, // Use Google place_id as the unique identifier
                  name: result.name || place.name,
                  niche,
                  phone: result.formatted_phone_number || '',
                  email: '', // Google Places does not return email address
                  website: '',
                  street: result.formatted_address || '',
                  city: foundCity,
                  state: foundState,
                  latitude: result.geometry?.location?.lat || place.geometry?.location?.lat,
                  longitude: result.geometry?.location?.lng || place.geometry?.location?.lng,
                });
              }
            }
          }
        } catch (detailErr) {
          console.error(`[Google Places Details Error] For place ${place.place_id}:`, detailErr);
        }
      }

      console.log(`[Google Places] Processed results. Returning ${leads.length} leads without website.`);
      return NextResponse.json({
        city,
        total_found: results.length,
        without_website: leads.length,
        leads,
      });
    }

    // STEP 1: Geocode
    const geo = await geocodeCity(city);
    if (!geo) {
      return NextResponse.json(
        { error: `Cidade "${city}" não encontrada. Tente o formato "Miami, FL" ou "Houston, TX".` },
        { status: 404 }
      );
    }

    console.log(`[search] Geocoded "${city}" → lat=${geo.lat}, lon=${geo.lon}`);

    // STEP 2: Get OSM tag for niche
    const osmTag = NICHE_OSM_TAGS[niche] || { key: 'amenity', value: niche };

    // STEP 3: Query Overpass
    const elements = await queryOverpass(geo.lat, geo.lon, osmTag.key, osmTag.value);

    // STEP 4: Filter + map
    const leads = elements
      .filter((el: any) => el.tags?.name && !el.tags?.website && !el.tags?.['contact:website'])
      .map((el: any) => {
        const coords = el.center || { lat: el.lat, lon: el.lon };
        const houseNum = el.tags?.['addr:housenumber'] || '';
        const street = el.tags?.['addr:street'] || '';
        return {
          osm_id: el.id,
          name: el.tags.name,
          niche,
          phone: el.tags?.phone || el.tags?.['contact:phone'] || '',
          email: el.tags?.email || el.tags?.['contact:email'] || '',
          website: '',
          street: [houseNum, street].filter(Boolean).join(' '),
          city: el.tags?.['addr:city'] || city.split(',')[0].trim(),
          state: el.tags?.['addr:state'] || (city.includes(',') ? city.split(',')[1].trim() : ''),
          latitude: coords.lat,
          longitude: coords.lon,
        };
      });

    return NextResponse.json({
      city: geo.displayName,
      total_found: elements.length,
      without_website: leads.length,
      leads,
    });

  } catch (error: any) {
    console.error('[leads/search] Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno ao realizar busca', details: error.message },
      { status: 500 }
    );
  }
}
