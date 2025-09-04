// src/admin/api/config.ts
import { api } from './client'
export async function getPlatformFee(): Promise<number> {
  const r = await api.get('/config/platform')
  // returns paise
  return r.data?.platformFee ?? 0
}
