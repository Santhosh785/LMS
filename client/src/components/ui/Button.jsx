import { Link } from 'react-router-dom'

export const cn = (...parts) => parts.filter(Boolean).join(' ')

/** Ported 1:1 from .btn / .btn-* in the original css/base.css. */
const base =
  'inline-flex items-center justify-center gap-[0.4rem] min-h-[42px] px-[1.15rem] rounded-full ' +
  'text-[0.92rem] font-semibold border border-transparent cursor-pointer ' +
  'transition-all duration-[250ms] ease-gs hover:-translate-y-px'

export const variants = {
  primary: 'bg-brand text-white shadow-[0_8px_20px_rgba(19,88,85,0.22)] hover:bg-brand-deep',
  outline:
    'border-[rgba(19,88,85,0.25)] text-brand bg-transparent hover:border-brand hover:bg-accent-soft',
  ghost: 'text-muted bg-transparent hover:text-brand',
  light: 'bg-white text-brand-deep hover:bg-accent-soft',
  accent: 'bg-accent text-brand-deep hover:brightness-105',
  danger: 'bg-danger text-white hover:brightness-95',
}

const sizes = {
  sm: 'min-h-[34px] px-[0.85rem] text-[0.82rem]',
  md: '',
  lg: 'min-h-[52px] px-[1.45rem] text-base',
}

export function buttonClass({ variant = 'primary', size = 'md', block, className } = {}) {
  return cn(base, variants[variant], sizes[size], block && 'w-full', className)
}

export default function Button({
  as,
  to,
  href,
  variant = 'primary',
  size = 'md',
  block,
  className,
  children,
  ...rest
}) {
  const cls = buttonClass({ variant, size, block, className })

  if (to) {
    return (
      <Link to={to} className={cls} {...rest}>
        {children}
      </Link>
    )
  }
  if (href) {
    return (
      <a href={href} className={cls} {...rest}>
        {children}
      </a>
    )
  }

  const Tag = as || 'button'
  return (
    <Tag className={cls} {...rest}>
      {children}
    </Tag>
  )
}
