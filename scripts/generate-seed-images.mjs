// Gera as imagens de placeholder que o seed referencia, em apps/web/public/seed/.
//
// Por que existe: o seed nasceu sem `imageUrl`, então todo card caía no
// fallback `bg-gradient-to-br from-brand-600 to-brand-400` e a tela local
// ficava muito mais laranja que a produção — o que atrapalha justamente quem
// está conferindo cor e tipografia. Com imagens, o card local tem o mesmo peso
// visual do card real.
//
// As imagens são geradas, não baixadas: o ambiente de desenvolvimento pode não
// ter acesso à rede, e binários gerados não precisam ser versionados (o
// diretório de saída está no .gitignore). PNG escrito à mão porque o projeto
// não tem sharp/jimp e não vale acrescentar dependência para isso.
//
//   node scripts/generate-seed-images.mjs

import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR = path.join(import.meta.dirname, '../apps/web/public/seed');
const WIDTH = 800;
const HEIGHT = 450;

// Um matiz por categoria, todos distantes do laranja da marca para o card não
// competir com os tokens que estão sendo avaliados.
const CATEGORIES = {
  technology: [212, 62],
  politics: [258, 44],
  economy: [168, 52],
  sports: [96, 54],
  science: [280, 48],
  entertainment: [330, 56],
  world: [200, 40],
  health: [150, 46],
};

/** HSL → RGB, ambos em 0..1 exceto h em graus. */
function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0]
    : h < 120 ? [x, c, 0]
    : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c]
    : h < 300 ? [x, 0, c]
    : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

function renderRgb(hue, saturation, seed) {
  // Deslocamento por categoria, para as bandas não caírem no mesmo lugar em
  // todas as imagens. Determinístico: a mesma categoria gera sempre o mesmo PNG.
  const phase = (seed % 32) / 32;
  const rows = [];
  for (let y = 0; y < HEIGHT; y++) {
    // filtro 0 (None) no início de cada scanline, como manda o formato
    const row = Buffer.alloc(WIDTH * 3 + 1);
    for (let x = 0; x < WIDTH; x++) {
      const dx = x / WIDTH;
      const dy = y / HEIGHT;
      // Gradiente diagonal + vinheta + uma onda larga, para dar alguma forma
      // sem virar ruído — ruído por pixel inviabiliza a compressão do PNG e
      // levaria cada imagem a centenas de kB.
      const ramp = 0.3 + 0.34 * (1 - (dx * 0.55 + dy * 0.45));
      const vignette = 1 - 0.16 * Math.hypot(dx - 0.5, dy - 0.5);
      const wave = 0.05 * Math.sin((dx * 2.2 + dy * 1.4 + phase) * Math.PI * 2);
      const [r, g, b] = hslToRgb(
        hue + (dx - 0.5) * 18,
        saturation / 100,
        Math.min(0.92, Math.max(0.06, ramp * vignette + wave)),
      );
      const i = 1 + x * 3;
      row[i] = r;
      row[i + 1] = g;
      row[i + 2] = b;
    }
    rows.push(row);
  }
  return Buffer.concat(rows);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(WIDTH, 0);
  ihdr.writeUInt32BE(HEIGHT, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rgb, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  let total = 0;

  for (const [name, [hue, saturation]] of Object.entries(CATEGORIES)) {
    const seed = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 7);
    const png = encodePng(renderRgb(hue, saturation, seed));
    await writeFile(path.join(OUT_DIR, `${name}.png`), png);
    total += png.length;
    console.log(`  ${name}.png  ${(png.length / 1024).toFixed(0)} kB`);
  }

  console.log(
    `\n${Object.keys(CATEGORIES).length} imagens em ${OUT_DIR} (${(total / 1024).toFixed(0)} kB)`,
  );
}

main();
