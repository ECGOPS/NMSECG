import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from 'vite-plugin-pwa';
import { securityConfig } from './src/config/security';
import fs from 'fs';
// import imagemin from 'vite-plugin-imagemin'; // Removed for security

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');
  
  // Check if .env file exists and its format
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const envLines = envContent.split('\n');
    envLines.forEach(line => {
      if (line.trim() && !line.startsWith('#')) {
        const hasVitePrefix = line.startsWith('VITE_');
        const hasEquals = line.includes('=');
        if (!hasVitePrefix || !hasEquals) {
          console.warn(`Warning: Environment variable "${line.split('=')[0]}" is not properly formatted. It should start with VITE_ and contain a value.`);
        }
      }
    });
  }

  // Check for properly formatted environment variables
  Object.entries(env).forEach(([key, value]) => {
    if (key.startsWith('VITE_') && !value) {
      console.warn(`Warning: Environment variable ${key} is not properly formatted. It should start with VITE_ and contain a value.`);
    }
  });

  return {
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      cors: securityConfig.cors,
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(self)',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.google.com https://*.googleapis.com https://*.gstatic.com https://*.googletagmanager.com https://www.youtube.com https://*.youtube.com; style-src 'self' 'unsafe-inline' https://*.google.com https://*.googleapis.com https://*.gstatic.com; img-src 'self' data: https: blob: http://localhost:3001 https://localhost:3001 https://*.google.com https://*.googleapis.com https://*.gstatic.com; connect-src 'self' https: wss: data: http://localhost:3001 https://localhost:3001 https://*.google.com https://*.googleapis.com https://www.google.com https://www.youtube.com https://*.youtube.com https://*.googlevideo.com; font-src 'self' data: https: https://*.google.com https://*.gstatic.com; object-src 'none'; media-src 'self' https://*.firebasestorage.googleapis.com https://*.firebasestorage.app https://firebasestorage.googleapis.com https://www.youtube.com https://*.youtube.com https://*.googlevideo.com; frame-src 'self' https://www.google.com https://www.google.com/maps/ https://*.googleapis.com https://*.gstatic.com https://www.youtube.com https://*.youtube.com https://*.youtu.be https://player.vimeo.com; worker-src 'self' blob:; manifest-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests",
        // COEP removed - YouTube embeds don't support CORP headers
        // 'Cross-Origin-Embedder-Policy': 'credentialless',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Resource-Policy': 'same-site'
      }
    },
    plugins: [
      react(),
      // imagemin({ ... }) // Removed for security
      // VitePWA({
      //   registerType: 'autoUpdate',
      //   includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      //   manifest: {
      //     name: 'FaultMaster',
      //     short_name: 'FaultMaster',
      //     description: 'FaultMaster - Fault Management System',
      //     theme_color: '#ffffff',
      //     icons: [
      //       {
      //         src: 'pwa-192x192.png',
      //         sizes: '192x192',
      //         type: 'image/png'
      //       },
      //       {
      //         src: 'pwa-512x512.png',
      //         sizes: '512x512',
      //         type: 'image/png'
      //       }
      //     ]
      //   },
      //   workbox: {
      //     globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
      //     runtimeCaching: [
      //       {
      //         urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
      //         handler: 'CacheFirst',
      //         options: {
      //         cacheName: 'google-fonts-cache',
      //         expiration: {
      //           maxEntries: 10,
      //           maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
      //         },
      //         cacheableResponse: {
      //           statuses: [0, 200]
      //         }
      //       },
      //       {
      //         urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
      //         handler: 'CacheFirst',
      //         options: {
      //           cacheName: 'gstatic-fonts-cache',
      //           expiration: {
      //             maxEntries: 10,
      //             maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
      //           },
      //           cacheableResponse: {
      //             statuses: [0, 200]
      //           }
      //         }
      //       },
      //       {
      //         urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
      //         handler: 'CacheFirst',
      //         options: {
      //           cacheName: 'images-cache',
      //           expiration: {
      //             maxEntries: 60,
      //             maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
      //           }
      //         }
      //       }
      //     ]
      //   }
      // })
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    optimizeDeps: {
      exclude: ['crypto'],
      include: [
        'react',
        'react-dom',
        '@mui/material',
        '@mui/icons-material',
        'date-fns',
        'moment',
        'lodash',
        'react-hook-form',
        '@hookform/resolvers',
        'zod',
        'recharts',
        '@react-google-maps/api',
        '@googlemaps/adv-markers-utils'
      ]
    },
    build: {
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.info', 'console.debug'],
          passes: 2
        },
        mangle: {
          safari10: true
        },
        format: {
          comments: false
        }
      },
      rollupOptions: {
        external: ['crypto'],
        output: {
          manualChunks: {
            'vendor': ['react', 'react-dom'],
            'ui': ['@mui/material', '@mui/icons-material', 'antd'],
            'utils': ['date-fns', 'moment', 'lodash'],
            'forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
            'charts': ['recharts'],
            'maps': ['@react-google-maps/api', '@googlemaps/adv-markers-utils'],
            // 'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
            'routing': ['react-router-dom', 'react-router'],
            'pdf': ['jspdf', 'jspdf-autotable'],
            'ui-components': [
              '@/components/ui/button',
              '@/components/ui/card',
              '@/components/ui/dialog',
              '@/components/ui/select',
              '@/components/ui/dropdown-menu',
              '@/components/ui/tabs',
              '@/components/ui/accordion',
              '@/components/ui/table',
              '@/components/ui/input',
              '@/components/ui/textarea',
              '@/components/ui/checkbox',
              '@/components/ui/radio-group',
              '@/components/ui/avatar',
              '@/components/ui/badge',
              '@/components/ui/label',
              '@/components/ui/alert',
              '@/components/ui/scroll-area',
              '@/components/ui/pagination'
            ]
          },
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]'
        }
      },
      chunkSizeWarningLimit: 2000,
      sourcemap: false,
      cssCodeSplit: true,
      assetsInlineLimit: 4096,
      target: 'es2015',
      modulePreload: {
        polyfill: true
      },
      reportCompressedSize: false,
      cssMinify: true
    }
  };
});
