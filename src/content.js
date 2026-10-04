// Post Peek content script.
// Intercepts clicks on x.com / twitter.com and bsky.app post links and opens
// them in a popup.
//
// Privacy notes:
// - The page's DOM is never scanned or mutated to find links. The dot marker is
//   pure CSS (content.css) matched on the href attribute, and the click handler
//   inspects only the link that was actually clicked.
// - The only element added to the page is the popup host, and only after the
//   user peeks. The only page attribute ever set is data-postpeek-dots on
//   <html>, and only when dots are on, which a page could already detect from
//   the dot's computed style. With dots off, nothing is written to the page.
//   (The dot stylesheet itself is always injected, so a page that sets that
//   attribute on its own can still tell the extension is installed.)
// - Runs at document_start so the dot setting is applied before the page
//   paints, rather than after it has already rendered.
// - All media is loaded anonymously (no cookies) with no Referer and no Origin
//   naming the page, so neither X nor Bluesky learns which site you were
//   reading: images come through the service worker, video plays in a
//   sandboxed frame.
(() => {
  if (window.__postPeekLoaded) return;
  window.__postPeekLoaded = true;

  const POST_RE =
    /^https?:\/\/(?:www\.|mobile\.|m\.)?(?:x\.com|twitter\.com|fxtwitter\.com|vxtwitter\.com|fixupx\.com|fixvx\.com)\/(?:#!\/)?(?:i\/web|[A-Za-z0-9_]{1,20})\/status(?:es)?\/(\d{1,25})(?:[/?#]|$)/;

  // bsky.app/profile/<handle or DID>/post/<record key>. The actor may arrive
  // percent-encoded (did%3Aplc%3A...), so it is decoded and re-checked.
  const BSKY_RE =
    /^https?:\/\/bsky\.app\/profile\/([A-Za-z0-9._:%-]{1,253})\/post\/([A-Za-z0-9._~:-]{1,512})(?:[/?#]|$)/;
  const BSKY_ACTOR_RE = /^(?:did:[a-z]+:[A-Za-z0-9._:%-]+|[A-Za-z0-9.-]+)$/;

  const settings = { showDots: true, theme: 'auto', enabled: true };

  // Returns { site: 'x', id } or { site: 'bsky', actor, rkey }, or null.
  function parseLink(href) {
    let m = POST_RE.exec(href || '');
    if (m) return { site: 'x', id: m[1] };
    m = BSKY_RE.exec(href || '');
    if (!m) return null;
    let actor;
    try { actor = decodeURIComponent(m[1]); } catch { return null; }
    return BSKY_ACTOR_RE.test(actor) ? { site: 'bsky', actor, rkey: m[2] } : null;
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
    if (host) {
      // A page that swapped out its <body> took the host with it.
      if (!host.isConnected) (document.body || document.documentElement).appendChild(host);
      return;
    }
    // A plain div, not a custom element: a page can define any hyphenated name
    // and reach a closed shadow root through its ElementInternals.
    host = document.createElement('div');
    shadow = host.attachShadow({ mode: 'closed' });
    try {
      shadow.adoptedStyleSheets = [loadCss()];
    } catch {
      // Firefox before 153 cannot assign adoptedStyleSheets from a content
      // script (Xray wrappers, Firefox bug 1751346). A <style> inside the
      // closed shadow root is still invisible to the page; the one cost is
      // that a host page with a strict style-src CSP can block it there.
      shadow.append(el('style', { text: POST_PEEK_CSS }));
    }
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
    window.removeEventListener('blur', onFrameFocus);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    lastFocus = null;
  }

  let lastTab = -Infinity;

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePopup(); }
    else if (e.key === 'Tab') lastTab = e.timeStamp;
  }

  // A key pressed while focus is inside a player's frame never reaches this
  // document, so Esc could not close the popup after a click on the video's
  // controls. The window's blur event is the one sign of focus going into the
  // frame, and when a click put it there, the card takes it straight back.
  // The click itself has already landed on the control. Focus that arrived by
  // Tab (the blur comes in the same instant as the key) is left alone, so the
  // controls stay reachable from the keyboard; Tab leads back out again.
  function onFrameFocus(e) {
    if (!overlay || e.timeStamp - lastTab < 100) return;
    // Not from inside the blur itself: the browser is still handing focus to
    // the frame, and would finish doing so after the card took it.
    setTimeout(() => {
      const card = overlay?.firstElementChild;
      if (card && shadow.activeElement?.localName === 'iframe') card.focus({ preventScroll: true });
    });
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

  const BSKY_LOGO = 'M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z';
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

  // Media may only come from the hosts PRIVACY.md names. background.js applies
  // the same allowlist to the image proxy, less video.twimg.com, which serves
  // only the video the player's frame loads. Anything else fails closed rather
  // than quietly contacting a third party.
  const MEDIA_HOSTS = new Set([
    'pbs.twimg.com', 'video.twimg.com',
    'cdn.bsky.app', 'video.bsky.app', 'video.cdn.bsky.app',
  ]);

  function safeMediaUrl(url) {
    try {
      const u = new URL(url);
      if (u.protocol === 'https:' && MEDIA_HOSTS.has(u.hostname)) return u.href;
    } catch { /* invalid */ }
    return null;
  }

  // Resolves with the service worker's answer, rejects with its error code.
  function send(msg) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(msg, (res) => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
          if (res?.ok) resolve(res.data); else reject(new Error(res?.error || 'UNKNOWN'));
        });
      } catch (e) { reject(e); }
    });
  }

  // Images never load from the page. An <img> there would either send cookies
  // or, with crossorigin="anonymous", an Origin header naming the site you are
  // reading, and its URL would show up in the page's resource timing list. The
  // service worker fetches each one instead (no cookies, no Referer, nothing
  // about the page) and hands back a data: URL.
  function img(src, attrs = {}) {
    const safe = safeMediaUrl(src);
    if (!safe) return el('span');
    const i = el('img', attrs);
    send({ type: 'fetchMedia', url: safe }).then((data) => { i.src = data; }, () => { /* stays blank */ });
    return i;
  }

  // X's API returns post text with &, < and > escaped, and counts entity
  // indices against the escaped text, so this runs on each slice after cutting.
  function unescapeX(s) {
    return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
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
    let pos = range[0], stop = range[1];
    for (const e of ents) {
      const [s, end] = e.i;
      if (s < pos || s >= stop) continue;
      if (s > pos) out.append(unescapeX(chars.slice(pos, s).join('')));
      if (!e.hide) out.append(extLink(e.href, e.label));
      // The API counts display_text_range in UTF-16 units but entity indices
      // in code points, so after an emoji the trailing media link can straddle
      // the end of the range. The text then ends where that entity starts.
      if (end > stop) { pos = stop = s; break; }
      pos = end;
    }
    if (pos < stop) out.append(unescapeX(chars.slice(pos, stop).join('')));
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
      const [w, h] = d.video_info?.aspect_ratio || [];
      if (vars.length) items.push({ src: vars[0].url, poster: d.media_url_https, gif: d.type === 'animated_gif', aspect: w / h });
    }
    if (!items.length && t.video) {
      const vars = (t.video.variants || []).filter((v) => v.type === 'video/mp4');
      const [w, h] = t.video.aspectRatio || [];
      if (vars.length) items.push({ src: vars[vars.length - 1].src, poster: t.video.poster, gif: false, aspect: w / h });
    }
    return items;
  }

  const attr = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

  // A <video> in the page gives the video host the site you are reading three
  // ways: the Referer (referrerpolicy covers only the poster, not the stream),
  // the Origin header that crossorigin="anonymous" adds, and, without that
  // attribute, your cookies. So each player lives in a sandboxed frame. Its
  // document has an opaque origin, so every request it makes (HLS playlists and
  // segments included) carries "Origin: null", its no-referrer policy drops the
  // Referer, and crossorigin="anonymous" keeps cookies out. The page cannot
  // look inside the frame either. No script runs in it: the document is plain
  // markup, and the poster is fetched by the service worker like any image.
  // preload="none": nothing is fetched from the video host until you press
  // play, except for GIFs, which loop on their own as they do on both sites.
  function player({ src, poster, gif, aspect }) {
    const safe = safeMediaUrl(src);
    if (!safe) return null;
    // A sandbox also blocks autoplay, and only allow-scripts lifts that, so a
    // GIF's frame gets it. There is still no script in the document to run,
    // and the origin stays opaque without allow-same-origin.
    const frame = el('iframe', { class: 'lb-player', title: 'Video', sandbox: gif ? 'allow-scripts' : '', allowfullscreen: '', scrolling: 'no' });
    // CSSOM, not a style attribute, so a page CSP without 'unsafe-inline' allows it.
    if (aspect > 0 && isFinite(aspect)) frame.style.setProperty('--lb-ratio', String(aspect));
    // The width attribute stands in where the page's CSP, which the frame
    // inherits, refuses the inline styles.
    const build = (still) => {
      frame.srcdoc = '<!doctype html><html style="height: 100%"><head><meta name="referrer" content="no-referrer"></head>'
        + '<body bgcolor="#000" marginwidth="0" marginheight="0" style="height: 100%; margin: 0; overflow: hidden">'
        + '<video controls playsinline crossorigin="anonymous" width="100%"'
        + (gif ? ' autoplay loop muted preload="auto"' : ' preload="none"')
        + (still ? ` poster="${attr(still)}"` : '')
        + ` style="display: block; width: 100%; height: 100%" src="${attr(safe)}"></video></body></html>`;
    };
    const still = safeMediaUrl(poster);
    if (still) send({ type: 'fetchMedia', url: still }).then(build, () => build(null));
    else build(null);
    return frame;
  }

  function renderMedia(t) {
    const photos = t.photos || [];
    const videos = pickVideo(t);
    const n = photos.length + videos.length;
    if (!n) return null;
    const box = el('div', { class: `lb-media n${Math.min(n, 4)}` });
    for (const v of videos) {
      const vid = player(v);
      if (vid) box.append(vid);
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
    return renderLinkCard(url, title, bv.description?.string_value, imgv?.url, bv.vanity_url?.string_value);
  }

  function renderLinkCard(url, title, desc, image, domain) {
    if (!domain) { try { domain = new URL(url).hostname; } catch { domain = ''; } }
    return extLink(url, [
      image ? img(image, { alt: '' }) : null,
      el('div', { class: 'lb-card-body' }, [
        el('div', { class: 'lb-card-domain', text: domain }),
        el('div', { class: 'lb-card-title', text: title }),
        desc ? el('div', { class: 'lb-card-desc', text: desc }) : null,
      ]),
    ], { class: 'lb-card-link' });
  }

  // a: { name, handle, avatar, profile, verified, url, logo, site }
  function renderHead(a, compact) {
    const head = el('div', { class: 'lb-head' }, [
      extLink(a.profile, img(a.avatar, { class: 'lb-avatar', alt: '' })),
      el('div', { class: 'lb-who' }, [
        el('div', { class: 'lb-name' }, [
          extLink(a.profile, a.name || ''),
          a.verified ? svg(BADGE, 'lb-badge') : null,
        ]),
        el('div', { class: 'lb-handle' }, extLink(a.profile, `@${a.handle || ''}`)),
      ]),
    ]);
    if (!compact) head.append(el('div', { class: 'lb-head-actions' }, extLink(a.url, svg(a.logo, 'lb-logo'), { title: `View on ${a.site}` })));
    return head;
  }

  function xHead(t, compact) {
    const u = t.user || {};
    return renderHead({
      name: u.name,
      handle: u.screen_name,
      avatar: u.profile_image_url_https,
      profile: `https://x.com/${u.screen_name}`,
      verified: u.is_blue_verified || u.verified,
      url: postUrl(t),
      logo: X_LOGO,
      site: 'X',
    }, compact);
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

  // A quoted post, which opens in the same popup when clicked.
  function quoteBox(children, ref) {
    const box = el('div', { class: 'lb-quote', role: 'link', tabindex: '0' }, children);
    const open = (e) => { e.preventDefault(); e.stopPropagation(); showPost(ref); };
    box.addEventListener('click', (e) => { if (!e.target.closest('a, button')) open(e); });
    box.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target === box) open(e); });
    return box;
  }

  function renderQuote(q) {
    return quoteBox([xHead(q, true), renderText(q), renderMedia(q)], { site: 'x', id: q.id_str });
  }

  function renderPost(t) {
    const parts = [xHead(t, false)];
    if (t.in_reply_to_screen_name) {
      const link = extLink(`https://x.com/${t.in_reply_to_screen_name}`, `@${t.in_reply_to_screen_name}`);
      const parentId = t.parent?.id_str || t.in_reply_to_status_id_str;
      if (parentId) {
        link.href = `https://x.com/${t.in_reply_to_screen_name}/status/${parentId}`;
        link.addEventListener('click', (e) => { e.preventDefault(); showPost({ site: 'x', id: parentId }); });
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
      el('div', { class: 'lb-meta' }, [extLink(postUrl(t), fmtDate(t.created_at)), stats]),
      extLink(postUrl(t), 'Open on X', { class: 'lb-open' }),
    ]));
    return parts;
  }

  // ---------- Bluesky ----------
  // Posts come from Bluesky's public AppView (app.bsky.feed.getPostThread),
  // the same unauthenticated API bsky.app's own embeds use.

  // Media carrying these labels is hidden from logged-out viewers on bsky.app,
  // so here it stays behind a click, as does all of a post labeled "!warn".
  // Posts that Bluesky's moderators hid, or whose authors asked to be hidden
  // from logged-out viewers, never get here: background.js withholds them.
  const SENSITIVE = new Set(['porn', 'sexual', 'nudity', 'graphic-media', 'gore']);

  function bskyHandle(a) {
    return a?.handle && a.handle !== 'handle.invalid' ? a.handle : a?.did;
  }
  function bskyRef(uri) {
    const m = /^at:\/\/([^/]+)\/app\.bsky\.feed\.post\/([^/]+)$/.exec(uri || '');
    return m ? { site: 'bsky', actor: m[1], rkey: m[2] } : null;
  }
  function bskyUrl(p) {
    return `https://bsky.app/profile/${bskyHandle(p.author)}/post/${bskyRef(p.uri)?.rkey}`;
  }
  // The values of the labels on a post and on its author's account. An account
  // label has the DID itself as its subject; one on the profile record covers
  // only the avatar and banner.
  function bskyLabels(p) {
    const a = p.author || {};
    return [...(p.labels || []), ...(a.labels || []).filter((l) => l.uri === a.did)].map((l) => l.val);
  }

  // Nodes behind a click: a button that is replaced by them. They are built
  // only on that click, so gated media is not even requested before it. With
  // no reason, the nodes are built and returned right away.
  function gated(reason, make) {
    if (!reason) return make();
    const b = el('button', { class: 'lb-reveal', type: 'button', text: `${reason}. Show` });
    b.addEventListener('click', () => b.replaceWith(...make().filter(Boolean)));
    return [b];
  }

  // The site a piece of link text names, if it reads as an address at all.
  function namedHost(label) {
    const text = label.trim().replace(/(\.\.\.|…)$/, '');
    if (/\s/.test(text) || !text.includes('.')) return null;
    try {
      return new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`).hostname.replace(/^www\./, '');
    } catch { return null; }
  }

  function bskyHead(p, compact) {
    const a = p.author || {};
    return renderHead({
      name: a.displayName || bskyHandle(a),
      handle: bskyHandle(a),
      avatar: (a.labels || []).some((l) => SENSITIVE.has(l.val)) ? null : a.avatar,
      profile: `https://bsky.app/profile/${bskyHandle(a)}`,
      verified: a.verification?.verifiedStatus === 'valid',
      url: bskyUrl(p),
      logo: BSKY_LOGO,
      site: 'Bluesky',
    }, compact);
  }

  // Facets index UTF-8 bytes, not characters, so the text is sliced as bytes.
  function bskyText(text, facets) {
    const bytes = new TextEncoder().encode(text || '');
    const dec = new TextDecoder();
    const out = el('div', { class: 'lb-text' });
    const sorted = (facets || []).slice().sort((a, b) => (a.index?.byteStart ?? 0) - (b.index?.byteStart ?? 0));
    let pos = 0;
    for (const f of sorted) {
      const s = f.index?.byteStart, end = f.index?.byteEnd;
      if (!(s >= pos && end > s && end <= bytes.length)) continue;
      const feat = f.features?.[0] || {};
      let href = null;
      if (feat.$type === 'app.bsky.richtext.facet#link') href = feat.uri;
      else if (feat.$type === 'app.bsky.richtext.facet#mention') href = `https://bsky.app/profile/${feat.did}`;
      else if (feat.$type === 'app.bsky.richtext.facet#tag') href = `https://bsky.app/hashtag/${encodeURIComponent(feat.tag || '')}`;
      if (!href) continue;
      if (s > pos) out.append(dec.decode(bytes.subarray(pos, s)));
      const label = dec.decode(bytes.subarray(s, end));
      out.append(extLink(href, label));
      // Link text is the author's to choose. Where it names one site and the
      // link opens another, say where it really goes, as bsky.app warns.
      if (feat.$type === 'app.bsky.richtext.facet#link') {
        const named = namedHost(label);
        let real = null;
        try { real = new URL(href).hostname.replace(/^www\./, ''); } catch { /* not linked at all */ }
        if (named && real && named !== real) out.append(el('span', { class: 'lb-goes', text: ` (opens ${real})` }));
      }
      pos = end;
    }
    if (pos < bytes.length) out.append(dec.decode(bytes.subarray(pos)));
    return out;
  }

  // Bluesky serves video only as HLS. Where the browser cannot play HLS
  // natively, show the thumbnail and link out rather than bundle a player.
  function bskyVideo(v, p) {
    const fail = () => el('div', { class: 'lb-media-fail' }, [
      'Video could not be played here. ', extLink(bskyUrl(p), 'Watch on Bluesky'),
    ]);
    const hls = document.createElement('video').canPlayType('application/vnd.apple.mpegurl');
    const ratio = v.aspectRatio?.width / v.aspectRatio?.height;
    const vid = hls ? player({ src: v.playlist, poster: v.thumbnail, gif: v.presentation === 'gif', aspect: ratio }) : null;
    if (vid) return vid;
    const poster = safeMediaUrl(v.thumbnail);
    return [poster ? img(poster, { alt: v.alt || '' }) : null, fail()];
  }

  function bskyMedia(embed, p) {
    if (embed?.$type === 'app.bsky.embed.images#view' && embed.images?.length) {
      const imgs = embed.images;
      const box = el('div', { class: `lb-media n${Math.min(imgs.length, 4)}` });
      for (const i of imgs) {
        box.append(extLink(bskyUrl(p), img(imgs.length === 1 ? i.fullsize : i.thumb, { alt: i.alt || '' })));
      }
      return box;
    }
    if (embed?.$type === 'app.bsky.embed.video#view') return el('div', { class: 'lb-media n1' }, bskyVideo(embed, p));
    if (embed?.$type === 'app.bsky.embed.recordWithMedia#view') return bskyMedia(embed.media, p);
    return null;
  }

  // Text, media, link card and quoted post, each behind a click where the
  // post's labels call for one. A quote (nested) shows only text and media.
  function bskyBody(p, embed, nested) {
    const r = p.record || {};
    const labels = bskyLabels(p);
    const x = embed?.$type === 'app.bsky.embed.external#view' ? embed.external : null;
    const media = () => [
      bskyMedia(embed, p),
      !nested && x && safeHref(x.uri) ? renderLinkCard(x.uri, x.title || x.uri, x.description, x.thumb) : null,
    ];
    const sensitive = labels.find((v) => SENSITIVE.has(v));
    const body = () => [
      bskyText(r.text, r.facets),
      ...gated(sensitive && `Media labeled “${sensitive}”`, media),
      !nested && embed?.$type === 'app.bsky.embed.record#view' ? bskyQuote(embed.record) : null,
      !nested && embed?.$type === 'app.bsky.embed.recordWithMedia#view' ? bskyQuote(embed.record?.record) : null,
    ];
    return gated(labels.includes('!warn') && 'Content warning', body);
  }

  function bskyQuote(rec) {
    if (!rec) return null;
    if (rec.$type !== 'app.bsky.embed.record#viewRecord') {
      if (!/#view(NotFound|Blocked|Detached)$/.test(rec.$type || '')) return null;
      return el('div', { class: 'lb-quote lb-quote-gone', text: 'The quoted post is unavailable.' });
    }
    if (rec.value?.$type !== 'app.bsky.feed.post') return null; // a feed, list or starter pack
    const ref = bskyRef(rec.uri);
    if (!ref) return null;
    const p = { ...rec, record: rec.value };
    return quoteBox([bskyHead(p, true), ...bskyBody(p, rec.embeds?.[0], true)], ref);
  }

  function renderBsky({ post: p, parent }) {
    const r = p.record || {};
    const parts = [bskyHead(p, false)];
    const parentRef = bskyRef(r.reply?.parent?.uri);
    if (parentRef) {
      const who = parent ? `@${bskyHandle(parent.author)}` : 'a post';
      const link = extLink(`https://bsky.app/profile/${parentRef.actor}/post/${parentRef.rkey}`, who);
      link.addEventListener('click', (e) => { e.preventDefault(); showPost(parentRef); });
      parts.push(el('div', { class: 'lb-reply' }, ['Replying to ', link]));
    }
    parts.push(...bskyBody(p, p.embed, false));

    const stats = el('div', { class: 'lb-stats' });
    for (const [n, label] of [[p.likeCount, 'likes'], [p.repostCount, 'reposts'], [p.replyCount, 'replies']]) {
      if (n != null) stats.append(el('span', { text: `${fmtNum(n)} ${label}` }));
    }
    parts.push(el('div', { class: 'lb-foot' }, [
      el('div', { class: 'lb-meta' }, [extLink(bskyUrl(p), fmtDate(r.createdAt)), stats]),
      extLink(bskyUrl(p), 'Open on Bluesky', { class: 'lb-open' }),
    ]));
    return parts;
  }

  // ---------- popup lifecycle ----------
  function friendlyError(code, ref) {
    const bsky = ref.site === 'bsky';
    const site = bsky ? 'Bluesky' : 'X';
    const url = bsky
      ? `https://bsky.app/profile/${ref.actor}/post/${ref.rkey}`
      : `https://x.com/i/web/status/${ref.id}`;
    let msg = 'This post could not be loaded.';
    if (code === 'POST_NOT_FOUND') msg = 'This post does not exist or was deleted.';
    else if (code === 'POST_UNAVAILABLE') {
      msg = bsky
        ? 'This post is unavailable (the account may be blocked, deactivated, or taken down).'
        : 'This post is unavailable to embed (it may be from a protected account, age-restricted, or removed).';
    } else if (code === 'LOGGED_IN_ONLY') msg = 'The author has asked that their posts be shown only to people signed in to Bluesky.';
    else if (code === 'HIDDEN_BY_BLUESKY') msg = 'Bluesky\'s moderators have hidden this post.';
    else if (/^HTTP_/.test(code)) msg = `${site} returned an error (${code.replace('HTTP_', 'HTTP ')}).`;
    else if (/Extension context invalidated|receiving end does not exist/i.test(code)) msg = 'Post Peek was updated. Reload this page to keep peeking.';
    return el('div', { class: 'lb-status' }, [
      el('div', { text: msg }),
      el('div', {}, extLink(url, `Open on ${site}`, { class: 'lb-open' })),
    ]);
  }

  function fetchPost(ref) {
    const msg = ref.site === 'bsky'
      ? { type: 'fetchBsky', actor: ref.actor, rkey: ref.rkey }
      : { type: 'fetchTweet', id: ref.id };
    return send(msg);
  }

  let requestToken = 0;

  async function showPost(ref) {
    ensureHost();
    if (!overlay) {
      lastFocus = document.activeElement;
      overlay = el('div', { class: 'lb-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Post preview' });
      overlay.addEventListener('click', (e) => { if (e.target === overlay) closePopup(); });
      shadow.append(overlay);
      document.addEventListener('keydown', onKey, true);
      window.addEventListener('blur', onFrameFocus);
    }
    const card = el('div', { class: 'lb-card', tabindex: '-1' });
    const close = el('button', { class: 'lb-close', type: 'button', 'aria-label': 'Close', text: '×' });
    close.addEventListener('click', closePopup);
    card.append(el('div', { class: 'lb-status' }, [el('div', { class: 'lb-spinner' }), 'Peeking…']), close);
    overlay.replaceChildren(card);
    close.focus();

    const token = ++requestToken;
    try {
      const data = await fetchPost(ref);
      if (!overlay || token !== requestToken) return;
      const parts = ref.site === 'bsky' ? renderBsky(data) : renderPost(data);
      card.replaceChildren(...parts.filter(Boolean), close);
    } catch (e) {
      if (!overlay || token !== requestToken) return;
      card.replaceChildren(friendlyError(e?.message || '', ref), close);
    }
    close.focus();
  }

  // ---------- click interception ----------
  // Once the extension is disabled, removed or updated, this script lives on in
  // open tabs but can no longer reach the service worker. chrome.runtime.id is
  // gone from then on.
  function orphaned() {
    try { return !chrome.runtime?.id; } catch { return true; }
  }

  function onClick(e) {
    // Only a real click from the user. A click the page dispatches itself must
    // neither reveal the extension nor make it fetch a post the page chose.
    if (!e.isTrusted) return;
    if (orphaned()) {
      // Step aside for good: links work normally again and the dots go.
      document.removeEventListener('click', onClick, true);
      delete document.documentElement.dataset.postpeekDots;
      closePopup();
      return;
    }
    if (!settings.enabled) return;
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    const a = e.composedPath().find((n) => n instanceof HTMLAnchorElement);
    if (!a) return;
    const ref = parseLink(a.href);
    if (!ref) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    showPost(ref);
  }
  document.addEventListener('click', onClick, true);

  // ---------- settings ----------
  function applySettings() {
    // content.css draws a dot only under html[data-postpeek-dots], so dots stay
    // invisible until the setting has actually been read. A user with dots off
    // never sees them flash, and nothing is written to the page at all.
    if (settings.showDots && settings.enabled) document.documentElement.dataset.postpeekDots = '';
    else delete document.documentElement.dataset.postpeekDots;
    applyTheme();
  }
  try {
    // Settings live in local storage only; nothing is synced to a Google account.
    chrome.storage.local.get(settings, (s) => { Object.assign(settings, s); applySettings(); });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      for (const [k, v] of Object.entries(changes)) if (k in settings && v.newValue !== undefined) settings[k] = v.newValue;
      applySettings();
    });
  } catch { /* storage unavailable */ }

})();
