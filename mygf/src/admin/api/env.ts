// src/api/env.ts
// Force mock by default so dev works even if you forget .env
const USE_MOCK_ENV = (import.meta.env.VITE_USE_MOCK ?? 'true').toString().toLowerCase()
export const USE_MOCK =
  USE_MOCK_ENV === 'true' ||
  USE_MOCK_ENV === '1' ||
  !import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_URL === '/mock'

export const API_URL = import.meta.env.VITE_API_URL || '/api'
