import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Разносим тяжёлые зависимости по отдельным вендор-чанкам,
        // чтобы они кэшировались независимо от кода приложения.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'emotion': ['@emotion/react', '@emotion/styled'],
          'mui-icons': ['@mui/icons-material'],
          'mui': ['@mui/material'],
          'datagrid': ['@mui/x-data-grid'],
          'supabase': ['@supabase/supabase-js'],
        },
      },
    },
  },
})
