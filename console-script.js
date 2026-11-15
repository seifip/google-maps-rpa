/* Google Maps saved-place first pass. No clicks, requests, timers or list edits. */
(function (root) {
  'use strict';
  const categories = Object.freeze({
    'mexican restaurant': 'Mexican', 'taco restaurant': 'Mexican',
    'burrito restaurant': 'Mexican', 'tex-mex restaurant': 'Mexican',
    'italian restaurant': 'Mediterranean', 'greek restaurant': 'Mediterranean',
    'turkish restaurant': 'Mediterranean', 'pizza restaurant': 'Mediterranean',
    'cafe': 'Coffee', 'coffee shop': 'Coffee', 'espresso bar': 'Coffee',
    'tea house': 'Tea', 'tea shop': 'Tea', 'tea store': 'Tea',
    'chinese tea house': 'Tea', 'bakery': 'Bakery', 'pastry shop': 'Bakery',
    'dessert shop': 'Dessert', 'dessert restaurant': 'Dessert',
    'japanese sweets restaurant': 'Dessert'
  });
  const clean = value => String(value || '').trim().replace(/^·\s*/, '').toLowerCase();
  function classify(category) {
    // No fallback to Food, name guessing, or broad Mediterranean/ME inference.
    return Object.hasOwn(categories, clean(category)) ? categories[clean(category)] : null;
  }
  function placeURL(value) {
    try {
      const u = new URL(value, 'https://www.google.com');
      if (!['www.google.com', 'maps.google.com', 'google.com'].includes(u.hostname) || !u.pathname.startsWith('/maps/place/')) return null;
      if (u.protocol !== 'https:') return null;
      u.hash = '';
      return u.href;
    } catch { return null; }
  }
  function plan(records) {
    const seen = new Set();
    return records.flatMap(record => {
      const url = placeURL(record.url);
      // Only deduplicate by exact place URL, NEVER by restaurant name.
      const identity = url && (/data=/.test(url) || /[?&](?:query_place_id|cid)=/.test(url)) ? url : null;
      if (identity && seen.has(identity)) return [];
      if (identity) seen.add(identity);
      const text = record.text || '';
      const permanent = /\bpermanently closed\b/i.test(text);
      const temporary = /\btemporarily closed\b/i.test(text);
      const closure = permanent && temporary ? 'conflicting' : permanent ? 'permanent' : temporary ? 'temporary' : null;
      // List-row DOM does not prove absence from Heart/Favorites. Default unknown.
      const heartMembership = record.heartMembership === true ? 'yes' : record.heartMembership === false ? 'no' : 'unknown';
      const target = closure ? null : classify(record.category);
      return [{ name: record.name, category: record.category, url,
        target, closure, heartMembership, status: closure === 'permanent' ? (heartMembership === 'yes' ? 'keep: Heart exception' : heartMembership === 'unknown' ? 'blocked: verify Heart membership before removal' : 'removal candidate: verify permanent closure, exact pin and preserve notes') : closure ? 'review closure: leave saved' : !url ? 'review: identity missing' : target ? 'candidate: verify pin and notes' : 'review: unmapped category' }];
    });
  }
  function scan({ scope, sourceList, limit = 1000 } = {}) {
    if (!scope || typeof scope.querySelectorAll !== 'function' || !sourceList?.trim()) {
      throw new Error('Choose the saved-list DOM container and explicitly name sourceList. Nothing changed.');
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 5000) throw new Error('limit must be 1..5000');
    // Read loaded rows only. Selectors are best-effort and must be checked against
    // the current Maps UI. Existing-note rows are included (not just Add note).
    const headings = Array.from(scope.querySelectorAll('.fontHeadlineSmall'));
    const records = headings.slice(0, limit).map(heading => {
      const row = heading.closest('[role="button"]') || heading.closest('a');
      const category = row?.querySelector('.fontBodyMedium > div:last-child > div:last-child span:last-child');
      const anchor = row?.matches('a[href]') ? row : row?.querySelector('a[href*="/maps/place/"]');
      return { name: heading.textContent.trim(), category: category?.textContent.trim() || '',
        url: anchor?.getAttribute('href'), text: row?.textContent || heading.textContent };
    });
    return { sourceList, readOnly: true, coverage: 'loaded DOM only; not a complete list export',
      inspected: records.length, truncated: headings.length > limit, candidates: plan(records) };
  }
  const api = Object.freeze({ classify, placeURL, plan, scan });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {
    root.mapsSavedFirstPass = api;
    console.info('Read-only helper ready: mapsSavedFirstPass.scan({scope, sourceList}). No saved places changed.');
  }
})(globalThis);
