// Este arquivo configura e exporta a instância do cliente Supabase para ser usada em toda a aplicação.
// Ele importa as chaves de acesso e a URL do Supabase a partir de um arquivo de constantes, 
// e utiliza o AsyncStorage para armazenar sessões de autenticação em dispositivos móveis.
// A configuração do cliente inclui opções para gerenciamento de autenticação, 
// como auto-refresh de tokens e persistência de sessões. 
// Além disso, o código adiciona um listener para o estado do aplicativo, garantindo que o auto-refresh de tokens seja ativado 
// quando o aplicativo estiver ativo e desativado quando não estiver.


import { anonKey, supaUrl } from '@/constants/supabase'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient, processLock } from '@supabase/supabase-js'
import { AppState, Platform } from 'react-native'
import 'react-native-url-polyfill/auto'

const supabaseUrl = supaUrl;
const supabaseAnonKey = anonKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
})


if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh()
    } else {
      supabase.auth.stopAutoRefresh()
    }
  })
}