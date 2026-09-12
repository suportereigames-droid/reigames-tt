import { useEffect, useState } from 'react'
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../context/AuthContext.jsx'

const GAMES = ['EFOOTBALL', 'Clash of Clans', 'Clash Royale', 'Brawl Stars', 'Hay Day', 'Wartune Ultra']
const STATUS = ['disponivel', 'reservado', 'vendido', 'oculto']

export default function ProdutoForm({ id }) {
  const { user } = useAuth()
  const router = useRouter()
  const isEditing = Boolean(id)

  const [form, setForm] = useState({
    game: GAMES[0], title: '', description: '', price: '', whatsapp: '', status: 'disponivel'
  })
  const [carregando, setCarregando] = useState(isEditing)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!isEditing) return
    supabase.from('products').select('*').eq('id', id).single().then(({ data }) => {
      if (data) {
        setForm({
          game: data.game, title: data.title, description: data.description,
          price: String(data.price), whatsapp: data.whatsapp || '', status: data.status
        })
      }
      setCarregando(false)
    })
  }, [id])

  async function salvar() {
    if (!form.title || !form.price) {
      Alert.alert('Preencha ao menos o título e o preço.')
      return
    }
    setSalvando(true)
    const payload = {
      game: form.game, title: form.title, description: form.description,
      price: Number(form.price), whatsapp: form.whatsapp, status: form.status
    }
    const { error } = isEditing
      ? await supabase.from('products').update(payload).eq('id', id)
      : await supabase.from('products').insert({ ...payload, created_by: user.id })
    setSalvando(false)
    if (error) {
      Alert.alert('Não foi possível salvar', 'Verifique os campos e tente de novo.')
      return
    }
    router.replace('/produtos')
  }

  if (carregando) return <View style={styles.screen} />

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.label}>Jogo</Text>
      <View style={styles.chipsRow}>
        {GAMES.map((g) => (
          <Pressable key={g} onPress={() => setForm({ ...form, game: g })} style={[styles.chip, form.game === g && styles.chipActive]}>
            <Text style={[styles.chipText, form.game === g && styles.chipTextActive]}>{g}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Título do anúncio</Text>
      <TextInput style={styles.input} value={form.title} onChangeText={(v) => setForm({ ...form, title: v })} placeholderTextColor="#8B93A7" />

      <Text style={styles.label}>Descrição</Text>
      <TextInput
        style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
        multiline
        value={form.description}
        onChangeText={(v) => setForm({ ...form, description: v })}
      />

      <Text style={styles.label}>Preço (R$)</Text>
      <TextInput style={styles.input} keyboardType="decimal-pad" value={form.price} onChangeText={(v) => setForm({ ...form, price: v })} />

      <Text style={styles.label}>WhatsApp para entrega</Text>
      <TextInput style={styles.input} value={form.whatsapp} onChangeText={(v) => setForm({ ...form, whatsapp: v })} />

      <Text style={styles.label}>Status</Text>
      <View style={styles.chipsRow}>
        {STATUS.map((s) => (
          <Pressable key={s} onPress={() => setForm({ ...form, status: s })} style={[styles.chip, form.status === s && styles.chipActive]}>
            <Text style={[styles.chipText, form.status === s && styles.chipTextActive]}>{s}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.saveBtn} onPress={salvar} disabled={salvando}>
        <Text style={styles.saveBtnText}>{salvando ? 'Salvando...' : 'Salvar conta'}</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0F1115' },
  label: { color: '#8B93A7', fontSize: 12, textTransform: 'uppercase', marginTop: 16, marginBottom: 6 },
  input: { backgroundColor: '#1D212C', borderColor: '#2A2F3B', borderWidth: 1, borderRadius: 8, color: '#FFFFFF', padding: 12 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#2A2F3B', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  chipActive: { backgroundColor: '#E7B94C', borderColor: '#E7B94C' },
  chipText: { color: '#8B93A7', fontSize: 12 },
  chipTextActive: { color: '#0F1115', fontWeight: '700' },
  saveBtn: { backgroundColor: '#E7B94C', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 28, marginBottom: 40 },
  saveBtnText: { color: '#0F1115', fontWeight: '700', fontSize: 16 }
})
