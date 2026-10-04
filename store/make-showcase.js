// Builds showcase pages for store screenshots and captures them with headless Chrome.
// Usage: node store/make-showcase.js
//
// The pages inline the real content script and styles. Posts and images are
// fetched up front, here in Node, by the real src/background.js, so each
// screenshot shows exactly what the extension gets and renders.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const J = (o) => JSON.stringify(o).replace(/<\//g, '<\\/');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const W = 1280, H = 800; // the Chrome Web Store accepts 1280x800 or 640x400 only

// Runs the service worker's message listener in this process. Its cache timer
// is stubbed out so it does not keep Node alive for five minutes.
function worker() {
  let listener;
  const chrome = { runtime: { onMessage: { addListener: (f) => { listener = f; } }, onInstalled: { addListener() {} } } };
  new Function('chrome', 'setTimeout', read('src/background.js'))(chrome, () => {});
  return (msg) => new Promise((ok, fail) => listener(msg, {}, (r) => (r.ok ? ok(r.data) : fail(new Error(r.error)))));
}

// Every image a post could show, as the data: URL the service worker returns.
// The worker itself turns away anything that is not an image on a media host.
async function media(send, post, into = {}) {
  const urls = new Set();
  JSON.stringify(post, (_k, v) => { if (typeof v === 'string' && v.startsWith('https://')) urls.add(v); return v; });
  for (const url of urls) {
    try { into[url] = await send({ type: 'fetchMedia', url }); } catch { /* not media */ }
  }
  return into;
}

function page({ posts = {}, media = {}, open, body }) {
  // A scripted click is not a trusted one, which the content script rightly
  // ignores, so that one check is dropped from the copy inlined here.
  const trusted = 'if (!e.isTrusted) return;';
  const src = read('src/content.js');
  if (!src.includes(trusted)) throw new Error('content.js no longer has the isTrusted check this script removes');
  const js = src.replace(trusted, '').replace("mode: 'closed'", "mode: 'open'");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Post Peek showcase</title>
<style>
body{margin:0;font-family:Georgia,serif;background:#fafafa;color:#222}
header{background:#fff;border-bottom:1px solid #e5e5e5;padding:18px 0}
.wrap{max-width:760px;margin:0 auto;padding:0 24px}
header .wrap{display:flex;justify-content:space-between;align-items:center;font-family:system-ui,sans-serif}
header b{font-size:20px} header nav a{margin-left:18px;color:#555;text-decoration:none;font-size:14px}
h1{font-size:34px;line-height:1.2;margin:36px 0 8px}
.meta{color:#777;font-family:system-ui,sans-serif;font-size:14px;margin-bottom:24px}
p{font-size:18px;line-height:1.65;margin:0 0 20px}
a{color:#1a5fb4}
</style>
<script>
const POSTS=${J(posts)}, MEDIA=${J(media)};
window.chrome={runtime:{id:'showcase',lastError:null,sendMessage:(msg,cb)=>{setTimeout(()=>{
  const d=msg.type==='fetchMedia'?MEDIA[msg.url]:POSTS[msg.type==='fetchBsky'?msg.actor+'/'+msg.rkey:msg.id];
  cb(d?{ok:true,data:d}:{ok:false,error:'POST_NOT_FOUND'})},50)}},
storage:{local:{get:(d,cb)=>cb(Object.assign({},d,{theme:'light'})),set(){}},onChanged:{addListener(){}}}};
</script>
<script>${read('src/popup-css.js')}</script>
<style>${read('src/content.css')}</style></head><body>
<header><div class="wrap"><b>The Launch Log</b><nav><a>Rockets</a><a>Missions</a><a>Archive</a><a>About</a></nav></div></header>
<div class="wrap">${body}</div>
<script>${js}</script>
<script>
${open ? `window.addEventListener('load',()=>setTimeout(()=>{document.querySelector('a[href="${open}"]').click();
  setTimeout(()=>{const h=[...document.body.children].find((e)=>e.shadowRoot);const a=h&&h.shadowRoot.activeElement;if(a)a.blur();},400);},100));` : ''}
</script>
</body></html>`;
}

(async () => {
  const send = worker();
  const X = { id: '1732824684683784516', url: 'https://x.com/SpaceX/status/1732824684683784516' };
  const B = { actor: 'esa.int', rkey: '3mui6mrhbms26', url: 'https://bsky.app/profile/esa.int/post/3mui6mrhbms26' };

  const spacex = await send({ type: 'fetchTweet', id: X.id });
  // Show the video's poster frame as a photo so the capture isn't an unplayed player.
  const spacexPhoto = { ...spacex, video: undefined, mediaDetails: undefined, photos: [{ url: spacex.video.poster, width: 1280, height: 720 }] };
  const esa = await send({ type: 'fetchBsky', actor: B.actor, rkey: B.rkey });

  const article = `
<h1>Starship's second flight test, one year on</h1>
<div class="meta">By A. Reader · 6 min read</div>
<p>A year after the second integrated flight test, it is worth revisiting how much changed between attempts. The pad survived, the hot-stage separation worked, and both stages flew further than before.</p>
<p>SpaceX marked the morning with <a href="${X.url}">a short clip of the launch at dawn</a>, which remains one of the better views of the vehicle leaving the tower. For a reminder of where all this hardware is headed, the European Space Agency's <a href="${B.url}">helmet-camera view of Earth from a spacewalk</a> is hard to beat.</p>
<p>The flight ended early for both stages, but the data it produced shaped every test that followed. Below, we walk through the timeline and what each milestone meant for the program.</p>
<p>Booster 9 lifted off with all 33 engines running, a first for the program, and the new water-cooled steel plate under the launch mount held up without the cratering seen on the first flight.</p>`;

  const shots = [
    { name: 'screenshot-1', html: page({ posts: { [X.id]: spacexPhoto }, media: await media(send, spacexPhoto), open: X.url, body: article }) },
    { name: 'screenshot-2', html: page({ body: article }) },
    { name: 'screenshot-3', html: page({ posts: { [`${B.actor}/${B.rkey}`]: esa }, media: await media(send, esa), open: B.url, body: article }) },
  ];
  for (const s of shots) {
    const file = path.join(__dirname, `${s.name}.html`);
    fs.writeFileSync(file, s.html);
    const out = path.join(__dirname, `${s.name}.png`);
    execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--window-size=${W},${H}`,
      '--force-device-scale-factor=1', '--virtual-time-budget=8000', `--screenshot=${out}`, 'file:///' + file.replace(/\\/g, '/')], { stdio: 'ignore' });
    fs.unlinkSync(file);
    // PNG header: width and height at bytes 16 and 20, color type at 25 (2 = RGB, no alpha).
    const png = fs.readFileSync(out);
    const [w, h, type] = [png.readUInt32BE(16), png.readUInt32BE(20), png[25]];
    console.log(out, png.length, 'bytes', `${w}x${h}`, type === 2 ? 'RGB' : `color type ${type}`);
    if (w !== W || h !== H) throw new Error(`${s.name}.png is ${w}x${h}, not ${W}x${H}`);
  }
})();
