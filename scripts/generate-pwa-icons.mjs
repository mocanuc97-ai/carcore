import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
mkdirSync(publicDir, { recursive: true });

// Standard icon: tight bounds, rounded square, matches the app's sidebar (zinc-900 + white wordmark).
const standardSvg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="96" fill="#18181b"/>
  <text x="256" y="330" font-family="Arial, Helvetica, sans-serif" font-size="300" font-weight="700"
        fill="#ffffff" text-anchor="middle">C</text>
</svg>
`;

// Maskable icon: background fills the full canvas (no rounded corners baked in — the OS applies its own mask),
// glyph kept within the ~80% safe zone so it isn't clipped by circular/squircle masks.
const maskableSvg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#18181b"/>
  <text x="256" y="315" font-family="Arial, Helvetica, sans-serif" font-size="240" font-weight="700"
        fill="#ffffff" text-anchor="middle">C</text>
</svg>
`;

const targets = [
  { svg: standardSvg, size: 192, out: 'icon-192.png' },
  { svg: standardSvg, size: 512, out: 'icon-512.png' },
  { svg: maskableSvg, size: 512, out: 'icon-512-maskable.png' },
  { svg: standardSvg, size: 180, out: 'apple-touch-icon.png' },
];

for (const { svg, size, out } of targets) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(publicDir, out));
  console.log('wrote', out);
}
