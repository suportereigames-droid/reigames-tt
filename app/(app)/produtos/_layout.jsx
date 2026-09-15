import { Stack } from 'expo-router'
import { useAuth } from '../../../context/AuthContext.jsx'

export default function ProdutosLayout() {
  const { isAdmin } = useAuth()

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0F1115' },
        headerTintColor: '#FFFFFF'
      }}
    >
      <Stack.Screen name="index" options={{ title: isAdmin ? 'Contas' : 'Minhas contas' }} />
      <Stack.Screen name="novo" options={{ title: 'Nova conta' }} />
      <Stack.Screen name="[id]" options={{ title: 'Editar conta' }} />
    </Stack>
  )
}
