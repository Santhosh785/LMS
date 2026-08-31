/**
 * Theme ported verbatim from the original static site's CSS custom properties.
 * Sources: css/base.css, admin/css/admin.css, community/css/community.css,
 * student/css/student.css — do not "improve" these values, they define the look.
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    // The original stylesheets are desktop-first and use max-width queries only.
    // Mirroring that exactly keeps every layout shift at the same pixel as before.
    screens: {
      'mx-1100': { max: '1100px' },
      'mx-1040': { max: '1040px' },
      'mx-980': { max: '980px' },
      'mx-960': { max: '960px' },
      'mx-900': { max: '900px' },
      'mx-860': { max: '860px' },
      'mx-768': { max: '768px' },
      'mx-760': { max: '760px' },
      'mx-720': { max: '720px' },
      'mx-640': { max: '640px' },
      'mx-560': { max: '560px' },
      /**
       * Phone widths. The ported stylesheets had roughly 118 desktop-down
       * breakpoints but only ~34 below 768px, and 28 of those were a single
       * one — the layout barely considered phones, while Indian D2C education
       * traffic is 75–85% mobile. These three are the widths the revenue path
       * is actually tested at: 480 covers small tablets held in portrait, 390
       * is an iPhone 14/15, 360 is the most common Android width in India.
       *
       * Still max-width, still desktop-first. A partial conversion to
       * mobile-first would be worse than a consistent desktop-first codebase.
       */
      'mx-480': { max: '480px' },
      'mx-390': { max: '390px' },
      'mx-360': { max: '360px' },
    },
    extend: {
      colors: {
        brand: { DEFAULT: '#135855', deep: '#0d3f3d' },
        accent: { DEFAULT: '#3ecf8e', soft: '#e8faf1', mid: '#68c088' },
        ink: '#1a2423',
        muted: { DEFAULT: '#5c6f6d', admin: '#6b7280' },
        surface: {
          DEFAULT: '#f6f8f7',
          white: '#ffffff',
          mist: '#eef3f1',
          student: '#f5f7f6',
          community: '#f4f7f6',
          admin: '#f3f6f5',
        },
        line: {
          DEFAULT: 'rgba(19, 88, 85, 0.12)',
          strong: 'rgba(19, 88, 85, 0.18)',
          solid: '#e3e9e7',
          admin: '#e5e7eb',
        },
        ok: '#16a34a',
        warn: { DEFAULT: '#d97706', admin: '#f59e0b' },
        danger: { DEFAULT: '#dc2626', admin: '#ef4444' },
        gold: '#eab308',
        silver: '#94a3b8',
        bronze: '#cd7f32',
        // workshop-landing palette
        wl: {
          green: '#2fd67b',
          deep: '#1db864',
          ink: '#0a1211',
          cream: '#eef3f1',
          card: '#f7faf8',
          panel: '#f3f6f4',
        },
      },
      borderRadius: {
        DEFAULT: '14px',
        sm2: '10px',
        md2: '12px',
        lg2: '16px',
        xl2: '20px',
      },
      boxShadow: {
        soft: '0 10px 30px rgba(19, 88, 85, 0.08)',
        softer: '0 4px 14px rgba(19, 88, 85, 0.06)',
        card: '0 8px 24px rgba(19, 88, 85, 0.07)',
        panel: '0 4px 18px rgba(19, 88, 85, 0.07)',
        admin: '0 4px 16px rgba(19, 88, 85, 0.06)',
        tiny: '0 2px 8px rgba(19, 88, 85, 0.05)',
      },
      fontFamily: {
        sans: [
          'Satoshi',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      transitionTimingFunction: {
        gs: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      // Page shells span the full viewport — horizontal breathing room comes from
      // each section's own padding, not from a centred fixed-width column.
      maxWidth: {
        shell: '100%',
        shellSm: '100%',
        admin: '100%',
      },
      spacing: {
        header: '76px',
        'header-student': '64px',
        'header-community': '58px',
        'header-admin': '56px',
        sidebar: '260px',
        side: '248px',
        right: '300px',
        outline: '340px',
      },
      letterSpacing: {
        tightest: '-0.02em',
        tighter2: '-0.01em',
      },
      lineHeight: {
        body: '1.55',
        heading: '1.15',
      },
      keyframes: {
        'wl-marquee': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        'wl-fade': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        pulse2: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
      },
      animation: {
        'wl-marquee': 'wl-marquee 22s linear infinite',
        'wl-fade': 'wl-fade 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        pulse2: 'pulse2 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
