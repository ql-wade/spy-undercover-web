import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],

  build: {
    // === §8.1 包体积目标 < 160KB gzipped ===
    target: 'es2020', // 现代浏览器，减少 polyfill
    cssMinify: true,
    minify: 'esbuild', // 最快的压缩器

    // === 代码分割策略 ===
    rollupOptions: {
      output: {
        // 手动 chunk 分割：vendor 与应用代码分离
        manualChunks: {
          // React 核心单独打包（稳定的长缓存）
          'vendor-react': ['react', 'react-dom'],
          // 状态管理单独打包
          'vendor-state': ['zustand'],
        },
        // 保持 chunk 名称可读（便于调试）
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },

    // === chunk 大小警告阈值 (KB) ===
    chunkSizeWarningLimit: 60, // 超过 60KB 未压缩时警告
  },

  // === 开发体验优化 ===
  esbuild: {
    jsx: 'automatic', // 自动 JSX runtime（React 17+）
    // 生产环境移除 console 和 debugger（通过 Vite build 时自动处理）
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },

  resolve: {
    // 别名配置（预留）
    alias: {
      '@': '/src',
    },
  },
})
