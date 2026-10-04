// Post Peek
// Service worker: fetches posts from X's syndication API (the same backend that
// powers X's embed widgets) and from Bluesky's public AppView. All requests are
// made with credentials omitted and no Referer, so no cookies are ever sent to
// either site and neither learns which page you were reading. Fetched posts
// are held only in memory, for at most five minutes.

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

// Keeps a fetched post for CACHE_TTL and no longer: the entry is dropped when
// its time is up, not just ignored, unless the worker was shut down first
// (which empties the cache anyway).
function remember(key, data) {
  const entry = { at: Date.now(), data };
  cache.set(key, entry);
  setTimeout(() => { if (cache.get(key) === entry) cache.delete(key); }, CACHE_TTL);
  return data;
}

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
    referrerPolicy: 'no-referrer',
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
  return remember(id, data);
}

const BSKY_THREAD = 'https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread';
const BSKY_ACTOR_RE = /^(?:did:[a-z]+:[A-Za-z0-9._:%-]+|[A-Za-z0-9.-]+)$/;
const BSKY_RKEY_RE = /^[A-Za-z0-9._~:-]{1,512}$/;

// Returns { post, parent }: the post and, for a reply, the post it replies to.
async function fetchBsky(actor, rkey) {
  if (!BSKY_ACTOR_RE.test(actor) || !BSKY_RKEY_RE.test(rkey)) throw new Error('POST_NOT_FOUND');
  const key = `bsky:${actor}/${rkey}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.data;

  const url = new URL(BSKY_THREAD);
  url.searchParams.set('uri', `at://${actor}/app.bsky.feed.post/${rkey}`);
  url.searchParams.set('depth', '0');
  url.searchParams.set('parentHeight', '1');

  const res = await fetch(url.href, {
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error === 'NotFound' ? 'POST_NOT_FOUND' : `HTTP_${res.status}`);

  const thread = body?.thread;
  if (thread?.$type === 'app.bsky.feed.defs#notFoundPost') throw new Error('POST_NOT_FOUND');
  if (!thread?.post) throw new Error('POST_UNAVAILABLE'); // blocked, or an unknown shape
  const withheld = bskyWithheld(thread.post);
  if (withheld) throw new Error(withheld);
  const parent = thread.parent?.post;
  const data = { post: withholdQuote(thread.post), parent: parent && !bskyWithheld(parent) ? parent : null };
  return remember(key, data);
}

// Why a Bluesky post (or quoted post) must not be shown, or null. bsky.app
// shows neither kind to logged-out viewers: an author's request to be hidden
// from them, and a "!hide" label from Bluesky's moderators on the post or the
// account (an account label has the DID itself as its subject).
function bskyWithheld(post) {
  const author = post?.author || {};
  const labels = author.labels || [];
  if (labels.some((l) => l.val === '!no-unauthenticated')) return 'LOGGED_IN_ONLY';
  if ((post?.labels || []).some((l) => l.val === '!hide')) return 'HIDDEN_BY_BLUESKY';
  if (labels.some((l) => l.val === '!hide' && l.uri === author.did)) return 'HIDDEN_BY_BLUESKY';
  return null;
}

// A withheld quoted post is swapped for the API's own "not found" view, so it
// never reaches the page at all.
function withholdQuote(post) {
  const e = post.embed;
  const holder = e?.$type === 'app.bsky.embed.record#view' ? e
    : e?.$type === 'app.bsky.embed.recordWithMedia#view' ? e.record : null;
  if (holder?.record && bskyWithheld(holder.record)) {
    holder.record = { $type: 'app.bsky.embed.record#viewNotFound', uri: holder.record.uri, notFound: true };
  }
  return post;
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

// Every image in the popup (avatars, photos, card thumbnails, video posters) is
// fetched here rather than by the page, so the request carries nothing about
// the site being read: no cookies, no Referer, and no Origin naming it. Only
// images, only from the media hosts declared in the manifest (before and after
// any redirect), and never written to the browser's disk cache.
const MEDIA_HOSTS = new Set([
  'pbs.twimg.com', 'video.twimg.com',
  'cdn.bsky.app', 'video.bsky.app', 'video.cdn.bsky.app',
]);

async function fetchMedia(url) {
  const u = new URL(url);
  if (u.protocol !== 'https:' || !MEDIA_HOSTS.has(u.hostname)) throw new Error('BAD_HOST');
  const res = await fetch(u.href, { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  if (!MEDIA_HOSTS.has(new URL(res.url).hostname)) throw new Error('BAD_HOST');
  const type = res.headers.get('content-type') || '';
  if (!type.startsWith('image/')) throw new Error('NOT_AN_IMAGE');
  const buf = await res.arrayBuffer();
  return `data:${type};base64,${toBase64(buf)}`;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === 'fetchTweet') {
        sendResponse({ ok: true, data: await fetchTweet(String(msg.id)) });
      } else if (msg?.type === 'fetchBsky') {
        sendResponse({ ok: true, data: await fetchBsky(String(msg.actor), String(msg.rkey)) });
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

// Settings moved from chrome.storage.sync to chrome.storage.local so that they
// are never uploaded to a Google account. Migrate once, then clear the synced copy.
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason !== 'update') return;
  chrome.storage.sync.get(null, (synced) => {
    if (chrome.runtime.lastError || !synced || !Object.keys(synced).length) return;
    chrome.storage.local.get(null, (local) => {
      const merged = { ...synced, ...local };
      chrome.storage.local.set(merged, () => chrome.storage.sync.clear());
    });
  });
});
