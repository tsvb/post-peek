// Builds showcase pages for store screenshots and captures them with headless Chrome.
// Usage: node store/make-showcase.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');
const tok = (id) => ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
const J = (o) => JSON.stringify(o).replace(/<\//g, '<\\/');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

async function get(id) {
  const r = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=en&token=${tok(id)}`);
  return JSON.parse(await r.text());
}

function page({ data, theme, autoOpen, body }) {
  const css = fs.readFileSync(path.join(root, 'src/popup.css'), 'utf8');
  const ccss = fs.readFileSync(path.join(root, 'src/content.css'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'src/content.js'), 'utf8').replace("mode: 'closed'", "mode: 'open'");
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
const DATA=${J(data)};
window.chrome={runtime:{getURL:(p)=>'chrome-extension://stub/'+p,lastError:null,sendMessage:(msg,cb)=>{setTimeout(()=>{const d=DATA[msg.id];cb(d?{ok:true,data:d}:{ok:false,error:'POST_NOT_FOUND'})},50)}},
storage:{sync:{get:(d,cb)=>cb(Object.assign({},d,{theme:${JSON.stringify(theme)}})),set(){}},onChanged:{addListener(){}}}};
const CSS=${J(css)};const _f=window.fetch;window.fetch=(u,...a)=>String(u).endsWith('popup.css')?Promise.resolve({text:()=>Promise.resolve(CSS)}):_f(u,...a);
</script>
<style>${ccss}</style></head><body>
<header><div class="wrap"><b>The Launch Log</b><nav><a>Rockets</a><a>Missions</a><a>Archive</a><a>About</a></nav></div></header>
<div class="wrap">${body}</div>
<script>${js}</script>
<script>
${autoOpen ? `window.addEventListener('load',()=>setTimeout(()=>{document.querySelector('a[data-postpeek]').click();
  setTimeout(()=>{const h=document.querySelector('post-peek-host');const a=h&&h.shadowRoot.activeElement;if(a)a.blur();},400);},100));` : ''}
</script>
</body></html>`;
}

(async () => {
  const spacex = await get('1732824684683784516');
  // Show the video's poster frame as a photo so the capture isn't a loading spinner.
  const spacexPhoto = { ...spacex, video: undefined, mediaDetails: undefined, photos: [{ url: spacex.video.poster, width: 1280, height: 720 }] };
  const jack = await get('20');

  const article = `
<h1>Starship's second flight test, one year on</h1>
<div class="meta">By A. Reader · 6 min read</div>
<p>A year after the second integrated flight test, it is worth revisiting how much changed between attempts. The pad survived, the hot-stage separation worked, and both stages flew further than before.</p>
<p>SpaceX marked the morning with <a href="https://x.com/SpaceX/status/1732824684683784516">a short clip of the launch at dawn</a>, which remains one of the better views of the vehicle leaving the tower. For contrast, <a href="https://x.com/jack/status/20">the very first post on the platform</a> was somewhat less dramatic.</p>
<p>The flight ended early for both stages, but the data it produced shaped every test that followed. Below, we walk through the timeline and what each milestone meant for the program.</p>
<p>Booster 9 lifted off with all 33 engines running, a first for the program, and the new water-cooled steel plate under the launch mount held up without the cratering seen on the first flight.</p>`;

  const shots = [
    { name: 'screenshot-1', html: page({ data: { '1732824684683784516': spacexPhoto, '20': jack }, theme: 'light', autoOpen: true, body: article }) },
    { name: 'screenshot-2', html: page({ data: { '1732824684683784516': spacexPhoto, '20': jack }, theme: 'light', autoOpen: false, body: article }) },
  ];
  for (const s of shots) {
    const file = path.join(__dirname, `${s.name}.html`);
    fs.writeFileSync(file, s.html);
    const out = path.join(__dirname, `${s.name}.png`);
    execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=1280,800',
      '--force-device-scale-factor=1', '--virtual-time-budget=8000', `--screenshot=${out}`, 'file:///' + file.replace(/\\/g, '/')], { stdio: 'ignore' });
    fs.unlinkSync(file);
    console.log(out, fs.statSync(out).size, 'bytes');
  }
})();
