function normalizeAudience(value) {
  const a = String(value || 'unisex').toLowerCase();
  if (['men', 'women', 'unisex'].includes(a)) return a;
  return 'unisex';
}

const SEARCH_CATEGORY_ALIASES = {
  tee: 'tees',
  tees: 'tees',
  tshirt: 'tees',
  tshirts: 'tees',
  shirt: 'tees',
  shirts: 'tees',
  cargo: 'bottoms',
  cargos: 'bottoms',
  short: 'bottoms',
  shorts: 'bottoms',
  pant: 'bottoms',
  pants: 'bottoms',
  bottom: 'bottoms',
  bottoms: 'bottoms',
  denim: 'bottoms',
  cap: 'headwear',
  caps: 'headwear',
  beanie: 'headwear',
  beanies: 'headwear',
  headwear: 'headwear',
  bag: 'accessories',
  bags: 'accessories',
  accessory: 'accessories',
  accessories: 'accessories',
  hoodie: 'tees',
  hoodies: 'tees',
  oversize: 'oversized',
  oversized: 'oversized',
  boxy: 'boxy',
  women: 'women',
  woman: 'women',
  men: 'men',
  man: 'men',
  unisex: 'unisex',
};

function productSearchHaystack(p) {
  const colorNames = (p.colors || []).map((c) => c.name).join(' ');
  return [
    p.id,
    p.title,
    p.subtitle,
    p.category,
    p.tag,
    p.fit,
    p.details,
    p.audience,
    p.collection,
    p.discount,
    colorNames,
    ...(p.sizes || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function tokenMatchesProduct(token, p, haystack) {
  if (!token) return true;
  if (haystack.includes(token)) return true;

  const aliasCategory = SEARCH_CATEGORY_ALIASES[token];
  if (aliasCategory && p.category === aliasCategory) return true;
  if (aliasCategory === 'oversized' && String(p.fit || '').toLowerCase().includes('oversized')) {
    return true;
  }
  if (aliasCategory === 'boxy' && String(p.fit || '').toLowerCase().includes('boxy')) {
    return true;
  }
  if (token === 'men' || token === 'man') {
    const a = normalizeAudience(p.audience);
    return a === 'men' || a === 'unisex';
  }
  if (token === 'women' || token === 'woman') {
    const a = normalizeAudience(p.audience);
    return a === 'women' || a === 'unisex';
  }
  if (token === 'sale' || token === 'discount') {
    return Boolean(p.discount);
  }
  return false;
}

function matchesProductSearch(p, rawQuery) {
  const q = String(rawQuery || '').trim().toLowerCase();
  if (!q) return true;
  const haystack = productSearchHaystack(p);
  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every((token) => tokenMatchesProduct(token, p, haystack));
}

module.exports = {
  normalizeAudience,
  matchesProductSearch,
};
