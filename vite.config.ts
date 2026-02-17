import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync } from 'fs';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-sw',
      closeBundle() {
        copyFileSync(
          resolve(__dirname, 'public/firebase-messaging-sw.js'),
          resolve(__dirname, 'dist/firebase-messaging-sw.js')
        );
      }
    }
  ],
});
