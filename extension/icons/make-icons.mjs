// make-icons.mjs
// 의존성 없이 간단한 단색 라운드 아이콘 PNG 를 생성하는 스크립트.
// 실행: node extension/icons/make-icons.mjs
// (아이콘 디자인 교체 시 이 스크립트를 수정하거나 직접 PNG 를 넣으면 됩니다.)

import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// CRC32 (PNG 청크용)
function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// size x size RGBA 단색(라운드 코너) 아이콘 생성
function makePng(size, [r, g, b]) {
  const radius = Math.floor(size * 0.22);
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter type 0
    for (let x = 0; x < size; x++) {
      // 라운드 코너 밖이면 투명
      let inside = true;
      const corners = [
        [radius, radius],
        [size - radius, radius],
        [radius, size - radius],
        [size - radius, size - radius],
      ];
      if (x < radius && y < radius) inside = dist(x, y, corners[0]) <= radius;
      else if (x >= size - radius && y < radius) inside = dist(x, y, corners[1]) <= radius;
      else if (x < radius && y >= size - radius) inside = dist(x, y, corners[2]) <= radius;
      else if (x >= size - radius && y >= size - radius) inside = dist(x, y, corners[3]) <= radius;

      const off = y * (size * 4 + 1) + 1 + x * 4;
      raw[off] = r;
      raw[off + 1] = g;
      raw[off + 2] = b;
      raw[off + 3] = inside ? 255 : 0;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const idat = zlib.deflateSync(raw);
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function dist(x, y, [cx, cy]) {
  return Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
}

const BLUE = [74, 144, 217];
for (const size of [16, 48, 128]) {
  const png = makePng(size, BLUE);
  fs.writeFileSync(path.join(__dirname, `icon${size}.png`), png);
  console.log(`생성: icon${size}.png (${png.length} bytes)`);
}
