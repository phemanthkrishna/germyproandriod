import { Jimp } from 'jimp'
import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SOURCE = path.join(__dirname, 'assets', 'icon-only.png')
const ANDROID_RES = path.join(__dirname, 'android', 'app', 'src', 'main', 'res')

// mipmap sizes for launcher icons
const SIZES = [
  { dir: 'mipmap-mdpi',    size: 48 },
  { dir: 'mipmap-hdpi',    size: 72 },
  { dir: 'mipmap-xhdpi',   size: 96 },
  { dir: 'mipmap-xxhdpi',  size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
]

// foreground sizes (108dp grid, icon fills 72dp center = 2/3)
const FOREGROUND_SIZES = [
  { dir: 'mipmap-mdpi',    size: 108 },
  { dir: 'mipmap-hdpi',    size: 162 },
  { dir: 'mipmap-xhdpi',   size: 216 },
  { dir: 'mipmap-xxhdpi',  size: 324 },
  { dir: 'mipmap-xxxhdpi', size: 432 },
]

async function run() {
  console.log('Reading source image...')
  const src = await Jimp.read(SOURCE)

  // Generate ic_launcher.png and ic_launcher_round.png
  for (const { dir, size } of SIZES) {
    const outDir = path.join(ANDROID_RES, dir)
    await fs.mkdir(outDir, { recursive: true })

    const img = src.clone().resize({ w: size, h: size })

    await img.write(path.join(outDir, 'ic_launcher.png'))
    await img.write(path.join(outDir, 'ic_launcher_round.png'))
    console.log(`${dir}: ${size}x${size} done`)
  }

  // Generate ic_launcher_foreground.png (adaptive icon foreground layer)
  for (const { dir, size } of FOREGROUND_SIZES) {
    const outDir = path.join(ANDROID_RES, dir)
    await fs.mkdir(outDir, { recursive: true })

    // Create transparent canvas, place icon in center (72/108 = 2/3 of space)
    const iconSize = Math.round(size * (72 / 108))
    const padding = Math.round((size - iconSize) / 2)

    const canvas = new Jimp({ width: size, height: size, color: 0x00000000 })
    const icon = src.clone().resize({ w: iconSize, h: iconSize })
    canvas.composite(icon, padding, padding)

    await canvas.write(path.join(outDir, 'ic_launcher_foreground.png'))
    console.log(`${dir}: foreground ${size}x${size} done`)
  }

  console.log('All icons generated!')
}

run().catch(err => { console.error(err); process.exit(1) })
