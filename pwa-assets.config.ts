import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config'

// Genera los PNG del manifest (192, 512, maskable, apple-touch) y el favicon a partir del SVG.
// Ejecuta `pnpm icons` cada vez que cambie public/icons/icon.svg.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...preset,
    maskable: { ...preset.maskable, resizeOptions: { background: '#5A4BE6' } },
    apple: { ...preset.apple, resizeOptions: { background: '#5A4BE6' } },
  },
  images: ['public/icons/icon.svg'],
})
