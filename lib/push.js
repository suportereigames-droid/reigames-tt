import { useEffect } from 'react'
import Constants from 'expo-constants'
import { Platform, Alert } from 'react-native'
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
  try {
    if (!Device.isDevice) return // notificações push não funcionam em emulador

    const { status: existing } = await Notifications.getPermissionsAsync()
    let status = existing
    if (existing !== 'granted') {
      const req = await Notifications.requestPermissionsAsync()
      status = req.status
    }
    if (status !== 'granted') {
      Alert.alert('Notificações desativadas', 'Sem a permissão de notificação, você não vai receber avisos de pedido novo/pago.')
      return
    }

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
    const { error } = await supabase.from('push_tokens').upsert(
      { user_id: userId, expo_token: data, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,expo_token' }
    )
    if (error) {
      Alert.alert('Não foi possível salvar o token de notificação', error.message)
    }
  } catch (err) {
    Alert.alert('Erro ao configurar notificações', String(err?.message || err))
  }
}

// Roda cada etapa manualmente e mostra o resultado de cada uma — usada
// pelo botão "Testar notificações" na tela de Perfil, pra descobrir
// exatamente onde trava sem precisar fazer um pedido de verdade.
export async function diagnosticarPush(userId) {
  const linhas = []

  linhas.push(`Modo Expo Go detectado: ${rodandoNoExpoGo ? 'SIM (é isso que está travando!)' : 'não'}`)
  linhas.push(`appOwnership: ${Constants.appOwnership}`)
  linhas.push(`executionEnvironment: ${Constants.executionEnvironment}`)

  if (rodandoNoExpoGo) {
    Alert.alert('Diagnóstico de notificações', linhas.join('\n'))
    return
  }

  try {
    linhas.push(`É um aparelho físico: ${Device.isDevice ? 'sim' : 'NÃO (é isso que está travando!)'}`)

    const { status: existing } = await Notifications.getPermissionsAsync()
    linhas.push(`Permissão atual: ${existing}`)
    let status = existing
    if (existing !== 'granted') {
      const req = await Notifications.requestPermissionsAsync()
      status = req.status
      linhas.push(`Permissão depois de pedir: ${status}`)
    }
    if (status !== 'granted') {
      linhas.push('PAROU AQUI: sem permissão concedida.')
      Alert.alert('Diagnóstico de notificações', linhas.join('\n'))
      return
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId
    linhas.push(`Project ID usado: ${projectId || '(vazio! isso é um problema)'}`)

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId })
    linhas.push(`Token gerado: ${data ? data.slice(0, 30) + '...' : '(vazio!)'}`)

    const { error } = await supabase.from('push_tokens').upsert(
      { user_id: userId, expo_token: data, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,expo_token' }
    )
    if (error) {
      linhas.push(`ERRO ao salvar no banco: ${error.message}`)
    } else {
      linhas.push('Token salvo no banco com sucesso! ✓')
    }
  } catch (err) {
    linhas.push(`ERRO INESPERADO: ${String(err?.message || err)}`)
  }

  Alert.alert('Diagnóstico de notificações', linhas.join('\n'))
}

// Chame este hook uma vez, logo depois do login (veja app/(app)/_layout.jsx)
export function useRegisterPushToken(userId) {
  useEffect(() => {
    if (userId) registrarToken(userId)
  }, [userId])
}
