import { useCallback, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, RefreshControl, Pressable } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'

const money = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`

export default function Dashboard() {
  const { profile, isAdmin, signOut } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState({ disponivel: 0, vendido: 0, faturado: 0, visitas: 0, pedidosAbertos: 0 })
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    // RLS já limita: membro só recebe as próprias linhas; admin recebe tudo.
    const [{ data: produtos }, { data: pedidos }, visitas] = await Promise.all([
      supabase.from('products').select('status'),
      supabase.from('orders').select('status, amount'),
      isAdmin
        ? supabase.from('site_visits').select('id', { count: 'exact', head: true })
        : Promise.resolve({ count: null })
    ])

    const disponivel = produtos?.filter((p) => p.status === 'disponivel').length || 0
    const vendido = produtos?.filter((p) => p.status === 'vendido').length || 0
    const faturado = pedidos?.filter((p) => p.status === 'pago').reduce((s, p) => s + Number(p.amount), 0) || 0
    const pedidosAbertos = pedidos?.filter((p) => p.status === 'pendente').length || 0

    setStats({ disponivel, vendido, faturado, visitas: visitas.count || 0, pedidosAbertos })
  }, [isAdmin])

  useFocusEffect(useCallback(() => { load() }, [load]))

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl tintColor="#E7B94C" refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Olá, {profile?.full_name?.split(' ')[0] || ''}</Text>
      <Text style={styles.subtitle}>
        {isAdmin ? 'Visão geral de toda a loja' : 'Resumo das suas contas e pedidos'}
      </Text>

      <View style={styles.grid}>
        <Card label="Pedidos em aberto" value={stats.pedidosAbertos} color="#E7B94C" onPress={() => router.push('/pedidos')} />
        <Card label="Contas disponíveis" value={stats.disponivel} color="#28C08A" onPress={() => router.push('/produtos')} />
        <Card label="Contas vendidas" value={stats.vendido} color="#8B93A7" />
        <Card label={isAdmin ? 'Faturado (total)' : 'Faturado por você'} value={money(stats.faturado)} color="#E7B94C" />
        {isAdmin && <Card label="Visitas no site" value={stats.visitas} color="#28C08A" />}
      </View>

      {isAdmin && (
        <Pressable style={styles.linkCard} onPress={() => router.push('/equipe')}>
          <Text style={styles.linkCardText}>Ver desempenho por pessoa da equipe →</Text>
        </Pressable>
      )}

      <Pressable style={styles.signOut} onPress={signOut}>
        <Text style={styles.signOutText}>Sair da conta</Text>
      </Pressable>
    </ScrollView>
  )
}

function Card({ label, value, color, onPress }) {
  const Wrapper = onPress ? Pressable : View
  return (
    <Wrapper style={styles.card} onPress={onPress}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={[styles.cardValue, { color }]}>{value}</Text>
    </Wrapper>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0F1115' },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
  subtitle: { color: '#8B93A7', marginTop: 2, marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '47%', backgroundColor: '#161922', borderColor: '#2A2F3B', borderWidth: 1, borderRadius: 10, padding: 14 },
  cardLabel: { color: '#8B93A7', fontSize: 12 },
  cardValue: { fontSize: 22, fontWeight: '700', marginTop: 6 },
  linkCard: { marginTop: 16, padding: 14, borderRadius: 10, backgroundColor: '#1D212C' },
  linkCardText: { color: '#E7B94C', fontWeight: '600' },
  signOut: { marginTop: 24, alignItems: 'center', padding: 12 },
  signOutText: { color: '#E8562F' }
})
