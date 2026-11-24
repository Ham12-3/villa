// Downloads the CC0 Poly Haven models (glTF, 1K textures) used for the
// furnishings into public/assets/models/<id>/, and the sky photo into
// assets-src/sky/ (it is resized for the site by `npm run sky`).
//   node scripts/fetch-models.mjs
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const MODELS = [
  'mid_century_lounge_chair',
  'modern_arm_chair_01',
  'dining_chair_02',
  'coffee_table_round_01',
  'side_table_01',
  'ceramic_vase_01',
  'ceramic_vase_02',
  'potted_plant_02',
  'potted_plant_04',
];
const UA = { 'User-Agent': 'asset-browser/1.0' };

const save = async (url, path) => {
  if (existsSync(path)) return 0;
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  const buf = Buffer.from(await r.arrayBuffer());
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buf);
  return buf.length;
};

let total = 0;
for (const id of MODELS) {
  const j = await (await fetch(`https://api.polyhaven.com/files/${id}`, { headers: UA })).json();
  const g = j.gltf['1k'].gltf;
  const dir = join('public/assets/models', id);
  let n = await save(g.url, join(dir, `${id}.gltf`));
  for (const [name, f] of Object.entries(g.include ?? {})) n += await save(f.url, join(dir, name));
  total += n;
  console.log(id.padEnd(28), (n / 1e6).toFixed(2), 'MB');
}

const h = await (await fetch('https://api.polyhaven.com/files/belfast_sunset_puresky', { headers: UA })).json();
total += await save(h.tonemapped.url, 'assets-src/sky/belfast_sunset_puresky.jpg');
console.log('downloaded', (total / 1e6).toFixed(1), 'MB');
