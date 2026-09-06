// Generates simple PNG icons (blue rounded square with a white "peek" dot), no dependencies.
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

function crc32(buf) {
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    let c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * stride + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}
function draw(size) {
  const r = size * 0.22, c = size / 2;
  const dotR = size * 0.19, dotX = size * 0.62, dotY = size * 0.38;
  return png(size, (x, y) => {
    const px = x + 0.5, py = y + 0.5;
    const dx = Math.max(Math.abs(px - c) - (c - r), 0);
    const dy = Math.max(Math.abs(py - c) - (c - r), 0);
    const dist = Math.hypot(dx, dy) - r;
    const cov = Math.min(1, Math.max(0, 0.5 - dist));
    if (cov <= 0) return [0, 0, 0, 0];
    const dd = Math.hypot(px - dotX, py - dotY) - dotR;
    const dcov = Math.min(1, Math.max(0, 0.5 - dd));
    const base = [29, 155, 240];
    const rgb = base.map((v) => Math.round(v + (255 - v) * dcov));
    return [rgb[0], rgb[1], rgb[2], Math.round(255 * cov)];
  });
}
const out = path.join(__dirname, '..', 'icons');
fs.mkdirSync(out, { recursive: true });
for (const s of [16, 32, 48, 128]) fs.writeFileSync(path.join(out, `icon${s}.png`), draw(s));
console.log('icons written to', out);
