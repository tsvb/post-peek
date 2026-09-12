// Renders the README banner with headless Chrome.
// Usage: node scripts/make-banner.js
//
// The design is authored at 1280x280 and every dimension is multiplied by SCALE,
// so the PNG lands at 2x and stays crisp on retina screens. Note the 2x comes
// from the multiplier and not --force-device-scale-factor: headless Chrome
// clamps a window taller than its virtual screen, which silently crops the
// bottom of the image, so the rendered window has to stay modest.
//
// The mark - a white rounded square with an off-center blue dot - is the same one
// in icons/ and the store tiles. The card on the right is an abstract stand-in
// for the popup: no real post content, and no artwork borrowed from anywhere.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
// Containers that run as root need --no-sandbox; set CHROME_NO_SANDBOX=1 there.
const SANDBOX_FLAGS = process.env.CHROME_NO_SANDBOX ? ['--no-sandbox'] : [];

const BASE_W = 1280;
const BASE_H = 280;
const SCALE = 2;
const W = BASE_W * SCALE;
const H = BASE_H * SCALE;
const s = (n) => `${n * SCALE}px`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}
html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden}
body{font-family:"Segoe UI",-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;
  background:linear-gradient(135deg,#0f6fc9 0%,#1d9bf0 55%,#4db8ff 100%);color:#fff;
  display:flex;align-items:center;justify-content:space-between;padding:0 ${s(56)};position:relative}
.glow{position:absolute;width:${s(BASE_H * 1.9)};height:${s(BASE_H * 1.9)};border-radius:50%;
  background:radial-gradient(circle,rgba(255,255,255,.20),rgba(255,255,255,0) 60%);
  right:-${s(BASE_H * 0.4)};top:-${s(BASE_H * 0.9)}}
.left{display:flex;align-items:center;gap:${s(26)};position:relative}
.icon{width:${s(96)};height:${s(96)};border-radius:${s(22)};background:#fff;position:relative;
  flex:0 0 auto;box-shadow:0 ${s(9)} ${s(26)} rgba(0,0,0,.25)}
.icon::after{content:"";position:absolute;width:${s(36)};height:${s(36)};border-radius:50%;
  background:#1d9bf0;left:${s(42)};top:${s(18)}}
.name{font-size:${s(52)};font-weight:700;letter-spacing:${s(-1.3)};line-height:1.02}
.tag{font-size:${s(21)};opacity:.95;margin-top:${s(8)}}
.sub{font-size:${s(13.5)};opacity:.78;margin-top:${s(11)}}

/* Abstract popup card: avatar, text bars, a media block, an action pill. */
.card{width:${s(248)};background:#fff;border-radius:${s(16)};padding:${s(15)};flex:0 0 auto;
  box-shadow:0 ${s(20)} ${s(50)} rgba(0,0,0,.28)}
.head{display:flex;align-items:center;gap:${s(9)}}
.av{width:${s(30)};height:${s(30)};border-radius:50%;background:#1d9bf0;flex:0 0 auto}
.bars{flex:1}
.bar{height:${s(7)};border-radius:${s(4)};background:#cfd9e0}
.head .bar:first-child{width:58%;background:#aab8c2;height:${s(8)}}
.head .bar:last-child{width:38%;margin-top:${s(6)}}
.body-bars{margin-top:${s(12)};display:flex;flex-direction:column;gap:${s(6)}}
.body-bars .bar:nth-child(2){width:86%}
.media{margin-top:${s(10)};height:${s(64)};border-radius:${s(10)};
  background:linear-gradient(160deg,#dce8f2 0%,#c3d6e6 100%)}
.foot{margin-top:${s(12)};display:flex;align-items:center;justify-content:space-between}
.foot .bar{width:${s(74)};height:${s(6)}}
.pill{width:${s(66)};height:${s(21)};border-radius:${s(11)};background:#1d9bf0}
</style></head><body><div class="glow"></div>
<div class="left"><div class="icon"></div><div>
<div class="name">Post Peek</div>
<div class="tag">Read one X post and leave.</div>
<div class="sub">Chrome extension &middot; post links open in a popup, not the full site</div>
</div></div>
<div class="card">
  <div class="head"><div class="av"></div><div class="bars"><div class="bar"></div><div class="bar"></div></div></div>
  <div class="body-bars"><div class="bar"></div><div class="bar"></div></div>
  <div class="media"></div>
  <div class="foot"><div class="bar"></div><div class="pill"></div></div>
</div>
</body></html>`;

const file = path.join(__dirname, '..', 'media', 'banner.html');
const out = path.join(__dirname, '..', 'media', 'banner.png');
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, html);
execFileSync(CHROME, [...SANDBOX_FLAGS, '--headless=new', '--disable-gpu', '--hide-scrollbars',
  `--window-size=${W},${H}`, '--force-device-scale-factor=1', '--virtual-time-budget=2000',
  `--screenshot=${out}`, 'file:///' + file.replace(/\\/g, '/')], { stdio: 'ignore' });
fs.unlinkSync(file);
console.log(out, fs.statSync(out).size, 'bytes');
