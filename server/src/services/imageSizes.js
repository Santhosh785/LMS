import path from 'node:path'
import sharp from 'sharp'

/**
 * Derivative image sizes, the way WordPress makes them.
 *
 * One upload becomes several files so an editor can drop the right weight of
 * image into an article, and so the public page can hand a phone a 300px file
 * instead of a 1200px one. The set below is WordPress's own default, because
 * the names are what anyone who has used WordPress already expects to see in
 * the Size dropdown.
 */

/**
 * `crop: true` produces exactly width×height, cutting what does not fit —
 * a thumbnail grid only looks like a grid if every tile is the same shape.
 * Everything else scales to fit *inside* the box, preserving the aspect ratio.
 */
export const IMAGE_SIZES = [
  { name: 'thumbnail', label: 'Thumbnail', width: 150, height: 150, crop: true },
  { name: 'medium', label: 'Medium', width: 300, height: 300 },
  { name: 'medium_large', label: 'Medium Large', width: 768, height: 0 },
  { name: 'large', label: 'Large', width: 1024, height: 1024 },
]

/** Animation is lost by a resize, so a GIF is stored whole and left alone. */
const RESIZABLE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
export const isResizable = (mimeType) => RESIZABLE.has(mimeType)

/** Reads the dimensions without decoding the whole image. */
export async function measure(buffer) {
  try {
    const { width, height } = await sharp(buffer).metadata()
    return { width: width || 0, height: height || 0 }
  } catch {
    // A file sharp cannot parse is still storable — it just has no dimensions
    // and no derivatives, which is the same outcome as a GIF.
    return { width: 0, height: 0 }
  }
}

/** `photo.webp` + 300×158 → `photo-300x158.webp`, as WordPress names them. */
export function sizedPath(fullPath, width, height) {
  const ext = path.extname(fullPath)
  return `${fullPath.slice(0, -ext.length)}-${width}x${height}${ext}`
}

/**
 * Renders every derivative that makes sense for this image.
 *
 * A size larger than the original is skipped rather than upscaled: blowing a
 * 600px image up to 1024px produces a bigger file that looks worse, and
 * WordPress skips them for the same reason. So a small upload simply has fewer
 * sizes, and the Size dropdown shows only what actually exists.
 */
export async function renderSizes(buffer, mimeType, { width, height }) {
  if (!isResizable(mimeType) || !width || !height) return []

  const format = mimeType.split('/')[1]
  const results = []

  for (const size of IMAGE_SIZES) {
    const targetWidth = size.width
    const targetHeight = size.height || null

    // Skip anything the original cannot fill. For a crop both dimensions must
    // be available; for a scale, only the constrained one has to be.
    if (size.crop) {
      if (width < targetWidth || height < size.height) continue
    } else if (width <= targetWidth && (!targetHeight || height <= targetHeight)) {
      continue
    }

    const pipeline = sharp(buffer).resize({
      width: targetWidth,
      height: targetHeight || undefined,
      fit: size.crop ? 'cover' : 'inside',
      position: 'centre',
      withoutEnlargement: true,
    })

    // Re-encode in the original format so the extension keeps telling the truth.
    const out = await pipeline[format]({ quality: 82 }).toBuffer({ resolveWithObject: true })
    results.push({
      name: size.name,
      width: out.info.width,
      height: out.info.height,
      buffer: out.data,
    })
  }

  return results
}

/** The dropdown an editor picks from: the generated sizes plus the original. */
export const sizeLabel = (name) =>
  name === 'full' ? 'Full Size' : IMAGE_SIZES.find((s) => s.name === name)?.label || name
