import { useBranding } from '../context/SiteConfigContext.jsx'

/**
 * The site logo, from admin settings.
 *
 * Nine places used to hardcode `/logo.png` and the alt text "Growth Scholar",
 * which is why changing either in admin settings did nothing. Every one of them
 * renders this instead, so the logo and the brand name have a single source.
 *
 * `width`/`height` stay explicit rather than being derived from the image, so
 * the header does not shift while the logo loads.
 */
export default function BrandLogo({
  className = 'h-12 w-auto rounded-sm2',
  width = 160,
  height = 100,
}) {
  const { brandName, logoUrl } = useBranding()
  return (
    <img
      src={logoUrl}
      alt={brandName}
      width={width}
      height={height}
      className={className}
      // The configured URL may 404 — a broken-image icon in the header is a
      // worse failure than falling back to the bundled asset.
      onError={(e) => {
        if (e.currentTarget.src !== `${window.location.origin}/logo.png`) {
          e.currentTarget.src = '/logo.png'
        }
      }}
    />
  )
}
