// Renders Chrome Web Store promo tiles with headless Chrome.
// Usage: node store/make-promo.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

function tile(w, h) {
  const scale = w / 440;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden}
body{font-family:"Segoe UI",-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;
  background:linear-gradient(135deg,#0f6fc9 0%,#1d9bf0 55%,#4db8ff 100%);color:#fff;
  display:flex;align-items:center;justify-content:center;position:relative}
.glow{position:absolute;width:${h * 1.4}px;height:${h * 1.4}px;border-radius:50%;
  background:radial-gradient(circle,rgba(255,255,255,.18),rgba(255,255,255,0) 60%);
  right:-${h * 0.5}px;top:-${h * 0.6}px}
.row{display:flex;align-items:center;gap:${28 * scale}px;position:relative;padding:0 ${24 * scale}px}
.icon{width:${118 * scale}px;height:${118 * scale}px;border-radius:${26 * scale}px;background:#fff;
  position:relative;flex:0 0 auto;box-shadow:0 ${10 * scale}px ${30 * scale}px rgba(0,0,0,.25)}
.icon::after{content:"";position:absolute;width:${44 * scale}px;height:${44 * scale}px;border-radius:50%;
  background:#1d9bf0;left:${52 * scale}px;top:${22 * scale}px}
.text{display:flex;flex-direction:column}
.name{font-size:${44 * scale}px;font-weight:700;letter-spacing:-0.5px;line-height:1.05}
.tag{font-size:${19 * scale}px;opacity:.95;margin-top:${8 * scale}px;font-weight:400}
.sub{font-size:${13 * scale}px;opacity:.8;margin-top:${10 * scale}px}
</style></head><body><div class="glow"></div>
<div class="row"><div class="icon"></div><div class="text">
<div class="name">Post Peek</div>
<div class="tag">Read one X post and leave.</div>
<div class="sub">Post links open in a popup<br>No account · No cookies sent to X</div>
</div></div></body></html>`;
}

const tiles = [
  { name: 'promo-small-440x280', w: 440, h: 280 },
  { name: 'promo-marquee-1400x560', w: 1400, h: 560 },
];
for (const t of tiles) {
  const file = path.join(__dirname, `${t.name}.html`);
  const out = path.join(__dirname, `${t.name}.png`);
  fs.writeFileSync(file, tile(t.w, t.h));
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--window-size=${t.w},${t.h}`,
    '--force-device-scale-factor=1', '--virtual-time-budget=2000', `--screenshot=${out}`,
    'file:///' + file.replace(/\\/g, '/')], { stdio: 'ignore' });
  fs.unlinkSync(file);
  console.log(out, fs.statSync(out).size, 'bytes');
}
