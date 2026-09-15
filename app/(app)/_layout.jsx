import { Redirect } from 'expo-router'
import { Tabs } from 'expo-router'
import { View, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../context/AuthContext.jsx'
import { useRegisterPushToken } from '../../lib/push.js'

function icone(nome) {
  return ({ color, size }) => <Ionicons name={nome} size={size} color={color} />
}

export default function AppLayout() {
  const { session, user, profile, isAdmin, loading } = useAuth()
  useRegisterPushToken(user?.id)

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F1115', justifyContent: 'center' }}>
        <ActivityIndicator color="#E7B94C" />
      </View>
    )
  }

  if (!session) return <Redirect href="/login" />

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#0F1115' },
        headerTintColor: '#FFFFFF',
        tabBarStyle: { backgroundColor: '#161922', borderTopColor: '#2A2F3B' },
        tabBarActiveTintColor: '#E7B94C',
        tabBarInactiveTintColor: '#8B93A7'
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: icone('home') }} />
      <Tabs.Screen name="pedidos/index" options={{ title: 'Pedidos', tabBarIcon: icone('receipt-outline') }} />
      <Tabs.Screen name="pedidos/[id]" options={{ href: null, title: 'Pedido' }} />
      <Tabs.Screen
        name="produtos"
        options={{ title: isAdmin ? 'Contas' : 'Minhas contas', headerShown: false, tabBarIcon: icone('game-controller-outline') }}
      />
      <Tabs.Screen
        name="equipe"
        options={{ href: isAdmin ? undefined : null, title: 'Equipe', tabBarIcon: icone('people-outline') }}
      />
      <Tabs.Screen
        name="site"
        options={{ href: isAdmin ? undefined : null, title: 'Site', tabBarIcon: icone('globe-outline') }}
      />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: icone('person-circle-outline') }} />
    </Tabs>
  )
}
