/**
 * AI Support Chat — storefront popup widget, streaming.
 *
 * Talks to the agentic-ai-backend support endpoint
 * (POST /api/v1/support/chat) and reads the reply back as Server-Sent Events,
 * so words land in the bubble as the agent writes them instead of arriving as
 * one block after a long wait.
 *
 * Events the stream can carry:
 *   session - {session_id, agent}   first frame; the thread id to send back
 *   token   - {text}                one piece of the reply
 *   reset   - {}                    discard what was streamed; the agent was
 *                                   thinking out loud before a lookup
 *   tool    - {name, phase}         the agent is looking something up
 *   done    - {session_id, reply}   the finished reply
 *   error   - {message}             the turn failed, nothing was saved
 *
 * Config comes from data-* attributes on the <ai-support-chat> element so the
 * same asset serves the theme section and the site-wide snippet.
 *
 * No dependencies. Everything the model returns is escaped before it is placed
 * in the DOM; only the markup produced here is ever trusted.
 */

const ICONS = {
  // Two four-point stars — the shorthand every storefront now uses for "ask
  // the assistant". Solid, because it sits inside a white disc.
  open: '<svg class="aisc-icon-open" viewBox="0 0 34 34" fill="currentColor" aria-hidden="true"><path d="M13 2c.5 6.2 4.8 10.5 11 11-6.2.5-10.5 4.8-11 11-.5-6.2-4.8-10.5-11-11 6.2-.5 10.5-4.8 11-11Z"/><path d="M25 18.5c.3 3.7 2.8 6.2 6.5 6.5-3.7.3-6.2 2.8-6.5 6.5-.3-3.7-2.8-6.2-6.5-6.5 3.7-.3 6.2-2.8 6.5-6.5Z"/></svg>',
  dismiss: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m4.4 4.55.07-.08a.75.75 0 0 1 .98-.07l.08.07L12 10.94l6.47-6.47a.75.75 0 1 1 1.06 1.06L13.06 12l6.47 6.47c.27.27.3.68.07.98l-.07.08a.75.75 0 0 1-.98.07l-.08-.07L12 13.06l-6.47 6.47a.75.75 0 0 1-1.06-1.06L10.94 12 4.47 5.53a.75.75 0 0 1-.07-.98l.07-.08-.07.08Z"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  cart: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M2.5 4.25c0-.41.34-.75.75-.75h.56c.95 0 1.52.64 1.84 1.23.22.4.38.86.5 1.27h12.6c.83 0 1.43.8 1.2 1.6L18.12 14a2.75 2.75 0 0 1-2.64 2H9.53a2.75 2.75 0 0 1-2.65-2.02l-.76-2.78-1.26-4.24v-.01c-.16-.57-.3-1.1-.52-1.5C4.13 5.07 3.96 5 3.8 5h-.56a.75.75 0 0 1-.75-.75Zm5.07 6.59.75 2.74c.15.54.65.92 1.21.92h5.95c.56 0 1.05-.37 1.2-.9l1.74-6.1H6.59l.97 3.29.01.05ZM11 19a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm-1.5 0a.5.5 0 1 0-1 0 .5.5 0 0 0 1 0Zm8.5 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm-1.5 0a.5.5 0 1 0-1 0 .5.5 0 0 0 1 0Z"/></svg>',
  cartFull: '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M3 3.5c0-.28.22-.5.5-.5h.44c.72 0 1.14.47 1.38.94.17.32.29.72.39 1.06H16a1 1 0 0 1 .96 1.27l-1.5 5.28A2 2 0 0 1 13.55 13H8.46a2 2 0 0 1-1.93-1.47L5.9 9.17l-.01-.03-1.03-3.5-.1-.33a5.2 5.2 0 0 0-.32-.91c-.16-.31-.3-.4-.5-.4H3.5a.5.5 0 0 1-.5-.5ZM8.5 17a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm5 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/></svg>',
  plus: '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 2.25c.41 0 .75.34.75.75v6.25H17a.75.75 0 0 1 0 1.5h-6.25V17a.75.75 0 0 1-1.5 0v-6.25H3a.75.75 0 0 1 0-1.5h6.25V3c0-.41.34-.75.75-.75Z"/></svg>',
  dock: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 7.25C22 5.45 20.54 4 18.75 4H5.25A3.25 3.25 0 0 0 2 7.25v9.5C2 18.55 3.46 20 5.25 20h13.5c1.8 0 3.25-1.46 3.25-3.25v-9.5ZM14.5 5.5v13H5.25c-.97 0-1.75-.78-1.75-1.75v-9.5c0-.97.78-1.75 1.75-1.75h9.25Zm1.5 0h2.75c.97 0 1.75.78 1.75 1.75v9.5c0 .97-.78 1.75-1.75 1.75H16v-13Z"/></svg>',
  undock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4 4 10M4 5.5V10h4.5"/><path d="M14 20l6-6M20 18.5V14h-4.5"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 7.75a1.75 1.75 0 1 1 0-3.5 1.75 1.75 0 0 1 0 3.5Zm0 6a1.75 1.75 0 1 1 0-3.5 1.75 1.75 0 0 1 0 3.5ZM10.25 18a1.75 1.75 0 1 0 3.5 0 1.75 1.75 0 0 0-3.5 0Z"/></svg>',
  // Points up-left, the way the panel grows: a corner bracket with the
  // diagonal running out of it.
  resize: '<svg viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M1 5V1h4M1 1l4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg>',
  thumbUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 22V10l5-8a2.5 2.5 0 0 1 2.4 3.2L13.5 9h5a2.5 2.5 0 0 1 2.4 3.1l-1.7 7A2.5 2.5 0 0 1 16.8 21H7z"/><path d="M7 10H4.5A1.5 1.5 0 0 0 3 11.5v9A1.5 1.5 0 0 0 4.5 22H7"/></svg>',
  thumbDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2v12l-5 8a2.5 2.5 0 0 1-2.4-3.2l.9-3.8h-5a2.5 2.5 0 0 1-2.4-3.1l1.7-7A2.5 2.5 0 0 1 7.2 3H17z"/><path d="M17 14h2.5A1.5 1.5 0 0 0 21 12.5v-9A1.5 1.5 0 0 0 19.5 2H17"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V5M5 12l7-7 7 7"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>',
};

const TICKET_RE = /\bTKT-\d{6}-[A-Z0-9]{3,6}\b/;

// How tall the composer may grow before it starts scrolling instead.
const MAX_INPUT_HEIGHT = 120;

// Launcher geometry: the margin it keeps from the top and bottom of the
// window when dragged, the gap it leaves for the panel above it, and how far
// a pointer may wander before a click counts as a drag instead.
//
// The panel's bottom edge sits on the launcher's, because the launcher is not
// there while the panel is open — it used to have to clear a button that stayed
// on screen. So at rest both are the same 24px off the bottom of the window.
const EDGE_GAP = 12;
const PANEL_GAP = 0;
const DRAG_SLOP = 5;
const POS_KEY = 'aisc:launcher-y';
const SIZE_KEY = 'aisc:panel-size';
/* The smallest the panel is allowed to get. Not an arbitrary floor: below
   this the header wraps onto two lines and a product card is clipped, which
   is worse than simply refusing to go smaller. */
const PANEL_MIN_W = 360;
const PANEL_MIN_H = 480;
// How many products a list answers with before it folds. A collection can hold
// hundreds; three is enough to show what kind of thing came back, and the rest
// are one tap away rather than a wall to scroll past.
const PREVIEW_CARDS = 3;
// How many pieces of an order are drawn out in full before the rest are
// counted. An order of twelve should not bury the reply that follows it.
const ORDER_ITEMS_SHOWN = 3;
const DOCK_KEY = 'aisc:dock';

/**
 * How the reply is drawn as it arrives.
 *
 * The backend streams in chunks, not letters — a sentence can land whole — so
 * rendering each chunk the moment it arrives makes the reply jump rather than
 * write itself. The text is revealed at a steady hand instead, fast enough to
 * read along with and slow enough to look written.
 *
 * The rate is a floor, not a ceiling: whatever has arrived is never left more
 * than TYPE_MAX_LAG behind, so a long answer that lands all at once still
 * finishes promptly instead of trickling out for half a minute.
 */
const TYPE_CPS = 65;
const TYPE_MAX_LAG = 0.8;

// A Shopify product handle, and nothing that could steer a URL somewhere else.
// The agent is told to copy handles verbatim, but it is still a language model
// writing them, so the value is validated here before it reaches a fetch.
const HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]{0,118}[a-z0-9])?$/;

/** Locale-aware storefront root, e.g. "/" or "/en-gb/". */
function shopRoot() {
  const root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  return root.endsWith('/') ? root : root + '/';
}

function cartAddUrl() {
  const themed = window.Theme && window.Theme.routes && window.Theme.routes.cart_add_url;
  return themed || shopRoot() + 'cart/add.js';
}

// One in-flight request per handle, shared by every card that names it, and the
// resolved product is reused for the rest of the session. Promises are cached
// rather than results so two cards rendered together cannot both fetch.
const productCache = new Map();

/** The handle out of a product URL, whatever host or locale prefix it carries. */
function handleFromUrl(url) {
  try {
    const m = new URL(url, location.origin).pathname.match(/\/products\/([^/?#]+)/);
    return m ? decodeURIComponent(m[1]).toLowerCase() : null;
  } catch (e) {
    return null;
  }
}

function money(amount, currency) {
  const n = Number(amount);
  if (!isFinite(n)) return '';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);
  } catch (e) {
    // An unknown or missing currency code must not cost the shopper the price.
    return (currency ? currency + ' ' : '') + n.toFixed(2);
  }
}

/**
 * Write a price into `el`, as a sale when `was` is above `now` (both in major
 * units, as the backend sends them): the new price, the old one struck, and the
 * saving - the same marks #fillCard draws from the live product, so a card looks
 * the same before and after it is filled. Returns the "N% off" label, or ''.
 */
function setSalePrice(el, now, was, currency) {
  const n = Number(now);
  const w = Number(was);
  if (!isFinite(n) || !isFinite(w) || w <= n || n <= 0) {
    el.textContent = money(now, currency);
    return '';
  }
  const off = Math.round((1 - n / w) * 100) + '% off';
  el.innerHTML =
    `<span class="aisc-pcard-sale">${escapeHtml(money(n, currency))}</span>` +
    `<s class="aisc-pcard-was">${escapeHtml(money(w, currency))}</s>` +
    `<span class="aisc-pcard-off">· ${off}</span>`;
  return off;
}

function loadProduct(handle) {
  if (!productCache.has(handle)) {
    productCache.set(
      handle,
      fetch(shopRoot() + 'products/' + encodeURIComponent(handle) + '.js', {
        headers: { Accept: 'application/json' },
      }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    );
  }
  return productCache.get(handle);
}






/**
 * Merchants name their options in whatever form reads best on the product page
 * — "Size", "Sizes", "Upholstery", "Box" — and all of them have to come out as
 * a countable plural in "7 of 12 … in stock".
 */
/**
 * What the products event says about its items, written onto the items
 * themselves so it survives being saved to the transcript and read back.
 *
 * `ranked: true` numbers them — a best-sellers answer is a ranking, and a
 * ranking has to be numbered or it is just a list. `confirm: true` says the
 * assistant is asking the shopper to approve this exact thing before it goes
 * in the cart, which is a smaller card ending in Confirm rather than Add.
 */
function shapeItems(items, data, ranked) {
  const list = Array.isArray(items) ? items : [];
  const opts = data || {};
  if (opts.ranked || ranked) {
    list.forEach((item, i) => { if (item && item.rank == null) item.rank = i + 1; });
  }
  if (opts.confirm) list.forEach((item) => { if (item) item.confirm = true; });

  // A comparison arrives as one table — each attribute holding a value per
  // product — but it is read as two cards standing next to each other. Folded
  // into the items here so a card can draw its own side of it without the
  // renderer having to keep the payload around and match ids a second time.
  const diffs = Array.isArray(opts.difference) ? opts.difference : [];
  if (diffs.length) {
    list.forEach((item) => {
      if (!item) return;
      const rows = [];
      diffs.forEach((d) => {
        const vals = d && Array.isArray(d.values) ? d.values : [];
        const mine = vals.find((v) => v && String(v.product_id) === String(item.product_id));
        const value = mine && String(mine.value == null ? '' : mine.value).trim();
        // An attribute only one side states is still worth showing: "Made in
        // Europe" against nothing is the difference, so a blank is kept out
        // rather than the whole row being dropped.
        if (value) rows.push({ label: String(d.label || '').trim(), value });
      });
      if (rows.length) { item.diff = rows; item.compare = true; }
    });
  }

  // What the assistant was answering about — a collection, a family — so the
  // fold can say "Show 7 more Billiani" rather than just "Show 7 more". A
  // comparison names itself ("Romper & Shirt Comparison"), and so does a
  // removal: without "Removed from your bag" above it, the product just taken
  // out reads as something being recommended.
  const named = diffs.length || opts.layout === 'removed' || opts.layout === 'edited';
  const group = String(opts.label || opts.group || opts.collection ||
    (named ? opts.heading || '' : '')).trim();
  if (group) list.forEach((item) => { if (item && !item.group) item.group = group; });
  return list;
}

/**
 * The colour of the card behind a collection's photograph.
 *
 * Cycled by position rather than hashed from the title, so no two cards next
 * to each other ever land on the same colour — a repeat between neighbours
 * reads as a mistake, and a hash produces them regularly out of six choices.
 * The shelf arrives in a stable order, so a collection keeps its colour.
 *
 * Not sampled from the image: that means a canvas read, which fails silently
 * on any image the CDN does not serve with CORS and would leave some cards
 * untinted for no visible reason. A payload carrying `color` overrides it.
 */
const TINTS = [
  'rgba(220, 146, 149, 0.5)',
  'rgba(150, 176, 168, 0.5)',
  'rgba(196, 176, 140, 0.5)',
  'rgba(150, 165, 196, 0.5)',
  'rgba(198, 156, 186, 0.5)',
  'rgba(176, 186, 150, 0.5)',
];
function tintFor(index) {
  return TINTS[index % TINTS.length];
}

/**
 * Whether the shopper was asking what is in their cart.
 *
 * Read from the shopper's own words rather than from the reply: they typed it,
 * so it is a far steadier signal than trying to work out what a paragraph of
 * generated prose was about. An instruction — "add the blue one to my cart" —
 * is not a question about the cart, so it is excluded.
 */
/**
 * Whether the shopper asked for a ranking rather than a selection.
 *
 * Read from their own words, as with the cart: "here are three stools" and
 * "here are your three best sellers" arrive as the same payload, and numbering
 * the first would invent an order that does not exist. `ranked: true` from the
 * backend still wins where it is sent — this only fills the gap where it is not.
 *
 * Deliberately narrow. Bare "top" is a garment as often as a ranking, and bare
 * "popular" is a question about one product as often as a list of many.
 */
function asksForRanking(text) {
  const t = String(text || '').toLowerCase();
  return /\bbest[\s-]?sell/.test(t)
    || /\bbestseller/.test(t)
    || /\btop[\s-]?(?:\d+|selling|sellers?|rated|picks?)\b/.test(t)
    || /\bmost[\s-]popular\b/.test(t)
    || /\btrending\b/.test(t);
}

/**
 * Whether the shopper brought orders into it — "is it in my cart or did I
 * order it already?". Then a reply carrying both is answering both, and
 * neither half should be thrown away.
 */
function asksAboutOrders(text) {
  return /\b(order|orders|ordered|delivery|deliver|shipped|shipping|tracking|track|parcel)\b/i
    .test(String(text || ''));
}

function asksAboutCart(text) {
  const t = String(text || '').toLowerCase();
  if (!/\b(cart|basket|bag)\b/.test(t)) return false;
  return !/\b(add|adding|added|put|buy|purchase|checkout|check out|remove|delete|clear)\b/.test(t);
}

/** "UNFULFILLED" and "partially_fulfilled" as a person would write them. */
function sentence(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  // Only shout-case and snake_case are rewritten; anything already written for
  // a reader is left exactly as the backend sent it.
  if (/[a-z]/.test(v) && !/_/.test(v)) return v;
  const words = v.toLowerCase().replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "2026-03-12T09:41:00Z" as the shopper would write it, or nothing at all. */
function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).trim();
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * The colour a status reads in.
 *
 * The tone comes from a fixed keyword list, never from the text itself, so
 * nothing the model or the backend writes can colour a cancelled order green.
 * Order matters: "unfulfilled" contains "fulfil" and "out for delivery"
 * contains "deliver", so the bad and in-progress states are tested first.
 */
function statusTone(text) {
  const l = String(text || '').toLowerCase();
  if (/cancel|refund|fail|declin|return/.test(l)) return 'crit';
  if (/unfulfil|process|pending|prepar|await|hold|partial|not yet/.test(l)) return 'warn';
  if (/ship|transit|dispatch|on its way|out for delivery|en route/.test(l)) return 'info';
  if (/deliver|fulfil|complet|arrived|collected/.test(l)) return 'ok';
  return '';
}

/**
 * The orders the backend found, read defensively.
 *
 * Order payloads differ more than any other between Shopify's own APIs and
 * whatever a backend assembles from them, so every field is accepted under the
 * handful of names it plausibly arrives as, and a missing one simply does not
 * render rather than breaking the card.
 */
function readOrders(data) {
  const raw = Array.isArray(data) ? data : (data && (data.orders || data.items || data.data)) || [];
  if (!Array.isArray(raw)) return [];

  const line = (i) => {
    if (!i || typeof i !== 'object') return null;
    const title = String(i.title || i.name || i.product_title || '').trim();
    if (!title) return null;
    const image = i.image || i.image_url || i.featured_image || i.img ||
      (i.image && i.image.src) || '';
    const handle = String(i.handle || i.product_handle || '').trim();
    return {
      title,
      variant: String(i.variant_title || i.variant || i.option || '').trim(),
      quantity: Math.max(1, Number(i.quantity || i.qty) || 1),
      image: typeof image === 'string' ? image : (image && image.src) || '',
      // A URL means the piece can be shown as a real product card — priced,
      // in stock or not, and orderable again.
      url: String(i.url || i.product_url || (handle ? `${shopRoot()}products/${handle}` : '')).trim(),
      price: i.price != null ? i.price : i.line_price,
      description: String(i.description || '').trim(),
    };
  };

  return raw
    .map((o) => {
      if (!o || typeof o !== 'object') return null;
      const name = String(o.name || o.order_name || o.order_number || o.number || '').trim();
      if (!name) return null;

      const currency = o.currency || o.currency_code || o.presentment_currency || '';
      // The pieces are priced in the order's currency; only the order carries
      // it, and a card with a bare "120.11" on it says nothing useful.
      const items = (o.line_items || o.items || o.products || []).map(line).filter(Boolean);
      items.forEach((i) => { if (!i.currency) i.currency = currency; });

      return {
        // Shopify writes them as "#1024"; a bare number gets the hash.
        name: /^#/.test(name) ? name : `#${name}`,
        // Only ever the backend's own link. A guessed /account/orders path
        // needs a token this widget does not have and would 404.
        url: String(o.order_status_url || o.status_url || o.url || '').trim(),
        placed: String(o.placed_on || o.created_at || o.processed_at || o.placed_at ||
          o.date || '').trim(),
        // "UNFULFILLED" is how a system writes it, not how anyone reads it.
        status: sentence(o.fulfillment_status || o.status || o.financial_status || ''),
        // The backend's plain-English gloss on that status, when it sends one:
        // "queued for packing" tells the shopper far more than "unfulfilled".
        meaning: String(o.status_meaning || o.status_note || o.status_text || '').trim(),
        total: o.total_formatted || o.total_price_formatted || o.total || o.total_price,
        currency,
        items,
      };
    })
    .filter(Boolean)
    .slice(0, 10);
}

/**
 * The follow-ups the assistant offers after a reply.
 *
 * Each carries the words to show and, separately, the words to send — "Explore
 * Dresses" is a good thing to read on a button and a poor thing to say to an
 * assistant, so the label and the prompt are kept apart. `kind` and `id` are
 * the backend's own bookkeeping and are passed through untouched.
 */
function readSuggestions(data) {
  const raw = Array.isArray(data) ? data : (data && (data.suggestions || data.items)) || [];
  if (!Array.isArray(raw)) return [];

  return raw
    .map((s) => {
      // A plain string is its own label and its own prompt.
      if (typeof s === 'string') return s.trim() ? { label: s.trim(), prompt: s.trim() } : null;
      if (!s || typeof s !== 'object') return null;
      const label = String(s.label || s.title || s.text || '').trim();
      if (!label) return null;
      // `keep`: a list to browse (every category) rather than a question to
      // answer once, so tapping one leaves the rest there for the next pick.
      return { label, prompt: String(s.prompt || s.query || label).trim(), ...(s.keep ? { keep: true } : {}) };
    })
    .filter(Boolean)
    // Room for a whole list — every category or collection the shopper asked
    // to see — while still bounding a runaway payload.
    .slice(0, 50);
}

// A line naming the collection, no longer than this, is read as a caption for
// the heading rather than as something said about the collection. A real
// paragraph about it runs longer and is left alone.
const CAPTION_MAX = 90;

/**
 * Drop the sentence that only introduces the collection.
 *
 * "Autumn Layers has 5 cosy knits for little ones." is a caption, and the
 * heading above the cards is already the name. Length is what separates the two:
 * a short line naming the collection is announcing it, a long one is describing
 * it, and only the first is a repeat.
 */
function dropGroupCaption(raw, group, allowEmpty) {
  const name = String(group || '').trim().toLowerCase();
  if (!name) return raw;

  const lines = String(raw == null ? '' : raw).split('\n');
  const kept = lines.filter((line) => {
    const t = line.trim();
    if (!t || t.length > CAPTION_MAX) return true;
    return !t.toLowerCase().includes(name);
  });
  const out = kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  // A reply that was nothing but the caption is allowed to go: the heading and
  // the cards below it are the whole answer.
  return out || (allowEmpty ? '' : raw);
}

/** The note is a frame around the assistant's words; with none, it is a box. */
function dropEmptyNote(desc) {
  if (desc.textContent) return;
  const note = desc.closest('.aisc-pcard-note');
  if (note) note.remove();
}

function plural(word) {
  if (/(s|x|z|ch|sh)$/i.test(word)) return word;
  if (/[^aeiou]y$/i.test(word)) return word.slice(0, -1) + 'ies';
  return word + 's';
}

/**
 * The published collections, fetched once per page.
 *
 * The payload is read defensively: this is a separate service from the theme,
 * and a shelf that quietly stays empty because a field was called `name` rather
 * than `title` is worse than one that accepts both.
 */
const collectionCache = new Map();
function loadCollections(url) {
  if (!collectionCache.has(url)) {
    collectionCache.set(
      url,
      fetch(url, { headers: { Accept: 'application/json' } })
        .then((r) => (r.ok ? r.json() : null))
        .then(readCollections)
        .catch(() => [])
    );
  }
  return collectionCache.get(url);
}

function readCollections(data) {
  const raw = Array.isArray(data)
    ? data
    : (data && (data.collections || data.items || data.data || data.results)) || [];
  if (!Array.isArray(raw)) return [];

  return raw
    .map((c) => {
      if (!c || typeof c !== 'object') return null;
      const title = String(c.title || c.name || c.handle || '').trim();
      if (!title) return null;
      const image = c.image || c.image_url || c.imageUrl || c.featured_image ||
        (c.featuredImage && c.featuredImage.url) || '';
      const handle = c.handle || '';
      return {
        title,
        image: typeof image === 'string' ? image : (image && image.src) || '',
        url: c.url || c.link || (handle ? `${shopRoot()}collections/${handle}` : ''),
      };
    })
    .filter(Boolean)
    .slice(0, 12);
}

// The greeting may carry a {name} token. Signed-in shoppers get their first
// name; everyone else gets the token removed and the leftover punctuation
// tidied, so one setting reads correctly both ways:
//   "Hi {name}!"          -> "Hi Palash!"  / "Hi!"
//   "Welcome back, {name}." -> "Welcome back, Palash." / "Welcome back."
function personalise(template, name) {
  const clean = String(name || '').trim().split(/\s+/)[0] || '';
  let out = String(template || '').replace(/\{\s*name\s*\}/gi, clean);
  if (!clean) {
    out = out
      .replace(/\s+([!?.,;:])/g, '$1')   // "Hi !"          -> "Hi!"
      .replace(/[,;:]\s*([.!?])/g, '$1') // "Welcome back,." -> "Welcome back."
      .replace(/\s{2,}/g, ' ');
  }
  return out.trim();
}







function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Shorten a URL for display so tracking links do not blow out the bubble. */
function linkLabel(url) {
  try {
    const u = new URL(url);
    const tail = (u.pathname + u.search).replace(/\/$/, '');
    const short = tail.length > 24 ? tail.slice(0, 24) + '…' : tail;
    return u.hostname.replace(/^www\./, '') + short;
  } catch (e) {
    return url;
  }
}

/**
 * Inline formatting: images, Markdown links, autolinks and **bold**.
 * Input must already be HTML-escaped by renderRich.
 *
 * Images and links are parked as NUL-delimited index placeholders rather than
 * being written straight out, so the later passes (autolink, bold) cannot chew
 * through a URL. NUL is stripped from the input first, which is what makes the
 * placeholders unforgeable: nothing the model emits can fabricate one. The
 * captured values are stored exactly as they arrive — already escaped, never
 * round-tripped through encode/decodeURIComponent, since that is precisely what
 * would let a %22 become a real quote and break out of the src attribute.
 */
function inline(escaped) {
  const imgs = [];
  const links = [];

  let out = String(escaped).replace(/\u0000/g, '')
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^\s<)"]+)\)/g, (m, alt, url) =>
      '\u0000I' + (imgs.push({ url, alt: alt || 'Product image' }) - 1) + '\u0000')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s<)"]+)\)/g, (m, label, url) =>
      '\u0000L' + (links.push({ url, label }) - 1) + '\u0000')
    .replace(/(https?:\/\/[^\s<]+[^\s<.,:;"')\]])/g, (m) =>
      `<a href="${m}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkLabel(m))}</a>`)
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');

  out = out.replace(/\u0000L(\d+)\u0000/g, (m, i) => {
    const { url, label } = links[Number(i)];
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });

  // A broken image hides its own frame, wired up in #addMessage rather than an
  // inline onerror= so a strict storefront CSP cannot strip it.
  out = out.replace(/\u0000I(\d+)\u0000/g, (m, i) => {
    const { url, alt } = imgs[Number(i)];
    return `<span class="aisc-img-wrap"><img src="${url}" alt="${alt}" ` +
           `class="aisc-product-img" loading="lazy"></span>`;
  });

  return out;
}

/**
 * Block formatting. Supports what the agent is told to emit and nothing more:
 *   ### Title      product heading, opens a card
 *   ---            ends a card / separates products
 *   - item         bullet list
 *   1. item        numbered list
 *   [Label](url)   alone on a line, becomes a call-to-action button
 *
 * Consecutive lines under a "###" are wrapped in .aisc-card so each product
 * reads as one object instead of a wall of text. Everything here runs on
 * already-escaped text — see inline().
 */
// A trailing "1. ... 2. ..." block is a set of choices, not prose. Lift it out so
// the widget can offer real buttons; the agent is told to use numbered lists only
// when it is asking the shopper to pick something.
function splitOptions(text) {
  const lines = String(text).split('\n');
  let i = lines.length;
  const found = [];
  while (i > 0) {
    const line = lines[i - 1];
    if (!line.trim()) { i--; continue; }
    const m = /^\s*(\d{1,2})[.)]\s+([^!\[].{0,79})$/.exec(line);
    if (!m) break;
    found.unshift({ n: Number(m[1]), label: m[2].trim() });
    i--;
  }
  // Only a genuine 1..n run counts — stray numbering stays as text. Eight is
  // the ceiling because the reasons offered for cancelling an order run to
  // seven, and a list that silently falls back to prose is worse than a long one.
  const ordered = found.length >= 2 && found.length <= 8 &&
    found.every((o, k) => o.n === k + 1);
  if (!ordered) return { text, options: [] };
  return { text: lines.slice(0, i).join('\n').trim(), options: found.map((o) => o.label) };
}

/**
 * Drop the lines of a reply that only restate a card.
 *
 * The agent lists what it picked and then the card lists it again, so the
 * shopper reads the same three products twice. Only lines that are *just* a
 * title, its option and a price are removed — a line carrying an actual remark
 * about the piece is left alone, because that is the part the card cannot show.
 */
// Words that carry a sentence rather than describe a product. Taken out before
// measuring what a line is really saying, so "Your cart has one item: the X at
// Y" reads as empty while "X is cut in a soft yarn-dyed gingham" does not.
const FILLER_WORDS = new RegExp('\\b(' + [
  'a', 'an', 'and', 'are', 'as', 'at', 'bag', 'basket', 'be', 'been', 'both', 'by',
  'cart', 'cost', 'costs', 'currently', 'each', 'for', 'from', 'had', 'has', 'have',
  'here', 'in', 'is', 'it', 'item', 'items', 'its', 'just', 'now', 'of', 'on', 'one',
  'only', 'or', 'order', 'orders', 'our', 'price', 'priced', 'product', 'products',
  'that', 'the', 'there', 'these', 'this', 'those', 'three', 'to', 'total', 'two',
  'was', 'were', 'with', 'you', 'your',
].join('|') + ')\\b', 'g');

/**
 * @param {boolean} [allowEmpty] Let the whole line go when the cards say all of
 *   it. Off by default, because a reply blanked to nothing normally means the
 *   rule has over-reached; the cart path turns it on, having built the cards
 *   itself and knowing they carry the entire answer.
 */
/**
 * A name as it can be compared: lower case, the size range dropped, and every
 * run of punctuation or spacing a single space - so "…in Blue, made with
 * Liberty Fabric (1mth-3yrs)" and "…in Blue Made with Liberty Fabric" match.
 */
function loosen(text) {
  return String(text || '').toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function dedupeCardProse(raw, titles, allowEmpty) {
  if (!titles.length) return raw;

  const lines = String(raw == null ? '' : raw).split('\n');
  const kept = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true;

    // Lines the card carries as its own furniture. "Status: queued for packing"
    // is the pill at the top of an order card; "Total: 180.25 INR" is its
    // footer. Restating either as prose leaves the reply reading like a form.
    // Only ever reached when there are cards — with none, `titles` is empty and
    // this function returns early, so a status written into a plain reply is
    // still rendered as a pill.
    if (/^[-•*\s]*(total|subtotal|status)\s*[:—-]/i.test(trimmed)) return false;

    // Compared loosely: the reply writes "in Blue, made with Liberty Fabric"
    // where the title has "in Blue Made with Liberty Fabric", and drops or
    // reshapes the size range - one comma kept a single product line standing
    // alone above a grid of ten after the other nine were taken out.
    const line_ = loosen(trimmed);
    const title = titles.map(loosen).filter(Boolean).sort((a, b) => b.length - a.length)
      .find((t) => line_.includes(t));
    if (!title) return true;

    // What is left once the title, any bracketed option, prices, the words
    // that only hold a sentence together, and punctuation are taken out. If
    // that is essentially nothing, the line was only naming the product the
    // card already shows — whether it did so as a bullet ("- Amelia Gingham
    // … 11400.00 INR") or as a sentence ("Your cart has one item: the Amelia
    // Gingham … at 11400.00 INR"). Anything that actually describes the thing
    // survives the strip and keeps the line.
    const rest = line_
      .replace(title, ' ')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/[\d.,]+/g, ' ')
      .replace(/\b(inr|gbp|usd|eur|rs|rupees?)\b/gi, ' ')
      .toLowerCase()
      .replace(FILLER_WORDS, ' ')
      .replace(/[^a-z]/g, '');
    return rest.length > 12;
  });

  // Two blank lines in a row are what removing a whole list leaves behind.
  const packed = kept.filter((line, i) => line.trim() || (kept[i - 1] || '').trim());

  // "…both currently queued for packing:" was introducing the list that has
  // just been taken out, so the colon is now pointing at nothing.
  const tidied = packed.map((line, i) => {
    if (!/:\s*$/.test(line)) return line;
    const next = packed.slice(i + 1).find((l) => l.trim());
    // Nothing after it at all - the whole list went - is the same dangling colon.
    return !next || !/^\s*[-•*\d]/.test(next) ? line.replace(/\s*:\s*$/, '.') : line;
  });

  const out = tidied.join('\n').trim();
  return out || (allowEmpty ? '' : raw);
}

function renderRich(raw) {
  // The model sometimes wraps a long link, leaving "[View product](" on one
  // line and the URL on the next — which then renders as literal text plus a
  // bare URL, the exact thing the button was meant to replace. Pull them back
  // together first. The URL still has to satisfy the strict pattern below, so
  // this repairs formatting without loosening what counts as a link.
  const mended = String(raw == null ? '' : raw)
    .replace(/\]\(\s*[\r\n]+\s*/g, '](')
    .replace(/(\]\([^\s()]*)\s*[\r\n]+\s*\)/g, '$1)');
  const lines = escapeHtml(mended).split('\n');
  const out = [];
  let list = null;       // {tag, items}
  let card = false;

  const blk = (html) => out.push({ block: true, html });
  const txt = (html) => out.push({ block: false, html });

  const closeList = () => {
    if (!list) return;
    blk('<' + list.tag + '>' + list.items.join('') + '</' + list.tag + '>');
    list = null;
  };
  const closeCard = () => {
    if (!card) return;
    closeList();
    blk('</div>');
    card = false;
  };
  const pushItem = (tag, html) => {
    if (list && list.tag !== tag) closeList();
    if (!list) list = { tag, items: [] };
    list.items.push('<li>' + html + '</li>');
  };

  for (const line of lines) {
    // A blank line ends a card. Without this, the sentence the agent writes
    // after the last product ("Which size shall I check?") is swallowed into
    // that product's box.
    if (!line.trim()) { closeCard(); closeList(); txt(''); continue; }

    const heading = line.match(/^\s*#{2,4}\s+(.*)$/);
    if (heading) {
      closeCard();
      blk('<div class="aisc-card">');
      card = true;
      blk('<div class="aisc-ptitle">' + inline(heading[1]) + '</div>');
      continue;
    }

    if (/^\s*(---+|___+|\*\*\*+)\s*$/.test(line)) { closeCard(); continue; }

    // "Status: Delivered" becomes a tinted state pill. The tone comes from a
    // fixed keyword list, never from the text itself, so the model cannot
    // colour a cancelled order green.
    const st = line.match(/^\s*(?:[-•]\s+)?Status\s*:\s*(.+)$/i);
    if (st) {
      closeList();
      const v = st[1].trim();
      const l = v.toLowerCase();
      // Order matters. "Unfulfilled" contains "fulfil" and "out for delivery"
      // contains "deliver", so the bad and in-progress states are matched
      // first — otherwise both would come out green.
      const tone = statusTone(l);
      blk('<div class="aisc-stateline"><span class="aisc-opts-label">Status</span>' +
               '<span class="aisc-state"' + (tone ? ' data-tone="' + tone + '"' : '') + '>' +
               v + '</span></div>');
      continue;
    }

    // "Sizes: UK-4, UK-6, ~UK-14" becomes a row of chips, sold-out ones struck
    // through. A tilde marks unavailable. Falls back to plain text if the agent
    // writes prose instead, so a missed format never loses the information.
    const opt = line.match(/^\s*(?:[-•]\s+)?(Sizes?|Colou?rs?|Options?|Variants?|Fits?)\s*:\s*(.+)$/i);
    // Chips need either a list, or a single value short enough to be a real
    // variant name — so "Sizes: Standard" gets a chip but
    // "Sizes: UK-4 to UK-16" stays as prose rather than one absurd pill.
    const optVal = opt ? opt[2].trim() : '';
    if (opt && (optVal.indexOf(',') > -1 ||
                (optVal.length <= 20 && optVal.split(/\s+/).length <= 2))) {
      closeList();
      const all = optVal.split(',').map((t) => t.trim()).filter(Boolean);
      const shown = all.slice(0, 12);
      const chips = shown.map((t) => {
        const sold = t.charAt(0) === '~';
        const label = sold ? t.slice(1).trim() : t;
        return '<span class="aisc-opt' + (sold ? ' aisc-opt--out" title="Sold out"' : '"') +
               '>' + label + '</span>';
      }).join('');
      const more = all.length > shown.length
        ? '<span class="aisc-opt aisc-opt--more">+' + (all.length - shown.length) + '</span>' : '';
      blk('<div class="aisc-opts"><span class="aisc-opts-label">' + opt[1] +
               '</span><span class="aisc-opts-row">' + chips + more + '</span></div>');
      continue;
    }

    // "Product: smocked-cotton-dress" is an instruction to the widget, not
    // something to show. It becomes an empty slot that #hydrateBuys fills with
    // real buttons once the live product has been read from the store; if the
    // handle is junk the slot is simply never filled, so a bad one costs a
    // button rather than printing a raw slug at the shopper.
    const buy = line.match(/^\s*Product\s*:\s*([^\s]+)\s*$/i);
    if (buy) {
      closeList();
      const handle = buy[1].trim().toLowerCase();
      if (HANDLE_RE.test(handle)) {
        blk('<div class="aisc-buy" data-handle="' + handle + '"></div>');
      }
      continue;
    }

    const bullet = line.match(/^\s*[-•]\s+(.*)$/);
    if (bullet) { pushItem('ul', inline(bullet[1])); continue; }

    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (numbered) { pushItem('ol', inline(numbered[1])); continue; }

    closeList();

    // A link on a line of its own reads as an action, not prose.
    const cta = line.match(/^\s*\[([^\]]+)\]\((https?:\/\/[^\s<)"]+)\)\s*$/);
    if (cta) {
      blk('<a class="aisc-cta" href="' + cta[2] + '" target="_blank" rel="noopener noreferrer">' +
               cta[1] + '</a>');
      continue;
    }

    txt(inline(line));
  }

  closeCard();
  closeList();

  // The bubble is white-space: pre-wrap, so a newline between two block
  // elements renders as a real empty line — that is where the gap between
  // product cards came from. Blank lines are kept only between prose, and
  // blocks are joined with nothing at all; their own margins do the spacing.
  const packed = [];
  for (const n of out) {
    const blank = !n.block && !n.html.trim();
    const last = packed[packed.length - 1];
    if (blank && (!last || last.block || !last.html.trim())) continue;
    packed.push(n);
  }
  while (packed.length && !packed[packed.length - 1].block &&
         !packed[packed.length - 1].html.trim()) packed.pop();

  let html = '';
  packed.forEach((n, i) => {
    const prev = packed[i - 1];
    if (prev && !prev.block && !n.block) html += '\n';
    html += n.html;
  });
  return html;
}

/**
 * The `action` words of the backend's `actions` event (cart_actions.py), one
 * per turn. Each names exactly what to do, so the widget acts on the word:
 *
 *   add          - add `items`, stay on the page
 *   checkout     - add `items`, then go to checkout
 *   checkoutBag  - go to checkout with the bag as it is; nothing is added
 *   openCart     - open the cart; nothing is added
 *   remove, edit - set each `items` line to its `new_quantity` (0 takes it out),
 *                  add any `add_items`, then go to `page` if one is given
 */
const CART_ACTIONS = {
  add: 'add previous products in cart',
  checkout: 'checkout',
  checkoutBag: 'checkout from existing',
  openCart: 'open cart',
  remove: 'remove from cart',
  edit: 'edit from cart',
};

class AISupportChat extends HTMLElement {
  connectedCallback() {
    if (this.dataset.initialised) return;
    this.dataset.initialised = 'true';

    this.endpoint = this.dataset.endpoint || '';
    this.greeting = personalise(this.dataset.greeting || 'Hi {name}! How can I help you today?', this.dataset.customerName);
    this.chips = (this.dataset.chips || '').split('|').map((c) => c.trim()).filter(Boolean);
    // Render free instances cold-start slowly — allow a long ceiling.
    this.timeoutMs = Number(this.dataset.timeout || 90000);
    this.busy = false;
    this.lastSent = '';
    // The pill is a live status, not a tagline: it says Online only once a
    // real reply has come back. The theme's subheading setting is used as the
    // label only if a merchant deliberately changed it away from the default.
    const sub = (this.dataset.subtitle || '').trim();
    this.onlineText = (!sub || sub === 'Usually replies instantly') ? 'Online' : sub;

    this.#placeLauncher();

    this.sessionId = this.#restoreSessionId();
    this.#render();
    this.#bind();
    this.#restoreTranscript();
    this.#attention();

    this.#restoreDock();
    this.#restorePanelSize();
    this.#warmUp();
    this.#sizePill();
    this.#restorePosition();
    this.#peek();
    // A webfont swapping in changes how wide "Shop with AI" actually is.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => this.#sizePill()).catch(() => {});
    }
  }

  /**
   * Corner or centre. A merchant can name the templates that want the centred,
   * always-open pill — "collection,index" — so the assistant can be the
   * invitation on a landing page and stay a corner utility everywhere else.
   */
  #placeLauncher() {
    const full = (this.dataset.template || '').toLowerCase();
    const base = full.split('.')[0];

    /**
     * Both forms of template name are accepted, so a merchant can be as broad
     * or as exact as the page needs: "page" catches every page, while
     * "page.trade-program" catches only that one.
     */
    const listed = (names) => String(names || '')
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .some((n) => n === full || n === base);

    // The default, then the exceptions. Right is checked last, so a template
    // named in both lists keeps the corner — the safer of the two, since a
    // centred pill sits over the middle of the page.
    let centred = this.dataset.position === 'center';
    if (listed(this.dataset.centerTemplates)) centred = true;
    if (listed(this.dataset.rightTemplates)) centred = false;
    this.dataset.position = centred ? 'center' : 'right';
  }

  // ── Session + persistence ──────────────────────────────────────────────
  /**
   * The backend owns session ids — it only accepts its own "cs_" prefixed ones
   * and mints a fresh one for anything else. So we start with nothing and store
   * whatever the first `session` frame hands back, which is what keeps the
   * conversation's memory window alive across a page navigation.
   */
  #restoreSessionId() {
    try {
      const id = sessionStorage.getItem('aisc:session');
      return id && id.startsWith('cs_') ? id : null;
    } catch (e) {
      return null; // private mode
    }
  }

  #rememberSessionId(id) {
    if (!id || id === this.sessionId) return;
    this.sessionId = id;
    try { sessionStorage.setItem('aisc:session', id); } catch (e) { /* ignore */ }
  }

  #saveTranscript() {
    try {
      const items = [...this.log.querySelectorAll('[data-role]')].map((el) => ({
        role: el.dataset.role,
        text: el.dataset.raw || el.textContent,
        ts: el.dataset.ts || '',
        products: el.dataset.products || '',
        outfit: el.dataset.outfit || '',
        suggestions: el.dataset.suggestions || '',
        position: el.dataset.suggestionsPosition || '',
        orders: el.dataset.orders || '',
        group: el.dataset.group || '',
      }));
      sessionStorage.setItem('aisc:log', JSON.stringify(items.slice(-40)));
    } catch (e) { /* ignore */ }
  }

  #restoreTranscript() {
    let items = [];
    try { items = JSON.parse(sessionStorage.getItem('aisc:log') || '[]'); } catch (e) { /* ignore */ }

    this.#renderWelcome();
    // Conversations saved before the welcome block existed still open with the
    // greeting as a bot turn; it would now read twice.
    if (items.length && items[0].role === 'bot' && items[0].text === this.greeting) items.shift();

    if (!items.length) {
      this.#renderChips();
      return;
    }
    items.forEach((m) =>
      this.#addMessage(m.role, m.text,
        { silent: true, ts: m.ts, products: m.products, outfit: m.outfit,
          suggestions: m.suggestions, position: m.position, orders: m.orders, group: m.group }));
  }

  /** Draw the eye once per browser session, never again. */
  #attention() {
    try {
      if (sessionStorage.getItem('aisc:seen')) return;
      sessionStorage.setItem('aisc:seen', '1');
    } catch (e) { /* ignore */ }
    this.setAttribute('data-attention', '');
  }

  // ── Markup ─────────────────────────────────────────────────────────────
  #render() {
    const title = this.dataset.title || 'Support';
    // The invitation changes with the page. Standing in a collection, "Browse
    // this collection?" is a better offer than "Shop with AI" — it is about
    // what the shopper is already looking at.
    const onTemplate = {
      collection: this.dataset.launcherLabelCollection,
      product: this.dataset.launcherLabelProduct,
    }[(this.dataset.template || '').split('.')[0]];
    const launcherLabel =
      String(onTemplate || this.dataset.launcherLabel || 'Shop with AI').trim();
    // Without a logo the avatar is the launcher's own sparkle, so the button
    // the shopper pressed is the face that answers them.
    const logo = this.dataset.logo
      ? `<img src="${escapeHtml(this.dataset.logo)}" alt="" class="aisc-logo">`
      : ICONS.open;
    // The notice is markup we build here from two plain settings, never
    // merchant HTML — so a stray tag in the theme editor cannot reach the DOM.
    const noticeText = (this.dataset.notice || '').trim();
    const noticeHref = (this.dataset.noticeHref || '').trim();
    const noticeLabel = (this.dataset.noticeLabel || '').trim();
    const notice = noticeText
      ? `<div class="aisc-notice">${escapeHtml(noticeText)}${
          noticeHref && noticeLabel
            ? ` <a href="${encodeURI(noticeHref)}" target="_blank" rel="noopener noreferrer">${
                escapeHtml(noticeLabel)}</a>`
            : ''
        }</div>`
      : '';

    // Terms and privacy sit in the header menu rather than under the composer:
    // they are read once, if ever, and the panel is calmer without them.
    const legal = [
      ['termsUrl', this.dataset.termsLabel || 'Terms of Use'],
      ['privacyUrl', this.dataset.privacyLabel || 'Privacy'],
    ].map(([key, label]) => {
      const href = (this.dataset[key] || '').trim();
      return href
        ? `<a href="${encodeURI(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`
        : '';
    }).join('');

    this.innerHTML = `
      <div class="aisc-panel" role="dialog" aria-modal="false" aria-label="Customer support chat" hidden>
        <!-- The panel is anchored to the bottom-right, so it grows towards the
             top-left: the corner takes both axes, the edges one each. Sliders
             rather than plain handles, so a keyboard can move them too. -->
        <div class="aisc-resize aisc-resize--edge-top" data-resize="h"
             role="slider" tabindex="0" aria-label="Resize chat height"
             aria-orientation="vertical"></div>
        <div class="aisc-resize aisc-resize--edge-left" data-resize="w"
             role="slider" tabindex="0" aria-label="Resize chat width"
             aria-orientation="horizontal"></div>
        <div class="aisc-resize aisc-resize--corner" data-resize="wh"
             role="slider" tabindex="0" aria-label="Resize chat window">${ICONS.resize}</div>
        <div class="aisc-header">
          <div class="aisc-avatar" aria-hidden="true">${logo}</div>
          <div class="aisc-header-text">
            <div class="aisc-title">${escapeHtml(title)}</div>
            <div class="aisc-state" data-tone="ok" role="status" aria-live="polite">${escapeHtml(
              this.onlineText)}</div>
          </div>
          <div class="aisc-hactions">
          <button type="button" class="aisc-hbtn aisc-cart" aria-label="View your cart"
                  title="View cart">${ICONS.cart}</button>
          <button type="button" class="aisc-hbtn aisc-dock" aria-label="Dock the chat to the side"
                  aria-pressed="false" title="Dock to the side">${ICONS.dock}</button>
          <div class="aisc-menu-wrap">
            <button type="button" class="aisc-hbtn aisc-more" aria-label="Chat options"
                    aria-expanded="false" title="Options">${ICONS.more}</button>
            <div class="aisc-menu" role="dialog" aria-label="Chat options" hidden>
              <div class="aisc-menu-title">Start a new chat?</div>
              <p class="aisc-menu-copy">Starting a new chat will delete this conversation.
                 You can't undo this action.</p>
              <button type="button" class="aisc-menu-btn aisc-reset">Start a new chat</button>
              <div class="aisc-menu-links">${legal}</div>
              <p class="aisc-menu-note">${escapeHtml(title)} uses AI, so it may occasionally
                 make mistakes.</p>
            </div>
          </div>
          <button type="button" class="aisc-hbtn aisc-close" aria-label="Close chat">${ICONS.dismiss}</button>
          </div>
        </div>
        ${notice}
        <div class="aisc-log" role="log" aria-live="polite" aria-atomic="false"></div>
        <button type="button" class="aisc-jump" aria-label="Jump to latest message">${ICONS.down}</button>
        <div class="aisc-chips"></div>
        <form class="aisc-form">
          <label class="aisc-sr" for="aisc-input">Type your message</label>
          <div class="aisc-field">
            <textarea id="aisc-input" class="aisc-input" rows="1"
                      placeholder="${escapeHtml(this.dataset.placeholder || `Message ${title}`)}"
                      autocomplete="off"></textarea>
            <button type="submit" class="aisc-send" aria-label="Send message">${ICONS.send}</button>
          </div>
        </form>
        <div class="aisc-viewer" role="dialog" aria-label="Product photos" hidden>
          <div class="aisc-viewer-bar">
            <button type="button" class="aisc-viewer-back" aria-label="Back to the chat">
              <span class="aisc-viewer-chev" aria-hidden="true">${ICONS.next}</span>
              <span class="aisc-viewer-title"></span>
            </button>
          </div>
          <div class="aisc-viewer-stage">
            <img class="aisc-viewer-img" alt="" draggable="false">
            <button type="button" class="aisc-viewer-arrow aisc-viewer-arrow--prev" aria-label="Previous photo">${ICONS.next}</button>
            <button type="button" class="aisc-viewer-arrow aisc-viewer-arrow--next" aria-label="Next photo">${ICONS.next}</button>
          </div>
          <div class="aisc-viewer-thumbs"></div>
        </div>
      </div>
      <div class="aisc-launcher-wrap">
        <button type="button" class="aisc-launcher" aria-label="Open customer support chat"
                aria-expanded="false">
          <span class="aisc-launcher-disc" aria-hidden="true">${ICONS.open}</span>
          <span class="aisc-launcher-label" aria-hidden="true">${escapeHtml(launcherLabel)}</span>
        </button>
        <span class="aisc-badge" aria-hidden="true">1</span>
      </div>`;

    this.panel = this.querySelector('.aisc-panel');
    this.menu = this.querySelector('.aisc-menu');
    this.moreBtn = this.querySelector('.aisc-more');
    this.dockBtn = this.querySelector('.aisc-dock');
    this.viewer = this.querySelector('.aisc-viewer');
    this.log = this.querySelector('.aisc-log');
    this.stateEl = this.querySelector('.aisc-state');
    this.chipBar = this.querySelector('.aisc-chips');
    this.form = this.querySelector('.aisc-form');
    this.input = this.querySelector('.aisc-input');
    this.sendBtn = this.querySelector('.aisc-send');
    this.launcher = this.querySelector('.aisc-launcher');
    this.launcherLabel = this.querySelector('.aisc-launcher-label');
    this.jumpBtn = this.querySelector('.aisc-jump');
  }

  // ── Launcher pill ──────────────────────────────────────────────────────
  /**
   * The open width has to be a real number for the growth to animate — `auto`
   * does not transition — so the label is measured once and handed to CSS.
   * Re-measured when the webfont lands, since that is when the text resizes.
   */
  #sizePill() {
    if (!this.launcherLabel) return;
    const w = Math.ceil(this.launcherLabel.getBoundingClientRect().width);
    if (w > 0) this.style.setProperty('--aisc-label-w', `${w}px`);
  }

  /** Show the pill open for a moment on a first visit, then let it settle. */
  #peek() {
    if (!this.hasAttribute('data-attention') || this.dataset.position === 'center') return;
    this.setAttribute('data-peek', '');
    setTimeout(() => this.removeAttribute('data-peek'), 3000);
  }

  // ── Dragging the launcher up and down ──────────────────────────────────
  /** Distance from the bottom of the viewport to the bottom of the widget. */
  #bottomPx() {
    return Math.round(window.innerHeight - this.getBoundingClientRect().bottom);
  }

  /** Keep the whole launcher on screen whatever the window is doing. */
  #clampBottom(px) {
    const h = this.launcher.offsetHeight || 64;
    return Math.min(Math.max(px, EDGE_GAP), Math.max(EDGE_GAP, window.innerHeight - h - EDGE_GAP));
  }

  #setBottom(px, remember) {
    const y = this.#clampBottom(px);
    this.style.setProperty('--aisc-bottom', `${y}px`);
    this.#placePanel();
    if (remember) {
      // Stored as a fraction of the viewport so the widget lands in the same
      // place on a laptop and a tall monitor, not 900px up a 700px screen.
      try { localStorage.setItem(POS_KEY, String(y / window.innerHeight)); } catch (e) { /* ignore */ }
    }
  }

  #restorePosition() {
    let saved = null;
    try { saved = localStorage.getItem(POS_KEY); } catch (e) { /* ignore */ }
    if (saved === null) return;
    const ratio = Number(saved);
    if (!Number.isFinite(ratio)) return;
    this.#setBottom(ratio * window.innerHeight, false);
  }

  /**
   * The panel hangs off the launcher, so once the launcher can be anywhere the
   * panel has to be told where the room is: above the launcher when there is
   * space for it, otherwise pushed down until its top edge clears the viewport.
   */
  #placePanel() {
    if (!this.panel || this.panel.hidden) return;
    if (this.dataset.dock === 'side') return;   // pinned to the window instead
    const vh = window.innerHeight;
    const panelH = this.panel.offsetHeight;
    if (!panelH) return;

    // Measured from the bottom of the window, because that is what the panel
    // is positioned against — see the note on .aisc-panel.
    let y = this.#bottomPx() + PANEL_GAP;       // its resting place, above the launcher
    y = Math.min(y, vh - EDGE_GAP - panelH);    // keep the top edge on screen
    y = Math.max(y, EDGE_GAP);                  // and the bottom edge with it
    this.style.setProperty('--aisc-panel-bottom', `${Math.round(y)}px`);
  }

  #bindDrag() {
    let startY = 0;
    let startBottom = 0;
    let dragging = false;

    const move = (e) => {
      const dy = startY - e.clientY;
      // A few pixels of slop, so a click with a shaky hand is still a click.
      if (!dragging && Math.abs(dy) < DRAG_SLOP) return;
      if (!dragging) {
        dragging = true;
        this.setAttribute('data-dragging', '');
      }
      this.#setBottom(startBottom + dy, false);
    };

    const end = () => {
      this.launcher.removeEventListener('pointermove', move);
      this.launcher.removeEventListener('pointerup', end);
      this.launcher.removeEventListener('pointercancel', end);
      if (!dragging) return;
      dragging = false;
      this.removeAttribute('data-dragging');
      this.#setBottom(this.#bottomPx(), true);

      // The pointer is still over the button, so the browser fires a click on
      // release. Swallow that one — the shopper was moving it, not opening it.
      // A cancelled gesture never produces the click, so the guard is also
      // torn down on a timer rather than waiting for a click that never comes.
      const swallow = (ev) => {
        ev.stopImmediatePropagation();
        ev.preventDefault();
        this.launcher.removeEventListener('click', swallow, true);
      };
      this.launcher.addEventListener('click', swallow, true);
      setTimeout(() => this.launcher.removeEventListener('click', swallow, true), 300);
    };

    this.launcher.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      startY = e.clientY;
      startBottom = this.#bottomPx();
      this.launcher.setPointerCapture?.(e.pointerId);
      this.launcher.addEventListener('pointermove', move);
      this.launcher.addEventListener('pointerup', end);
      this.launcher.addEventListener('pointercancel', end);
    });
  }

  /**
   * Drag the panel bigger or smaller.
   *
   * Anchored bottom-right, so it grows up and to the left and the handles live
   * on those two edges — the same place every docked chat window puts them.
   *
   * The size is written to the two custom properties the panel is already
   * sized by, so nothing else has to know this exists. No transition on
   * width or height: a drag has to track the pointer exactly, and easing it
   * would feel like lag rather than polish. `data-resizing` suspends the
   * transitions that *are* on the panel and stops the page selecting text
   * under the pointer.
   *
   * Kept off phones, where the panel is the whole screen and there is nothing
   * to resize, and off the side dock's height, which is the window's.
   */
  #bindResize() {
    const handles = this.panel ? this.panel.querySelectorAll('.aisc-resize') : [];
    if (!handles.length) return;

    const onPhone = () => window.matchMedia('(max-width: 480px)').matches;
    const limits = () => (onPhone()
      // A sheet may be pulled to the full screen, and half a screen is the
      // least that still shows a card and the composer together.
      ? { minW: 0, minH: Math.round(window.innerHeight * 0.45),
          maxW: window.innerWidth, maxH: window.innerHeight }
      : { minW: PANEL_MIN_W, minH: PANEL_MIN_H,
          maxW: Math.max(PANEL_MIN_W, window.innerWidth - 32),
          maxH: Math.max(PANEL_MIN_H, window.innerHeight - 32) });
    const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

    const apply = (w, h, remember) => {
      const l = limits();
      const box = this.panel.getBoundingClientRect();
      if (w != null) {
        this.style.setProperty('--aisc-panel-w', `${Math.round(clamp(w, l.minW, l.maxW))}px`);
      }
      if (h != null && this.dataset.dock !== 'side') {
        const px = `${Math.round(clamp(h, l.minH, l.maxH))}px`;
        this.style.setProperty(onPhone() ? '--aisc-sheet-h' : '--aisc-panel-h', px);
      }
      // The panel sits above the launcher, and growing it can push the top off
      // screen; the existing placement does that arithmetic already. A sheet is
      // pinned to the bottom by CSS and needs none of it.
      if (!onPhone()) this.#placePanel();
      if (remember) {
        try {
          localStorage.setItem(SIZE_KEY, JSON.stringify({
            w: Math.round(w == null ? box.width : clamp(w, l.minW, l.maxW)),
            h: Math.round(h == null ? box.height : clamp(h, l.minH, l.maxH)),
          }));
        } catch (e) { /* private mode: the size is simply not remembered */ }
      }
    };
    this.applyPanelSize = apply;

    handles.forEach((grip) => {
      const axis = grip.dataset.resize || 'wh';

      grip.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        // A phone has no width to give — the sheet is already the screen wide
        // — but its height is the whole point of the grip.
        if (onPhone() && !axis.includes('h')) return;
        const box = this.panel.getBoundingClientRect();
        const startX = e.clientX;
        const startY = e.clientY;
        const startW = box.width;
        const startH = box.height;
        let live = false;

        const move = (ev) => {
          // Pulling left and up makes it bigger, which is why the deltas are
          // subtracted rather than added.
          const dw = startX - ev.clientX;
          const dh = startY - ev.clientY;
          if (!live && Math.abs(dw) < DRAG_SLOP && Math.abs(dh) < DRAG_SLOP) return;
          if (!live) { live = true; this.setAttribute('data-resizing', ''); }
          apply(axis.includes('w') ? startW + dw : null,
                axis.includes('h') ? startH + dh : null, false);
        };
        const end = () => {
          grip.removeEventListener('pointermove', move);
          grip.removeEventListener('pointerup', end);
          grip.removeEventListener('pointercancel', end);
          if (!live) return;
          this.removeAttribute('data-resizing');
          const now = this.panel.getBoundingClientRect();
          apply(now.width, now.height, true);
        };
        grip.setPointerCapture?.(e.pointerId);
        grip.addEventListener('pointermove', move);
        grip.addEventListener('pointerup', end);
        grip.addEventListener('pointercancel', end);
      });

      // Arrow keys for anyone not using a pointer, and a double-click to put
      // it back to the size it shipped with.
      grip.addEventListener('keydown', (e) => {
        const step = e.shiftKey ? 48 : 16;
        const box = this.panel.getBoundingClientRect();
        let w = null;
        let h = null;
        if (axis.includes('w') && e.key === 'ArrowLeft') w = box.width + step;
        if (axis.includes('w') && e.key === 'ArrowRight') w = box.width - step;
        if (axis.includes('h') && e.key === 'ArrowUp') h = box.height + step;
        if (axis.includes('h') && e.key === 'ArrowDown') h = box.height - step;
        if (w == null && h == null) return;
        e.preventDefault();
        apply(w, h, true);
      });

      grip.addEventListener('dblclick', () => {
        this.style.removeProperty('--aisc-panel-w');
        this.style.removeProperty('--aisc-panel-h');
        try { localStorage.removeItem(SIZE_KEY); } catch (e) { /* ignore */ }
        this.#placePanel();
      });
    });
  }

  /** The size the shopper last dragged it to, if it still fits the window. */
  #restorePanelSize() {
    let saved = null;
    try { saved = localStorage.getItem(SIZE_KEY); } catch (e) { return; }
    if (!saved) return;
    try {
      const { w, h } = JSON.parse(saved);
      if (typeof w === 'number' && w > 0) {
        this.style.setProperty('--aisc-panel-w',
          `${Math.min(w, Math.max(PANEL_MIN_W, window.innerWidth - 32))}px`);
      }
      if (typeof h === 'number' && h > 0 && this.dataset.dock !== 'side') {
        const phone = window.matchMedia('(max-width: 480px)').matches;
        this.style.setProperty(phone ? '--aisc-sheet-h' : '--aisc-panel-h',
          `${Math.min(h, phone ? window.innerHeight
                               : Math.max(PANEL_MIN_H, window.innerHeight - 32))}px`);
      }
    } catch (e) { /* a corrupt entry is not worth a broken panel */ }
  }

  #bind() {
    this.launcher.addEventListener('click', () => this.toggle());
    this.#bindDrag();
    this.#bindResize();

    window.addEventListener('resize', () => {
      this.#sizePill();
      // Re-clamp rather than re-read the saved ratio: a resize should not
      // yank a launcher the shopper just moved back to where it was days ago.
      this.#setBottom(this.#bottomPx(), false);
      // A panel dragged large on a wide monitor must not hang off a narrow
      // window. Clamped to what fits, without overwriting what they chose —
      // widen the window again and their size comes back.
      if (this.applyPanelSize && this.panel && !this.panel.hidden) {
        const box = this.panel.getBoundingClientRect();
        this.applyPanelSize(box.width, box.height, false);
      }
    });
    this.querySelector('.aisc-close').addEventListener('click', () => this.close());
    this.querySelector('.aisc-reset').addEventListener('click', () => this.reset());
    this.querySelector('.aisc-cart').addEventListener('click', () => this.#openCart());
    this.querySelector('.aisc-viewer-back').addEventListener('click', () => this.#closeViewer());
    this.querySelector('.aisc-viewer-arrow--prev').addEventListener('click', () => this.#showShot(this.viewerIndex - 1));
    this.querySelector('.aisc-viewer-arrow--next').addEventListener('click', () => this.#showShot(this.viewerIndex + 1));
    this.#bindViewerSwipe();
    this.dockBtn.addEventListener('click', () =>
      this.#setDock(this.dataset.dock === 'side' ? 'float' : 'side', true));

    this.moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#toggleMenu();
    });
    // Anywhere else — inside the panel or out on the page — dismisses it.
    document.addEventListener('click', (e) => {
      if (!this.menu.hidden && !e.target.closest('.aisc-menu-wrap')) this.#toggleMenu(false);
    });
    this.jumpBtn.addEventListener('click', () => this.#scroll(true));

    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.#send(this.input.value);
    });

    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.form.requestSubmit();
      }
    });

    this.input.addEventListener('input', () => {
      this.#autoGrow();
      this.#syncTyping();
    });

    // Show "jump to latest" only when the reader has scrolled away from the end.
    this.log.addEventListener('scroll', () => {
      const gap = this.log.scrollHeight - this.log.scrollTop - this.log.clientHeight;
      this.jumpBtn.toggleAttribute('data-show', gap > 120);
    });
    // The shopper taking the scroll back ends any follow an add started.
    const stopFollowing = () => { this.followUntil = 0; };
    this.log.addEventListener('wheel', stopFollowing, { passive: true });
    this.log.addEventListener('touchmove', stopFollowing, { passive: true });
    // Grabbing the scrollbar lands on the log itself, not on anything in it.
    this.log.addEventListener('pointerdown', (e) => { if (e.target === this.log) stopFollowing(); });

    document.addEventListener('keydown', (e) => {
      if (!this.hasAttribute('open')) return;

      // The photographs are their own view: the arrows walk them and Escape
      // steps back to the conversation rather than closing the whole panel.
      if (!this.viewer.hidden) {
        if (e.key === 'Escape') { e.preventDefault(); this.#closeViewer(); }
        if (e.key === 'ArrowRight') { e.preventDefault(); this.#showShot(this.viewerIndex + 1); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); this.#showShot(this.viewerIndex - 1); }
        return;
      }

      if (e.key !== 'Escape') return;
      if (!this.menu.hidden) {
        this.#toggleMenu(false);
        this.moreBtn.focus();
        return;
      }
      this.close();
    });

    // Keep Tab inside the panel while it is open.
    this.panel.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const f = [...this.panel.querySelectorAll('button, textarea, input, a[href]')]
        .filter((el) => !el.disabled && el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    const netState = () => {
      const off = !navigator.onLine;
      this.toggleAttribute('data-offline', off);
      if (off) this.#setStatus('crit', 'No connection');
      else if (!this.busy) this.#setStatus('ok', this.onlineText);
    };
    window.addEventListener('online', netState);
    window.addEventListener('offline', netState);
    netState();

    document.addEventListener('ai-support-chat:open', () => this.open());
  }












  /**
   * Grow the composer to fit what is typed, up to a few lines.
   *
   * The border has to be added back on. `scrollHeight` measures content plus
   * padding, but the field is border-box, so assigning it straight to `height`
   * leaves the border no room — the text then overflows by exactly those two
   * pixels and the browser draws a scrollbar on a single line of text.
   */
  #autoGrow() {
    const el = this.input;
    const borders = el.offsetHeight - el.clientHeight;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight + borders, MAX_INPUT_HEIGHT) + 'px';
    // Only let it scroll once it has actually stopped growing.
    el.style.overflowY = el.scrollHeight + borders > MAX_INPUT_HEIGHT ? 'auto' : 'hidden';
  }

  #syncSend() {
    this.sendBtn.disabled = this.busy;
  }

  #renderChips() {
    this.chipBar.innerHTML = '';
    this.chips.forEach((label) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'aisc-chip';
      b.textContent = label;
      b.addEventListener('click', () => this.#send(label));
      this.chipBar.appendChild(b);
    });
  }

  // ── Welcome ────────────────────────────────────────────────────────────
  /**
   * The opening is a greeting, not a message. A heading and one line of
   * invitation read as the assistant introducing itself; the same words in a
   * chat bubble read as a turn the shopper has to answer.
   */
  #renderWelcome() {
    const title = this.dataset.title || 'Support';
    const wrap = document.createElement('div');
    wrap.className = 'aisc-welcome';

    const h = document.createElement('h2');
    h.className = 'aisc-welcome-title';
    h.textContent = personalise(
      this.dataset.welcomeHeading || `Welcome to ${title}`, this.dataset.customerName);
    wrap.appendChild(h);

    if (this.greeting) {
      const sub = document.createElement('p');
      sub.className = 'aisc-welcome-sub';
      sub.textContent = this.greeting;
      wrap.appendChild(sub);
    }

    // Theme-editor picks win — a merchant who chose eight collections meant
    // those eight. Otherwise the backend is asked for what the store actually
    // publishes, which arrives a moment later and slots in underneath.
    const cats = this.#categoryRow(this.#pickedCategories());
    if (cats) wrap.appendChild(cats);
    else this.#loadCategories(wrap);
    this.log.prepend(wrap);
  }

  /**
   * Wake the assistant's server before the shopper has anything to ask it.
   *
   * It sleeps when idle, and the first message after a nap waited on it to
   * start — QA's "taking too much time". Asking for the collections list once
   * the page has settled wakes it while the shopper is still browsing, and
   * that list is the one the welcome screen shows, so it is already cached by
   * the time the chat is opened. Once per page: `loadCollections` keeps the
   * answer, so a second call costs nothing.
   *
   * On idle rather than at once, so it never competes with the store's own
   * page load for bandwidth.
   */
  #warmUp() {
    const url = this.#collectionsUrl();
    if (!url) return;
    const go = () => { loadCollections(url); };
    if ('requestIdleCallback' in window) window.requestIdleCallback(go, { timeout: 3000 });
    else setTimeout(go, 1500);
  }

  #pickedCategories() {
    try { return JSON.parse(this.dataset.categories || '[]'); } catch (e) { return []; }
  }

  /**
   * Every collection the store publishes, from the assistant's own service.
   * The route is a sibling of the chat one, so a merchant who has set the
   * endpoint has already set this; `data-collections-endpoint` overrides it for
   * a backend that puts the two somewhere else.
   */
  #collectionsUrl() {
    const explicit = (this.dataset.collectionsEndpoint || '').trim();
    if (explicit) return explicit;
    const chat = (this.endpoint || '').trim();
    const url = chat.replace(/\/chat\/?$/, '/collections');
    // Nothing was replaced, so this endpoint is not shaped the way we assumed
    // and guessing a URL from it would only produce a confusing request.
    return url === chat ? '' : url;
  }

  async #loadCategories(wrap) {
    const url = this.#collectionsUrl();
    if (!url) return;

    let items = [];
    try {
      items = await loadCollections(url);
    } catch (e) {
      return; // no shelf is a fine outcome; a broken welcome is not
    }
    // A reset or a restored transcript may have replaced the welcome while the
    // request was in the air.
    if (!items.length || !wrap.isConnected) return;

    const row = this.#categoryRow(items);
    if (row) {
      row.dataset.late = '1';
      wrap.appendChild(row);
    }
  }

  /**
   * A shelf of places to start, built from the collections the merchant picked.
   * Tapping one asks about it rather than navigating: the point is to open a
   * conversation, and a shopper who wanted the collection page would have used
   * the menu.
   */
  /**
   * Prev and next for a strip that scrolls sideways, each hidden when there is
   * nothing that way — and both hidden when the whole strip already fits.
   * One implementation for the collection shelf, the product gallery and the
   * recommendations, so all three behave the same way under the hand.
   */
  #scrollArrows(track, className, step) {
    const make = (dir) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `${className} ${className}--${dir}`;
      b.setAttribute('aria-label', dir === 'prev' ? 'Previous' : 'Next');
      b.innerHTML = ICONS.next;
      b.hidden = true;
      b.addEventListener('click', () => {
        const by = (typeof step === 'function' && step()) || Math.round(track.clientWidth * 0.8);
        track.scrollBy({ left: dir === 'prev' ? -by : by, behavior: 'smooth' });
      });
      return b;
    };
    const prev = make('prev');
    const next = make('next');
    const sync = () => {
      const room = track.scrollWidth - track.clientWidth;
      prev.hidden = room < 4 || track.scrollLeft < 4;
      next.hidden = room < 4 || room - track.scrollLeft < 4;
    };
    return { prev, next, sync };
  }

  /**
   * A mouse can't swipe a strip the way a finger can, so on a desktop the
   * strip is grabbed and dragged instead. Touch is left to the browser's own
   * scrolling. Snapping is paused while the hand is on it — otherwise every
   * pixel of drag fights the snap — and the click that ends a drag is eaten,
   * so letting go over a photograph doesn't open it.
   */
  #dragScroll(el) {
    el.addEventListener('dragstart', (e) => e.preventDefault());
    let startX = 0;
    let startLeft = 0;
    let down = false;
    let dragged = false;
    let snap = '';

    const move = (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (!dragged) {
        if (Math.abs(dx) < DRAG_SLOP) return;
        dragged = true;
        snap = el.style.scrollSnapType;
        el.style.scrollSnapType = 'none';
        el.style.scrollBehavior = 'auto';
        el.setAttribute('data-grabbing', '');
        el.setPointerCapture?.(e.pointerId);
      }
      el.scrollLeft = startLeft - dx;
    };
    const end = () => {
      if (!down) return;
      down = false;
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', end);
      if (!dragged) return;
      el.removeAttribute('data-grabbing');
      el.style.scrollBehavior = '';
      el.style.scrollSnapType = snap;
      const swallow = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
      el.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => el.removeEventListener('click', swallow, { capture: true }), 0);
    };

    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      if (el.scrollWidth - el.clientWidth < 4) return;
      down = true;
      dragged = false;
      startX = e.clientX;
      startLeft = el.scrollLeft;
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    });
  }

  /**
   * The big photograph follows the hand — finger or mouse — and a throw past
   * a fifth of its width (or a quick flick) moves to the next shot. Anything
   * less springs back.
   */
  #bindViewerSwipe() {
    const stage = this.querySelector('.aisc-viewer-stage');
    const img = this.querySelector('.aisc-viewer-img');
    let startX = 0;
    let startY = 0;
    let startT = 0;
    let id = null;
    let dragging = false;

    const settle = () => {
      img.style.transition = '';
      img.style.transform = '';
    };

    stage.addEventListener('dragstart', (e) => e.preventDefault());
    stage.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.aisc-viewer-arrow')) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if ((this.viewerShots || []).length < 2) return;
      id = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      startT = performance.now();
      dragging = false;
    });
    stage.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!dragging) {
        if (Math.abs(dx) < DRAG_SLOP || Math.abs(dx) < Math.abs(dy)) return;
        dragging = true;
        stage.setPointerCapture?.(id);
        stage.setAttribute('data-grabbing', '');
        img.style.transition = 'none';
      }
      img.style.transform = `translateX(${dx}px)`;
    });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      if (!dragging) return;
      dragging = false;
      stage.removeAttribute('data-grabbing');
      const dx = e.clientX - startX;
      const fast = Math.abs(dx) / Math.max(1, performance.now() - startT) > 0.5;
      settle();
      if (e.type === 'pointercancel') return;
      if (Math.abs(dx) > stage.clientWidth * 0.2 || (fast && Math.abs(dx) > 30)) {
        this.#showShot(this.viewerIndex + (dx < 0 ? 1 : -1));
      }
    };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
  }

  #categoryRow(source) {
    const items = (Array.isArray(source) ? source : []).filter((i) => i && i.title);
    if (!items.length) return null;

    const prompt = this.dataset.categoryPrompt || 'Tell me more about {title}';
    const wrap = document.createElement('div');
    wrap.className = 'aisc-cats-wrap';
    const row = document.createElement('div');
    row.className = 'aisc-cats';

    items.forEach((item, at) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'aisc-cat';
      if (item.image) {
        const frame = document.createElement('span');
        frame.className = 'aisc-cat-frame';

        // A tinted card sitting behind the photograph, just off-square. It is
        // the only decoration in the panel, and it is what makes the shelf
        // read as a stack of things to pick up rather than a row of pictures.
        const back = document.createElement('span');
        back.className = 'aisc-cat-back';
        back.style.background = item.color || tintFor(at);
        frame.appendChild(back);

        const img = document.createElement('img');
        img.className = 'aisc-cat-img';
        img.src = item.image;
        img.alt = '';
        img.loading = 'lazy';
        frame.appendChild(img);
        card.appendChild(frame);
      }
      const label = document.createElement('span');
      label.className = 'aisc-cat-label';
      label.textContent = item.title;
      card.appendChild(label);
      card.addEventListener('click', () => {
        // The reply that comes back is about this collection, and the widget
        // knows its name without having to read it out of the prose.
        this.pendingGroup = item.title;
        this.#send(prompt.replace('{title}', item.title));
      });
      row.appendChild(card);
    });

    const card = () => {
      const first = row.firstElementChild;
      return first ? first.offsetWidth + 14 : 0;
    };
    const { prev, next, sync } = this.#scrollArrows(row, 'aisc-cats-arrow', card);
    row.addEventListener('scroll', sync);
    this.#dragScroll(row);
    requestAnimationFrame(sync);
    // Images landing changes the width the arrows were measured against.
    row.querySelectorAll('img').forEach((img) => img.addEventListener('load', sync, { once: true }));

    wrap.append(row, prev, next);
    return wrap;
  }

  // ── Header controls ────────────────────────────────────────────────────
  /**
   * A dot on the cart icon once there is something in the cart. Deliberately
   * not a number: the count is one tap away, and a badge that has to be read
   * competes with the conversation for attention.
   */
  /**
   * What the cart holds, kept so a card can say "In your cart" instead of
   * offering to add something that is already there. Matched on the variant
   * rather than the product: a shopper with the 12M in their basket looking at
   * the 18M is looking at something they have not bought.
   */
  #rememberCart(cart) {
    const lines = (cart && cart.items) || [];
    this.cartVariants = new Set(
      lines.map((i) => Number(i.variant_id != null ? i.variant_id : i.id)).filter(Boolean));
    this.#showCartDot(cart ? cart.item_count : 0);
    // A card drawn a moment before the add landed still reads "Add to cart":
    // every card with a settled choice looks again. And the other way: a card
    // drawn before a removal landed still read "In your cart" under "Removed".
    if (this.log) {
      this.log.querySelectorAll('.aisc-pcard').forEach((card) => {
        const add = card.querySelector('.aisc-pcard-add');
        if (!add || add.dataset.busy) return;
        // A row with no size picked yet counts as in the cart when any of its
        // variants is - the same test #fillCard draws it with.
        const chosen = card.dataset.chosen ||
          (card.aiscProduct && (card.aiscProduct.variants.find((v) => this.#inCart(v.id)) || {}).id);
        if (card.dataset.change !== 'removed' && chosen && this.#inCart(chosen)) {
          this.#markInCart(add, chosen);
        } else if (add.classList.contains('aisc-pcard-add--incart')) {
          add.classList.remove('aisc-pcard-add--incart');
          add.removeAttribute('aria-label');
          add.textContent = add.dataset.label || 'Add to cart';
        }
      });
    }
  }

  #inCart(id) {
    return Boolean(this.cartVariants && this.cartVariants.has(Number(id)));
  }

  /**
   * Already in the cart? Say so — and roll to "Add to cart" under the
   * pointer, so the button reports the state at rest and offers the action
   * the moment someone reaches for it. Every Add to cart button goes through
   * here, so a product reads the same wherever it turns up.
   */
  #markInCart(add, id) {
    const there = id != null && this.#inCart(id);
    add.classList.toggle('aisc-pcard-add--incart', there);
    if (there) {
      add.disabled = false;
      add.innerHTML =
        `<span class="aisc-roll aisc-roll--icon" aria-hidden="true">` +
          `<span class="aisc-roll-cell">${ICONS.cartFull}</span>` +
          `<span class="aisc-roll-cell">${ICONS.plus}</span>` +
        `</span>` +
        `<span class="aisc-roll aisc-roll--label" aria-hidden="true">` +
          `<span class="aisc-roll-cell">In your cart</span>` +
          `<span class="aisc-roll-cell">Add to cart</span>` +
        `</span>`;
      add.setAttribute('aria-label', 'In your cart. Add another');
    } else {
      add.removeAttribute('aria-label');
    }
    return there;
  }

  #showCartDot(count) {
    const n = Number(count) || 0;
    this.toggleAttribute('data-cart', n > 0);
    const btn = this.querySelector('.aisc-cart');
    if (btn) {
      btn.setAttribute('aria-label', n
        ? `View your cart, ${n} ${n === 1 ? 'item' : 'items'}`
        : 'View your cart');
    }
  }

  /**
   * Read the count on its own. Separate from #readCart, which a merchant can
   * switch off for privacy — the dot never leaves the browser, so it should
   * not disappear along with the data the backend is allowed to see.
   */
  async #syncCart() {
    try {
      const cart = await fetch(shopRoot() + 'cart.js', { headers: { Accept: 'application/json' } })
        .then((r) => (r.ok ? r.json() : null));
      if (cart) this.#rememberCart(cart);
    } catch (e) { /* a cart we cannot read simply shows no dot */ }
  }

  #openCart() {
    if (this.dataset.cartAction === 'drawer' && this.#openCartDrawer()) return;
    const root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
    window.location.href = `${root}cart`.replace('//cart', '/cart');
  }

  #toggleMenu(show) {
    const open = show === undefined ? this.menu.hidden : show;
    this.menu.hidden = !open;
    this.moreBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  /**
   * Floating in the corner, or pinned full-height to the edge of the window.
   * The choice is remembered, because it is a way of working rather than a
   * per-conversation decision.
   */
  #setDock(mode, remember) {
    const side = mode === 'side';
    this.dataset.dock = side ? 'side' : 'float';
    if (this.dockBtn) {
      const label = side ? 'Undock the chat' : 'Dock the chat to the side';
      this.dockBtn.innerHTML = side ? ICONS.undock : ICONS.dock;
      this.dockBtn.setAttribute('aria-pressed', side ? 'true' : 'false');
      this.dockBtn.setAttribute('aria-label', label);
      this.dockBtn.title = label;
    }
    if (remember) {
      try { localStorage.setItem(DOCK_KEY, this.dataset.dock); } catch (e) { /* ignore */ }
    }

    // Docked, there is nothing to place. Undocking returns the panel to where
    // it was floating, which the variable still holds — so leave it alone and
    // let the box animate there, then re-measure once it has settled, in case
    // the window changed size while it was docked.
    clearTimeout(this.dockSettle);
    if (!side) this.dockSettle = setTimeout(() => this.#placePanel(), 430);
  }

  #restoreDock() {
    let saved = null;
    try { saved = localStorage.getItem(DOCK_KEY); } catch (e) { /* ignore */ }
    this.#setDock(saved === 'side' ? 'side' : 'float', false);
  }

  /** The send button only exists once there is something to send. */
  #syncTyping() {
    this.form.toggleAttribute('data-typing', Boolean(this.input.value.trim()));
  }

  // ── Open / close / reset ───────────────────────────────────────────────
  toggle() { this.hasAttribute('open') ? this.close() : this.open(); }

  open() {
    this.setAttribute('open', '');
    this.removeAttribute('data-unread');
    this.removeAttribute('data-attention');
    this.panel.hidden = false;
    this.#placePanel();
    this.#syncCart();
    this.launcher.setAttribute('aria-expanded', 'true');
    this.launcher.setAttribute('aria-label', 'Close customer support chat');
    this.#scroll(true);
    if (!window.matchMedia('(hover: none)').matches) {
      setTimeout(() => this.input.focus(), 120);
    }
  }

  /**
   * Open the panel with a question already asked.
   *
   * Lets the rest of the storefront hand a shopper straight into a conversation
   * — a "not sure on the size?" prompt beside the size chart, a homepage band
   * offering to put an outfit together — instead of opening an empty composer
   * and making them think of the question themselves.
   *
   * A turn already in flight is not interrupted; the question is dropped into
   * the composer for them to send when it settles.
   */
  ask(text) {
    this.open();
    const question = String(text || '').trim();
    if (!question) return;

    if (this.busy) {
      this.input.value = question;
      this.#autoGrow();
      return;
    }
    this.#send(question);
  }

  close() {
    this.removeAttribute('open');
    this.launcher.setAttribute('aria-expanded', 'false');
    this.launcher.setAttribute('aria-label', 'Open customer support chat');
    setTimeout(() => { if (!this.hasAttribute('open')) this.panel.hidden = true; }, 240);
    this.launcher.focus();
  }

  /** Fresh session id too — otherwise the agent keeps the old memory window. */
  reset() {
    try {
      sessionStorage.removeItem('aisc:log');
      sessionStorage.removeItem('aisc:session');
    } catch (e) { /* ignore */ }
    this.sessionId = this.#restoreSessionId();
    this.log.innerHTML = '';
    this.#closeViewer();
    this.#toggleMenu(false);
    this.#renderWelcome();
    this.#renderChips();
    this.input.focus();
  }

  // ── Messages ───────────────────────────────────────────────────────────
  #addMessage(role, text,
    { silent = false, ts = '', products = '', outfit = '', suggestions = '',
      position = '', orders = '', group = '' } = {}) {
    const stamp = ts || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const row = document.createElement('div');
    row.className = 'aisc-row aisc-row--' + role;

    if (role === 'bot') {
      const ava = document.createElement('div');
      ava.className = 'aisc-ava';
      ava.setAttribute('aria-hidden', 'true');
      ava.textContent = (this.dataset.title || 'S').trim()[0].toUpperCase();
      row.appendChild(ava);
    }

    const el = document.createElement('div');
    el.className = 'aisc-msg aisc-msg--' + role;
    el.dataset.role = role;
    el.dataset.raw = text;
    el.dataset.ts = stamp;
    if (role === 'bot') {
      if (products) el.dataset.products = products;
      if (suggestions) el.dataset.suggestions = suggestions;
      if (position) el.dataset.suggestionsPosition = position;
      if (orders) el.dataset.orders = orders;
      if (group) el.dataset.group = group;
      if (outfit) el.dataset.outfit = outfit;
    }
    const parsed = role === 'bot'
      ? splitOptions(dedupeCardProse(text, this.#cardTitles(el)))
      : { text, options: [] };
    el.innerHTML = role === 'bot' ? renderRich(parsed.text) : escapeHtml(text);
    // A product image that 404s should not leave an empty grey frame.
    el.querySelectorAll('.aisc-product-img').forEach((img) => {
      img.addEventListener('error', () => {
        const wrap = img.closest('.aisc-img-wrap');
        if (wrap) wrap.remove();
      });
    });
    row.appendChild(el);

    if (role === 'bot' && !silent && parsed.options.length) {
      this.#addQuickReplies(el, parsed.options);
    }

    if (role !== 'system') {
      const t = document.createElement('span');
      t.className = 'aisc-time';
      t.textContent = stamp;
      row.appendChild(t);
    }

    this.log.appendChild(row);

    // Surface a ticket reference as something the shopper can actually keep.
    const m = role === 'bot' && text.match(TICKET_RE);
    if (m) this.#addTicketChip(el, m[0]);

    if (role === 'bot') {
      // A reply that was never streamed — restored from the transcript, or
      // returned whole on `done` — still earns its follow-ups and its actions.
      // Only #finishStream used to add them, so both were being lost.
      //
      // Built before the cards, not after: the hydrators insert their blocks
      // directly after this row, so anything already sitting there is pushed
      // below them — which is where the follow-ups belong.
      let offers = [];
      try { offers = JSON.parse(el.dataset.suggestions || '[]'); } catch (e) { /* ignore */ }
      if (offers.length || this.hasAttribute('data-cart')) this.#addQuickReplies(row, offers);
      if (text) this.#addActions(row, text);

      this.#hydrateBuys(el);
      this.#hydrateOutfit(el);
      this.#hydrateProducts(el);
      this.#hydrateOrders(el);
      this.#placeQuickReplies(el);
    }

    this.#scroll();
    if (!silent) this.#saveTranscript();
    return el;
  }

  /**
   * Put the follow-ups where the backend said they go. They are built in the
   * strip below the cards; a reply that is asking - "How old is she?" - has
   * position "before_products", and its answers are lifted to sit between the
   * message and its cards, so they are met before a shelf not yet narrowed.
   * Called once the cards are in: each card block is inserted directly after
   * the message row, so anything moved there earlier would end up under them.
   */
  #placeQuickReplies(el) {
    if (el.dataset.suggestionsPosition !== 'before_products') return;
    const row = el.parentElement;
    if (!row) return;
    // Once lifted it is no longer in the strip, so it is remembered: a second
    // pass after more cards went in lifts it back above them.
    const quick = (row.aiscAfter && row.aiscAfter.querySelector('.aisc-quick')) || row.aiscQuick;
    if (!quick || !quick.isConnected) return;
    row.aiscQuick = quick;
    row.after(quick);
  }




  /**
   * Copy, and a verdict. The thumbs are only worth offering if the answer goes
   * somewhere, so a rating is dispatched as a DOM event the storefront can
   * listen for, and posted only to an endpoint the merchant has actually
   * configured — guessing a write route on someone's API is not on.
   */
  #addActions(row, text) {
    const bar = document.createElement('div');
    bar.className = 'aisc-acts';

    const act = (icon, label) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'aisc-act';
      b.setAttribute('aria-label', label);
      b.title = label;
      b.innerHTML = icon;
      bar.appendChild(b);
      return b;
    };

    const copy = act(ICONS.copy, 'Copy this reply');
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(text);
      } catch (e) {
        return; // the browser refused; there is nothing useful to say about it
      }
      copy.innerHTML = ICONS.check;
      copy.setAttribute('aria-label', 'Copied');
      setTimeout(() => {
        copy.innerHTML = ICONS.copy;
        copy.setAttribute('aria-label', 'Copy this reply');
      }, 1600);
    });

    const up = act(ICONS.thumbUp, 'This was helpful');
    const down = act(ICONS.thumbDown, 'This was not helpful');
    const vote = (btn, other, verdict) => btn.addEventListener('click', () => {
      const on = btn.toggleAttribute('data-on');
      other.removeAttribute('data-on');
      // Pressing again clears it: a shopper who mis-taps should be able to
      // take it back rather than being stuck with an opinion.
      this.#rate(on ? verdict : null, text);
    });
    vote(up, down, 'up');
    vote(down, up, 'down');

    this.#afterBlock(row).appendChild(bar);
  }

  #rate(verdict, text) {
    const detail = { rating: verdict, message: text, session_id: this.sessionId || null };
    this.dispatchEvent(new CustomEvent('aisc:rating', { detail, bubbles: true }));

    const url = (this.dataset.feedbackEndpoint || '').trim();
    if (!url || !verdict) return;
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(detail),
      keepalive: true,
    }).catch(() => { /* a lost vote is not worth telling the shopper about */ });
  }

  #addTicketChip(bubble, ticket) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'aisc-ticket';
    b.innerHTML = ICONS.copy + '<span>' + escapeHtml(ticket) + '</span>';
    b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(ticket); } catch (e) { return; }
      const label = b.querySelector('span');
      const old = label.textContent;
      label.textContent = 'Copied';
      setTimeout(() => { label.textContent = old; }, 1400);
    });
    bubble.appendChild(b);
  }



  #addEscalationBanner() {
    const el = document.createElement('div');
    el.className = 'aisc-esc';
    el.innerHTML = ICONS.check +
      '<span>This conversation has been passed to a human agent. You will get a reply by email.</span>';
    this.log.appendChild(el);
    this.#scroll();
  }

  // Choices the agent offered, as buttons. They vanish once one is picked so a
  // stale menu cannot be answered twice.
  /**
   * The strip under a reply that holds its follow-ups and its actions.
   *
   * It lives after the message row rather than inside the bubble, because the
   * product and order cards are inserted directly after that row — so anything
   * placed here ends up below them, which is where a "what next" belongs.
   */
  #afterBlock(row) {
    let block = row.aiscAfter;
    if (block && block.isConnected) return block;
    block = document.createElement('div');
    block.className = 'aisc-after';
    row.insertAdjacentElement('afterend', block);
    row.aiscAfter = block;
    return block;
  }

  #addQuickReplies(row, offers) {
    const wrap = document.createElement('div');
    wrap.className = 'aisc-quick';

    // No Checkout in the chat: the store's own cart is where a shopper goes to
    // pay. A "Checkout" the backend suggests itself is dropped too.
    offers = offers.filter((o) =>
      !/^\s*(go to |proceed to )?check\s?out\s*$/i.test(String((o && o.label) || o || '')));
    if (!offers.length) return;

    offers.forEach((offer) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'aisc-quick-btn';
      b.textContent = offer.label;
      b.addEventListener('click', () => {
        if (this.busy) return;
        if (offer.keep) {
          wrap.querySelectorAll('[aria-pressed="true"]').forEach((o) => o.setAttribute('aria-pressed', 'false'));
          b.setAttribute('aria-pressed', 'true');
        } else {
          wrap.remove();
        }
        this.#send(offer.prompt || offer.label);
      });
      wrap.appendChild(b);
    });
    this.#afterBlock(row).appendChild(wrap);
  }

  #addRetry(afterEl) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'aisc-retry';
    b.textContent = 'Try again';
    b.addEventListener('click', () => {
      b.remove();
      this.#send(this.lastSent, { resend: true });
    });
    afterEl.appendChild(b);
  }

  /**
   * Said in words rather than drawn as three bouncing dots: the shopper is
   * being asked to wait, and a sentence explains that where a decoration only
   * hints at it. The trailing dots count up as a loader would.
   */
  #showTyping() {
    const row = document.createElement('div');
    row.className = 'aisc-row aisc-row--bot aisc-row--typing';
    row.innerHTML =
      '<div class="aisc-typing" role="status" aria-live="polite">' +
        '<span class="aisc-typing-mark" aria-hidden="true"></span>' +
        '<span class="aisc-typing-text">' +
          escapeHtml(this.dataset.thinking || 'Thinking this through, just a moment') +
          // Out of the accessible name: a screen reader announcing the sentence
          // again on every tick of the dots would be unbearable.
          '<span class="aisc-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>' +
        '</span>' +
      '</div>';
    this.log.appendChild(row);
    this.#scroll(true);
    return row;
  }

  #scroll(force = false) {
    const following = Date.now() < (this.followUntil || 0);
    const gap = this.log.scrollHeight - this.log.scrollTop - this.log.clientHeight;
    if (!force && !following && gap > 160) return; // reader is looking at history — leave them alone
    requestAnimationFrame(() => { this.log.scrollTop = this.log.scrollHeight; });
  }

  /**
   * Keep the conversation pinned to its end for a while after the shopper
   * adds something. What an add produces — the confirm card's options, the
   * full description, the "You might also like" shelf and its photographs —
   * arrives over several requests, and each is taller than the gap #scroll
   * allows, so without this the view would stop following after the first.
   */
  #follow(ms = 8000) {
    this.followUntil = Date.now() + ms;
  }

  #setBusy(state) {
    this.busy = state;
    this.input.disabled = state;
    this.#syncSend();
  }

  /**
   * Header pill: what we actually know about the assistant right now.
   * Green once it has answered, blue while it is thinking, amber while a
   * cold Render instance wakes, red when we could not reach it. Observed
   * from real replies only — it never fires an extra request to find out,
   * so it can never claim "online" without evidence.
   */
  #setStatus(tone, text) {
    if (!this.stateEl) return;
    this.stateEl.dataset.tone = tone;
    this.stateEl.textContent = text;
  }

  // ── Cart ───────────────────────────────────────────────────

  /**
   * The shopper's live cart, summarised for the agent.
   *
   * There is no way to look a Shopify cart up by customer — a cart belongs to a
   * browser cookie, and most shoppers are not signed in — so the only place it
   * can come from is here, travelling with the message. Trimmed rather than
   * forwarded whole: the agent needs what is in the basket, not every image
   * size and property of every line.
   */
  async #readCart() {
    if (this.dataset.sendCart === 'false') return null;
    try {
      const cart = await fetch(shopRoot() + 'cart.js', { headers: { Accept: 'application/json' } })
        .then((r) => (r.ok ? r.json() : null));
      if (!cart || !Array.isArray(cart.items)) return null;
      // Shopify decides the presentment currency from the shopper's market, and
      // a currency switcher can change it after the page was rendered. Taking it
      // from the live cart rather than the Liquid attribute means a shopper who
      // switches to GBP is not still described as shopping in INR.
      if (cart.currency) this.liveCurrency = cart.currency;
      this.#rememberCart(cart);
      return {
        token: cart.token,
        item_count: cart.item_count,
        total_price: cart.total_price,   // minor units, as Shopify gives them
        currency: cart.currency,
        items: cart.items.slice(0, 20).map((i) => ({
          variant_id: i.id,
          product_id: i.product_id,
          title: i.product_title || i.title,
          variant_title: i.variant_title,
          quantity: i.quantity,
          line_price: i.line_price,
          handle: i.handle,
        })),
      };
    } catch (e) {
      return null;   // a cart we cannot read must never block the message
    }
  }

  /**
   * Who the shopper is, when Liquid says they are signed in.
   *
   * Everything here is rendered by the theme from the `customer` object, so a
   * guest sends nothing at all. It is still a browser talking, though: anyone
   * can POST any email to the endpoint, so the backend must treat these as a
   * hint about who is asking and never as proof. Releasing order or account
   * data on the strength of an email in this payload would hand it to whoever
   * types it. Verified identity needs a Shopify App Proxy, which signs the
   * request so the server can check it really came from the store.
   */
  #customerContext() {
    const d = this.dataset;
    if (!d.customerId && !d.customerEmail) return null;
    const who = {
      // Two different claims, and the difference matters. `logged_in` is true:
      // Liquid only renders these values for a shopper with a session, so this
      // really is a signed-in person. `verified` is about the *server's* side —
      // the request is still just JSON from a browser, and nothing in it proves
      // it came from the storefront rather than from anyone with curl. It flips
      // to true only under a signed transport such as a Shopify App Proxy.
      logged_in: true,
      verified: false,
    };
    if (d.customerId) who.id = d.customerId;
    if (d.customerEmail) who.email = d.customerEmail;
    if (d.customerPhone) who.phone = d.customerPhone;
    if (d.customerName) who.first_name = d.customerName;
    const currency = this.liveCurrency || d.currency;
    if (currency) who.currency = currency;
    return who;
  }

  /**
   * The shopper's storefront context. Sent for guests too, because currency is
   * what prices are quoted in and a guest needs those quoted correctly just as
   * much as a signed-in customer does.
   */
  #storefrontContext() {
    const d = this.dataset;
    const ctx = {};
    const currency = this.liveCurrency || d.currency;
    if (currency) ctx.currency = currency;
    if (d.shopCurrency && d.shopCurrency !== currency) ctx.shop_currency = d.shopCurrency;
    if (d.country) ctx.country = d.country;
    if (d.locale) ctx.locale = d.locale;
    if (d.template) ctx.template = d.template;
    if (d.productTitle) ctx.viewing_product = d.productTitle;
    ctx.page_url = location.href;
    return Object.keys(ctx).length > 1 ? ctx : null;
  }

  /**
   * Open the theme's cart drawer. Called rather than relying on the theme's own
   * auto-open, which is off unless the merchant enabled it and would otherwise
   * throw the drawer over the conversation on every add.
   */
  #openCartDrawer() {
    const drawer = document.querySelector('theme-drawer#cart-drawer');
    if (!drawer || typeof drawer.open !== 'function') return false;
    if (!drawer.isOpen) drawer.open();
    return true;
  }

  // ── Product cards ──────────────────────────────────────────

  /**
   * Render the products the backend named in its `products` event.
   *
   * The card is built in two passes. The first draws immediately from the
   * event — title, image, price — so the shopper sees something the moment the
   * reply lands. The second fills in sizes, stock and description from the live
   * storefront, because those are the parts that go stale and the parts a buy
   * button must not get wrong.
   */
  /**
   * The cart, drawn as product cards.
   *
   * Only used when the backend answered a cart question in prose alone. The
   * lines come from Shopify's own /cart.js rather than from anything in the
   * reply, so the cards cannot disagree with the cart — and because every
   * variant in them is by definition in the cart, each one comes up reading
   * "In your cart" rather than offering to add it again.
   */
  async #showCartItems(bubble) {
    if (!bubble) return;

    let cart = null;
    try {
      cart = await fetch(shopRoot() + 'cart.js', { headers: { Accept: 'application/json' } })
        .then((r) => (r.ok ? r.json() : null));
    } catch (e) {
      return;   // an unreadable cart is not worth an error in the conversation
    }
    const lines = (cart && cart.items) || [];
    // The reply may have been cleared by a reset while the cart was being read.
    if (!lines.length || !bubble.isConnected) return;

    this.#rememberCart(cart);
    const currency = cart.currency || this.dataset.currency;

    const items = lines.slice(0, 8).map((l) => ({
      title: l.product_title || l.title,
      // /cart.js gives "/products/handle?variant=123", which is all the card
      // needs to find the live product.
      url: l.url || (l.handle ? `${shopRoot()}products/${l.handle}` : ''),
      image: l.image || (l.featured_image && l.featured_image.url) || '',
      price: (Number(l.price) || 0) / 100,   // cents, as the AJAX API gives them
      currency,
      // The exact thing in the cart, so the card does not have to guess at it
      // from a picker the shopper has already been through once.
      variantId: l.variant_id != null ? l.variant_id : l.id,
    })).filter((i) => i.title && handleFromUrl(i.url));
    if (!items.length) return;

    // The cards now say everything the sentence did — "your cart has one item:
    // the Amelia Gingham Trapeze Dress at 11400.00 INR" — so the sentence
    // goes. This is the same de-duplication a backend-sent card gets, run late
    // because the cart only arrives after the reply has been drawn.
    const raw = bubble.dataset.raw || '';
    const trimmed = dedupeCardProse(raw, items.map((i) => i.title), true);
    if (!trimmed.trim()) {
      // The sentence said nothing the cards do not. Hidden rather than emptied,
      // so no bare bubble and no stray timestamp is left standing above them.
      bubble.parentElement.hidden = true;
    } else if (trimmed !== raw) {
      bubble.innerHTML = renderRich(splitOptions(trimmed).text);
      this.#hydrateBuys(bubble);
    }

    const wrap = document.createElement('div');
    wrap.className = 'aisc-pcards';
    items.forEach((item) => wrap.appendChild(this.#productCard(item, 'list')));
    bubble.parentElement.insertAdjacentElement('afterend', wrap);
    this.#scroll();
  }

  /**
   * The shopper's own orders, as cards rather than as a list the assistant
   * retyped. The whole card opens the order, because "where is my order" is
   * nearly always followed by wanting to look at it.
   */
  #hydrateOrders(el) {
    if (!el.dataset.orders || el.dataset.ordersDone) return;
    el.dataset.ordersDone = '1';

    let orders = [];
    try { orders = JSON.parse(el.dataset.orders); } catch (e) { return; }
    if (!orders.length) return;

    const wrap = document.createElement('div');
    wrap.className = 'aisc-orders';
    orders.forEach((order) => wrap.appendChild(this.#orderCard(order)));
    el.parentElement.insertAdjacentElement('afterend', wrap);
    this.#scroll();
  }

  #orderCard(order) {
    // Always a plain box, never a link around the whole thing: the pieces
    // inside are product cards with their own buttons, and wrapping those in
    // an anchor would swallow every one of their clicks. The way to the order
    // is its own line at the foot.
    const card = document.createElement('div');
    card.className = 'aisc-order';

    const head = document.createElement('div');
    head.className = 'aisc-order-head';
    const name = document.createElement('span');
    name.className = 'aisc-order-name';
    name.textContent = order.name;
    head.appendChild(name);

    if (order.status) {
      const state = document.createElement('span');
      state.className = 'aisc-state';
      const tone = statusTone(order.status);
      if (tone) state.dataset.tone = tone;
      state.textContent = order.status;
      head.appendChild(state);
    }
    card.appendChild(head);

    // Placed on, how many pieces, what it came to — one quiet line.
    const facts = [
      formatDate(order.placed),
      order.items.length
        ? `${order.items.length} ${order.items.length === 1 ? 'item' : 'items'}`
        : '',
      order.total == null || order.total === ''
        ? ''
        : typeof order.total === 'string' && !/^[\d.,\s]+$/.test(order.total)
          ? order.total                                   // already formatted
          : money(Number(String(order.total).replace(/[^\d.-]/g, '')), order.currency),
    ].filter(Boolean);
    if (facts.length) {
      const meta = document.createElement('div');
      meta.className = 'aisc-order-meta';
      meta.textContent = facts.join(' · ');
      card.appendChild(meta);
    }

    // What the status actually means for the shopper, in the backend's words.
    if (order.meaning) {
      const note = document.createElement('p');
      note.className = 'aisc-order-note';
      note.textContent = order.meaning;
      card.appendChild(note);
    }

    order.items.slice(0, ORDER_ITEMS_SHOWN).forEach((item) => {
      // A piece the storefront can still be asked about becomes a real card —
      // photograph, live price, and a way to order it again. One that arrives
      // as a bare name stays a name.
      card.appendChild(handleFromUrl(item.url)
        ? this.#productCard(item, 'list')
        : this.#orderLine(item));
    });

    // The rest are counted rather than listed: an order of twelve should not
    // push the next reply off the screen.
    const rest = order.items.length - ORDER_ITEMS_SHOWN;
    if (rest > 0) {
      const more = document.createElement('div');
      more.className = 'aisc-order-more';
      more.textContent = `and ${rest} more ${rest === 1 ? 'item' : 'items'}`;
      card.appendChild(more);
    }

    if (order.url) {
      const link = document.createElement('a');
      link.className = 'aisc-order-link';
      link.href = order.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = `View order ${order.name}`;
      card.appendChild(link);
    }

    return card;
  }

  /** A piece with no product page behind it: what it was, and how many. */
  #orderLine(item) {
    const row = document.createElement('div');
    row.className = 'aisc-order-item';

    if (item.image) {
      const img = document.createElement('img');
      img.className = 'aisc-order-thumb';
      img.src = item.image;
      img.alt = '';
      img.loading = 'lazy';
      img.addEventListener('error', () => img.remove());
      row.appendChild(img);
    }

    const text = document.createElement('span');
    text.className = 'aisc-order-text';
    const title = document.createElement('span');
    title.className = 'aisc-order-title';
    title.textContent = item.title;
    text.appendChild(title);
    if (item.variant) {
      const v = document.createElement('span');
      v.className = 'aisc-order-variant';
      v.textContent = item.variant;
      text.appendChild(v);
    }
    row.appendChild(text);

    if (item.quantity > 1) {
      const qty = document.createElement('span');
      qty.className = 'aisc-order-qty';
      qty.textContent = `×${item.quantity}`;
      row.appendChild(qty);
    }
    return row;
  }

  /**
   * The collection these products belong to: the one the backend named, or the
   * one the shopper tapped. Only meaningful where there are products to head.
   */
  #groupOf(el) {
    if (!el.dataset.products) return '';
    try {
      const items = JSON.parse(el.dataset.products);
      if (Array.isArray(items) && items[0] && items[0].group) return String(items[0].group);
    } catch (e) { /* ignore */ }
    return el.dataset.group || '';
  }

  #hydrateProducts(el) {
    if (!el.dataset.products || el.dataset.productsDone) return;
    el.dataset.productsDone = '1';

    let items = [];
    try { items = JSON.parse(el.dataset.products); } catch (e) { return; }
    items = items.filter((i) => i && i.title && handleFromUrl(i.url));
    if (!items.length) return;

    const wrap = document.createElement('div');
    wrap.className = 'aisc-pcards';

    // What these products are. A heading rather than a sentence — for "tell me
    // about Autumn Layers", the name of the collection is the answer, and the
    // cards under it are the rest of it.
    const group = this.#groupOf(el);
    if (group) {
      const head = document.createElement('div');
      head.className = 'aisc-pcards-head';
      head.textContent = group;
      wrap.appendChild(head);
    }

    // A comparison is read across, not down. Two pieces stand side by side and
    // the attributes that differ line up between them, so the eye can travel
    // left to right on "Sizes" instead of holding one card in memory while it
    // scrolls to the next.
    if (items.length > 1 && items.some((i) => i.compare)) {
      wrap.classList.add('aisc-pcards--compare');
      wrap.appendChild(this.#compareRow(items));
      el.parentElement.insertAdjacentElement('afterend', wrap);
      this.#scroll();
      return;
    }

    // Asking about one product is a different question from asking which
    // products exist, so a single answer gets the full card — gallery, note
    // and a quantity — while several stay scannable rows. A confirmation is
    // neither: it is one thing, already chosen, waiting to be approved.
    // The assistant marks one as waiting to be confirmed (`confirm: true`);
    // the widget does not read that off the shopper's words itself.
    const one = items.length === 1;
    // What went into or came out of the bag is a receipt, not a product to
    // study: always the compact row. A single removal drew the full card -
    // gallery, description, size picker - for a thing the shopper just let go.
    const bagChange = items.some((i) => ['removed', 'added', 'edited', 'changed']
      .includes(String(i.change || '').toLowerCase()));
    const mode = bagChange ? 'list'
      : one && items[0].confirm ? 'confirm'
      : one ? 'detail' : 'list';

    // Fold a long list. Only worth it when at least two cards are hidden — a
    // row reading "Show 1 more" costs the height of the card it is hiding.
    const cap = Math.max(1, Number(this.dataset.productPreview) || PREVIEW_CARDS);
    const fold = mode === 'list' && items.length > cap + 1;
    const shown = fold ? items.slice(0, cap) : items;

    // The Removed / Now in your bag tag is drawn by #productCard itself, so the
    // cards behind "Show N more" carry it too.
    shown.forEach((item) => wrap.appendChild(this.#productCard(item, mode)));
    if (fold) wrap.appendChild(this.#moreRow(items.slice(cap), mode));

    // Below the row rather than inside the bubble: a card is its own object and
    // needs the panel's full width.
    el.parentElement.insertAdjacentElement('afterend', wrap);
    this.#scroll();
  }

  /**
   * The cards of a comparison, and the means to reach the ones off-screen.
   *
   * A scroller rather than the recommendation shelf's deck: two cards read
   * side by side is the point, so they lie flat and level instead of fanning.
   * The arrows only appear when something is actually out of sight, each
   * sitting on a fade so the row visibly continues under it rather than
   * stopping at a hard edge.
   */
  #compareRow(items) {
    const frame = document.createElement('div');
    frame.className = 'aisc-cmp-frame';

    const row = document.createElement('div');
    row.className = 'aisc-cmp-row';
    items.forEach((item) => row.appendChild(this.#compareCard(item)));
    frame.appendChild(row);

    const arrow = (dir) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `aisc-cmp-arrow aisc-cmp-arrow--${dir}`;
      b.setAttribute('aria-label', dir === 'prev' ? 'Previous' : 'Next');
      b.innerHTML = ICONS.next;
      b.hidden = true;
      b.addEventListener('click', () => {
        // One card per press. Measured rather than assumed: the cards flex to
        // the panel, so their width is only known once they are laid out.
        const card = row.querySelector('.aisc-cmp-card');
        const step = card ? card.getBoundingClientRect().width + 10 : row.clientWidth * 0.8;
        row.scrollBy({ left: dir === 'prev' ? -step : step, behavior: 'smooth' });
      });
      return b;
    };
    const prev = arrow('prev');
    const next = arrow('next');
    frame.append(prev, next);

    // An arrow is an answer to something being out of sight; with both cards
    // on screen it is furniture. The fades follow the arrows for the same
    // reason, so a row that fits shows no decoration at all.
    const sync = () => {
      const slack = row.scrollWidth - row.clientWidth;
      const atStart = row.scrollLeft <= 1;
      const atEnd = row.scrollLeft >= slack - 1;
      prev.hidden = slack <= 1 || atStart;
      next.hidden = slack <= 1 || atEnd;
      frame.classList.toggle('aisc-cmp-frame--prev', !prev.hidden);
      frame.classList.toggle('aisc-cmp-frame--next', !next.hidden);
    };
    row.addEventListener('scroll', sync, { passive: true });
    requestAnimationFrame(sync);
    // A photograph arriving changes what fits, and so does the panel being
    // resized or opened on a phone in landscape.
    row.querySelectorAll('img').forEach((img) => img.addEventListener('load', sync, { once: true }));
    if (typeof ResizeObserver === 'function') new ResizeObserver(sync).observe(row);
    return frame;
  }

  /**
   * One side of a comparison.
   *
   * Deliberately not `#productCard` in another mode: that card is built to be
   * read on its own — gallery, swatches, quantity — and none of it survives
   * being squeezed to half the panel. This one carries only what the shopper
   * is comparing: the photograph, the price, the attributes that differ, and
   * the one button worth having under them.
   */
  #compareCard(item) {
    const card = document.createElement('div');
    card.className = 'aisc-cmp-card';

    const shot = String(item.image || '').trim();
    if (shot) {
      const figure = document.createElement('div');
      figure.className = 'aisc-cmp-media';
      const img = document.createElement('img');
      img.className = 'aisc-cmp-img';
      img.loading = 'lazy';
      img.alt = '';                       // the title below is the name already
      img.src = shot;
      // A photograph that never arrives should cost its frame, not leave a
      // grey hole the height of the card above the words that matter.
      img.addEventListener('error', () => figure.remove());
      figure.appendChild(img);
      card.appendChild(figure);
    }

    const title = document.createElement('a');
    title.className = 'aisc-cmp-title';
    title.textContent = item.title;
    if (item.url) { title.href = item.url; title.target = '_top'; }
    card.appendChild(title);

    const price = document.createElement('div');
    price.className = 'aisc-cmp-price';
    setSalePrice(price, item.price, item.compare_at_price, item.currency);
    if (price.textContent) card.appendChild(price);

    // The comparison proper. Label and value on one line, the label muted, so
    // the values form a column the eye can run down against the card beside it.
    const rows = Array.isArray(item.diff) ? item.diff : [];
    if (rows.length) {
      const list = document.createElement('div');
      list.className = 'aisc-cmp-specs';
      rows.forEach((r) => {
        const line = document.createElement('p');
        line.className = 'aisc-cmp-spec';
        const key = document.createElement('span');
        key.className = 'aisc-cmp-spec-k';
        key.textContent = r.label ? r.label + ': ' : '';
        line.append(key, document.createTextNode(r.value));
        list.appendChild(line);
      });
      card.appendChild(list);
    }

    // What the piece is good for, as the payload puts it. Capped: past four the
    // card stops being scannable, which is the only thing it is for.
    const good = (Array.isArray(item.highlights) ? item.highlights : [])
      .map((h) => String(h || '').trim()).filter(Boolean).slice(0, 4);
    if (good.length) {
      const ul = document.createElement('ul');
      ul.className = 'aisc-cmp-good';
      good.forEach((h) => {
        const li = document.createElement('li');
        li.textContent = h;
        ul.appendChild(li);
      });
      card.appendChild(ul);
    }

    const foot = document.createElement('div');
    foot.className = 'aisc-cmp-foot';
    if (item.variant_id) {
      // The same button every other card carries, not a look-alike: same
      // class, same label, same "In your cart" roll, same add path. A shopper
      // comparing two pieces is one tap from the list they just came out of,
      // and the button should not change under them.
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'aisc-pcard-add';
      add.dataset.label = 'Add to cart';
      add.textContent = add.dataset.label;
      this.#markInCart(add, item.variant_id);
      // Like a row in a list, and for the same reason: the card is too narrow
      // to ask which colour and which size, so the button opens the confirm
      // card underneath and that asks. Adding the payload's variant straight
      // to the cart would quietly choose a size on the shopper's behalf.
      add.addEventListener('click', () => this.#openConfirm(item, card));
      foot.appendChild(add);
    } else if (item.url) {
      // No variant means nothing safe to add — the product page can ask for the
      // size the payload did not carry.
      const go = document.createElement('a');
      go.className = 'aisc-buy-link';
      go.href = item.url;
      go.target = '_top';
      go.textContent = 'View product';
      foot.appendChild(go);
    }
    if (foot.children.length) card.appendChild(foot);

    // A comparison card is a row in a list that happens to stand sideways, so
    // it answers a press the same way: the whole card asks about the piece,
    // while its own controls — the title's link, Add to cart — take the click
    // first and do their own job.
    card.addEventListener('click', (e) => {
      if (e.target.closest('button, a')) return;
      const ask = this.dataset.productPrompt || this.dataset.categoryPrompt ||
        'Tell me more about {title}';
      this.#send(ask.replace('{title}', item.title));
    });
    return card;
  }

  #productCard(item, mode) {
    const detail = mode === 'detail';
    const confirming = mode === 'confirm';
    const card = document.createElement('div');
    card.className = 'aisc-pcard aisc-pcard--' + mode;
    // Set before anything reads the cart for this card: a removed piece must
    // never be drawn "In your cart" from a cart read before the removal landed.
    const change = String(item.change || '').toLowerCase();
    if (change === 'removed' || change === 'added') card.dataset.change = change;

    // Every photograph this card knows about, in the order they arrived. The
    // strip renders from it and the viewer opens on it, so the two can never
    // disagree about what the third picture is.
    const shots = [];
    const seen = new Set();
    const accept = (src) => {
      if (!src) return false;
      // The card opens on the image the assistant already showed, so the same
      // photograph must not arrive again when the live product is read.
      const key = String(src).split('?')[0].replace(/^https?:/, '');
      if (seen.has(key)) return false;
      seen.add(key);
      shots.push(src);
      return true;
    };

    const title = document.createElement('a');
    title.className = 'aisc-pcard-title';
    title.href = item.url;
    title.textContent = item.title;

    const price = document.createElement('div');
    price.className = 'aisc-pcard-price';
    // A reduced piece shows as one from the first frame, not only once the live
    // product has answered; #fillCard redraws it from the live price after.
    const saleOff = setSalePrice(price, item.price, item.compare_at_price, item.currency);

    const stock = document.createElement('div');
    stock.className = 'aisc-pcard-stock';

    const sizes = document.createElement('div');
    sizes.className = 'aisc-pcard-sizes';

    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'aisc-pcard-add';
    // The label the button returns to after "…", "Sold out" or a choice.
    add.dataset.label = confirming ? 'Confirm' : 'Add to cart';
    add.textContent = add.dataset.label;
    add.disabled = true;                       // until the live product answers

    // What the assistant said about this product, if it said anything. On a
    // detail card it is called out as the assistant's own note; in a list it
    // is just the line under the row.
    const desc = document.createElement('p');
    desc.className = 'aisc-pcard-desc';
    if (item.description) desc.textContent = String(item.description).trim();

    // A referral or discount code, where the shopper is about to commit. Off
    // unless the theme editor switches it on.
    const code = (detail || confirming) && this.dataset.discountCodes === 'true'
      ? this.#codeField(card) : null;

    let gallery = null;
    if (detail) {
      gallery = this.#gallery(item, shots, accept);
      const note = document.createElement('div');
      note.className = 'aisc-pcard-note';
      note.innerHTML = `<span class="aisc-pcard-note-mark" aria-hidden="true">${ICONS.open}</span>`;
      note.appendChild(desc);

      const buy = document.createElement('div');
      buy.className = 'aisc-pcard-buy';
      buy.append(this.#qtyStepper(), add);

      card.append(gallery.wrap, title, price, note, stock, sizes);
      if (code) card.append(code);
      card.append(buy);
    } else {
      const top = document.createElement('div');
      top.className = 'aisc-pcard-top';

      // A button, not a link: it opens the photographs. The product page is
      // reached through the underlined title, which says so.
      if (item.image && accept(item.image)) {
        const shotBox = document.createElement('div');
        shotBox.className = 'aisc-pcard-shot';

        const frame = document.createElement('button');
        frame.type = 'button';
        frame.className = 'aisc-pcard-img';
        frame.setAttribute('aria-label', `See photos of ${item.title}`);
        const img = document.createElement('img');
        img.src = item.image;
        img.alt = item.title;
        img.loading = 'lazy';
        img.addEventListener('error', () => shotBox.remove());
        img.addEventListener('load', () => this.#scroll(), { once: true });
        frame.appendChild(img);
        frame.addEventListener('click', () => this.#openViewer(item.title, shots, 0, frame));
        shotBox.appendChild(frame);

        // Its place in the ranking, when the answer is one.
        if (Number(item.rank) > 0) {
          const rank = document.createElement('span');
          rank.className = 'aisc-pcard-rank';
          rank.textContent = String(Math.round(item.rank));
          shotBox.appendChild(rank);
        }
        top.appendChild(shotBox);
      }

      const main = document.createElement('div');
      main.className = 'aisc-pcard-main';
      if (confirming) {
        // Already chosen, so the row is just what is being approved; the
        // question and the answer sit underneath it at full width.
        main.append(title, price);
        top.appendChild(main);
        card.append(top, stock, sizes);
        if (code) card.append(code);
        card.append(add);
      } else {
        main.append(title, price, stock, sizes, add);
        top.appendChild(main);
        card.append(top, desc);
      }
    }

    // The same "N% off" tag #fillCard puts over the title, which replaces it.
    if (saleOff) {
      const badge = document.createElement('span');
      badge.className = 'aisc-pcard-badge';
      badge.textContent = saleOff;
      title.before(badge);
    }

    // After an edit the same product can appear twice - the size taken out and
    // the size put in - and two identical cards with no word between them leave
    // the shopper guessing which is now in their bag.
    if (card.dataset.change) {
      const tag = document.createElement('span');
      tag.className = 'aisc-pcard-change';
      tag.textContent = card.dataset.change === 'added' ? 'Now in your bag' : 'Removed';
      title.before(tag);
    }

    // A row in a list is a thing to ask about. The detail card is already the
    // answer to that question, and the confirm card is waiting on a decision,
    // so neither of those takes the click.
    if (!detail && !confirming) {
      card.addEventListener('click', (e) => {
        // The card's own controls win: the photograph opens the viewer, the
        // title goes to the product page, Add to cart adds.
        if (e.target.closest('button, a')) return;
        const ask = this.dataset.productPrompt || this.dataset.categoryPrompt ||
          'Tell me more about {title}';
        this.#send(ask.replace('{title}', item.title));
      });
    }

    this.#fillCard({ card, item, mode, price, stock, sizes, desc, add, gallery, accept })
      .then(() => {
        // The options arrive after the card is drawn and make it taller, so a
        // confirm card that is still the newest thing is brought fully into view.
        if (confirming && card.dataset.pinned && this.log.lastElementChild &&
            this.log.lastElementChild.contains(card)) this.#scroll(true);
      });
    return card;
  }

  /**
   * "Have a code?" — a referral or discount code, put on the cart itself so it
   * travels with everything in it to checkout. Folded to one line until asked
   * for: most shoppers have no code, and an empty box reads as a price they
   * are missing out on.
   */
  #codeField(card) {
    const box = document.createElement('div');
    box.className = 'aisc-code';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'aisc-code-toggle';
    toggle.textContent = 'Have a referral or discount code?';

    const form = document.createElement('form');
    form.className = 'aisc-code-form';
    form.hidden = true;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'aisc-code-input';
    input.placeholder = 'Enter code';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-label', 'Referral or discount code');
    const apply = document.createElement('button');
    apply.type = 'submit';
    apply.className = 'aisc-code-apply';
    apply.textContent = 'Apply';
    form.append(input, apply);

    const status = document.createElement('div');
    status.className = 'aisc-code-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    // A code already given earlier in the conversation is still on the cart.
    if (this.discountCode) {
      toggle.hidden = true;
      status.dataset.tone = 'ok';
      status.textContent = `Code ${this.discountCode} will be applied at checkout`;
    }

    toggle.addEventListener('click', () => {
      toggle.hidden = true;
      form.hidden = false;
      input.focus();
      this.#scroll();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = input.value.trim();
      if (!code || form.dataset.busy) return;
      form.dataset.busy = '1';
      apply.disabled = true;
      apply.textContent = '…';
      delete status.dataset.tone;
      status.textContent = '';
      try {
        const { cart, applicable } = await this.#applyCode(code);
        const pid = card.dataset.productId;
        const carried = (cart.items || []).some((l) => String(l.product_id) === pid);
        if (applicable === false && carried) {
          status.dataset.tone = 'bad';
          status.textContent = `${code} can't be used on the items in your cart`;
        } else if (applicable === false || applicable === null) {
          // Nothing in the cart it covers yet — it waits on the cart and is
          // checked again at checkout.
          status.textContent = `Code ${code} saved — it will be applied at checkout if it's valid for your items`;
        } else {
          status.dataset.tone = 'ok';
          status.textContent = `Code ${code} applied`;
          this.#paintCodePrice(card, cart);
        }
        // Left open unless it worked, so a mistyped code can be corrected.
        form.hidden = applicable === true;
        toggle.hidden = true;
      } catch (err) {
        status.dataset.tone = 'bad';
        status.textContent = err.message || 'Could not check that code. Please try again.';
      } finally {
        delete form.dataset.busy;
        apply.disabled = false;
        apply.textContent = 'Apply';
        this.#scroll();
      }
    });

    box.append(toggle, form, status);
    return box;
  }

  /**
   * Put a code on the cart. Shopify's cart API takes the whole list of codes
   * at once, so the ones already there are sent back alongside it rather than
   * replaced. A store on an older cart API gets the /discount/ route instead,
   * which leaves the code in a cookie for checkout to pick up.
   */
  async #applyCode(code) {
    const want = code.toLowerCase();
    const read = () => fetch(shopRoot() + 'cart.js', { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);

    const before = await read();
    const kept = ((before && before.discount_codes) || [])
      .map((d) => d && d.code)
      .filter((c) => c && String(c).toLowerCase() !== want);

    const res = await fetch(shopRoot() + 'cart/update.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ discount: kept.concat(code).join(',') }),
    }).catch(() => null);
    const cart = res && res.ok ? await res.json().catch(() => null) : null;
    if (!cart) throw new Error('Could not check that code. Please try again.');

    const entry = (cart.discount_codes || []).find((d) => d && String(d.code).toLowerCase() === want);
    if (!entry) {
      await fetch(shopRoot() + 'discount/' + encodeURIComponent(code), { credentials: 'same-origin' })
        .catch(() => {});
    }
    this.discountCode = code;
    this.#rememberCart(cart);
    return { cart, applicable: entry ? Boolean(entry.applicable) : null };
  }

  /**
   * Once a code is taking money off this product in the cart, the card says
   * so the same way a sale does: the price paid in green, the old one struck,
   * and how much is off.
   */
  #paintCodePrice(card, cart) {
    const pid = card.dataset.productId;
    const line = pid && (cart.items || []).find((l) => String(l.product_id) === pid);
    if (!line) return;
    const now = Number(line.final_price);
    const was = Number(line.original_price);
    if (!(now < was)) return;

    const price = card.querySelector('.aisc-pcard-price');
    if (!price) return;
    const currency = cart.currency || this.dataset.currency;
    const off = Math.round((1 - now / was) * 100) + '% off';
    price.innerHTML =
      `<span class="aisc-pcard-sale">${escapeHtml(money(now / 100, currency))}</span>` +
      `<s class="aisc-pcard-was">${escapeHtml(money(was / 100, currency))}</s>` +
      `<span class="aisc-pcard-off">\u00b7 ${escapeHtml(off)}</span>`;

    card.querySelectorAll('.aisc-pcard-badge').forEach((b) => b.remove());
    const badge = document.createElement('span');
    badge.className = 'aisc-pcard-badge';
    badge.textContent = off;
    const title = card.querySelector('.aisc-pcard-title');
    if (title) title.before(badge);
  }

  /** Checkout, carrying any code the shopper gave in the conversation. */
  #checkoutUrl() {
    const url = shopRoot() + 'checkout';
    return this.discountCode ? url + '?discount=' + encodeURIComponent(this.discountCode) : url;
  }

  /**
   * "Add to cart" on a list card whose product has options. The list stays a
   * set of scannable rows; the choice is asked as its own step underneath —
   * the shopper's "Add to cart", then a card with the options and Confirm.
   */
  #openConfirm(item, from, { said = true } = {}) {
    // One question at a time per product: a second press goes back to the
    // card that is still waiting rather than stacking another under it.
    const open = from.aiscConfirm;
    if (open && open.isConnected && !open.dataset.done) {
      if (item.pick && open.aiscPick) open.aiscPick(item.pick);
      open.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }

    // A button press is given a line of its own so the conversation reads
    // naturally; a typed request already has one, and echoing it would put
    // "Add to cart" under the shopper's own words.
    const row = said ? document.createElement('div') : null;
    if (row) {
      row.className = 'aisc-row aisc-row--user';
      const line = document.createElement('div');
      line.className = 'aisc-msg aisc-msg--user';
      line.textContent = 'Add to cart';
      row.appendChild(line);
    }

    const wrap = document.createElement('div');
    wrap.className = 'aisc-pcards';
    const card = this.#productCard({ ...item, confirm: true }, 'confirm');
    wrap.appendChild(card);
    from.aiscConfirm = card;

    card.dataset.pinned = '1';
    this.#follow();
    if (row) this.log.append(row, wrap);
    else this.log.append(wrap);
    // The shopper pressed a button further up the conversation; the question
    // it asked is at the bottom, so that is where they are taken.
    this.#scroll(true);
  }

  /**
   * "Show 7 more Billiani" — the rest of the list, and a thumbnail of the next
   * one so it is clear what is behind the row. The hidden cards are built when
   * it is pressed, not before: each one reads the live product, and ten of
   * those requests for cards nobody has asked to see is rude to the store.
   */
  #moreRow(rest, mode) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'aisc-pmore';

    const stack = document.createElement('span');
    stack.className = 'aisc-pmore-stack';
    stack.setAttribute('aria-hidden', 'true');
    const sample = rest.find((i) => i.image);
    if (sample) {
      const img = document.createElement('img');
      img.src = sample.image;
      img.alt = '';
      img.loading = 'lazy';
      img.addEventListener('error', () => stack.remove());
      stack.appendChild(img);
    }

    // The group the assistant was answering about, when it named one.
    const group = (rest[0] && rest[0].group) || '';
    const label = document.createElement('span');
    label.className = 'aisc-pmore-label';
    label.textContent = `Show ${rest.length} more${group ? ' ' + group : ''}`;

    row.append(stack, label);
    row.addEventListener('click', () => {
      const rendered = document.createDocumentFragment();
      rest.forEach((item) => rendered.appendChild(this.#productCard(item, mode)));
      row.replaceWith(rendered);
      this.#scroll();
    });
    return row;
  }

  /**
   * The photographs, in a strip that scrolls sideways. Shopify hands back every
   * image on the product, and being able to see the piece from the back is
   * often the whole question — so they are all here rather than one hero shot.
   */
  #gallery(item, shots, accept) {
    const wrap = document.createElement('div');
    wrap.className = 'aisc-gallery';
    const track = document.createElement('div');
    track.className = 'aisc-gallery-track';
    wrap.appendChild(track);

    const addShot = (src) => {
      if (!accept(src)) return;
      const at = shots.length - 1;

      const shot = document.createElement('button');
      shot.type = 'button';
      shot.className = 'aisc-shot';
      shot.setAttribute('aria-label', `See photos of ${item.title}`);
      const img = document.createElement('img');
      img.src = src;
      img.alt = item.title;
      img.loading = 'lazy';
      img.addEventListener('error', () => { shot.remove(); sync(); });
      shot.appendChild(img);
      shot.addEventListener('click', () => this.#openViewer(item.title, shots, at, shot));
      track.appendChild(shot);
      sync();
    };

    const shot = () => {
      const first = track.firstElementChild;
      return first ? first.offsetWidth + 2 : 0;
    };
    const { prev, next, sync } = this.#scrollArrows(track, 'aisc-gallery-arrow', shot);
    track.addEventListener('scroll', sync);
    this.#dragScroll(track);
    wrap.append(prev, next);

    addShot(item.image);
    return { wrap, addShot, sync };
  }

  // ── Photo viewer ───────────────────────────────────────────────────────
  /**
   * Tapping a photograph takes the panel over rather than opening a layer on
   * top of the page: the shopper is looking at the piece inside the same
   * conversation, and a back chevron returns them to exactly where they were.
   */
  #openViewer(title, images, index, origin) {
    if (!images.length) return;
    this.viewerOrigin = origin || null;
    this.viewerShots = images.slice();
    this.querySelector('.aisc-viewer-title').textContent = title;

    const thumbs = this.querySelector('.aisc-viewer-thumbs');
    thumbs.innerHTML = '';
    this.viewerShots.forEach((src, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'aisc-viewer-thumb';
      b.setAttribute('aria-label', `Photo ${i + 1} of ${this.viewerShots.length}`);
      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      img.loading = 'lazy';
      b.appendChild(img);
      b.addEventListener('click', () => this.#showShot(i));
      thumbs.appendChild(b);
    });
    // A single photograph has nothing to choose between.
    thumbs.hidden = this.viewerShots.length < 2;
    if (!thumbs.dataset.drag) {
      thumbs.dataset.drag = '1';
      this.#dragScroll(thumbs);
    }
    this.querySelectorAll('.aisc-viewer-arrow').forEach((a) => { a.hidden = this.viewerShots.length < 2; });

    this.viewer.hidden = false;
    this.#showShot(index || 0);
    this.querySelector('.aisc-viewer-back').focus();
  }

  #showShot(i) {
    const shots = this.viewerShots || [];
    if (!shots.length) return;
    const n = (i + shots.length) % shots.length;
    this.viewerIndex = n;
    this.querySelector('.aisc-viewer-img').src = shots[n];
    this.querySelectorAll('.aisc-viewer-thumb').forEach((t, k) =>
      t.toggleAttribute('data-current', k === n));
    const current = this.querySelectorAll('.aisc-viewer-thumb')[n];
    if (current) current.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  #closeViewer() {
    if (this.viewer.hidden) return;
    this.viewer.hidden = true;
    // Put the shopper back on the photograph they opened, not at the top.
    if (this.viewerOrigin && this.viewerOrigin.isConnected) this.viewerOrigin.focus();
    this.viewerOrigin = null;
  }

  /** How many to add. Only ever offered on a detail card. */
  #qtyStepper() {
    const wrap = document.createElement('div');
    wrap.className = 'aisc-qty';
    wrap.dataset.qty = '1';

    const out = document.createElement('span');
    out.className = 'aisc-qty-value';
    out.textContent = '1';

    const step = (delta, label, glyph) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'aisc-qty-btn';
      b.setAttribute('aria-label', label);
      b.textContent = glyph;
      b.addEventListener('click', () => {
        const next = Math.min(99, Math.max(1, Number(wrap.dataset.qty) + delta));
        wrap.dataset.qty = String(next);
        out.textContent = String(next);
        wrap.querySelector('.aisc-qty-btn').disabled = next === 1;
      });
      return b;
    };

    const minus = step(-1, 'One fewer', '\u2212');
    minus.disabled = true;
    wrap.append(minus, out, step(1, 'One more', '+'));
    return wrap;
  }

  /** The quantity the shopper picked on this card, or one. */
  #qtyOf(card) {
    const box = card.querySelector('.aisc-qty');
    return box ? Math.max(1, Number(box.dataset.qty) || 1) : 1;
  }

  /** Second pass: everything that has to be true right now, not at sync time. */
  async #fillCard(refs) {
    const { card, item, mode, price, stock, sizes, desc, add, gallery, accept } = refs;
    const product = await loadProduct(handleFromUrl(item.url));

    if (!product || !Array.isArray(product.variants) || !product.variants.length) {
      // No live product to add against — the card stays a link to the page,
      // which is the one thing that definitely still works.
      add.remove();
      stock.remove();
      dropEmptyNote(desc);
      return;
    }

    // Shopify's recommendation endpoint keys off the numeric id, so the card
    // has to carry it once the live product has answered.
    if (product.id) card.dataset.productId = String(product.id);
    // Kept so a size the assistant picks later can find the card it belongs to.
    card.aiscProduct = product;
    card.aiscItem = item;

    const currency = (window.Shopify && window.Shopify.currency && window.Shopify.currency.active) ||
      item.currency;
    // A sale says so: the new price, the old one struck through, how much is
    // off, and the same figure as a tag above the name.
    const showPrice = (now, was) => {
      if (typeof now !== 'number') return;
      card.querySelectorAll('.aisc-pcard-badge').forEach((b) => b.remove());
      if (typeof was !== 'number' || was <= now) {
        price.textContent = money(now / 100, currency);
        return;
      }
      const off = Math.round((1 - now / was) * 100) + '% off';
      price.innerHTML =
        `<span class="aisc-pcard-sale">${escapeHtml(money(now / 100, currency))}</span>` +
        `<s class="aisc-pcard-was">${escapeHtml(money(was / 100, currency))}</s>` +
        `<span class="aisc-pcard-off">\u00b7 ${off}</span>`;
      const badge = document.createElement('span');
      badge.className = 'aisc-pcard-badge';
      badge.textContent = off;
      const title = card.querySelector('.aisc-pcard-title');
      if (title) title.before(badge);
    };
    showPrice(product.price, product.compare_at_price);

    // Every photograph on the product, after the one the assistant led with.
    // A list card has no strip to draw, but the viewer still opens on them.
    const take = gallery ? gallery.addShot : accept;
    (product.images || []).slice(0, 12).forEach(take);
    if (gallery) requestAnimationFrame(gallery.sync);

    if (product.description) {
      // Shopify returns rich text; parsing beats a tag-stripping regex, which
      // would turn "&amp;" into stray entities and choke on attributes.
      const text = new DOMParser()
        .parseFromString(product.description, 'text/html')
        .body.textContent.replace(/\s+/g, ' ').trim();
      // Kept whole on the card so the full story can be told once the shopper
      // has committed to the thing; the note itself stays a summary.
      if (text) card.dataset.fullDesc = text;
      // The assistant's own words win there: it was answering the question
      // that was actually asked. The storefront copy is the fallback.
      if (text && !desc.textContent) {
        desc.textContent = text.length > 150 ? text.slice(0, 150).trim() + '…' : text;
      }
    }
    dropEmptyNote(desc);

    // Re-checked whenever the choice changes.
    const markInCart = (id) => this.#markInCart(add, id);

    // A piece that came out of the cart already has its variant settled. The
    // picker would be inviting the shopper to change something this card is
    // not describing, so it goes, and the price shown is that variant's own.
    if (item.variantId) {
      const known = product.variants.find((v) => Number(v.id) === Number(item.variantId));
      if (known) {
        showPrice(known.price, known.compare_at_price);
        sizes.remove();
        stock.remove();
        add.disabled = false;
        markInCart(known.id);
        add.addEventListener('click', () =>
          this.#addToCart(known.id, add, card, this.#qtyOf(card)));
        return;
      }
    }

    const sellable = product.variants.filter((v) => v.available);
    if (!sellable.length) {
      stock.textContent = 'Sold out';
      stock.dataset.tone = 'out';
      add.textContent = 'Sold out';
      return;
    }
    // How the store names its own options, and which values actually exist in
    // the variant list. Reading the values off the variants rather than
    // `options[i].values` means the picker can only ever offer a combination
    // the store really stocks.
    const optionNames = (product.options || [])
      .map((o, i) => (o && (o.name || o)) || 'Option ' + (i + 1));
    if (!optionNames.length) optionNames.push('Options');

    // Older /products.js payloads carry option1..option3; newer ones an array.
    const valueAt = (v, i) => (Array.isArray(v.options) ? v.options[i] : v['option' + (i + 1)]);

    const values = optionNames.map((_, i) => {
      const seen = [];
      product.variants.forEach((v) => {
        const val = valueAt(v, i);
        if (val != null && val !== '' && seen.indexOf(val) === -1) seen.push(val);
      });
      return seen;
    });

    // "7 of 12 sizes in stock" is only true of a product with one option. A
    // shoe in 6 colours and 14 sizes has 84 variants and no count of "sizes".
    const unit = optionNames.length === 1 ? plural(optionNames[0].toLowerCase()) : 'options';
    // Only a shortfall is worth a line. "3 of 3 in stock" beside a working Add
    // to cart is the button saying the same thing twice.
    stock.textContent = product.variants.length > 1 && sellable.length < product.variants.length
      ? sellable.length + ' of ' + product.variants.length + ' ' + unit + ' in stock'
      : '';

    // The colour the shopper asked for - on this card, or noted for the whole
    // chat - when this product comes in it. Matched against the product's own
    // option values, whatever the store calls the option.
    const wantColour = String(item.color || this.#preferredColour() || '').trim().toLowerCase();
    let preferred = null;
    if (wantColour && !item.variantId && !item.pick) {
      const at = values.findIndex((vals) => vals.some((val) => String(val).toLowerCase() === wantColour));
      if (at !== -1) {
        const matches = product.variants.filter((v) => String(valueAt(v, at)).toLowerCase() === wantColour);
        const variant = matches.find((v) => v.available) || matches[0];
        preferred = { name: optionNames[at], value: valueAt(variant, at), variant };
        // Its photo, and a link that opens the product page on it.
        const src = variant.featured_image && (variant.featured_image.src || variant.featured_image);
        if (typeof src === 'string' && src) {
          const thumb = card.querySelector('.aisc-pcard-img img');
          if (gallery) gallery.addShot(src);
          else if (thumb) thumb.src = src;
          if (gallery) {
            const track = gallery.wrap.querySelector('.aisc-gallery-track');
            const key = src.split('?')[0].replace(/^https?:/, '');
            const img = track && [...track.querySelectorAll('img')]
              .find((i) => i.src.split('?')[0].replace(/^https?:/, '') === key);
            const shot = img && img.closest('.aisc-shot');
            if (shot && track.firstElementChild) {
              track.scrollTo({ left: shot.offsetLeft - track.firstElementChild.offsetLeft });
            }
          }
        }
        const link = card.querySelector('.aisc-pcard-title');
        if (link && link.href) {
          const url = new URL(link.href, location.origin);
          url.searchParams.set('variant', variant.id);
          link.href = url.toString();
        }
      }
    }

    // A single-variant product needs no picker; the button is the whole story.
    if (product.variants.length === 1) {
      add.disabled = false;
      markInCart(sellable[0].id);
      add.addEventListener('click', () =>
        this.#addToCart(sellable[0].id, add, card, this.#qtyOf(card)));
      return;
    }

    // A row in a list does not ask the question itself: its button opens a
    // confirm card underneath, which does.
    if (mode === 'list') {
      sizes.remove();
      add.disabled = false;
      add.textContent = add.dataset.label;
      // Never on a row marked Removed: the cart it reads may be the one from
      // before the removal landed.
      const carried = card.dataset.change !== 'removed' && product.variants.find((v) => this.#inCart(v.id));
      if (carried) markInCart(carried.id);
      add.addEventListener('click', () => this.#openConfirm(
        preferred ? { ...item, pick: { [preferred.name]: preferred.value } } : item, card));
      return;
    }

    // One row per option. Colour and size are two separate questions, and
    // flattening them into variant titles ("Navy / 7 UK / 8 US / 24 EU") under
    // a single heading is neither readable nor shoppable once a product has
    // more than a handful of variants.
    const selection = new Array(optionNames.length).fill(null);
    const chipsAt = [];
    let chosen = null;

    const variantFor = () => product.variants.find((v) =>
      selection.every((val, i) => val != null && valueAt(v, i) === val));

    // Whether any sellable variant carries this value at all. Deliberately not
    // narrowed by the other selections: someone who picks navy, then a size
    // navy does not come in, should be told so rather than silently locked out
    // of every size that navy happens to miss.
    const valueSellable = (i, val) =>
      product.variants.some((v) => v.available && valueAt(v, i) === val);

    // The photograph follows the choice: pick Green and the card shows the
    // green one. Shopify gives each variant its own `featured_image`; a colour
    // alone is enough to find it, before a size is chosen.
    const photoKey = (src) => String(src || '').split('?')[0].replace(/^https?:/, '');
    let pictured = '';
    const showPhoto = () => {
      if (selection.every((val) => val == null)) return;
      const v = product.variants.find((x) => x.featured_image &&
        selection.every((val, i) => val == null || valueAt(x, i) === val));
      const src = v && (v.featured_image.src || v.featured_image);
      if (!src || typeof src !== 'string' || photoKey(src) === pictured) return;
      pictured = photoKey(src);
      if (gallery) {
        const track = gallery.wrap.querySelector('.aisc-gallery-track');
        const find = () => [...track.querySelectorAll('img')].find((img) => photoKey(img.src) === pictured);
        if (!find()) gallery.addShot(src);
        const img = find();
        const shot = img && img.closest('.aisc-shot');
        if (shot && track.firstElementChild) {
          track.scrollTo({ left: shot.offsetLeft - track.firstElementChild.offsetLeft, behavior: 'smooth' });
        }
        return;
      }
      const thumb = card.querySelector('.aisc-pcard-img img');
      if (thumb) thumb.src = src;
    };

    const sync = () => {
      chosen = variantFor();
      delete card.dataset.chosen;
      showPhoto();
      // Sizes can be priced, and discounted, differently.
      if (chosen) showPrice(chosen.price, chosen.compare_at_price);
      const missing = selection.indexOf(null);
      if (missing !== -1) {
        add.disabled = true;
        add.textContent = 'Choose ' + optionNames[missing].toLowerCase();
      } else if (!chosen || !chosen.available) {
        // Both values are stocked, just not together.
        add.disabled = true;
        add.textContent = 'Sold out';
      } else {
        add.disabled = false;
        add.textContent = add.dataset.label || 'Add to cart';
        card.dataset.chosen = String(chosen.id);
        markInCart(chosen.id);
      }
    };

    optionNames.forEach((name, i) => {
      const vals = values[i];
      if (!vals.length) return;
      // A single value is not a choice, but it is still an answer to "what
      // does this come with", so it is shown — already chosen, not offered.
      if (vals.length === 1) selection[i] = vals[0];

      const group = document.createElement('div');
      group.className = 'aisc-opt-group';

      const label = document.createElement('span');
      label.className = 'aisc-opts-label';
      label.textContent = name;
      group.appendChild(label);

      const row = document.createElement('div');
      row.className = 'aisc-buy-row';
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', name);

      const chips = vals.map((val) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'aisc-buy-btn aisc-buy-btn--sm';
        b.textContent = val;
        if (!valueSellable(i, val)) {
          b.disabled = true;
          b.classList.add('aisc-buy-btn--out');
          b.title = 'Sold out';
        } else {
          b.setAttribute('aria-pressed', 'false');
          b.addEventListener('click', () => {
            row.querySelectorAll('[aria-pressed="true"]')
              .forEach((o) => o.setAttribute('aria-pressed', 'false'));
            b.setAttribute('aria-pressed', 'true');
            selection[i] = val;
            sync();
          });
        }
        row.appendChild(b);
        return b;
      });
      chipsAt[i] = chips;

      group.appendChild(row);
      // One line per question, scrolled sideways, so a product with thirty
      // finishes is the same height as one with three — and so the answer to
      // "what else is there" is a nudge rather than a second control to find.
      const arrows = this.#scrollArrows(row, 'aisc-opts-arrow');
      group.append(arrows.prev, arrows.next);
      row.addEventListener('scroll', arrows.sync);
      requestAnimationFrame(arrows.sync);
      sizes.appendChild(group);

      // One sellable value is not a guess, so it is pressed. Anything more is
      // the shopper's choice - or the assistant's, when they ask it to choose:
      // a card that shows Pink nobody picked tells them one thing while the
      // assistant, rightly, still asks which colour.
      const free = chips.filter((b) => !b.disabled);
      if (free.length === 1) free[0].click();
    });

    sync();

    // "Select blue, size 4" — the options the assistant chose for the shopper,
    // keyed by option name as the store writes them. Only the chips are
    // pressed: Add to cart is still theirs.
    card.aiscPick = (options) => {
      const wanted = new Map(Object.entries(options || {})
        .map(([k, v]) => [String(k).toLowerCase().replace('colour', 'color'), String(v)]));
      optionNames.forEach((name, i) => {
        const value = wanted.get(String(name).toLowerCase().replace('colour', 'color'));
        const chip = value && (chipsAt[i] || []).find((b) => !b.disabled && b.textContent === value);
        if (!chip) return;
        if (chip.getAttribute('aria-pressed') !== 'true') chip.click();
        chip.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
    };
    if (item.pick) card.aiscPick(item.pick);
    // The colour the shopper asked for ("brown"), sent by the assistant with the
    // card: it opens on that colour rather than on whichever variant is first.
    // Only the colour - the size is still theirs to choose.
    else if (preferred) card.aiscPick({ [preferred.name]: preferred.value });
    // A choice the assistant made while this card was still loading.
    if (card.aiscPendingPick) {
      card.aiscPick(card.aiscPendingPick);
      delete card.aiscPendingPick;
    }
    // A bag card from the assistant — "Now in your bag" — names what went in as
    // `variant_id`: its colour and size come up already chosen, so the button
    // reads "In your cart" rather than asking for them again. (An ordinary
    // card's `variant_id` is only a default, so it is not pressed.)
    const inBag = item.change && product.variants.find((v) => Number(v.id) === Number(item.variant_id));
    if (inBag) card.aiscPick(Object.fromEntries(optionNames.map((name, i) => [name, valueAt(inBag, i)])));

    add.addEventListener('click', () => {
      if (chosen) this.#addToCart(chosen.id, add, card, this.#qtyOf(card));
    });
  }

  // ── Outfit ─────────────────────────────────────────────────

  /**
   * Render a complete look: the pieces the agent chose, what they come to, and
   * one button that puts the lot in the bag.
   *
   * Unlike `products`, an outfit already names the exact variant for each piece
   * — the size and colour the agent picked — so there is nothing to choose and
   * no live lookup to do. `cart_items` is the same set expressed the way
   * /cart/add.js wants it, which is what makes one-click work.
   */
  #hydrateOutfit(el) {
    if (!el.dataset.outfit || el.dataset.outfitDone) return;
    el.dataset.outfitDone = '1';

    let data = null;
    try { data = JSON.parse(el.dataset.outfit); } catch (e) { return; }
    const items = (data && data.items) || [];
    if (!items.length) return;

    const box = document.createElement('div');
    box.className = 'aisc-outfit';

    const head = document.createElement('div');
    head.className = 'aisc-outfit-head';
    head.innerHTML = '<span class="aisc-opts-label">' +
      escapeHtml(this.dataset.outfitHeading || 'Complete the Look') + '</span>' +
      '<span class="aisc-outfit-count">' + items.length +
      (items.length === 1 ? ' piece' : ' pieces') + '</span>';
    box.appendChild(head);

    // The variant the agent chose for each piece, when the payload lines up.
    // Matching by position is the only link the payload gives, so it is only
    // trusted when the two lists are plainly the same list.
    const chosen = Array.isArray(data.cart_items) && data.cart_items.length === items.length
      ? data.cart_items
      : null;
    items.forEach((item, i) =>
      box.appendChild(this.#outfitRow(item, data.currency, i + 1, chosen && chosen[i])));

    if (typeof data.total === 'number') {
      const total = document.createElement('div');
      total.className = 'aisc-outfit-total';
      total.innerHTML = '<span>Total</span><b>' + escapeHtml(money(data.total, data.currency)) + '</b>';
      box.appendChild(total);
    }

    // Only speak about a budget the shopper actually set.
    if (typeof data.budget === 'number' && data.budget > 0) {
      const note = document.createElement('div');
      note.className = 'aisc-outfit-budget';
      note.dataset.tone = data.within_budget ? 'ok' : 'over';
      note.textContent = (data.within_budget ? 'Within your ' : 'Over your ') +
        money(data.budget, data.currency) + ' budget';
      box.appendChild(note);
    }

    const lines = (data.cart_items || [])
      .map((c) => ({ id: c.variant_id, quantity: c.quantity || 1 }))
      .filter((c) => c.id);

    if (lines.length) {
      const actions = document.createElement('div');
      actions.className = 'aisc-outfit-actions';

      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'aisc-pcard-add';
      add.textContent = this.dataset.outfitCta || 'Add Complete Look to Bag';
      add.addEventListener('click', () => this.#addItemsToCart(lines, add, box));
      actions.appendChild(add);

      box.appendChild(actions);
    }

    el.parentElement.insertAdjacentElement('afterend', box);
    this.#scroll();
  }

  /**
   * One piece of the look, built as a numbered product card so a look reads
   * the same way a shortlist does — the shopper should not have to learn two
   * layouts for "here are some things". What keeps it a look rather than a
   * list is the running total and the one button underneath them all.
   */
  #outfitRow(item, currency, rank, line) {
    const card = document.createElement('div');
    // `--list` and not a look-alike: a piece of a look is a list row, so it
    // takes the same hover, the same click and the same photograph button.
    card.className = 'aisc-pcard aisc-pcard--list aisc-outfit-piece';

    const top = document.createElement('div');
    top.className = 'aisc-pcard-top';

    // Every photograph this piece knows about. A look names one, so the viewer
    // opens on a single shot — but it is a list so the strip can grow later.
    const shots = item.image ? [item.image] : [];

    if (item.image) {
      const shot = document.createElement('div');
      shot.className = 'aisc-pcard-shot';
      // A button, not a link: it opens the photographs, exactly as a list row
      // does. The product page is reached through the underlined title.
      const frame = document.createElement('button');
      frame.type = 'button';
      frame.className = 'aisc-pcard-img';
      frame.setAttribute('aria-label', `See photos of ${item.title}`);
      const img = document.createElement('img');
      img.src = item.image;
      img.alt = item.title;
      img.loading = 'lazy';
      img.addEventListener('error', () => shot.remove());
      frame.appendChild(img);
      frame.addEventListener('click', () => this.#openViewer(item.title, shots, 0, frame));
      shot.appendChild(frame);

      const badge = document.createElement('span');
      badge.className = 'aisc-pcard-rank';
      badge.textContent = String(rank);
      shot.appendChild(badge);
      top.appendChild(shot);
    }

    const main = document.createElement('div');
    main.className = 'aisc-pcard-main';

    const title = document.createElement('a');
    title.className = 'aisc-pcard-title';
    title.href = item.url;
    title.textContent = item.title;
    main.appendChild(title);

    if (item.option) {
      const opt = document.createElement('div');
      opt.className = 'aisc-outfit-option';
      opt.textContent = item.option;
      main.appendChild(opt);
    }

    const price = document.createElement('div');
    price.className = 'aisc-pcard-price';
    setSalePrice(price, item.price, item.compare_at_price, item.currency || currency);
    main.appendChild(price);

    // Only when the payload named the variant for this piece. Guessing one
    // would put the wrong colour in someone's cart.
    if (line && line.variant_id) {
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'aisc-pcard-add';
      add.dataset.label = 'Add to cart';
      add.textContent = add.dataset.label;
      this.#markInCart(add, line.variant_id);
      add.addEventListener('click', () =>
        this.#addToCart(line.variant_id, add, card, line.quantity || 1));
      main.appendChild(add);
    }

    top.appendChild(main);
    card.appendChild(top);

    // A piece of a look is still a thing to ask about, so the row opens it the
    // way a shortlist row does. The card's own controls win: the photograph
    // opens the viewer, the title goes to the product page, Add to cart adds.
    card.addEventListener('click', (e) => {
      if (e.target.closest('button, a')) return;
      const ask = this.dataset.productPrompt || this.dataset.categoryPrompt ||
        'Tell me more about {title}';
      this.#send(ask.replace('{title}', item.title));
    });

    return card;
  }

  // ── Add to cart ────────────────────────────────────────────

  /**
   * Fill every product slot in a finished message with real buttons.
   *
   * Sizes, stock and variant ids are read live from the storefront rather than
   * taken from the agent's text. The catalogue the agent searches is a synced
   * copy, so it can be hours stale; the cart cannot be. This also means no
   * variant id ever has to survive a trip through the model's prose.
   */
  #hydrateBuys(root) {
    root.querySelectorAll('.aisc-buy[data-handle]').forEach(async (slot) => {
      if (slot.dataset.done) return;
      slot.dataset.done = '1';

      const product = await loadProduct(slot.dataset.handle);
      // An unknown handle leaves no trace: better a card with no button than a
      // button that cannot work.
      if (!product || !Array.isArray(product.variants) || !product.variants.length) {
        slot.remove();
        return;
      }

      const url = shopRoot() + 'products/' + product.handle;
      const sized = product.variants.length > 1;

      const wrap = document.createElement('div');
      wrap.className = 'aisc-buy-inner';

      if (sized) {
        const label = document.createElement('span');
        label.className = 'aisc-opts-label';
        // "Size" is the usual axis but not the only one; use what the store calls it.
        label.textContent = (product.options && product.options[0] &&
          (product.options[0].name || product.options[0])) || 'Size';
        wrap.appendChild(label);
      }

      const row = document.createElement('div');
      row.className = 'aisc-buy-row';
      product.variants.forEach((v) => {
        const b = document.createElement('button');
        b.type = 'button';
        // A size is a choice among chips; a lone variant is the card's own Add
        // to cart, so it wears the same button as every other card.
        b.className = sized ? 'aisc-buy-btn' : 'aisc-pcard-add';
        b.textContent = sized ? v.title : (v.available ? 'Add to cart' : 'Sold out');
        if (!v.available) {
          b.disabled = true;
          b.classList.add('aisc-buy-btn--out');
          b.title = 'Sold out';
        } else {
          if (!sized) {
            b.dataset.label = 'Add to cart';
            this.#markInCart(b, v.id);
          }
          b.addEventListener('click', () => this.#addToCart(v.id, b, wrap));
        }
        row.appendChild(b);
      });
      wrap.appendChild(row);

      const link = document.createElement('a');
      link.className = 'aisc-buy-link';
      link.href = url;
      link.textContent = 'View product';
      wrap.appendChild(link);

      slot.appendChild(wrap);
      this.#scroll();
    });
  }

  /**
   * Add one variant, then tell the theme so the cart icon and drawer catch up.
   *
   * Every cart component in Horizon listens on `document` for the standard
   * cart-lines-update event and reads the new totals off the event's promise —
   * so the promise is resolved with a freshly read cart rather than a guess.
   */
  #addToCart(variantId, button, wrap, quantity = 1) {
    return this.#addItemsToCart([{ id: variantId, quantity }], button, wrap);
  }

  /**
   * Add one or many lines. A whole outfit goes in as a single request, so the
   * cart cannot end up half-filled if the second call fails.
   */
  async #addItemsToCart(lines, button, wrap) {
    if (button.dataset.busy) return;
    button.dataset.busy = '1';
    this.#follow();
    // Not textContent: an in-cart button holds two stacked labels, and reading
    // it back would restore "In your cartAdd to cart".
    const label = button.dataset.label || button.textContent;
    button.classList.remove('aisc-pcard-add--incart');
    button.removeAttribute('aria-label');
    // One spinner (drawn in CSS off data-busy) and one word, on every button
    // that adds — the round + on a recommendation has room for the spinner only.
    button.setAttribute('aria-busy', 'true');
    button.textContent = button.classList.contains('aisc-rec-add') ? ''
      : 'Adding…';
    wrap.querySelectorAll('.aisc-buy-err').forEach((n) => n.remove());

    try {
      const res = await fetch(cartAddUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          items: lines.map((l) => ({ id: Number(l.id), quantity: l.quantity || 1 })),
        }),
      });
      const payload = await res.json().catch(() => ({}));

      // /cart/add.js reports a refusal — sold out, or a quantity rule — in the
      // body with an HTTP error, and its `description` is written for shoppers.
      if (!res.ok) throw new Error(payload.description || payload.message || 'Could not add that to the cart.');

      const cart = await fetch(shopRoot() + 'cart.js', { headers: { Accept: 'application/json' } })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);

      await this.#announceCart(lines, cart);
      this.#follow();

      button.classList.add('aisc-buy-btn--added');
      button.classList.add('aisc-pcard-add--added');
      const settled = wrap.classList.contains('aisc-pcard--confirm') ||
        (wrap.classList.contains('aisc-outfit') && button.classList.contains('aisc-pcard-add'));
      if (settled) {
        // A confirmed card or a whole look is finished: the button itself is
        // the receipt, in the same grey pill either way.
        wrap.dataset.done = '1';
        button.disabled = true;
        button.classList.add('aisc-pcard-add--done');
        button.innerHTML = ICONS.check + '<span>Added to cart</span>';
        wrap.querySelectorAll('.aisc-buy-btn').forEach((b) => { b.disabled = true; });
      } else if (wrap.classList.contains('aisc-rec')) {
        // Too small a card for a sentence; the tick on the button says it.
        button.innerHTML = ICONS.check;
        button.setAttribute('aria-label', 'Added to your cart');
      } else {
        button.textContent = label;
        this.#showAdded(wrap, cart);
      }
      if (cart) this.#rememberCart(cart); else this.#showCartDot(1);
      if (cart && this.discountCode) this.#paintCodePrice(wrap, cart);
      if (!settled && !wrap.classList.contains('aisc-rec') &&
          button.classList.contains('aisc-pcard-add') && lines.length === 1) {
        this.#markInCart(button, lines[0].id);
      }
      this.#recommend(wrap);
    } catch (err) {
      const msg = document.createElement('div');
      msg.className = 'aisc-buy-err';
      msg.textContent = err.message || 'Could not add that to the cart.';
      wrap.appendChild(msg);
      button.textContent = label;
      this.#scroll();
    } finally {
      delete button.dataset.busy;
      button.removeAttribute('aria-busy');
    }
  }

  /**
   * Dispatch the theme's own cart event. Loaded on demand from the storefront
   * import map: a theme without it still has a correct server-side cart, so a
   * missing module costs a live badge update, never the add itself.
   */
  /**
   * Carry out what the backend decided to do to the cart.
   *
   * `{ action, items?, add_items?, page? }` — the backend has already worked out
   * which product and which size from the conversation; the widget does the
   * write, because the cart lives in the shopper's browser. `action` is one of
   * CART_ACTIONS and says what to do; the fields say what with:
   *
   * - add / checkout: `items` go to `cart/add.js`; checkout then leaves for it.
   * - checkout from existing / open cart: no write, straight to the page. Any
   *   `items` are ignored - the bag goes as it stands.
   * - remove / edit: `items` carry `new_quantity` (0 takes a line out) and go to
   *   `cart/update.js`; `add_items` (a swap's new size or colour) go to
   *   `cart/add.js`; then `page`, if the shopper also asked for checkout or bag.
   *
   * An unknown word - an older or newer backend - falls back to reading the
   * fields alone: `new_quantity` means a change, anything else an add.
   *
   * Every write is followed by the same announcement, so the header's cart icon
   * and drawer catch up exactly as they do when a button is pressed.
   */
  async #runActions(data, bubble) {
    if (!data) return;
    const id = (i) => Number(i && i.variant_id);
    const ok = (list) => (Array.isArray(list) ? list : []).filter((i) => Number.isFinite(id(i)) && id(i) > 0);
    const setsQuantity = (i) => i.new_quantity != null && Number.isFinite(Number(i.new_quantity));
    const items = ok(data.items);
    const extra = ok(data.add_items);
    const page = data.page === 'checkout' || data.page === 'cart' ? data.page : '';
    const action = String(data.action || '').trim().toLowerCase();

    let changes = [];
    let adds = [];
    let go = '';
    switch (action) {
      case CART_ACTIONS.add:
        adds = items.concat(extra);
        break;
      case CART_ACTIONS.checkout:
        adds = items.concat(extra);
        go = 'checkout';
        break;
      case CART_ACTIONS.checkoutBag:
        go = 'checkout';
        break;
      case CART_ACTIONS.openCart:
        go = 'cart';
        break;
      case CART_ACTIONS.remove:
      case CART_ACTIONS.edit:
        changes = items.filter(setsQuantity);
        // A line with no new_quantity does not say how many - not guessed at.
        // And a swap is both halves or neither: adding the new size alone
        // would leave the old one in while the reply says it was replaced.
        if (items.length && changes.length !== items.length) return;
        adds = extra;
        go = page;
        break;
      default:
        changes = items.filter(setsQuantity);
        adds = items.filter((i) => !changes.includes(i)).concat(extra);
        go = page;
    }

    if (!changes.length && !adds.length) {
      if (go) this.#goTo(go);
      return;
    }

    // A swap is a change *and* an add, and must not read as a removal.
    const removing = changes.length && !adds.length && changes.every((i) => Number(i.new_quantity) === 0);
    const note = document.createElement('div');
    note.className = 'aisc-action-note';
    note.setAttribute('role', 'status');
    note.textContent = removing ? 'Removing from your cart…'
      : changes.length ? 'Updating your cart…' : 'Adding to your cart…';
    this.#afterBlock(bubble.parentElement).appendChild(note);
    this.#scroll();

    const post = async (path, body, fallback) => {
      const res = await fetch(shopRoot() + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      // Shopify writes its refusals — sold out, a quantity rule — for shoppers.
      if (!res.ok) throw new Error(payload.description || payload.message || fallback);
    };

    try {
      if (changes.length) {
        const updates = {};
        changes.forEach((i) => { updates[id(i)] = Math.max(0, Math.floor(Number(i.new_quantity))); });
        await post('cart/update.js', { updates }, 'Could not update your cart.');
      }
      if (adds.length) {
        await post('cart/add.js', {
          items: adds.map((i) => ({ id: id(i), quantity: Math.max(1, Number(i.quantity) || 1) })),
        }, 'Could not add that to your cart.');
      }

      const cart = await fetch(shopRoot() + 'cart.js', { headers: { Accept: 'application/json' } })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      const lines = changes.concat(adds).map((i) => ({
        id: id(i),
        quantity: i.new_quantity != null ? Number(i.new_quantity) : (Number(i.quantity) || 1),
      }));
      await this.#announceCart(lines, cart);
      if (cart) this.#rememberCart(cart); else if (!removing) this.#showCartDot(1);

      const n = removing ? changes.length : adds.length;
      note.dataset.tone = 'ok';
      note.innerHTML = ICONS.check + '<span>' + (
        removing ? (n === 1 ? 'Removed from your cart' : `${n} items removed from your cart`)
        : changes.length ? 'Cart updated'
        : (n === 1 ? 'Added to your cart' : `${n} items added to your cart`)
      ) + '</span>';
      this.#saveTranscript();
      // A remove or an edit is tidying the bag, not shopping - no shelf after it.
      const tidying = action === CART_ACTIONS.remove || action === CART_ACTIONS.edit;
      if (go) {
        this.#goTo(go);
      } else if (adds.length && !removing && !tidying) {
        // "You may also like" after an add the assistant made, exactly as after
        // a press of Add to cart: the store's own recommendations for it.
        const ids = new Set(adds.map((i) => id(i)));
        const added = (Array.isArray(data.products) ? data.products : [])
          .find((p) => p && p.product_id && ids.has(Number(p.variant_id)));
        const card = [...this.log.querySelectorAll('.aisc-pcard')].reverse()
          .find((c) => c.aiscProduct && c.aiscProduct.variants.some((v) => ids.has(Number(v.id))));
        // The shelf only - not the full description a button press brings up:
        // the assistant has already said what went in, in its own words.
        this.#recommend(null, (added && added.product_id) || (card && card.dataset.productId));
      }
    } catch (err) {
      note.dataset.tone = 'error';
      note.textContent = err.message || 'Could not update your cart.';
    }
    this.#scroll();
  }

  /**
   * Press the options the assistant chose on that product's card: the newest
   * card already asking the question, or a new one opened under the product.
   * Nothing goes in the cart — the shopper still presses Add to cart.
   */
  #applySelection(sel) {
    if (!sel || !sel.options || !sel.url) return;
    const handle = sel.handle || handleFromUrl(sel.url);
    // Every card of this product, newest first - including one this very reply
    // drew that is still reading the live product. The choice belongs on the
    // newest one: an older card further up would take it out of sight.
    const cards = [...this.log.querySelectorAll('.aisc-pcard')].reverse().filter((c) => {
      const link = c.querySelector('.aisc-pcard-title');
      return (c.aiscProduct && c.aiscProduct.handle === handle) ||
        (link && handleFromUrl(link.getAttribute('href') || '') === handle);
    });
    const newest = cards[0];
    const picker = newest && (newest.classList.contains('aisc-pcard--detail') ||
      newest.classList.contains('aisc-pcard--confirm'));
    if (picker) {
      if (newest.aiscPick) newest.aiscPick(sel.options);
      else newest.aiscPendingPick = sel.options;
      this.#follow();
      newest.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }
    const source = cards.find((c) => c.aiscItem);
    const item = source ? source.aiscItem
      : { title: sel.title, url: sel.url, image: sel.image };
    this.#openConfirm({ ...item, pick: sel.options }, source || this, { said: false });
  }

  /** The colour the assistant noted the shopper wants, for this browser session. */
  #preferredColour() {
    if (this.preferredColourValue !== undefined) return this.preferredColourValue;
    try { this.preferredColourValue = sessionStorage.getItem('aisc:colour') || ''; } catch (e) {
      this.preferredColourValue = '';
    }
    return this.preferredColourValue;
  }

  #setPreferredColour(colour) {
    this.preferredColourValue = String(colour || '').trim();
    try {
      if (this.preferredColourValue) sessionStorage.setItem('aisc:colour', this.preferredColourValue);
      else sessionStorage.removeItem('aisc:colour');
    } catch (e) { /* private mode: kept for this page only */ }
  }

  /**
   * The page the assistant sent them to. Nothing is written into the chat.
   * The cart opens the way the theme editor's "cart" setting says - the drawer
   * where there is one, otherwise the cart page.
   */
  #goTo(page) {
    if (page === 'checkout') location.href = this.#checkoutUrl();
    else this.#openCart();
  }

  async #announceCart(lines, cart) {
    try {
      const { CartLinesUpdateEvent } = await import('@shopify/events');
      const deferred = CartLinesUpdateEvent.createPromise();
      // Dispatch first: listeners attach to the promise as they receive the
      // event, so resolving before that would leave them waiting forever.
      document.dispatchEvent(
        new CartLinesUpdateEvent({
          // 'update', not 'add': the cart components all refresh either way,
          // but the drawer's auto-open only fires on 'add' — and covering the
          // conversation is this widget's decision to make, not a side effect.
          action: 'update',
          context: 'product',
          lines: lines.map((l) => ({
            merchandiseId: String(l.id),
            quantity: l.quantity || 1,
          })),
          promise: deferred.promise,
        })
      );
      deferred.resolve({
        cart: cart ? CartLinesUpdateEvent.createCartFromAjaxResponse(cart) : null,
        detail: {
          items: (cart && cart.items) || [],
          itemCount: cart ? cart.item_count : lines.length,
          source: 'ai-support-chat',
        },
      });
    } catch (e) {
      /* no import map, or an older events module — the cart itself is fine */
    }
  }

  /** A confirmation that leads somewhere, rather than a dead "Added". */
  #showAdded(wrap, cart) {
    wrap.querySelectorAll('.aisc-added').forEach((n) => n.remove());
    const count = cart && typeof cart.item_count === 'number' ? cart.item_count : null;
    const note = document.createElement('div');
    note.className = 'aisc-added';
    note.innerHTML = ICONS.check + '<span>Added' +
      (count ? ' — ' + count + (count === 1 ? ' item' : ' items') + ' in your cart' : '') + '</span>';
    note.appendChild(this.#viewCartControl());
    wrap.appendChild(note);
    this.#scroll();
  }

  /**
   * The same complements Shopify offers on a product page, asked of the store
   * itself rather than of the model: `/recommendations/products.json` is the
   * storefront's own engine, so what the shopper is offered here is what they
   * would have been offered on the product page.
   */
  async #recommend(wrap, productId) {
    // An add the assistant made has no card of its own to hang this off, only
    // the product it put in the bag - so the id may come without a card.
    const id = productId || (wrap && wrap.dataset && wrap.dataset.productId);
    // One shelf per product. A shopper who adds two sizes should not be handed
    // the same six products twice, whether by button or by asking.
    this.recommendedFor = this.recommendedFor || new Set();
    if (!id || this.recommendedFor.has(String(id)) || (wrap && wrap.dataset.recommended)) return;
    this.recommendedFor.add(String(id));
    if (wrap) wrap.dataset.recommended = '1';

    // What they just bought, in full, before anything else is offered. The
    // note on the card is a summary written to help someone decide; once they
    // have decided, the rest of the description is the useful part.
    if (wrap) this.#describeAdded(wrap);

    let items = [];
    try {
      const url = `${shopRoot()}recommendations/products.json?product_id=${encodeURIComponent(id)}` +
        '&limit=8&intent=related';
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      const data = res.ok ? await res.json() : null;
      items = (data && Array.isArray(data.products) ? data.products : []).filter((p) => p && p.handle);
    } catch (e) {
      return; // no recommendations is a fine outcome; a broken card is not
    }
    if (!items.length) return;

    // At the end of the conversation rather than under the card, so anything
    // the assistant says about the add lands above the shelf rather than
    // below it.
    this.log.appendChild(this.#recShelf(items));
    this.#scroll();
  }

  #describeAdded(card) {
    const full = (card.dataset.fullDesc || '').trim();
    if (!full) return;
    // The note already said all of it — a short description does not need
    // repeating word for word directly underneath itself.
    const shown = (card.querySelector('.aisc-pcard-desc') || {}).textContent || '';
    if (full === shown.trim()) return;
    this.#addMessage('bot', full);
  }

  /**
   * The shelf is a deck, not a scroller.
   *
   * The track is moved with a transform rather than scrolled, and each card is
   * turned a flat 8 degrees, alternating, away from whichever is at the front —
   * which stays upright. Stacking order falls away from the front card too, so
   * the row reads as a hand of cards being fanned rather than a strip sliding
   * past a window. Everything settles on the same overshooting curve, which is
   * what makes the movement feel thrown rather than dragged.
   */
  #recShelf(items) {
    const shelf = document.createElement('div');
    shelf.className = 'aisc-recs';

    const head = document.createElement('div');
    head.className = 'aisc-recs-head';
    head.textContent = this.dataset.recsHeading || 'You might also like';
    shelf.appendChild(head);

    const frame = document.createElement('div');
    frame.className = 'aisc-recs-frame';
    const track = document.createElement('div');
    track.className = 'aisc-recs-track';
    frame.appendChild(track);

    const currency = (window.Shopify && window.Shopify.currency && window.Shopify.currency.active) ||
      this.dataset.currency;

    const cards = items.map((p) => {
      const seat = document.createElement('div');
      seat.className = 'aisc-rec-seat';
      seat.appendChild(this.#recCard(p, currency));
      track.appendChild(seat);
      return seat;
    });

    const flat = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let front = 0;

    // Three quarters of a card per press, not a whole one — so a quarter of the
    // card being left behind stays on screen and the deck reads as continuous
    // rather than as pages turning.
    const step = () => {
      const first = cards[0];
      if (!first) return 0;
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      return first.offsetWidth * 0.75 + gap;
    };

    const lay = () => {
      const width = step() || 1;
      // Stop once the tail of the deck has reached the right edge, rather than
      // dragging it past into empty space.
      const last = Math.max(0, Math.ceil((track.scrollWidth - frame.clientWidth) / width));
      front = Math.min(Math.max(front, 0), last);

      track.style.transform = `translateX(${-front * width}px)`;
      cards.forEach((seat, i) => {
        const away = i - front;
        // The card at the front is square to the reader; the rest lean away
        // from it in alternating directions.
        // 0, then ±8 alternating outwards, mirrored either side of the front.
        seat.style.rotate = flat || away === 0
          ? '0deg'
          : `${Math.sign(away) * (Math.abs(away) % 2 === 1 ? 8 : -8)}deg`;
        seat.style.zIndex = String(cards.length - Math.abs(away));
      });

      prev.hidden = front <= 0;
      next.hidden = front >= last;
    };

    const arrow = (dir) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `aisc-recs-arrow aisc-recs-arrow--${dir}`;
      b.setAttribute('aria-label', dir === 'prev' ? 'Previous' : 'Next');
      b.innerHTML = ICONS.next;
      b.hidden = true;
      b.addEventListener('click', () => { front += dir === 'prev' ? -1 : 1; lay(); });
      return b;
    };
    const prev = arrow('prev');
    const next = arrow('next');
    frame.append(prev, next);

    // Without a scroller there is no swipe, and on a phone the arrows are the
    // only way through the deck. One card per flick, in the direction thrown.
    // Photographs and links are natively draggable on a desktop, and the
    // browser starting its own drag cancels the pointer before it lifts — so
    // that is switched off, and the click that ends a swipe is eaten rather
    // than opening whichever card the pointer was let go over.
    let from = null;
    track.addEventListener('dragstart', (e) => e.preventDefault());
    track.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      from = e.clientX;
    });
    track.addEventListener('pointermove', (e) => {
      if (from === null || Math.abs(e.clientX - from) < DRAG_SLOP) return;
      if (!track.hasPointerCapture?.(e.pointerId)) track.setPointerCapture?.(e.pointerId);
    });
    track.addEventListener('pointerup', (e) => {
      if (from === null) return;
      const moved = e.clientX - from;
      from = null;
      if (Math.abs(moved) >= DRAG_SLOP) {
        const swallow = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
        track.addEventListener('click', swallow, { capture: true, once: true });
        setTimeout(() => track.removeEventListener('click', swallow, { capture: true }), 0);
      }
      if (Math.abs(moved) < 40) return;
      front += moved < 0 ? 1 : -1;
      lay();
    });
    track.addEventListener('pointercancel', () => { from = null; });

    shelf.appendChild(frame);

    requestAnimationFrame(lay);
    // A card only takes its final width once its photograph has arrived.
    track.querySelectorAll('img').forEach((img) => img.addEventListener('load', () => {
      lay();
      this.#scroll();
    }, { once: true }));
    return shelf;
  }

  #recCard(p, currency) {
    const card = document.createElement('div');
    card.className = 'aisc-rec';

    const shot = document.createElement('div');
    shot.className = 'aisc-rec-shot';

    const url = shopRoot() + 'products/' + p.handle;
    const img = document.createElement('img');
    img.src = (p.featured_image || (p.images && p.images[0]) || '');
    img.alt = '';
    img.loading = 'lazy';
    shot.appendChild(img);

    // The whole point of the shelf: one tap adds it, without leaving the reply.
    const variant = (p.variants || []).find((v) => v.available);
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'aisc-rec-add';
    add.setAttribute('aria-label', `Add ${p.title} to your cart`);
    add.textContent = '+';
    if (variant && (p.variants || []).length > 1) {
      // Options to pick first: the same confirm card a list row opens.
      add.addEventListener('click', () => this.#openConfirm({
        title: p.title,
        url,
        image: img.src,
        price: variant.price / 100,
        currency,
      }, card));
    } else if (variant) {
      add.addEventListener('click', () => this.#addToCart(variant.id, add, card));
    } else {
      add.disabled = true;
      add.setAttribute('aria-label', `${p.title} is sold out`);
    }
    shot.appendChild(add);

    const title = document.createElement('a');
    title.className = 'aisc-rec-title';
    title.href = url;
    title.textContent = p.title;

    const price = document.createElement('div');
    price.className = 'aisc-rec-price';
    // /recommendations returns prices in cents, like the rest of the AJAX API.
    const now = variant ? variant.price : p.price;
    const was = variant ? variant.compare_at_price : p.compare_at_price;
    if (typeof was === 'number' && was > now) {
      // The same sale as a full card, in a smaller room: new price in green,
      // the old one struck, and the figure as a tag on the photograph.
      price.innerHTML =
        `<span class="aisc-pcard-sale">${escapeHtml(money(now / 100, currency))}</span>` +
        `<s class="aisc-pcard-was">${escapeHtml(money(was / 100, currency))}</s>`;
      const badge = document.createElement('span');
      badge.className = 'aisc-pcard-badge aisc-rec-badge';
      badge.textContent = Math.round((1 - now / was) * 100) + '% off';
      shot.appendChild(badge);
    } else {
      price.textContent = money(now / 100, currency);
    }

    card.append(shot, title, price);
    return card;
  }

  /**
   * "View cart", doing whatever the merchant chose in the theme editor.
   *
   * The drawer keeps the shopper in the conversation, so it is a button, not a
   * link — but only once we know the drawer is really there. If the theme has
   * no cart drawer, or the setting says otherwise, this falls back to a plain
   * link to the cart page, which always works.
   */
  #viewCartControl() {
    const cartUrl = (window.Theme && window.Theme.routes && window.Theme.routes.cart_url) ||
      shopRoot() + 'cart';

    if (this.dataset.cartAction === 'drawer' && document.querySelector('theme-drawer#cart-drawer')) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'aisc-viewcart';
      b.textContent = 'View cart';
      b.addEventListener('click', () => {
        // If the drawer has gone missing since render, still get them there.
        if (!this.#openCartDrawer()) location.href = cartUrl;
      });
      return b;
    }

    const a = document.createElement('a');
    a.className = 'aisc-viewcart';
    a.href = cartUrl;
    a.textContent = 'View cart';
    return a;
  }

  // ── Streaming bubble ─────────────────────────────────────

  /**
   * An empty bot bubble that grows as tokens arrive. It is deliberately not
   * built by #addMessage: quick replies, the ticket chip and the timestamp all
   * belong to a finished answer, and attaching them to half a sentence would
   * make them flicker on every token. #finishStream adds them once.
   */
  #startStream() {
    const row = document.createElement('div');
    row.className = 'aisc-row aisc-row--bot';

    const ava = document.createElement('div');
    ava.className = 'aisc-ava';
    ava.setAttribute('aria-hidden', 'true');
    ava.textContent = (this.dataset.title || 'S').trim()[0].toUpperCase();
    row.appendChild(ava);

    const el = document.createElement('div');
    el.className = 'aisc-msg aisc-msg--bot aisc-streaming';
    el.dataset.role = 'bot';
    el.dataset.raw = '';
    row.appendChild(el);

    this.log.appendChild(row);
    this.#scroll(true);
    return el;
  }

  /**
   * Repaint the streaming bubble, at most once a frame. Tokens arrive far
   * faster than the screen refreshes, and renderRich re-parses the whole reply
   * each time, so painting per token would burn work nobody sees.
   */
  #updateStream(el, text) {
    el.dataset.raw = text;

    // Someone who has asked for less motion has asked for this too: the words
    // appear as they arrive, with no reveal to sit through.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (el.aiscFrame) return;
      el.aiscFrame = requestAnimationFrame(() => {
        el.aiscFrame = 0;
        if (!el.isConnected) return;
        el.innerHTML = renderRich(el.dataset.raw || '');
        this.#scroll();
      });
      return;
    }

    if (el.aiscFrame) return;               // a reveal is already running
    const step = (now) => {
      el.aiscFrame = 0;
      if (!el.isConnected) return;
      const full = el.dataset.raw || '';
      // First frame has no previous tick to measure against, and a tab that
      // was in the background can hand back a gap of seconds — either would
      // dump the whole reply at once, so the step is clamped.
      const dt = Math.min(0.05, Math.max(0, (now - (el.aiscTick || now)) / 1000));
      el.aiscTick = now;

      const shown = el.aiscShown || 0;
      const behind = full.length - shown;
      const rate = Math.max(TYPE_CPS, behind / TYPE_MAX_LAG);
      const next = Math.min(full.length, shown + rate * dt);
      el.aiscShown = next;

      // Only redraw when the visible text actually changed: at 65 characters a
      // second most frames add nothing, and re-rendering costs a reflow.
      if (Math.floor(next) !== Math.floor(shown) || next === full.length) {
        el.innerHTML = renderRich(full.slice(0, Math.floor(next)));
        this.#scroll();
      }
      if (next < full.length) el.aiscFrame = requestAnimationFrame(step);
    };
    el.aiscFrame = requestAnimationFrame(step);
  }

  /** Swap the growing bubble for a finished message, with all the trimmings. */
  /** Titles of the cards that will be drawn under this message, if any. */
  #cardTitles(el) {
    for (const key of ['outfit', 'products']) {
      if (!el.dataset[key]) continue;
      try {
        const data = JSON.parse(el.dataset[key]);
        const items = Array.isArray(data) ? data : data.items;
        if (Array.isArray(items)) return items.map((i) => i && i.title).filter(Boolean);
      } catch (e) { /* ignore */ }
    }

    // An order card shows the number and everything in it, so the bullet list
    // the reply writes out underneath — "#1029 — Catherine Gingham … 210.21
    // INR" — is the same information twice. The pieces come first: a line
    // naming both an order and a product should be judged on the product,
    // which is the longer half of it.
    if (el.dataset.orders) {
      try {
        const orders = JSON.parse(el.dataset.orders);
        if (Array.isArray(orders)) {
          const pieces = orders.flatMap((o) => (o.items || []).map((i) => i && i.title));
          const names = orders.map((o) => o && o.name);
          return [...pieces, ...names].filter(Boolean);
        }
      } catch (e) { /* ignore */ }
    }
    return [];
  }

  #finishStream(el, text) {
    if (el.aiscFrame) {
      cancelAnimationFrame(el.aiscFrame);
      el.aiscFrame = 0;
    }
    // The reveal is done with: whatever it had left is about to be replaced by
    // the parsed reply in full.
    el.aiscShown = 0;
    el.aiscTick = 0;
    el.classList.remove('aisc-streaming');
    el.dataset.raw = text;

    // Both strippers may take the whole reply, and that is allowed here: a
    // reply whose every line was a restatement of the cards below it has
    // nothing left to say. The guard still holds everywhere it is not passed.
    const parsed = splitOptions(dedupeCardProse(
      dropGroupCaption(text, this.#groupOf(el), true), this.#cardTitles(el), true));
    el.innerHTML = renderRich(parsed.text);
    // Everything it said is now the heading over the cards. Hidden rather than
    // emptied, so no bare bubble or stray timestamp is left above them.
    if (!parsed.text.trim()) el.parentElement.hidden = true;
    el.querySelectorAll('.aisc-product-img').forEach((img) => {
      img.addEventListener('error', () => {
        const wrap = img.closest('.aisc-img-wrap');
        if (wrap) wrap.remove();
      });
    });
    // The backend's own suggestions win: they carry a prompt written for the
    // assistant, where a list parsed out of the prose can only send itself back.
    let offers = [];
    try { offers = JSON.parse(el.dataset.suggestions || '[]'); } catch (e) { /* ignore */ }
    if (!offers.length) offers = parsed.options.map((o) => ({ label: o, prompt: o }));
    if (offers.length || this.hasAttribute('data-cart')) this.#addQuickReplies(el.parentElement, offers);

    const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    el.dataset.ts = stamp;
    const t = document.createElement('span');
    t.className = 'aisc-time';
    t.textContent = stamp;
    el.parentElement.appendChild(t);

    const m = text.match(TICKET_RE);
    if (m) this.#addTicketChip(el, m[0]);

    this.#addActions(el.parentElement, text);
    this.#hydrateBuys(el);
    this.#scroll();
    this.#saveTranscript();
    return el;
  }

  // ── Network ────────────────────────────────────────────────

  /**
   * Send a turn and stream the reply.
   *
   * The timeout is an *idle* one, reset by every frame that arrives. A long
   * answer is not a stuck one, so a fixed ceiling would cut off exactly the
   * replies worth waiting for; what we actually want to catch is silence.
   */
  async #send(rawText, { resend = false } = {}) {
    const text = String(rawText || '').trim();
    if (!text || this.busy) return;

    if (!this.endpoint) {
      this.#addMessage('system', 'Chat is not configured yet — no endpoint URL was set.');
      return;
    }
    if (!navigator.onLine) {
      this.#addMessage('system', 'You appear to be offline. Check your connection and try again.');
      return;
    }


    this.lastSent = text;
    this.input.value = '';
    this.#syncTyping();
    this.#autoGrow();
    this.chipBar.innerHTML = '';
    if (!resend) this.#addMessage('user', text);
    this.#setBusy(true);
    this.#setStatus('info', 'Typing…');

    const typing = this.#showTyping();
    let bubble = null;      // created on the first token, not before
    let reply = '';
    let streamed = '';
    let failed = false;
    let products = [];      // structured cards the backend sends alongside the prose
    let outfit = null;      // a put-together look, which supersedes them
    let selection = null;   // options the assistant chose on a product, to press on its card
    let suggestions = [];   // the follow-ups to offer under the reply
    let position = '';      // where they go: "before_products" when the reply is asking
    let orders = [];        // the shopper's own orders, when they asked for them
    let actions = null;     // something the backend has decided to do, e.g. add to cart

    // No separate "waking up" notice, however long the first reply takes. The
    // thinking line already says a reply is coming; announcing the server's
    // cold start on top of it tells the shopper about our infrastructure, which
    // is not theirs to worry about — and QA read it as the assistant failing.

    const controller = new AbortController();
    let idle = null;
    const resetIdle = () => {
      clearTimeout(idle);
      idle = setTimeout(() => controller.abort(), this.timeoutMs);
    };
    resetIdle();

    const body = { message: text };
    if (this.sessionId) body.session_id = this.sessionId;
    const cart = await this.#readCart();
    if (cart) body.cart = cart;
    // After #readCart, which is what learns the live currency.
    const customer = this.#customerContext();
    if (customer) body.customer = customer;
    const context = this.#storefrontContext();
    if (context) body.context = context;

    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error('HTTP ' + res.status);
      if (!res.body) throw new Error('No stream');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // SSE frames are separated by a blank line. Anything after the last one
      // is a partial frame, so it stays in the buffer until the rest arrives.
      for (;;) {
        const { value, done } = await reader.read();
        resetIdle();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let cut;
        while ((cut = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, cut);
          buffer = buffer.slice(cut + 2);

          let name = 'message';
          const dataLines = [];
          for (const line of frame.split('\n')) {
            if (line.startsWith('event:')) name = line.slice(6).trim();
            else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
          }
          if (!dataLines.length) continue;

          let data;
          try { data = JSON.parse(dataLines.join('\n')); } catch (e) { continue; }

          if (name === 'session') {
            this.#rememberSessionId(data.session_id);
            continue;
          }

          if (name === 'token') {
            if (!bubble) {
              typing.remove();
              bubble = this.#startStream();
            }
            streamed += data.text || '';
            this.#updateStream(bubble, streamed);
            continue;
          }

          // The agent narrated its intent before a lookup ("Let me check…").
          // That is not the answer, so it is wiped rather than left above it.
          if (name === 'reset') {
            streamed = '';
            if (bubble) {
              bubble.parentElement.remove();
              bubble = null;
              typing.remove();
              this.log.appendChild(typing);
              this.#scroll();
            }
            continue;
          }

          // The products the agent looked up, as the store's own data — real
          // titles, prices and images, none of it retyped by the model.
          if (name === 'products') {
            products = shapeItems(data.items, data, asksForRanking(text));
            continue;
          }

          // The backend has done the deciding — which product, which size — and
          // hands over the doing. Collected here and carried out once the reply
          // has finished, so the words and the cart change land together.
          if (name === 'actions') {
            actions = data;
            continue;
          }

          if (name === 'suggestions') {
            suggestions = readSuggestions(data);
            if (data && data.position) position = String(data.position);
            continue;
          }

          if (name === 'orders' || name === 'order') {
            orders = readOrders(data);
            continue;
          }

          // The agent tries several looks in one turn and emits each one, so
          // the last is its final answer. It also supersedes `products`: the
          // shopper asked for an outfit, not the shelf it was picked from.
          if (name === 'outfit') {
            if (Array.isArray(data.items) && data.items.length) outfit = data;
            continue;
          }

          if (name === 'select') {
            selection = data;
            continue;
          }

          // The colour the shopper wants, noted by the assistant. Kept for the
          // session and applied to every card from here on - so it is set now,
          // before this reply's own cards are drawn.
          if (name === 'preference') {
            this.#setPreferredColour(data && data.colour);
            continue;
          }

          if (name === 'done') {
            this.#rememberSessionId(data.session_id);
            reply = data.reply || streamed;
            // `done` repeats the products, so a client that missed the earlier
            // event still gets the cards.
            const late = data.products;
            if (!products.length && late) {
              products = shapeItems(late.items, late, asksForRanking(text));
            }
            // `done` repeats them too, for a client that joined late.
            if (!suggestions.length) suggestions = readSuggestions(data.suggestions);
            if (!position && data.suggestions_position) position = String(data.suggestions_position);
            if (!orders.length) orders = readOrders(data.orders || data.order);
            if (!selection && data.select) selection = data.select;
            if (data.preference) this.#setPreferredColour(data.preference.colour);
            // `done` repeats the final look, which settles it if several were
            // streamed or the client joined late.
            if (data.outfit && Array.isArray(data.outfit.items) && data.outfit.items.length) {
              outfit = data.outfit;
            }
            continue;
          }

          if (name === 'error') {
            failed = true;
            reply = data.message || 'Sorry — something went wrong. Please try again.';
          }
        }
      }


      // A stream that ends with neither `done` nor `error` was cut short, but
      // whatever did arrive is still a real partial answer worth showing.
      if (!reply) reply = streamed;
      if (!reply) {
        failed = true;
        reply = 'Sorry, I did not get a reply that time. Please try again.';
      }

      // The cards belong to a finished answer — a `reset` mid-turn can still
      // discard the bubble they would have hung off. An outfit wins over the
      // product list it was picked from.
      const cards = failed ? null
        : outfit ? { key: 'outfit', json: JSON.stringify(outfit) }
        : products.length ? { key: 'products', json: JSON.stringify(products) }
        : null;

      if (bubble) {
        // Set before rendering: the reply's own restatement of these products
        // is stripped out, and that needs to know their titles first.
        if (cards) bubble.dataset[cards.key] = cards.json;
        if (suggestions.length) bubble.dataset.suggestions = JSON.stringify(suggestions);
        // Also without backend chips: the options parsed out of the reply's own
        // numbered list become the buttons, and follow the same position.
        if (position) bubble.dataset.suggestionsPosition = position;
        if (orders.length) bubble.dataset.orders = JSON.stringify(orders);
        // Set before rendering, like the cards: the prose is de-duplicated
        // against the heading this is about to become.
        if (this.pendingGroup) bubble.dataset.group = this.pendingGroup;
        this.#finishStream(bubble, reply);
      } else {
        // No token ever arrived, so the whole reply came from `done` — and
        // everything riding along with it has to be carried over by hand.
        const extra = cards ? { [cards.key]: cards.json } : {};
        if (suggestions.length) extra.suggestions = JSON.stringify(suggestions);
        if (position) extra.position = position;
        if (orders.length) extra.orders = JSON.stringify(orders);
        if (this.pendingGroup) extra.group = this.pendingGroup;
        bubble = this.#addMessage('bot', reply, extra);
      }

      // A question about the cart is answered with the cart. Orders arriving
      // alongside one are the backend answering something that was not asked,
      // and showing them here is worse than showing nothing — the shopper gets
      // a different garment, at a different price, under an order number.
      // Products sent deliberately still win: those were chosen for this reply.
      // One turn only — whatever is asked next is not about that collection.
      this.pendingGroup = null;

      if (!cards && asksAboutCart(text) && !asksAboutOrders(text)) {
        delete bubble.dataset.orders;
        this.#showCartItems(bubble);
      } else if (cards || orders.length) {
        this.#hydrateOutfit(bubble);
        this.#hydrateProducts(bubble);
        this.#hydrateOrders(bubble);
        this.#placeQuickReplies(bubble);
        this.#saveTranscript();
      }

      if (!failed && actions && bubble) this.#runActions(actions, bubble);
      if (!failed && selection) this.#applySelection(selection);

      if (failed) {
        this.#setStatus('warn', 'Having trouble');
        this.#addRetry(bubble);
      } else {
        this.#setStatus('ok', this.onlineText);
      }
    } catch (err) {
      const aborted = err.name === 'AbortError';
      this.#setStatus('crit', aborted ? 'Not responding' : 'Offline');

      const message = aborted
        ? 'That took longer than expected. The assistant should be awake now — try again.'
        : 'I could not reach our support system just now. Please try again in a moment.';

      // Keep any words that did arrive; only the tail is missing.
      if (bubble && streamed) this.#finishStream(bubble, streamed);
      else if (bubble) bubble.parentElement.remove();

      this.#addRetry(this.#addMessage('bot', message));
    } finally {
      clearTimeout(idle);
      typing.remove();
      this.#setBusy(false);
      if (!this.hasAttribute('open')) this.setAttribute('data-unread', '');
      if (!window.matchMedia('(hover: none)').matches) this.input.focus();
    }
  }
}

if (!customElements.get('ai-support-chat')) {
  customElements.define('ai-support-chat', AISupportChat);
}
