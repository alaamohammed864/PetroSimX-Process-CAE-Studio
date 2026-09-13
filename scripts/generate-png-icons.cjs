const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 implementation for standard PNG chunks
function createCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    table[n] = c;
  }
  return table;
}

const crcTable = createCrcTable();
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writePngChunk(typeStr, dataBuf) {
  const len = dataBuf.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(typeStr, 4, 4, 'ascii');
  dataBuf.copy(chunk, 8);
  
  const typeAndData = Buffer.concat([Buffer.from(typeStr, 'ascii'), dataBuf]);
  const crc = crc32(typeAndData);
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

function generatePngBuffer(width, height, isMaskable = false) {
  // Signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // bit depth 8
  ihdrData.writeUInt8(6, 9); // RGBA
  ihdrData.writeUInt8(0, 10);
  ihdrData.writeUInt8(0, 11);
  ihdrData.writeUInt8(0, 12);
  const ihdrChunk = writePngChunk('IHDR', ihdrData);

  // Raw scanlines
  const rowBytes = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowBytes);

  const cx = width / 2;
  const cy = height / 2;
  const radius = isMaskable ? width * 0.4 : width * 0.45;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0; // Filter byte 0 (None)

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Deep navy background #0b1326
      let r = 11, g = 19, b = 38, a = 255;

      // Draw outer circle accent #131b2e to #171f33
      if (dist < radius) {
        r = 19; g = 27; b = 46;

        // Distillation column vessel in center
        if (Math.abs(dx) < width * 0.08 && Math.abs(dy) < height * 0.22) {
          // Vessel wall #4cd7f6 (Cyan)
          r = 76; g = 215; b = 246;
          // Internal tray stripes
          if (Math.abs(dy % (height * 0.06)) < 3) {
            r = 78; g = 222; b = 163; // emerald tray
          }
        }

        // Process flow pipes horizontal & vertical
        if (Math.abs(dy - height * 0.08) < (width * 0.015) && Math.abs(dx) < width * 0.28) {
          r = 76; g = 215; b = 246; // Cyan piping
        }
        if (Math.abs(dy + height * 0.08) < (width * 0.015) && Math.abs(dx) < width * 0.28) {
          r = 255; g = 185; b = 95; // Warm orange return
        }

        // Molecular node circles
        const d1 = Math.hypot(dx + width * 0.25, dy);
        const d2 = Math.hypot(dx - width * 0.25, dy);
        if (d1 < width * 0.05) {
          r = 78; g = 222; b = 163; // Emerald inlet
        } else if (d2 < width * 0.05) {
          r = 255; g = 185; b = 95; // Orange outlet
        }
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  // Deflate IDAT
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = writePngChunk('IDAT', compressed);

  // IEND
  const iendChunk = writePngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const publicDir = path.resolve(__dirname, '../public');

fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), generatePngBuffer(192, 192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), generatePngBuffer(512, 512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), generatePngBuffer(512, 512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), generatePngBuffer(180, 180, false));
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), generatePngBuffer(48, 48, false));

console.log('Successfully generated PWA PNG icons and favicon in public/');
