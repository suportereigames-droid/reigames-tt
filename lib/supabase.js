import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

// Preencha com os mesmos valores do projeto Supabase usados no site.
const SUPABASE_URL = 'https://ltptdiiblzxzxtzocphy.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_4yF37I3fMEnGcsZN3X_Mgw_3swuMyQr'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
})
