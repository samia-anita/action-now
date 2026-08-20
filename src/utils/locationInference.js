'use strict';

/**
 * Infers a broad geographic region from a free-text location string.
 * Used to select the appropriate trusted-resource links on the results page.
 *
 * @param {string} location - Free-text location entered by user
 * @returns {'us' | 'ca' | 'uk' | 'intl'}
 */
function inferTrustRegion(location) {
  const s = (location || '').trim().toLowerCase();
  if (!s) return 'intl';

  // Canada signals
  if (
    /\bcanada\b/.test(s) ||
    /\b(on|bc|ab|sk|mb|qc|nl|ns|pe|nb|nt|yt|nu)\b/.test(s) ||
    /\b(toronto|montreal|calgary|ottawa|winnipeg|edmonton|mississauga|hamilton|halifax|saskatoon|regina|kelowna|charlottetown|fredericton|whitehorse|iqaluit)\b/.test(s) ||
    /\b(quebec city|québec)\b/.test(s) ||
    /\blondon\s*,\s*on\b/i.test(s)
  ) return 'ca';

  // UK signals
  if (
    /\b(united kingdom|great britain|england|scotland|wales|northern ireland)\b/.test(s) ||
    /,[\s]*uk\s*$/i.test(location.trim()) ||
    /^uk\s*,/i.test(location.trim())
  ) return 'uk';

  // US state abbreviations and city names
  if (
    /\b(united states|usa)\b/.test(s) ||
    /,[\s]*(al|ak|az|ar|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy|dc|pr|vi|gu|as)\b/i.test(location) ||
    /,[\s]*ca\b/i.test(location)
  ) return 'us';

  // Well-known US cities (no comma + state needed)
  if (
    /\b(new york|los angeles|chicago|houston|phoenix|philadelphia|san antonio|san diego|dallas|san jose|austin|jacksonville|fort worth|columbus|charlotte|indianapolis|seattle|denver|boston|detroit|nashville|portland|oklahoma city|las vegas|milwaukee|atlanta|minneapolis|tampa|baltimore|orlando|sacramento|miami|raleigh|omaha|tucson|fresno|honolulu|anchorage)\b/.test(s)
  ) return 'us';

  return 'intl';
}

module.exports = { inferTrustRegion };
