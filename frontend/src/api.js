// Re-export the Supabase-powered API service.
// All 17 files that import { api } from '../api.js' continue to work unchanged.
export { api } from './lib/supabaseService.js';

// Asset URLs are now absolute Supabase Storage URLs — no prefix needed.
export const ASSET_ORIGIN = '';
