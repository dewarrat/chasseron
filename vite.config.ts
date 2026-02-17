import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFile } from 'fs/promises';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-sw',
      async closeBundle() {
        try {
          await copyFile(
            resolve(__dirname, 'public/firebase-messaging-sw.js'),
            resolve(__dirname, 'dist/firebase-messaging-sw.js')
          );
        } catch (err) {
          console.error('Failed to copy service worker:', err);
        }
      }
    }
  ],
});
