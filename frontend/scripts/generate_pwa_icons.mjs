// frontend/scripts/generate_pwa_icons.mjs
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const publicDir = path.resolve(__dirname, '../public')
const iconsDir = path.join(publicDir, 'icons')

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true })
}

// SVG App Icon with Wello sunrise gradient and branded W mark
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF9F1C" />
      <stop offset="50%" stop-color="#FF387D" />
      <stop offset="100%" stop-color="#7A3FF6" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#FF387D" flood-opacity="0.35" />
    </filter>
  </defs>
  <rect width="512" height="512" rx="112" fill="#0F172A" />
  <rect x="32" y="32" width="448" height="448" rx="88" fill="url(#brandGrad)" opacity="0.15" />
  <g filter="url(#glow)">
    <path d="M128 152 L176 360 L232 232 L280 360 L328 152" fill="none" stroke="url(#brandGrad)" stroke-width="44" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="384" cy="176" r="24" fill="#FF9F1C" />
  </g>
</svg>`

fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svgIcon, 'utf-8')
fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svgIcon, 'utf-8')

const logoPath = path.join(publicDir, 'logo.png')
if (fs.existsSync(logoPath)) {
  fs.copyFileSync(logoPath, path.join(iconsDir, 'icon-192x192.png'))
  fs.copyFileSync(logoPath, path.join(iconsDir, 'icon-512x512.png'))
  fs.copyFileSync(logoPath, path.join(iconsDir, 'icon-maskable-512x512.png'))
  fs.copyFileSync(logoPath, path.join(iconsDir, 'apple-touch-icon.png'))
  fs.copyFileSync(logoPath, path.join(publicDir, 'apple-touch-icon.png'))
}

console.log('✅ PWA Icons successfully generated in public/icons/')
