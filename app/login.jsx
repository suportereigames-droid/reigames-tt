import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { Redirect } from 'expo-router'
import { useAuth } from '../context/AuthContext.jsx'

export default function Login() {
  const { session, signIn, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  if (loading) return null
  if (session) return <Redirect href="/" />

  async function handleLogin() {
    setSending(true)
    setError('')
    const { error } = await signIn(email, password)
    setSending(false)
    if (error) setError('E-mail ou senha inválidos.')
  }

  return (
    <View style={styles.container}>
      <Text style={styles.brandGold}>REI</Text>
      <Text style={styles.brand}>GAMES</Text>
      <Text style={styles.subtitle}>App da equipe</Text>

      <TextInput
        style={styles.input}
        placeholder="E-mail"
        placeholderTextColor="#8B93A7"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Senha"
        placeholderTextColor="#8B93A7"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {!!error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={handleLogin} disabled={sending}>
        {sending ? <ActivityIndicator color="#0F1115" /> : <Text style={styles.buttonText}>Entrar</Text>}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1115', justifyContent: 'center', padding: 24 },
  brandGold: { color: '#E7B94C', fontSize: 40, fontWeight: '700', textAlign: 'center' },
  brand: { color: '#FFFFFF', fontSize: 40, fontWeight: '700', textAlign: 'center', marginTop: -8 },
  subtitle: { color: '#8B93A7', textAlign: 'center', marginBottom: 32 },
  input: {
    backgroundColor: '#1D212C',
    borderColor: '#2A2F3B',
    borderWidth: 1,
    borderRadius: 8,
    color: '#FFFFFF',
    padding: 14,
    marginBottom: 12
  },
  error: { color: '#E8562F', marginBottom: 12 },
  button: { backgroundColor: '#E7B94C', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#0F1115', fontWeight: '700', fontSize: 16 }
})
