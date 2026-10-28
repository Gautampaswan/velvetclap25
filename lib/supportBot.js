const { matchesProductSearch } = require('./catalogSearch');

const FILLER =
  /\b(i|me|my|want|need|looking|for|show|find|get|some|any|please|can|you|have|do|the|a|an|is|are|what|which|where|hi|hello|hey|bro|bhai|dikhao|chahiye|koi|mujhe|de|do)\b/gi;

function normalizeDigits(raw) {
  return String(raw || '').replace(/\D/g, '');
}

function getSupportContacts() {
  const wa = normalizeDigits(process.env.SUPPORT_WHATSAPP || '919876543210');
  const phone = normalizeDigits(process.env.SUPPORT_PHONE || wa || '919876543210');
  let display = process.env.SUPPORT_PHONE_DISPLAY || '';
  if (!display && phone.length >= 10) {
    const local = phone.replace(/^91/, '');
    display =
      local.length === 10
        ? `+91 ${local.slice(0, 5)} ${local.slice(5)}`
        : `+${phone}`;
  }
  if (!display) display = phone;
  return {
    phone,
    whatsapp: wa,
    phoneDisplay: display,
    whatsappUrl: `https://wa.me/${wa}`,
    telUrl: phone ? `tel:+${phone.startsWith('91') ? phone : `91${phone}`}` : null,
    hours: process.env.SUPPORT_HOURS || 'Mon–Sat, 10 AM – 7 PM (Dehradun)',
  };
}

function extractMaxPrice(message) {
  const m = String(message).match(
    /(?:under|below|max|upto|up to|less than)\s*₹?\s*(\d{2,4})/i
  );
  if (m) return Number(m[1]);
  if (/\bcheap\b|\bbudget\b|\blow price\b/i.test(message)) return 599;
  return null;
}

function extractSearchQuery(message) {
  let q = String(message || '')
    .toLowerCase()
    .replace(FILLER, ' ')
    .replace(/[^\w\s₹]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  q = q.replace(
    /(?:under|below|max|upto|up to|less than)\s*₹?\s*\d+/gi,
    ''
  ).trim();
  return q;
}

function isHumanHandoff(message) {
  return /\b(human|agent|person|call|phone|whatsapp|wa\.me|talk|speak|connect|customer care|support desk|real person|insan|aadmi|number|call karo)\b/i.test(
    message
  );
}

function detectIntent(message) {
  const m = String(message).toLowerCase();
  if (isHumanHandoff(m)) return 'human';
  if (/\b(track|order status|where is my order|delivery status|vc25-)\b/i.test(m)) {
    return 'track';
  }
  if (/\b(return|exchange|refund)\b/i.test(m)) return 'returns';
  if (/\b(deliver|shipping|pincode|248|dehradun|courier|kitne din)\b/i.test(m)) {
    return 'delivery';
  }
  if (/\b(vc25|coupon|promo|discount code|off)\b/i.test(m)) return 'coupon';
  if (/\b(cod|cash on delivery|upi|razorpay|pay)\b/i.test(m)) return 'payment';
  if (/\b(size|fit|gsm|fabric|measurement)\b/i.test(m)) return 'sizing';
  if (
    /\b(tee|shirt|cargo|short|hoodie|bag|cap|women|men|oversized|boxy|streetwear|clothes|outfit|piece|product|buy|shop)\b/i.test(
      m
    )
  ) {
    return 'products';
  }
  if (/^(hi|hello|hey|namaste|start|help)$/i.test(m.trim())) return 'greet';
  return 'products';
}

function summarizeProduct(p) {
  const image = p.colors?.[0]?.image || null;
  return {
    id: p.id,
    title: p.title,
    price: p.price,
    originalPrice: p.originalPrice,
    fit: p.fit,
    image,
    stockLeft: p.stockLeft,
  };
}

function searchCatalog(products, message, limit = 5) {
  const maxPrice = extractMaxPrice(message);
  let query = extractSearchQuery(message);
  if (!query && maxPrice) query = 'tee';

  let list = products.filter((p) => matchesProductSearch(p, query || message));
  if (maxPrice) list = list.filter((p) => p.price <= maxPrice);
  list.sort((a, b) => a.price - b.price);
  return { items: list.slice(0, limit), query, maxPrice };
}

function buildSupportReply(message, products) {
  const contacts = getSupportContacts();
  const text = String(message || '').trim();
  const intent = detectIntent(text);

  const baseActions = [
    { label: 'Oversized tees', type: 'query', value: 'oversized tees for men' },
    { label: 'Cargos & shorts', type: 'query', value: 'cargo shorts' },
    { label: 'Under ₹599', type: 'query', value: 'tees under 599' },
    { label: 'Talk to us', type: 'human', value: 'human' },
  ];

  if (!text) {
    return {
      intent: 'greet',
      reply:
        'Hi — I’m the Velvetclap Help desk. Tell me what you want (e.g. “oversized tee under ₹699” or “women cargo”), and I’ll list pieces live on this site.',
      products: [],
      actions: baseActions,
      handoff: null,
    };
  }

  if (intent === 'human') {
    return {
      intent: 'human',
      reply: `You can reach our Dehradun team directly:\n\n• WhatsApp: ${contacts.phoneDisplay}\n• Call: ${contacts.phoneDisplay}\n• Hours: ${contacts.hours}\n\nTap below to open WhatsApp with your question pre-filled.`,
      products: [],
      actions: [
        { label: 'Open WhatsApp', type: 'whatsapp', value: contacts.whatsappUrl },
        { label: 'Call shop', type: 'call', value: contacts.telUrl },
        { label: 'Keep browsing', type: 'query', value: 'show all tees' },
      ],
      handoff: contacts,
    };
  }

  if (intent === 'track') {
    return {
      intent: 'track',
      reply:
        'To track an order: tap your profile avatar (top right) → Vault, or use Track in the footer with your **mobile number** and order ID (VC25-…).',
      products: [],
      actions: [
        { label: 'Find hoodies', type: 'query', value: 'hoodie' },
        { label: 'WhatsApp support', type: 'whatsapp', value: contacts.whatsappUrl },
      ],
      handoff: null,
    };
  }

  if (intent === 'returns') {
    return {
      intent: 'returns',
      reply:
        '7-day returns: unworn with tags, contact us within 7 days of delivery. Reverse pickup where our courier serves your pincode. Refund after QC in 5–7 business days.',
      products: [],
      actions: [
        { label: 'Talk to support', type: 'human', value: 'human' },
        { label: 'Browse catalog', type: 'query', value: 'boxy tees' },
      ],
      handoff: null,
    };
  }

  if (intent === 'delivery') {
    return {
      intent: 'delivery',
      reply:
        'Dehradun (248xxx): free local delivery. Same-day delivery on orders ₹1599+ (subject to order time). Under ₹1599: usually 1–2 business days after dispatch. Rest of Uttarakhand: 2–4 days. Pan-India: 3–6 days. Free pan-India shipping on orders ₹999+. Use the pincode checker on the homepage for an estimate.',
      products: [],
      actions: [
        { label: 'Pincode help on WhatsApp', type: 'whatsapp', value: contacts.whatsappUrl },
        { label: 'Shop under ₹999', type: 'query', value: 'under 999' },
      ],
      handoff: null,
    };
  }

  if (intent === 'coupon') {
    return {
      intent: 'coupon',
      reply:
        'Code **VC25** gives ₹300 off when your cart subtotal is **₹799+** (before shipping). Add items to bag → apply VC25 at checkout.',
      products: [],
      actions: [
        { label: 'Tees under ₹799', type: 'query', value: 'tees under 799' },
        { label: 'Human help', type: 'human', value: 'human' },
      ],
      handoff: null,
    };
  }

  if (intent === 'payment') {
    return {
      intent: 'payment',
      reply:
        'We accept UPI / cards via Razorpay when enabled, and **Cash on Delivery (COD)** at checkout. You’ll enter name, mobile, and pincode before paying.',
      products: [],
      actions: baseActions,
      handoff: null,
    };
  }

  if (intent === 'sizing') {
    return {
      intent: 'sizing',
      reply:
        'Each product lists **fit** (Boxy, Oversized, Relaxed) and **GSM/details** in the description. Open a product → quick view for sizes in stock. Not sure? WhatsApp us your height/weight and we’ll suggest a size.',
      products: [],
      actions: [
        { label: 'WhatsApp sizing help', type: 'whatsapp', value: contacts.whatsappUrl },
        { label: 'Oversized fits', type: 'query', value: 'oversized' },
      ],
      handoff: null,
    };
  }

  if (intent === 'greet') {
    return {
      intent: 'greet',
      reply:
        'Welcome to Velvetclap — streetwear for Dehradun, everything under ₹999. What are you looking for today?',
      products: [],
      actions: baseActions,
      handoff: null,
    };
  }

  const { items, query, maxPrice } = searchCatalog(products, text, 5);
  if (items.length === 0) {
    return {
      intent: 'products',
      reply: `I couldn’t find a live match for “${query || text}” in the vault. Try different words (tee, cargo, hoodie, men/women) or chat with us on WhatsApp — we can check restocks manually.`,
      products: [],
      actions: [
        { label: 'Show all bottoms', type: 'query', value: 'cargo shorts' },
        { label: 'WhatsApp', type: 'whatsapp', value: contacts.whatsappUrl },
        { label: 'Call', type: 'call', value: contacts.telUrl },
      ],
      handoff: contacts,
    };
  }

  const priceNote = maxPrice ? ` under ₹${maxPrice}` : '';
  return {
    intent: 'products',
    reply: `Here ${items.length === 1 ? 'is' : 'are'} **${items.length}** piece${items.length > 1 ? 's' : ''} in the vault${priceNote} matching “${query || text}”. Tap a card to open it on the site.`,
    products: items.map(summarizeProduct),
    actions: [
      { label: 'More like this', type: 'query', value: query || text },
      { label: 'Talk to human', type: 'human', value: 'human' },
    ],
    handoff: null,
  };
}

module.exports = {
  buildSupportReply,
  getSupportContacts,
};
