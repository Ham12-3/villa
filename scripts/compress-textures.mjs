// Encodes the source JPG texture sets (assets-src/tex) to GPU-compressed KTX2
// (public/assets/tex), with mipmaps.
//   npm run textures
//
//  - colour and roughness : ETC1S  (very small; fine for low-contrast surfaces)
//  - normal maps          : UASTC + RDO + Zstd (keeps the detail normals need)
import { encodeToKTX2 } from 'ktx2-encoder';
import sharp from 'sharp';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const SRC = 'assets-src/tex';
const OUT = 'public/assets/tex';
mkdirSync(OUT, { recursive: true });

// sets that are only ever seen from far away do not need the full 1024 px
const MAX_SIZE = { leafy_grass: 512 };
const only = process.argv[2]; // optional: encode just the files whose name contains this

let size = 1024;
const imageDecoder = async (buffer) => {
  const { data, info } = await sharp(buffer)
    .resize(size, size, { fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
};

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
let before = 0;
let after = 0;

for (const file of readdirSync(SRC).filter((f) => f.endsWith('.jpg')).sort()) {
  const name = basename(file, '.jpg');
  if (only && !name.includes(only)) continue;
  size = Object.entries(MAX_SIZE).find(([k]) => name.startsWith(k))?.[1] ?? 1024;
  const normal = name.includes('_nor_');
  const colour = name.endsWith('_diff');
  const input = new Uint8Array(readFileSync(join(SRC, file)));
  const t0 = performance.now();
  const out = await encodeToKTX2(input, {
    imageDecoder,
    generateMipmap: true,
    // match the orientation the JPGs had through TextureLoader (flipY)
    isYFlip: true,
    isNormalMap: normal,
    isPerceptual: colour,
    ...(normal
      ? { isUASTC: true, uastcLDRQualityLevel: 2, enableRDO: true, rdoQualityLevel: 1.5, needSupercompression: true }
      : { isUASTC: false, qualityLevel: colour ? 200 : 150, compressionLevel: 2 }),
  });
  const target = join(OUT, `${name}.ktx2`);
  writeFileSync(target, out);
  const a = statSync(join(SRC, file)).size;
  before += a;
  after += out.byteLength;
  console.log(
    `${name.padEnd(30)} ${normal ? 'UASTC' : 'ETC1S'}  ${kb(a).padStart(8)} -> ${kb(out.byteLength).padStart(8)}  (${((performance.now() - t0) / 1000).toFixed(1)}s)`,
  );
}
console.log(`total ${kb(before)} -> ${kb(after)}`);
