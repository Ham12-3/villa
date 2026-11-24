// Resizes the Poly Haven sky photo (assets-src/sky) to the 4096 x 2048 JPG the
// site ships as its visible sky.
//   npm run sky
import sharp from 'sharp';
import { statSync } from 'node:fs';

const src = 'assets-src/sky/belfast_sunset_puresky.jpg';
const out = 'public/assets/sky.jpg';
await sharp(src, { limitInputPixels: false }).resize(4096, 2048, { fit: 'fill' }).jpeg({ quality: 93, mozjpeg: true }).toFile(out);
console.log(out, (statSync(out).size / 1e6).toFixed(2), 'MB');
