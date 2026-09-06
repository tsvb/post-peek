// Litterbox - Post Peeker (Chrome)
// Service worker: fetches posts from X's syndication API (the same backend that
// powers X's embed widgets). All requests are made with credentials omitted, so
// no cookies are ever sent to X.

const SYNDICATION = 'https://cdn.syndication.twimg.com/tweet-result';

// The syndication endpoint requires a "token" derived from the post id.
// This is the same derivation used by X's own embed code.
function tokenFor(id) {
  return ((Number(id) / 1e15) * Math.PI)
    .toString(6 ** 2)
    .replace(/(0+|\.)/g, '');
}

const FEATURES = [
  'tfw_timeline_list:',
  'tfw_follower_count_sunset:true',
  'tfw_tweet_edit_backend:on',
  'tfw_refsrc_session:on',
  'tfw_fosnr_soft_interventions_enabled:on',
  'tfw_show_birdwatch_pivots_enabled:on',
  'tfw_show_business_verified_badge:on',
  'tfw_duplicate_scribes_to_settings:on',
  'tfw_use_profile_image_shape_enabled:on',
  'tfw_show_blue_verified_badge:on',
  'tfw_legacy_timeline_sunset:true',
  'tfw_show_gov_verified_badge:on',
  'tfw_show_business_affiliate_badge:on',
  'tfw_tweet_edit_frontend:on',
].join(';');

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

async function fetchTweet(id) {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.data;

  const url = new URL(SYNDICATION);
  url.searchParams.set('id', id);
  url.searchParams.set('lang', 'en');
  url.searchParams.set('token', tokenFor(id));
  url.searchParams.set('features', FEATURES);

  const res = await fetch(url.toString(), {
    credentials: 'omit',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });

  if (res.status === 404) throw new Error('POST_NOT_FOUND');
  if (!res.ok) throw new Error(`HTTP_${res.status}`);

  const text = await res.text();
  if (!text) throw new Error('POST_UNAVAILABLE');
  const data = JSON.parse(text);
  if (!data || data.__typename === 'TweetTombstone') {
    throw new Error('POST_UNAVAILABLE');
  }
  cache.set(id, { at: Date.now(), data });
  return data;
}

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

// Used as a fallback when the host page's Content-Security-Policy blocks
// loading images from twimg.com directly.
async function fetchMedia(url) {
  const u = new URL(url);
  if (!/\.twimg\.com$/.test(u.hostname)) throw new Error('BAD_HOST');
  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  const type = res.headers.get('content-type') || 'application/octet-stream';
  const buf = await res.arrayBuffer();
  return `data:${type};base64,${toBase64(buf)}`;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === 'fetchTweet') {
        sendResponse({ ok: true, data: await fetchTweet(String(msg.id)) });
      } else if (msg?.type === 'fetchMedia') {
        sendResponse({ ok: true, data: await fetchMedia(String(msg.url)) });
      } else {
        sendResponse({ ok: false, error: 'UNKNOWN_MESSAGE' });
      }
    } catch (e) {
      sendResponse({ ok: false, error: e?.message || String(e) });
    }
  })();
  return true; // keep the channel open for the async response
});
