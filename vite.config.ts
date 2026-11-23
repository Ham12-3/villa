import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const dep = (names: string) => new RegExp(`[\\\\/]node_modules[\\\\/](${names})[\\\\/]`);

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  build: {
    chunkSizeWarningLimit: 1400,
    rolldownOptions: {
      output: {
        // Vendor chunks, so the page shell (React, GSAP, the copy) loads and
        // paints without waiting for three.js, which App imports lazily.
        codeSplitting: {
          groups: [
            { name: 'react', test: dep('react|react-dom|scheduler'), priority: 40 },
            { name: 'motion', test: dep('gsap|lenis'), priority: 30 },
            { name: 'three', test: dep('three'), priority: 20 },
            { name: 'r3f', test: dep('@react-three|postprocessing|n8ao|maath|three-stdlib|troika-[a-z-]+|zustand|its-fine|suspend-react'), priority: 10 },
          ],
        },
      },
    },
  },
});
