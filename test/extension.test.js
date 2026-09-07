// Dependency-free tests for the packaged extension, run with `npm test`
// (node --test). They assert the invariants the privacy claims in PRIVACY.md
// and store/LISTING.md rest on, plus the packaging rules the Chrome Web Store
// enforces at upload time.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('package.json'));
const contentJs = read('src/content.js');
const contentCss = read('src/content.css');
const backgroundJs = read('src/background.js');

const MEDIA_HOSTS = ['pbs.twimg.com', 'video.twimg.com'];
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
  ]);
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
  for (const host of ['https://x.com/*', 'https://twitter.com/*']) {
    assert.ok(cs.exclude_matches.includes(host), `should not run on ${host}`);
  }
  assert.ok(!cs.matches.some((m) => m.startsWith('file://')), 'must not run on file://');
});

test('every file the manifest references exists', () => {
  const cs = manifest.content_scripts[0];
  const refs = new Set([
    ...Object.values(manifest.icons),
    manifest.background.service_worker,
    ...cs.js,
    ...cs.css,
    manifest.options_ui.page,
    manifest.action.default_popup,
  ]);
  for (const f of refs) {
    assert.ok(fs.existsSync(path.join(root, f)), `missing ${f}`);
  }
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
  const dotted = [...contentCss.matchAll(/href\*="\/\/([^"]+)\/"/g)].map((m) => m[1]).sort();
  const peekable = [];
  for (const p of PREFIXES) {
    for (const d of DOMAINS) {
      if (POST_RE.test(`https://${p}${d}/jack/status/20`)) peekable.push(p + d);
    }
  }
  assert.deepStrictEqual(dotted, peekable.sort());
});

// test.html is how the dot list is checked by hand in a real browser, so it has
// to keep up with the hosts. v1.1.3 shipped a dot list that had drifted; the
// page could not have caught it, because it never linked to m.x.com.
test('test.html links to every dotted host', () => {
  const page = read('test.html');
  const dotted = [...contentCss.matchAll(/href\*="\/\/([^"]+)\/"/g)].map((m) => m[1]);
  for (const host of dotted) {
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

// --------------------------------------------------------------- url guards

test('media is restricted to the declared hosts', () => {
  assert.deepStrictEqual([...guards.MEDIA_HOSTS].sort(), MEDIA_HOSTS.slice().sort());

  for (const url of [
    'https://pbs.twimg.com/media/a.jpg',
    'https://video.twimg.com/v/a.mp4',
  ]) assert.ok(guards.safeMediaUrl(url), `should allow ${url}`);

  for (const url of [
    'http://pbs.twimg.com/media/a.jpg',      // must be https
    'https://abs.twimg.com/a.png',           // dropped from host_permissions
    'https://evil.com/a.jpg',
    'https://pbs.twimg.com.evil.com/a.jpg',  // suffix trick
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

test('settings live in local storage, sync only for the one-time migration', () => {
  assert.ok(!/storage\.sync/.test(contentJs), 'content.js must not touch storage.sync');
  assert.ok(!/storage\.sync/.test(read('options/options.js')), 'options must not touch storage.sync');
  // background.js may read sync exactly to migrate off it.
  assert.match(backgroundJs, /storage\.sync\.clear\(\)/);
});

test('every request is made without cookies or a Referer', () => {
  const count = (re) => (backgroundJs.match(re) || []).length;
  const fetches = count(/\bfetch\(/g);
  assert.ok(fetches >= 2, 'expected at least the post and media fetches');
  // Every fetch in the service worker must carry both options, so a new one
  // cannot be added without them.
  assert.strictEqual(count(/credentials: 'omit'/g), fetches, 'a fetch is missing credentials: omit');
  assert.strictEqual(count(/referrerPolicy: 'no-referrer'/g), fetches, 'a fetch is missing no-referrer');
});
