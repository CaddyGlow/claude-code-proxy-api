import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    target: 'es2015',
    outDir: 'dist',
    rollupOptions: {
      input: 'index.html',
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    },
    cssCodeSplit: false,
    assetsInlineLimit: 100000000, // Inline all assets
    minify: 'esbuild'
  },
  server: {
    port: 5173,
    proxy: {
      '/metrics': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  }
})
