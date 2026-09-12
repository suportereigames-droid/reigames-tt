import { useCallback, useState } from 'react'
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { supabase } from '../../../lib/supabase.js'
import { useAuth } from '../../../context/AuthContext.jsx'

const money = (v) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`

const STATUS = {
  pendente: { texto: 'Pendente', cor: '#E7B94C' },
  pago: { texto: 'Pago', cor: '#28C08A' },
  cancelado: { texto: 'Cancelado', cor: '#E8562F' },
  estornado: { texto: 'Estornado', cor: '#8B93A7' }
}

export default function Pedidos() {
  const { isAdmin } = useAuth()
  const router = useRouter()
  const [pedidos, setPedidos] = useState([])
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    // A RLS de "orders" já limita: membro só vê pedidos onde seller_id = ele mesmo.
    const { data } = await supabase
      .from('orders')
      .select('id, buyer_name, buyer_whatsapp, amount, status, created_at, products(title, game)')
      .order('created_at', { ascending: false })
    setPedidos(data || [])
  }, [])

  useFocusEffect(useCallback(() => { load() }, [load]))

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={pedidos}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl tintColor="#E7B94C" refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>Nenhum pedido por aqui ainda.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/pedidos/${item.id}`)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.game}>{item.products?.game}</Text>
              <Text style={styles.title}>{item.products?.title}</Text>
              <Text style={styles.buyer}>{item.buyer_name} · {item.buyer_whatsapp}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.amount}>{money(item.amount)}</Text>
              <Text style={{ color: STATUS[item.status]?.cor, fontSize: 12, marginTop: 4 }}>
                {STATUS[item.status]?.texto}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0F1115' },
  empty: { color: '#8B93A7', textAlign: 'center', marginTop: 40 },
  card: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#161922', borderColor: '#2A2F3B', borderWidth: 1,
    borderRadius: 10, padding: 14, marginBottom: 10
  },
  game: { color: '#28C08A', fontSize: 11, textTransform: 'uppercase' },
  title: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginTop: 2 },
  buyer: { color: '#8B93A7', fontSize: 12, marginTop: 4 },
  amount: { color: '#E7B94C', fontSize: 16, fontWeight: '700' }
})
