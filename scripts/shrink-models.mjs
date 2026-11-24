// Resizes the downloaded model textures (public/assets/models) to what the
// site needs: 1K only where the camera gets close, 512 px elsewhere. This
// roughly halves the download and cuts GPU memory by two thirds. Safe to run
// again: files already at or under their target size are left alone.
//   npm run models   (runs fetch-models, then this)
import sharp from 'sharp';
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'public/assets/models';
/** seen from a metre away: keep colour and normal maps at 1K */
const CLOSE = ['mid_century_lounge_chair', 'modern_arm_chair_01', 'coffee_table_round_01'];
/** keep the colour map at 1K only */
const MID = ['dining_chair_02', 'potted_plant_02'];

const target = (model, file) => {
  const colour = /_diff_/.test(file);
  const normal = /_nor_/.test(file);
  if (CLOSE.includes(model)) return colour || normal ? 1024 : 512;
  if (MID.includes(model)) return colour && !/_pot_/.test(file) ? 1024 : 512;
  return 512;
};

let before = 0;
let after = 0;
for (const model of readdirSync(ROOT)) {
  const dir = join(ROOT, model, 'textures');
  let files = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.jpg'));
  } catch {
    continue;
  }
  for (const f of files) {
    const path = join(dir, f);
    const size = statSync(path).size;
    before += size;
    const input = readFileSync(path);
    const meta = await sharp(input).metadata();
    const want = target(model, f);
    if ((meta.width ?? 0) <= want) {
      after += size;
      continue;
    }
    const out = await sharp(input).resize(want, want).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
    writeFileSync(path, out);
    after += out.length;
    console.log(`${model}/${f}`.padEnd(72), `${meta.width} -> ${want}`);
  }
}
console.log('textures', (before / 1e6).toFixed(1), 'MB ->', (after / 1e6).toFixed(1), 'MB');
