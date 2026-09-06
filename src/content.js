// Post Peek content script.
// Intercepts clicks on x.com / twitter.com post links and opens them in a popup.
//
// Privacy notes:
// - The page's DOM is never scanned or mutated to find links. The dot marker is
//   pure CSS (content.css) matched on the href attribute, and the click handler
//   inspects only the link that was actually clicked.
// - The only element added to the page is the popup host, and only after the
//   user peeks. The only page attribute ever set is data-postpeek-nodots on
//   <html>, when the user turns dots off.
// - All media is loaded anonymously (no cookies) with no Referer, so X never
//   learns which site you were reading.
(() => {
  if (window.__postPeekLoaded) return;
  window.__postPeekLoaded = true;

  const POST_RE =
    /^https?:\/\/(?:www\.|mobile\.|m\.)?(?:x\.com|twitter\.com|fxtwitter\.com|vxtwitter\.com|fixupx\.com|fixvx\.com)\/(?:#!\/)?(?:i\/web|[A-Za-z0-9_]{1,20})\/status(?:es)?\/(\d{1,25})(?:[/?#]|$)/;

  const settings = { showDots: true, theme: 'auto', enabled: true };

  function parsePostId(href) {
    const m = POST_RE.exec(href || '');
    return m ? m[1] : null;
  }

  // ---------- popup ----------
  let host = null, shadow = null, overlay = null, lastFocus = null;
  let sheet = null;

  // popup-css.js (loaded before this script) defines POST_PEEK_CSS. Embedding
  // the stylesheet avoids exposing it as a web-accessible resource, which
  // would let any website detect the extension.
  function loadCss() {
    if (!sheet) { sheet = new CSSStyleSheet(); sheet.replaceSync(POST_PEEK_CSS); }
    return sheet;
  }

  function ensureHost() {
    if (host) return;
    host = document.createElement('post-peek-host');
    shadow = host.attachShadow({ mode: 'closed' });
    shadow.adoptedStyleSheets = [loadCss()];
    applyTheme();
    (document.body || document.documentElement).appendChild(host);
  }

  function applyTheme() {
    if (!host) return;
    if (settings.theme === 'light' || settings.theme === 'dark') host.dataset.theme = settings.theme;
    else delete host.dataset.theme;
  }

  function closePopup() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    document.removeEventListener('keydown', onKey, true);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    lastFocus = null;
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePopup(); }
  }

  function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else n.setAttribute(k, v);
    }
    for (const c of [].concat(children)) if (c != null) n.append(c);
    return n;
  }

  const X_LOGO = 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z';
  const BADGE = 'M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z';

  function svg(path, cls) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('class', cls);
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', path);
    s.append(p);
    return s;
  }

  // Only http(s) URLs from the API are ever turned into links.
  function safeHref(href) {
    try {
      const u = new URL(href);
      if (u.protocol === 'https:' || u.protocol === 'http:') return u.href;
    } catch { /* invalid */ }
    return null;
  }

  function extLink(href, children, attrs = {}) {
    return el('a', { href: safeHref(href), target: '_blank', rel: 'noopener noreferrer', ...attrs }, children);
  }

  function postUrl(t) {
    return `https://x.com/${t.user?.screen_name || 'i/web'}/status/${t.id_str}`;
  }

  // Media is requested anonymously: crossorigin="anonymous" sends no cookies and
  // referrerpolicy="no-referrer" sends no Referer, so X cannot tie the request
  // to your account or learn the page you are reading. If the page's CSP blocks
  // twimg.com images, they are routed through the service worker instead.
  const MEDIA_ATTRS = { crossorigin: 'anonymous', referrerpolicy: 'no-referrer' };

  function img(src, attrs = {}) {
    if (!safeHref(src)) return el('span');
    const i = el('img', { src, loading: 'lazy', ...MEDIA_ATTRS, ...attrs });
    i.addEventListener('error', () => {
      if (i.dataset.proxied) return;
      i.dataset.proxied = '1';
      chrome.runtime.sendMessage({ type: 'fetchMedia', url: src }, (res) => {
        if (res?.ok) i.src = res.data;
      });
    }, { once: true });
    return i;
  }

  function renderText(t, cls = 'lb-text') {
    const chars = Array.from(t.text || '');
    const range = t.display_text_range || [0, chars.length];
    const ents = [];
    const E = t.entities || {};
    for (const u of E.urls || []) ents.push({ i: u.indices, href: u.expanded_url || u.url, label: u.display_url || u.url });
    for (const m of E.user_mentions || []) ents.push({ i: m.indices, href: `https://x.com/${m.screen_name}`, label: `@${m.screen_name}` });
    for (const h of E.hashtags || []) ents.push({ i: h.indices, href: `https://x.com/hashtag/${encodeURIComponent(h.text)}`, label: `#${h.text}` });
    for (const s of E.symbols || []) ents.push({ i: s.indices, href: `https://x.com/search?q=%24${encodeURIComponent(s.text)}`, label: `$${s.text}` });
    for (const m of E.media || []) ents.push({ i: m.indices, hide: true });
    ents.sort((a, b) => a.i[0] - b.i[0]);

    const out = el('div', { class: cls });
    let pos = range[0];
    for (const e of ents) {
      const [s, end] = e.i;
      if (s < pos || end > range[1]) continue;
      if (s > pos) out.append(chars.slice(pos, s).join(''));
      if (!e.hide) out.append(extLink(e.href, e.label));
      pos = end;
    }
    if (pos < range[1]) out.append(chars.slice(pos, range[1]).join(''));
    // Trim leftover whitespace from removed media links.
    if (out.lastChild?.nodeType === 3) out.lastChild.textContent = out.lastChild.textContent.replace(/\s+$/, '');
    return out;
  }

  function pickVideo(t) {
    const details = (t.mediaDetails || []).filter((m) => m.type === 'video' || m.type === 'animated_gif');
    const items = [];
    for (const d of details) {
      const vars = (d.video_info?.variants || []).filter((v) => v.content_type === 'video/mp4');
      vars.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
      if (vars.length) items.push({ src: vars[0].url, poster: d.media_url_https, gif: d.type === 'animated_gif' });
    }
    if (!items.length && t.video) {
      const vars = (t.video.variants || []).filter((v) => v.type === 'video/mp4');
      if (vars.length) items.push({ src: vars[vars.length - 1].src, poster: t.video.poster, gif: false });
    }
    return items;
  }

  function renderMedia(t) {
    const photos = t.photos || [];
    const videos = pickVideo(t);
    const n = photos.length + videos.length;
    if (!n) return null;
    const box = el('div', { class: `lb-media n${Math.min(n, 4)}` });
    for (const v of videos) {
      if (!safeHref(v.src)) continue;
      // preload="none": nothing is fetched from video.twimg.com until you press play.
      const vid = el('video', { controls: '', playsinline: '', preload: 'none', poster: v.poster, src: v.src, ...MEDIA_ATTRS });
      if (v.gif) { vid.setAttribute('autoplay', ''); vid.setAttribute('loop', ''); vid.muted = true; }
      vid.addEventListener('error', () => {
        vid.replaceWith(el('div', { class: 'lb-media-fail' }, [
          'Video could not be loaded here. ', extLink(postUrl(t), 'Watch on X'),
        ]));
      }, { once: true });
      box.append(vid);
    }
    for (const p of photos) {
      box.append(extLink(p.expandedUrl || postUrl(t), img(p.url, { alt: p.accessibilityLabel || '' })));
    }
    return box;
  }

  function renderCard(t) {
    const bv = t.card?.binding_values;
    if (!bv) return null;
    const url = bv.card_url?.string_value || t.entities?.urls?.[0]?.expanded_url;
    const title = bv.title?.string_value;
    if (!url || !title) return null;
    const imgv = bv.summary_photo_image_large?.image_value || bv.thumbnail_image_large?.image_value || bv.photo_image_full_size_large?.image_value;
    const desc = bv.description?.string_value;
    let domain = bv.vanity_url?.string_value;
    if (!domain) { try { domain = new URL(url).hostname; } catch { domain = ''; } }
    return extLink(url, [
      imgv ? img(imgv.url, { alt: '' }) : null,
      el('div', { class: 'lb-card-body' }, [
        el('div', { class: 'lb-card-domain', text: domain }),
        el('div', { class: 'lb-card-title', text: title }),
        desc ? el('div', { class: 'lb-card-desc', text: desc }) : null,
      ]),
    ], { class: 'lb-card-link' });
  }

  function renderHead(t, compact) {
    const u = t.user || {};
    const profile = `https://x.com/${u.screen_name}`;
    const head = el('div', { class: 'lb-head' }, [
      extLink(profile, img(u.profile_image_url_https, { class: 'lb-avatar', alt: '' })),
      el('div', { class: 'lb-who' }, [
        el('div', { class: 'lb-name' }, [
          extLink(profile, u.name || ''),
          (u.is_blue_verified || u.verified) ? svg(BADGE, 'lb-badge') : null,
        ]),
        el('div', { class: 'lb-handle' }, extLink(profile, `@${u.screen_name || ''}`)),
      ]),
    ]);
    if (!compact) head.append(el('div', { class: 'lb-head-actions' }, extLink(postUrl(t), svg(X_LOGO, 'lb-x'), { title: 'View on X' })));
    return head;
  }

  function fmtDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleString(undefined, { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric', year: 'numeric' });
  }
  function fmtNum(n) {
    if (n == null) return null;
    return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  }

  function renderQuote(q) {
    const box = el('div', { class: 'lb-quote', role: 'link', tabindex: '0' }, [
      renderHead(q, true),
      renderText(q),
      renderMedia(q),
    ]);
    const open = (e) => { e.preventDefault(); e.stopPropagation(); showPost(q.id_str); };
    box.addEventListener('click', (e) => { if (!e.target.closest('a')) open(e); });
    box.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(e); });
    return box;
  }

  function renderPost(t) {
    const parts = [renderHead(t, false)];
    if (t.in_reply_to_screen_name) {
      const link = extLink(`https://x.com/${t.in_reply_to_screen_name}`, `@${t.in_reply_to_screen_name}`);
      const parentId = t.parent?.id_str || t.in_reply_to_status_id_str;
      if (parentId) {
        link.href = `https://x.com/${t.in_reply_to_screen_name}/status/${parentId}`;
        link.addEventListener('click', (e) => { e.preventDefault(); showPost(parentId); });
      }
      parts.push(el('div', { class: 'lb-reply' }, ['Replying to ', link]));
    }
    parts.push(renderText(t));
    parts.push(renderMedia(t));
    if (!t.photos?.length && !t.video) parts.push(renderCard(t));
    if (t.quoted_tweet) parts.push(renderQuote(t.quoted_tweet));

    const stats = el('div', { class: 'lb-stats' });
    const likes = fmtNum(t.favorite_count);
    if (likes != null) stats.append(el('span', { text: `${likes} likes` }));
    const replies = fmtNum(t.conversation_count);
    if (replies != null) stats.append(el('span', { text: `${replies} replies` }));
    parts.push(el('div', { class: 'lb-foot' }, [
      el('div', {}, [extLink(postUrl(t), fmtDate(t.created_at)), stats.childElementCount ? ' · ' : null, stats]),
      extLink(postUrl(t), 'Open on X', { class: 'lb-open' }),
    ]));
    return parts;
  }

  function friendlyError(code, id) {
    const url = `https://x.com/i/web/status/${id}`;
    let msg = 'This post could not be loaded.';
    if (code === 'POST_NOT_FOUND') msg = 'This post does not exist or was deleted.';
    else if (code === 'POST_UNAVAILABLE') msg = 'This post is unavailable to embed (it may be from a protected account, age-restricted, or removed).';
    else if (/^HTTP_/.test(code)) msg = `X returned an error (${code.replace('HTTP_', 'HTTP ')}).`;
    else if (/Extension context invalidated/i.test(code)) msg = 'Post Peek was updated. Reload this page to keep peeking.';
    return el('div', { class: 'lb-status' }, [
      el('div', { text: msg }),
      el('div', {}, extLink(url, 'Open on X', { class: 'lb-open' })),
    ]);
  }

  function fetchTweet(id) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage({ type: 'fetchTweet', id }, (res) => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
          if (res?.ok) resolve(res.data); else reject(new Error(res?.error || 'UNKNOWN'));
        });
      } catch (e) { reject(e); }
    });
  }

  let requestToken = 0;

  async function showPost(id) {
    ensureHost();
    if (!overlay) {
      lastFocus = document.activeElement;
      overlay = el('div', { class: 'lb-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'X post preview' });
      overlay.addEventListener('click', (e) => { if (e.target === overlay) closePopup(); });
      shadow.append(overlay);
      document.addEventListener('keydown', onKey, true);
    }
    const card = el('div', { class: 'lb-card', tabindex: '-1' });
    const close = el('button', { class: 'lb-close', type: 'button', 'aria-label': 'Close', text: '×' });
    close.addEventListener('click', closePopup);
    card.append(el('div', { class: 'lb-status' }, [el('div', { class: 'lb-spinner' }), 'Peeking…']), close);
    overlay.replaceChildren(card);
    close.focus();

    const token = ++requestToken;
    try {
      const t = await fetchTweet(id);
      if (!overlay || token !== requestToken) return;
      card.replaceChildren(...renderPost(t).filter(Boolean), close);
    } catch (e) {
      if (!overlay || token !== requestToken) return;
      card.replaceChildren(friendlyError(e?.message || '', id), close);
    }
    close.focus();
  }

  // ---------- click interception ----------
  document.addEventListener('click', (e) => {
    if (!settings.enabled) return;
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    const a = e.composedPath().find((n) => n instanceof HTMLAnchorElement);
    if (!a) return;
    const id = parsePostId(a.href);
    if (!id) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    showPost(id);
  }, true);

  // ---------- settings ----------
  function applySettings() {
    // Dots are on by default via content.css; only the off state touches the page.
    if (settings.showDots && settings.enabled) delete document.documentElement.dataset.postpeekNodots;
    else document.documentElement.dataset.postpeekNodots = '';
    applyTheme();
  }
  try {
    // Settings live in local storage only; nothing is synced to a Google account.
    chrome.storage.local.get(settings, (s) => { Object.assign(settings, s); applySettings(); });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      for (const [k, v] of Object.entries(changes)) if (k in settings) settings[k] = v.newValue;
      applySettings();
    });
  } catch { /* storage unavailable */ }

})();
