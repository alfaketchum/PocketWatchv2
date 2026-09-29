// Social-share banner (public/img/og-banner.jpg, 1200x630) in the current flame style.
// Reads APP_NAME and LOGO_PATH from src/lib/brand.ts so the banner always matches the brand.
// Run: node scripts/generate-og-banner.mjs
import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dirname, "..");
const brand = readFileSync(join(ROOT, "src/lib/brand.ts"), "utf8");
const APP_NAME = brand.match(/APP_NAME = "([^"]+)"/)[1];
const LOGO_PATH = brand.match(/LOGO_PATH =\s*"([^"]+)"/)[1];

// "FlameFolio" → ["Flame", "Folio"]: the second word is set in the accent colour.
const [first, ...rest] = APP_NAME.split(/(?=[A-Z])/);
const second = rest.join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0f0f13"/>
  <rect x="540" y="150" width="120" height="120" rx="26" fill="#5b5bd6"/>
  <g transform="translate(564, 174) scale(4.5)">
    <path d="${LOGO_PATH}" fill="white" fill-rule="evenodd"/>
  </g>
  <text x="600" y="385" text-anchor="middle" font-family="DejaVu Sans, system-ui, sans-serif" font-size="68">
    <tspan font-weight="700" fill="#f2f2f7">${first}</tspan><tspan fill="#8b8bff">${second}</tspan>
  </text>
  <text x="600" y="445" text-anchor="middle" font-family="DejaVu Sans, system-ui, sans-serif" font-size="26" fill="#b4b4c3">See everything you own. In one place.</text>
  <text x="600" y="512" text-anchor="middle" font-family="DejaVu Sans, system-ui, sans-serif" font-size="18" fill="#6e6e80">Banking · Investments · Credit Cards · Digital Assets</text>
</svg>`;

const out = join(ROOT, "public/img/og-banner.jpg");
writeFileSync(out, await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer());
console.log(`✓ og-banner.jpg for ${APP_NAME}`);
