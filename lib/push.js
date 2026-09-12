import { useEffect } from 'react'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { supabase } from './supabase'

// Desde a versão 53 do Expo, o Expo Go não suporta mais notificações push
// remotas — só funciona rodando um APK de verdade (build). Por isso, nem
// tentamos carregar o módulo de notificações quando estamos no Expo Go:
// só importar o módulo já quebrava o app antes dessa correção.
const rodandoNoExpoGo = Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient'

let Notifications = null
let Device = null

if (!rodandoNoExpoGo) {
  Notifications = require('expo-notifications')
  Device = require('expo-device')

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false
    })
  })
}

async function registrarToken(userId) {
  if (rodandoNoExpoGo) return // push só funciona em build de verdade, não no Expo Go
  if (!Device.isDevice) return // notificações push não funcionam em emulador

  const { status: existing } = await Notifications.getPermissionsAsync()
  let status = existing
  if (existing !== 'granted') {
    const req = await Notifications.requestPermissionsAsync()
    status = req.status
  }
  if (status !== 'granted') return

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('pedidos', {
      name: 'Pedidos',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#E7B94C'
    })
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId })

  // upsert: cada usuário pode ter mais de um aparelho logado
  await supabase.from('push_tokens').upsert(
    { user_id: userId, expo_token: data, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,expo_token' }
  )
}

// Chame este hook uma vez, logo depois do login (veja app/(app)/_layout.jsx)
export function useRegisterPushToken(userId) {
  useEffect(() => {
    if (userId) registrarToken(userId)
  }, [userId])
}
