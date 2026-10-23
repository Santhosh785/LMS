import { fileURLToPath } from 'node:url'

/**
 * Tailwind looks for its config in the process's working directory, which in
 * development is the server's (Vite runs embedded in the Express process), so
 * the path is given explicitly. `react-router build` runs from this folder and
 * is unaffected.
 */
export default {
  plugins: {
    tailwindcss: { config: fileURLToPath(new URL('./tailwind.config.js', import.meta.url)) },
    autoprefixer: {},
  },
}
