// Dependency-free tests for the packaged extension, run with `npm test`
// (node --test). They assert the invariants the privacy claims in PRIVACY.md
// and store/LISTING.md rest on, plus the packaging rules the Chrome Web Store
// enforces at upload time.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
// Line endings are normalized so the source-matching below also holds in a
// checkout that Git converted to CRLF (core.autocrlf=true on Windows).
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('package.json'));
const contentJs = read('src/content.js');
const contentCss = read('src/content.css');
const backgroundJs = read('src/background.js');
const { toFirefoxManifest } = require('../scripts/firefox-manifest');
const firefoxManifest = toFirefoxManifest(manifest);

const MEDIA_HOSTS = [
  'pbs.twimg.com', 'video.twimg.com',
  'cdn.bsky.app', 'video.bsky.app', 'video.cdn.bsky.app',
];
const PREFIXES = ['', 'www.', 'mobile.', 'm.'];
const DOMAINS = ['x.com', 'twitter.com', 'fxtwitter.com', 'vxtwitter.com', 'fixupx.com', 'fixvx.com'];

// ----------------------------------------------------------------- helpers

// Pull a named function's source out of a file so it can be exercised
// directly. Fails loudly if the guard is renamed or removed.
function extractFn(src, name) {
  const start = src.indexOf(`function ${name}(`);
  assert.notStrictEqual(start, -1, `expected a function named ${name}`);
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`unbalanced braces in ${name}`);
}

function evalExpr(src, re, label) {
  const m = src.match(re);
  assert.ok(m, `could not find ${label}`);
  return new Function(`return ${m[1]}`)();
}

const POST_RE = evalExpr(contentJs, /const POST_RE\s*=\s*([\s\S]*?);\n/, 'POST_RE');

// parseLink with both sites' patterns, run as-is.
const { parseLink } = new Function(`
  ${contentJs.match(/const POST_RE\s*=[\s\S]*?;\n/)[0]}
  ${contentJs.match(/const BSKY_RE\s*=[\s\S]*?;\n/)[0]}
  ${contentJs.match(/const BSKY_ACTOR_RE\s*=.*;\n/)[0]}
  ${extractFn(contentJs, 'parseLink')}
  return { parseLink };
`)();

// The X hosts the dot rule names, one per https:// selector.
const dottedHosts = () => [...contentCss.matchAll(/href\^="https:\/\/([^"/]+)\/"/g)].map((m) => m[1]);

// A function's source by indentation, for the ones extractFn cannot cut
// because their parameter list has braces of its own.
function sliceFn(src, name) {
  const start = src.indexOf(`function ${name}(`);
  assert.notStrictEqual(start, -1, `expected a function named ${name}`);
  return src.slice(start, src.indexOf('\n  }\n', start) + 4);
}

// The real service worker, run against a stubbed fetch. Timers are collected
// rather than started, so a test can fire them by hand.
function loadBackground(fetchStub) {
  const timers = [];
  const listener = { addListener() {} };
  const chrome = { runtime: { onMessage: listener, onInstalled: listener } };
  const api = new Function('chrome', 'fetch', 'setTimeout', `${backgroundJs}
    return { fetchTweet, fetchBsky, fetchMedia, cache, CACHE_TTL };`)(chrome, fetchStub, (fn, ms) => timers.push({ fn, ms }));
  return { ...api, timers };
}

const jsonResponse = (body) => ({
  ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body),
});

// safeHref and safeMediaUrl only touch URL and Set, so they run as-is.
const guards = new Function(`
  ${contentJs.match(/const MEDIA_HOSTS = new Set\(\[[^\]]*\]\);/)[0]}
  ${extractFn(contentJs, 'safeHref')}
  ${extractFn(contentJs, 'safeMediaUrl')}
  return { safeHref, safeMediaUrl, MEDIA_HOSTS };
`)();

// ---------------------------------------------------------------- manifest

test('manifest version matches package.json', () => {
  assert.strictEqual(manifest.version, pkg.version);
});

// The Web Store rejects the upload above 132. This shipped broken through v1.1.1.
test('manifest description fits the 132-character limit', () => {
  assert.ok(
    manifest.description.length <= 132,
    `description is ${manifest.description.length} chars`,
  );
});

test('manifest asks for only the declared permissions', () => {
  assert.deepStrictEqual(manifest.permissions, ['storage']);
  assert.deepStrictEqual(manifest.host_permissions.slice().sort(), [
    'https://cdn.syndication.twimg.com/*',
    'https://pbs.twimg.com/*',
    'https://video.twimg.com/*',
    'https://public.api.bsky.app/*',
    'https://cdn.bsky.app/*',
    'https://video.bsky.app/*',
    'https://video.cdn.bsky.app/*',
  ].sort());
});

// A web-accessible resource gives any site a chrome-extension:// URL to probe.
test('no web-accessible resources', () => {
  assert.ok(!('web_accessible_resources' in manifest));
});

test('content scripts load popup-css.js first, at document_start', () => {
  const cs = manifest.content_scripts[0];
  assert.deepStrictEqual(cs.js, ['src/popup-css.js', 'src/content.js']);
  // document_start is what keeps the dot setting ahead of first paint.
  assert.strictEqual(cs.run_at, 'document_start');
  assert.strictEqual(cs.all_frames, false);
  for (const host of ['https://x.com/*', 'https://twitter.com/*', 'https://bsky.app/*']) {
    assert.ok(cs.exclude_matches.includes(host), `should not run on ${host}`);
  }
  assert.ok(!cs.matches.some((m) => m.startsWith('file://')), 'must not run on file://');
});

test('every file the manifest references exists', () => {
  const cs = manifest.content_scripts[0];
  const refs = new Set([
    ...Object.values(manifest.icons),
    manifest.background.service_worker,
    ...firefoxManifest.background.scripts,
    ...cs.js,
    ...cs.css,
    manifest.options_ui.page,
    manifest.action.default_popup,
  ]);
  for (const f of refs) {
    assert.ok(fs.existsSync(path.join(root, f)), `missing ${f}`);
  }
});

// ---------------------------------------------------------------- firefox

// The Firefox zip is the Chrome zip with only the manifest rewritten, and the
// rewrite must touch nothing but the background key and the gecko block.
test('the Firefox manifest differs from Chrome only where Firefox requires', () => {
  assert.deepStrictEqual(firefoxManifest.background, { scripts: [manifest.background.service_worker] });
  assert.ok(!('service_worker' in firefoxManifest.background), 'Firefox has no service workers');

  const gecko = firefoxManifest.browser_specific_settings.gecko;
  assert.match(gecko.id, /^[^@\s]+@[^@\s]+$/, 'gecko.id must be email-shaped');
  assert.match(gecko.strict_min_version, /^\d+\.\d+$/);
  assert.ok(Number(gecko.strict_min_version) >= 127, 'MV3 host permissions are install-time only from Firefox 127');
  // AMO requires this for new submissions; "none" is the claim PRIVACY.md makes.
  assert.deepStrictEqual(gecko.data_collection_permissions, { required: ['none'] });

  const rest = { ...firefoxManifest };
  delete rest.background;
  delete rest.browser_specific_settings;
  const chromeRest = { ...manifest };
  delete chromeRest.background;
  assert.deepStrictEqual(rest, chromeRest);
});

test('the Chrome manifest carries no Firefox-only keys', () => {
  assert.ok(!('browser_specific_settings' in manifest));
  assert.ok(!('scripts' in manifest.background));
});

// Firefox before 153 throws on adoptedStyleSheets from a content script, so
// the popup must fall back to a <style> in the closed shadow root.
test('popup styling falls back to a <style> when adoptedStyleSheets throws', () => {
  const fn = extractFn(contentJs, 'ensureHost');
  assert.match(fn, /try\s*\{[^}]*adoptedStyleSheets[^}]*\}\s*catch/);
  assert.match(fn, /el\('style', \{ text: POST_PEEK_CSS \}\)/);
});

// -------------------------------------------------------------- dot marker

// Dots must be opt-in: the rule may only apply once content.js has read the
// setting, or a user with dots off sees them flash on every page load.
test('dot rule is gated on the opt-in attribute', () => {
  assert.match(contentCss, /html\[data-postpeek-dots\]/);
  assert.ok(
    !/:not\(\[data-postpeek-nodots\]\)/.test(contentCss),
    'the dots-off polarity reintroduces the load flash',
  );
});

test('every host the click handler peeks is dotted, and no others', () => {
  const dotted = dottedHosts().sort();
  const peekable = [];
  for (const p of PREFIXES) {
    for (const d of DOMAINS) {
      if (POST_RE.test(`https://${p}${d}/jack/status/20`)) peekable.push(p + d);
    }
  }
  assert.deepStrictEqual(dotted, peekable.sort());
  // Each host is also dotted over http and in scheme-relative links, which the
  // click handler peeks just the same.
  for (const host of dotted) {
    for (const scheme of ['http:', '']) {
      assert.ok(contentCss.includes(`[href^="${scheme}//${host}/"]`), `no ${scheme}// dot for ${host}`);
    }
  }
});

// A substring match would dot https://evil.com/?u=https://x.com/a/status/1,
// which the click handler does not peek.
test('hosts are matched only at the start of the href', () => {
  assert.ok(!/href\*="[^"]*\/\/[^"]*"/.test(contentCss), 'a host is matched as a substring');
});

// test.html is how the dot list is checked by hand in a real browser, so it has
// to keep up with the hosts. v1.1.3 shipped a dot list that had drifted; the
// page could not have caught it, because it never linked to m.x.com.
test('test.html links to every dotted host', () => {
  const page = read('test.html');
  for (const host of dottedHosts()) {
    assert.ok(
      page.includes(`href="https://${host}/jack/status/20"`),
      `test.html has no peekable link for ${host}`,
    );
  }
});

test('POST_RE matches post links and rejects everything else', () => {
  for (const url of [
    'https://x.com/jack/status/20',
    'https://m.x.com/jack/status/20',
    'https://twitter.com/NASA/statuses/123',
    'https://x.com/i/web/status/20',
    'https://x.com/jack/status/20?s=20',
  ]) assert.ok(POST_RE.test(url), `should peek ${url}`);

  for (const url of [
    'https://x.com/jack',
    'https://example.com/status/123',
    'https://notx.com/a/status/1',
    'https://x.com.evil.com/a/status/1',
    'javascript:alert(1)',
  ]) assert.ok(!POST_RE.test(url), `should not peek ${url}`);
});

test('parseLink reads Bluesky post links and rejects everything else', () => {
  const did = 'did:plc:z72i7hdynmk6r22z27h6tvur';
  const rkey = '3l6oveex3ii2l';
  assert.deepStrictEqual(parseLink(`https://bsky.app/profile/bsky.app/post/${rkey}`),
    { site: 'bsky', actor: 'bsky.app', rkey });
  assert.deepStrictEqual(parseLink(`https://bsky.app/profile/${did}/post/${rkey}?x=1`),
    { site: 'bsky', actor: did, rkey });
  assert.deepStrictEqual(parseLink(`https://bsky.app/profile/${encodeURIComponent(did)}/post/${rkey}`),
    { site: 'bsky', actor: did, rkey });
  assert.deepStrictEqual(parseLink('https://x.com/jack/status/20'), { site: 'x', id: '20' });

  for (const url of [
    'https://bsky.app/profile/bsky.app',
    'https://bsky.app/profile/bsky.app/feed/whats-hot',
    'https://bsky.app/profile/bsky.app/post/',
    `https://bsky.app.evil.com/profile/a.b/post/${rkey}`,
    `https://notbsky.app/profile/a.b/post/${rkey}`,
    `https://bsky.app/profile/a%2Fb/post/${rkey}`, // decodes to a slash
    `https://bsky.app/profile/a%ZZ/post/${rkey}`,  // malformed escape
  ]) assert.strictEqual(parseLink(url), null, `should not peek ${url}`);
});

test('Bluesky post links are dotted, and test.html has one', () => {
  assert.ok(contentCss.includes(
    'a:is([href^="https://bsky.app/profile/"], [href^="http://bsky.app/profile/"])[href*="/post/"]::after',
  ), 'content.css has no Bluesky dot rule matching BSKY_RE');
  assert.ok(read('test.html').includes('href="https://bsky.app/profile/bsky.app/post/3l6oveex3ii2l"'),
    'test.html has no peekable Bluesky link');
});

test('the service worker checks Bluesky links with the same patterns', () => {
  const actor = (src) => evalExpr(src, /const BSKY_ACTOR_RE\s*=\s*(.*);\n/, 'BSKY_ACTOR_RE');
  assert.strictEqual(actor(backgroundJs).source, actor(contentJs).source);
  // The record key in BSKY_RE uses exactly the background's character class.
  const rkey = evalExpr(backgroundJs, /const BSKY_RKEY_RE\s*=\s*(.*);\n/, 'BSKY_RKEY_RE');
  const bskyRe = evalExpr(contentJs, /const BSKY_RE\s*=\s*([\s\S]*?);\n/, 'BSKY_RE');
  assert.ok(bskyRe.source.includes(`\\/post\\/(${rkey.source.slice(1, -1)})`),
    'BSKY_RE and BSKY_RKEY_RE accept different record keys');
});

// ----------------------------------------------------------------- video

// A <video> in the page would hand the video host the page's address (Referer),
// its origin (the Origin header crossorigin adds) or the user's cookies. Every
// player must be the sandboxed, no-referrer, cookie-free frame player() builds.
test('videos play only inside the sandboxed no-referrer frame', () => {
  const player = sliceFn(contentJs, 'player');
  assert.ok(player.includes('safeMediaUrl(src)'), 'player() must check the video host');
  // allow-scripts only for GIFs, whose autoplay the sandbox would otherwise block.
  assert.match(player, /el\('iframe', \{[^}]*sandbox: gif \? 'allow-scripts' : ''/, 'the frame must be sandboxed');
  assert.ok(!/<script/i.test(player), 'the frame document must not carry a script');
  assert.ok(player.includes('<meta name="referrer" content="no-referrer">'), 'the frame needs a no-referrer policy');
  assert.match(player, /<video [^>]*crossorigin="anonymous"/, 'the video must be requested without cookies');
  assert.ok(player.includes('preload="none"'), 'video must not load before play is pressed');
  // allow-same-origin would give the frame the page's origin back, and with it
  // the Origin header this frame exists to avoid.
  const code = contentJs.replace(/^\s*\/\/.*$/gm, '');
  assert.deepStrictEqual(code.match(/allow-[a-z-]+/g), ['allow-scripts'], 'the player sandbox was loosened');

  // No <video> may be built any other way. The one createElement('video') is
  // the detached canPlayType probe, which never gets a source.
  const outside = contentJs.replace(player, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/<video/.test(outside), 'video markup is built outside player()');
  assert.ok(!/el\('video'/.test(contentJs), 'a <video> is built outside player()');
  const made = contentJs.match(/createElement(?:NS)?\([^)]*video[^)]*\)[^;\n]*/g) || [];
  assert.strictEqual(made.length, 1, 'a <video> is created outside player()');
  assert.match(made[0], /^createElement\('video'\)\.canPlayType\(/);
  assert.ok(!/\.(?:innerHTML|outerHTML)\b|insertAdjacentHTML|document\.write/.test(contentJs),
    'markup is parsed somewhere a <video> could hide');
  assert.strictEqual((contentJs.match(/\.srcdoc\s*=/g) || []).length, 1, 'srcdoc is set outside player()');
});

// ----------------------------------------------------------------- images

// An <img> pointed at a media host from the page sends cookies, or with
// crossorigin="anonymous" the page's origin. Images are fetched by the service
// worker and shown from the data: URL it returns, and nothing else.
test('images load only through the service worker', () => {
  const img = sliceFn(contentJs, 'img');
  assert.strictEqual((contentJs.match(/el\('img'/g) || []).length, 1, 'an <img> is built outside img()');
  assert.ok(img.includes("el('img'"));
  assert.ok(img.includes("send({ type: 'fetchMedia', url: safe })"), 'img() must fetch through the service worker');
  assert.ok(!/src:|setAttribute/.test(img), 'img() gives the image a source of its own');
  // The only source any element is ever given is the proxied data: URL.
  assert.deepStrictEqual(contentJs.match(/\.src\s*=[^=][^;]*/g), ['.src = data']);
  assert.ok(!/createElement\('img'\)|new Image\(/.test(contentJs), 'an image is created outside img()');

  // Behavior: nothing is requested for a host off the allowlist, and the
  // element only ever gets what the service worker returned.
  const run = (answer) => {
    const sent = [];
    const node = {};
    const fn = new Function('el', 'send', 'safeMediaUrl', `${img}; return img;`)(
      (tag) => (tag === 'img' ? node : { tag }),
      (msg) => { sent.push(msg); return answer; },
      guards.safeMediaUrl,
    );
    return { fn, sent, node };
  };
  const ok = run(Promise.resolve('data:image/png;base64,AAAA'));
  assert.strictEqual(ok.fn('https://pbs.twimg.com/media/a.jpg'), ok.node);
  assert.deepStrictEqual(ok.sent, [{ type: 'fetchMedia', url: 'https://pbs.twimg.com/media/a.jpg' }]);
  assert.ok(!('src' in ok.node), 'the image has a source before the service worker answered');
  const bad = run(Promise.resolve('x'));
  assert.deepStrictEqual(bad.fn('https://evil.com/a.jpg'), { tag: 'span' });
  assert.deepStrictEqual(bad.sent, []);
  return ok.sent.length && Promise.resolve().then(() => {
    assert.strictEqual(ok.node.src, 'data:image/png;base64,AAAA');
  });
});

// Media behind a "Show" button must not be built, and so not fetched, until
// the button is pressed.
test('gated media is not built before the click', () => {
  let click = null;
  const button = { addEventListener: (_, fn) => { click = fn; }, replaceWith(...n) { this.shown = n; } };
  const gated = new Function('el', `${extractFn(contentJs, 'gated')}; return gated;`)(() => button);
  let built = 0;
  const make = () => { built++; return ['media', null]; };
  assert.deepStrictEqual(gated('Content warning', make), [button]);
  assert.strictEqual(built, 0, 'gated nodes were built before the click');
  click();
  assert.strictEqual(built, 1);
  assert.deepStrictEqual(button.shown, ['media']);
  assert.deepStrictEqual(gated(false, make), ['media', null]);
});

// ------------------------------------------------------------ click handler

function clickHarness({ orphaned = false, enabled = true } = {}) {
  class Anchor { constructor(href) { this.href = href; } }
  const calls = { shown: [], removed: 0, closed: 0 };
  const document = {
    documentElement: { dataset: { postpeekDots: '' } },
    removeEventListener: () => { calls.removed++; },
  };
  const onClick = new Function(
    'settings', 'parseLink', 'showPost', 'orphaned', 'closePopup', 'document', 'HTMLAnchorElement',
    `${extractFn(contentJs, 'onClick')}; return onClick;`,
  )({ enabled }, parseLink, (ref) => calls.shown.push(ref), () => orphaned, () => { calls.closed++; }, document, Anchor);
  const click = (over = {}) => {
    const e = {
      isTrusted: true, button: 0, prevented: false, stopped: false,
      composedPath: () => [new Anchor('https://x.com/jack/status/20')],
      preventDefault() { this.prevented = true; },
      stopImmediatePropagation() { this.stopped = true; },
      ...over,
    };
    onClick(e);
    return e;
  };
  return { click, calls, document };
}

test('a real click on a post link opens the popup', () => {
  const { click, calls } = clickHarness();
  const e = click();
  assert.ok(e.prevented && e.stopped);
  assert.deepStrictEqual(calls.shown, [{ site: 'x', id: '20' }]);
  assert.ok(!click({ ctrlKey: true }).prevented, 'a modified click must open the link normally');
});

// A page can dispatch a click itself. If the handler answered, any site could
// detect the extension (even with dots off) and make it fetch a post it chose.
test('clicks the page fakes are ignored', () => {
  const { click, calls } = clickHarness();
  const e = click({ isTrusted: false });
  assert.ok(!e.prevented && !e.stopped, 'a synthetic click was intercepted');
  assert.deepStrictEqual(calls.shown, []);
});

// After the extension is disabled, removed or updated, the old content script
// is still in every open tab. It must hand the links back.
test('an orphaned content script stops intercepting links', () => {
  const { click, calls, document } = clickHarness({ orphaned: true });
  const e = click();
  assert.ok(!e.prevented, 'a link was swallowed after the extension went away');
  assert.deepStrictEqual(calls.shown, []);
  assert.strictEqual(calls.removed, 1, 'the click listener must be removed');
  assert.ok(!('postpeekDots' in document.documentElement.dataset), 'the dots must go');
  assert.match(extractFn(contentJs, 'orphaned'), /chrome\.runtime\?\.id/);
});

// The popup host is appended to <body>. A page that replaces its <body> takes
// the host with it, and the next popup would render into a detached tree.
test('the popup host is re-attached if the page dropped it', () => {
  assert.match(extractFn(contentJs, 'ensureHost'), /if \(!host\.isConnected\)[^;]*appendChild\(host\)/);
});

// ------------------------------------------------------------------- text

test('X post text is unescaped after it is cut', () => {
  const unescapeX = new Function(`${extractFn(contentJs, 'unescapeX')}; return unescapeX;`)();
  assert.strictEqual(unescapeX('R&amp;D &lt;3 a &gt; b'), 'R&D <3 a > b');
  assert.strictEqual(unescapeX('&amp;lt;'), '&lt;', 'text must be unescaped once, not twice');
  // Entity indices count the escaped text, so slices are cut first.
  const renderText = extractFn(contentJs, 'renderText');
  assert.strictEqual((renderText.match(/out\.append\(unescapeX\(chars\.slice\(/g) || []).length, 2);
});

test('Bluesky link text naming another site is detected', () => {
  const namedHost = new Function(`${extractFn(contentJs, 'namedHost')}; return namedHost;`)();
  assert.strictEqual(namedHost('example.com/a/long/pa...'), 'example.com');
  assert.strictEqual(namedHost('https://www.example.com/x'), 'example.com');
  assert.strictEqual(namedHost('read this'), null);
  assert.strictEqual(namedHost('here'), null);
  assert.ok(extractFn(contentJs, 'bskyText').includes('named !== real'));
});

// --------------------------------------------------------------- url guards

test('media is restricted to the declared hosts', () => {
  assert.deepStrictEqual([...guards.MEDIA_HOSTS].sort(), MEDIA_HOSTS.slice().sort());

  for (const url of [
    'https://pbs.twimg.com/media/a.jpg',
    'https://video.twimg.com/v/a.mp4',
    'https://cdn.bsky.app/img/avatar/plain/did:plc:a/b',
    'https://video.bsky.app/watch/did%3Aplc%3Aa/b/playlist.m3u8',
  ]) assert.ok(guards.safeMediaUrl(url), `should allow ${url}`);

  for (const url of [
    'http://pbs.twimg.com/media/a.jpg',      // must be https
    'https://abs.twimg.com/a.png',           // dropped from host_permissions
    'https://evil.com/a.jpg',
    'https://pbs.twimg.com.evil.com/a.jpg',  // suffix trick
    'https://bsky.app/img/a.jpg',            // not a media host
    'https://evil.com/?x=pbs.twimg.com',
    'data:image/png;base64,AAAA',
    'javascript:alert(1)',
    undefined,
  ]) assert.strictEqual(guards.safeMediaUrl(url), null, `should block ${url}`);
});

test('links allow any http(s) target but no other scheme', () => {
  assert.ok(guards.safeHref('https://example.com/a'));
  assert.ok(guards.safeHref('http://example.com/a'));
  for (const url of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', undefined]) {
    assert.strictEqual(guards.safeHref(url), null, `should reject ${url}`);
  }
});

// ---------------------------------------------------------------- service worker

test('the proxy enforces the same media allowlist', () => {
  const bg = evalExpr(
    backgroundJs,
    /const MEDIA_HOSTS = new Set\((\[[^\]]*\])\)/,
    'background MEDIA_HOSTS',
  );
  assert.deepStrictEqual(bg.slice().sort(), MEDIA_HOSTS.slice().sort());
});

test('withheld Bluesky posts never reach the page', () => {
  const { bskyWithheld, withholdQuote } = new Function(`
    ${extractFn(backgroundJs, 'bskyWithheld')}
    ${extractFn(backgroundJs, 'withholdQuote')}
    return { bskyWithheld, withholdQuote };
  `)();
  const did = 'did:plc:a';
  const post = (author = [], own = []) => ({ author: { did, labels: author }, labels: own });

  assert.strictEqual(bskyWithheld(post()), null);
  assert.strictEqual(bskyWithheld(post([{ val: '!no-unauthenticated', uri: `at://${did}/app.bsky.actor.profile/self` }])), 'LOGGED_IN_ONLY');
  assert.strictEqual(bskyWithheld(post([], [{ val: '!hide' }])), 'HIDDEN_BY_BLUESKY');
  assert.strictEqual(bskyWithheld(post([{ val: '!hide', uri: did }])), 'HIDDEN_BY_BLUESKY');
  // A label on the profile record alone covers the avatar, not the posts.
  assert.strictEqual(bskyWithheld(post([{ val: '!hide', uri: `at://${did}/app.bsky.actor.profile/self` }])), null);

  const hidden = { $type: 'app.bsky.embed.record#viewRecord', uri: 'at://x/y/z', ...post([], [{ val: '!hide' }]) };
  for (const embed of [
    { $type: 'app.bsky.embed.record#view', record: { ...hidden } },
    { $type: 'app.bsky.embed.recordWithMedia#view', record: { record: { ...hidden } } },
  ]) {
    const out = withholdQuote({ embed });
    const rec = out.embed.record.record || out.embed.record;
    assert.strictEqual(rec.$type, 'app.bsky.embed.record#viewNotFound');
    assert.ok(!('author' in rec), 'the withheld quote still carries its author');
  }
});

// The helpers above are only worth something if fetchBsky uses them, so this
// runs the real function against the API responses that must be withheld.
test('fetchBsky withholds posts, parents and quotes the API returned', async () => {
  const did = 'did:plc:a';
  const hide = [{ val: '!hide' }];
  const post = (over = {}) => ({ uri: `at://${did}/app.bsky.feed.post/1`, author: { did, labels: [] }, labels: [], ...over });
  const fetchThread = (thread) => loadBackground(async () => jsonResponse({ thread })).fetchBsky(did, '1');

  await assert.rejects(fetchThread({ post: post({ labels: hide }) }), /HIDDEN_BY_BLUESKY/);
  await assert.rejects(
    fetchThread({ post: post({ author: { did, labels: [{ val: '!no-unauthenticated' }] } }) }),
    /LOGGED_IN_ONLY/,
  );

  const quoted = { $type: 'app.bsky.embed.record#viewRecord', ...post({ labels: hide }) };
  const out = await fetchThread({
    post: post({ embed: { $type: 'app.bsky.embed.record#view', record: quoted } }),
    parent: { post: post({ labels: hide }) },
  });
  assert.strictEqual(out.parent, null, 'a hidden parent reached the page');
  assert.strictEqual(out.post.embed.record.$type, 'app.bsky.embed.record#viewNotFound');
  assert.ok(!JSON.stringify(out).includes('!hide'), 'withheld content is still in the response');

  const shown = await fetchThread({ post: post(), parent: { post: post() } });
  assert.ok(shown.post && shown.parent, 'an ordinary post and parent must come through');
});

// PRIVACY.md promises posts are kept for at most five minutes. An expired
// entry has to be dropped, not just skipped on the next lookup.
test('cached posts are evicted when they expire', async () => {
  const did = 'did:plc:a';
  let requests = 0;
  const bg = loadBackground(async () => {
    requests++;
    return jsonResponse({ thread: { post: { uri: `at://${did}/app.bsky.feed.post/1`, author: { did } } } });
  });
  await bg.fetchBsky(did, '1');
  await bg.fetchBsky(did, '1');
  assert.strictEqual(requests, 1, 'a fresh entry should be served from the cache');
  assert.strictEqual(bg.cache.size, 1);
  assert.deepStrictEqual(bg.timers.map((t) => t.ms), [bg.CACHE_TTL]);
  assert.strictEqual(bg.CACHE_TTL, 5 * 60 * 1000);
  bg.timers[0].fn();
  assert.strictEqual(bg.cache.size, 0, 'the entry outlived its five minutes');
  // Nothing may enter the cache except through remember(), which sets the timer.
  assert.strictEqual((backgroundJs.match(/cache\.set\(/g) || []).length, 1);
});

test('the media proxy returns only images, from the allowlist, uncached', async () => {
  const image = (url, type = 'image/jpeg') => ({
    ok: true, status: 200, url, headers: { get: () => type }, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
  });
  const seen = [];
  const bg = loadBackground(async (url, init) => { seen.push({ url, init }); return image(url); });
  assert.strictEqual(await bg.fetchMedia('https://pbs.twimg.com/media/a.jpg'), 'data:image/jpeg;base64,AQID');
  assert.deepStrictEqual(seen[0].init, { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' });

  await assert.rejects(bg.fetchMedia('https://evil.com/a.jpg'), /BAD_HOST/);
  assert.strictEqual(seen.length, 1, 'a host off the allowlist was contacted');
  const redirected = loadBackground(async () => image('https://evil.com/a.jpg'));
  await assert.rejects(redirected.fetchMedia('https://pbs.twimg.com/media/a.jpg'), /BAD_HOST/);
  const video = loadBackground(async (url) => image(url, 'video/mp4'));
  await assert.rejects(video.fetchMedia('https://video.twimg.com/a.mp4'), /NOT_AN_IMAGE/);
});

test('settings live in local storage, sync only for the one-time migration', () => {
  assert.ok(!/storage\.sync/.test(contentJs), 'content.js must not touch storage.sync');
  assert.ok(!/storage\.sync/.test(read('options/options.js')), 'options must not touch storage.sync');
  // background.js may read sync exactly to migrate off it.
  assert.match(backgroundJs, /storage\.sync\.clear\(\)/);
});

test('every request is made without cookies, a Referer or the disk cache', () => {
  const count = (re) => (backgroundJs.match(re) || []).length;
  const fetches = count(/\bfetch\(/g);
  assert.ok(fetches >= 3, 'expected at least the X post, Bluesky post and media fetches');
  // Every fetch in the service worker must carry both options, so a new one
  // cannot be added without them.
  assert.strictEqual(count(/credentials: 'omit'/g), fetches, 'a fetch is missing credentials: omit');
  assert.strictEqual(count(/referrerPolicy: 'no-referrer'/g), fetches, 'a fetch is missing no-referrer');
  // PRIVACY.md says the extension writes nothing to disk; that includes
  // Chrome's HTTP cache.
  assert.strictEqual(count(/cache: 'no-store'/g), fetches, 'a fetch may be written to the disk cache');
});

// -------------------------------------------------------------- store listing

// store/LISTING.md is pasted into the Developer Dashboard by hand. It went a
// whole feature (Bluesky, four host permissions) without being updated.
test('the store listing keeps up with the manifest', () => {
  const listing = read('store/LISTING.md');
  assert.ok(listing.includes(`\n${manifest.description}\n`), 'the summary is not the manifest description');
  const justification = listing.slice(listing.indexOf('### Host permission justification'), listing.indexOf('### Are you using remote code?'));
  for (const perm of manifest.host_permissions) {
    const host = new URL(perm.replace('/*', '/')).hostname;
    assert.ok(justification.includes(host), `the listing does not justify ${host}`);
  }
  for (const host of manifest.content_scripts[0].exclude_matches) {
    const name = new URL(host.replace('*.', '').replace('/*', '/')).hostname;
    assert.ok(listing.includes(name), `the listing does not mention ${name}`);
  }
});

// ------------------------------------------------------------------ changelog

test('the changelog has an entry for the shipping version', () => {
  const changelog = read('CHANGELOG.md');
  assert.ok(
    changelog.includes(`## [${manifest.version}]`),
    `CHANGELOG.md has no section for ${manifest.version}`,
  );
});
