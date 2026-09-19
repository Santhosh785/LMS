import { useState } from 'react'
import { cn } from './ui/index.jsx'

/**
 * The artwork block on a course, workshop or blog card.
 *
 * The design ships without photography: each item carries a gradient class and
 * has its title drawn over it, which is how the original static site looked.
 * An optional `image` URL now takes precedence, so an operator can add real
 * artwork per item without every item needing one.
 *
 * Three states, in order:
 *   1. `image` set and loads  → the photograph, no text over it
 *   2. `image` set but 404s   → falls back to the gradient rather than showing
 *                               a broken-image icon on a sales page
 *   3. no `image`             → the gradient with the label, exactly as before
 */
export default function CoverArt({
  image,
  imageAlt,
  gradientClass,
  label,
  className,
  /*
   * Sizing is split in three so the two states can never emit conflicting
   * Tailwind classes: `cn` here is a plain join with no conflict resolution, so
   * putting `h-32` and `h-auto` in one string would leave the winner up to the
   * order Tailwind happens to emit them in.
   *
   *   className     — always (rounding, margin, padding)
   *   fallbackClass — only with the gradient (its fixed height)
   *   imageClass    — only with a photograph (usually an aspect ratio)
   *
   * A detail page has one image and no row to line up with, so it can show the
   * picture whole. Grids keep a fixed height: consistent card rows matter more
   * there than seeing every pixel.
   */
  fallbackClass,
  imageClass,
  labelClass = 'text-[1.15rem]',
  sizes,
  /** Candidate widths from the Media Library, when the image came from it. */
  srcSet,
  /**
   * The source's real pixel width, when known. An image narrower than the slot
   * it fills is shown at its true size over the gradient rather than stretched
   * to fit: `object-cover` would upscale it, and a 200px image blown up to
   * 1400px does not look like a cover, it looks broken.
   */
  naturalWidth,
  naturalHeight,
}) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(image) && !failed
  const tooSmall = showImage && naturalWidth > 0 && naturalWidth < 700

  return (
    <div
      className={cn(
        'relative grid place-items-center overflow-hidden text-center',
        // The sheen is a highlight over the gradient; over a photograph it
        // just muddies it, so it only applies in the fallback state.
        (!showImage || tooSmall) && 'art-sheen',
        (!showImage || tooSmall) && gradientClass,
        !showImage && fallbackClass,
        className,
        showImage && imageClass,
      )}
    >
      {showImage ? (
        <img
          src={image}
          alt={imageAlt || label || ''}
          loading="lazy"
          /*
           * Both are dropped for an image being shown at its own size: `sizes`
           * would be declaring a layout width the image deliberately does not
           * take, and with one usable candidate there is nothing to choose
           * between anyway. (It also stops `naturalWidth` reporting Chrome's
           * density-corrected size, which is a confusing thing to debug.)
           */
          srcSet={srcSet && !tooSmall ? srcSet : undefined}
          sizes={srcSet && !tooSmall ? sizes : undefined}
          onError={() => setFailed(true)}
          className={cn(
            tooSmall ? 'max-h-full max-w-full object-contain' : 'h-full w-full object-cover',
          )}
          style={tooSmall ? { width: naturalWidth, height: naturalHeight } : undefined}
        />
      ) : (
        <span className={cn('whitespace-pre-line font-black leading-tight text-white', labelClass)}>
          {label}
        </span>
      )}
    </div>
  )
}
