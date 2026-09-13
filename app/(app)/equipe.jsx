import { useCallback, useState } from 'react'
import { View, Text, FlatList, Pressable, StyleSheet, TextInput, Alert } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'

export default function Equipe() {
  const router = useRouter()
  const { isAdmin } = useAuth()
  const [membros, setMembros] = useState([])
  const [mostrarForm, setMostrarForm] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'membro' })

  const load = useCallback(async () => {
    const { data: perfis } = await supabase.from('profiles').select('id, full_name, role').order('full_name')
    const { data: produtos } = await supabase.from('products').select('created_by, status')
    const { data: pedidos } = await supabase.from('orders').select('seller_id, status').eq('status', 'pago')

    const resumo = (perfis || []).map((p) => {
      const dele = (produtos || []).filter((pr) => pr.created_by === p.id)
      const vendasDele = (pedidos || []).filter((o) => o.seller_id === p.id)
      return {
        ...p,
        total: dele.length,
        disponivel: dele.filter((pr) => pr.status === 'disponivel').length,
        vendido: vendasDele.length
      }
    })
    setMembros(resumo)
  }, [])

  useFocusEffect(useCallback(() => { load() }, [load]))

  async function criarMembro() {
    if (!form.fullName.trim() || !form.email.trim() || !form.password) {
      Alert.alert('Preencha nome, e-mail e senha.')
      return
    }
    setSalvando(true)
    try {
      const { data: sessao } = await supabase.auth.getSession()
      const { data, error } = await supabase.functions.invoke('create-team-member', {
        body: {
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role
        },
        headers: { Authorization: `Bearer ${sessao.session.access_token}` }
      })
      if (error || data?.error) {
        Alert.alert('Não foi possível criar', data?.error || error?.message || 'Tente novamente.')
        return
      }
      Alert.alert('Membro criado!', `Agora é só passar o e-mail e a senha pra ${form.fullName} fazer login no app.`)
      setForm({ fullName: '', email: '', password: '', role: 'membro' })
      setMostrarForm(false)
      load()
    } finally {
      setSalvando(false)
    }
  }

  if (mostrarForm) {
    return (
      <View style={styles.screen}>
        <View style={{ padding: 20 }}>
          <Text style={styles.tituloForm}>Adicionar membro da equipe</Text>

          <Text style={styles.label}>Nome</Text>
          <TextInput
            style={styles.input}
            value={form.fullName}
            onChangeText={(v) => setForm({ ...form, fullName: v })}
            placeholderTextColor="#8B93A7"
          />

          <Text style={styles.label}>E-mail (vai usar pra fazer login)</Text>
          <TextInput
            style={styles.input}
            value={form.email}
            onChangeText={(v) => setForm({ ...form, email: v })}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor="#8B93A7"
          />

          <Text style={styles.label}>Senha (mínimo 6 caracteres)</Text>
          <TextInput
            style={styles.input}
            value={form.password}
            onChangeText={(v) => setForm({ ...form, password: v })}
            secureTextEntry
            placeholderTextColor="#8B93A7"
          />
          <Text style={styles.hint}>Você define essa senha agora e já passa pronta pra pessoa — ela pode trocar depois.</Text>

          <Text style={styles.label}>Cargo</Text>
          <View style={styles.chipsRow}>
            <Pressable
              onPress={() => setForm({ ...form, role: 'membro' })}
              style={[styles.chip, form.role === 'membro' && styles.chipActive]}
            >
              <Text style={[styles.chipText, form.role === 'membro' && styles.chipTextActive]}>Membro da equipe</Text>
            </Pressable>
            <Pressable
              onPress={() => setForm({ ...form, role: 'admin' })}
              style={[styles.chip, form.role === 'admin' && styles.chipActive]}
            >
              <Text style={[styles.chipText, form.role === 'admin' && styles.chipTextActive]}>Admin</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>Admin vê tudo (todas as contas, pedidos e vendas). Membro só vê o que ele mesmo postar.</Text>

          <Pressable style={styles.saveBtn} onPress={criarMembro} disabled={salvando}>
            <Text style={styles.saveBtnText}>{salvando ? 'Criando...' : 'Criar login'}</Text>
          </Pressable>
          <Pressable style={{ marginTop: 12, alignItems: 'center' }} onPress={() => setMostrarForm(false)}>
            <Text style={{ color: '#8B93A7' }}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={{ padding: 16 }}
      data={membros}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        isAdmin ? (
          <Pressable style={styles.addBtn} onPress={() => setMostrarForm(true)}>
            <Text style={styles.addBtnText}>+ Adicionar membro da equipe</Text>
          </Pressable>
        ) : null
      }
      renderItem={({ item }) => (
        <Pressable
          style={styles.card}
          onPress={() => router.push({ pathname: '/produtos', params: { seller: item.id, sellerName: item.full_name } })}
        >
          <View>
            <Text style={styles.nome}>{item.full_name}</Text>
            <Text style={styles.papel}>{item.role === 'admin' ? 'admin' : 'membro da equipe'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.total}>{item.total} contas</Text>
            <Text style={styles.detalhe}>{item.disponivel} disponíveis · {item.vendido} vendidas</Text>
          </View>
        </Pressable>
      )}
    />
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0F1115' },
  card: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#161922', borderColor: '#2A2F3B', borderWidth: 1,
    borderRadius: 10, padding: 14, marginBottom: 10
  },
  nome: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  papel: { color: '#8B93A7', fontSize: 12, marginTop: 2 },
  total: { color: '#E7B94C', fontWeight: '700' },
  detalhe: { color: '#8B93A7', fontSize: 11, marginTop: 2 },
  addBtn: { backgroundColor: '#E7B94C', borderRadius: 8, padding: 14, alignItems: 'center', marginBottom: 16 },
  addBtnText: { color: '#0F1115', fontWeight: '700' },
  tituloForm: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginBottom: 16 },
  label: { color: '#8B93A7', fontSize: 12, textTransform: 'uppercase', marginTop: 14, marginBottom: 6 },
  hint: { color: '#8B93A7', fontSize: 11, marginTop: 6 },
  input: { backgroundColor: '#1D212C', borderColor: '#2A2F3B', borderWidth: 1, borderRadius: 8, color: '#FFFFFF', padding: 12 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#2A2F3B', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  chipActive: { backgroundColor: '#E7B94C', borderColor: '#E7B94C' },
  chipText: { color: '#8B93A7', fontSize: 12 },
  chipTextActive: { color: '#0F1115', fontWeight: '700' },
  saveBtn: { backgroundColor: '#E7B94C', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#0F1115', fontWeight: '700' }
})
