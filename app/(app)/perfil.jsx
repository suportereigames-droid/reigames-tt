import { useCallback, useState } from 'react'
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, Alert } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'

export default function Perfil() {
  const { user, profile } = useAuth()
  const [nome, setNome] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [salvando, setSalvando] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('full_name, whatsapp').eq('id', user.id).single()
    if (data) {
      setNome(data.full_name || '')
      setWhatsapp(data.whatsapp || '')
    }
  }, [user?.id])

  useFocusEffect(useCallback(() => { load() }, [load]))

  async function salvar() {
    setSalvando(true)
    const { error } = await supabase.from('profiles').update({ full_name: nome, whatsapp }).eq('id', user.id)
    setSalvando(false)
    if (error) {
      Alert.alert('Não foi possível salvar', 'Tente novamente.')
      return
    }
    Alert.alert('Perfil atualizado!')
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.title}>Meu perfil</Text>
      <Text style={styles.subtitle}>
        Esse é o WhatsApp que vai junto em todas as contas que você cadastrar — configura uma vez aqui, não precisa mais digitar em cada anúncio.
      </Text>

      <Text style={styles.label}>Nome</Text>
      <TextInput style={styles.input} value={nome} onChangeText={setNome} placeholderTextColor="#8B93A7" />

      <Text style={styles.label}>Seu WhatsApp</Text>
      <TextInput
        style={styles.input}
        value={whatsapp}
        onChangeText={setWhatsapp}
        placeholder="(DDD) 9 9999-9999"
        placeholderTextColor="#8B93A7"
        keyboardType="phone-pad"
      />

      <Pressable style={styles.saveBtn} onPress={salvar} disabled={salvando}>
        <Text style={styles.saveBtnText}>{salvando ? 'Salvando...' : 'Salvar'}</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0F1115' },
  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  subtitle: { color: '#8B93A7', fontSize: 13, marginTop: 6, marginBottom: 20 },
  label: { color: '#8B93A7', fontSize: 12, textTransform: 'uppercase', marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: '#1D212C', borderColor: '#2A2F3B', borderWidth: 1, borderRadius: 8, color: '#FFFFFF', padding: 12 },
  saveBtn: { backgroundColor: '#E7B94C', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#0F1115', fontWeight: '700', fontSize: 16 }
})
