import sharp from 'sharp'
import { readFileSync } from 'fs'
import { mkdirSync } from 'fs'

mkdirSync('public', { recursive: true })

const svg = readFileSync('public/icon.svg')

const icons = [
  { file: 'public/apple-touch-icon.png', size: 180 },
  { file: 'public/pwa-192x192.png',      size: 192 },
  { file: 'public/pwa-512x512.png',      size: 512 },
]

for (const { file, size } of icons) {
  await sharp(svg).resize(size, size).png().toFile(file)
  console.log(`created ${file}`)
}
