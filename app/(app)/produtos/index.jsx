import { useCallback, useState } from 'react'
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../../../lib/supabase.js'
import { useAuth } from '../../../context/AuthContext.jsx'

const money = (v) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`
const STATUS_COR = { disponivel: '#28C08A', reservado: '#E7B94C', vendido: '#8B93A7', oculto: '#8B93A7' }

export default function Produtos() {
  const { isAdmin } = useAuth()
  const router = useRouter()
  const { seller, sellerName } = useLocalSearchParams() // presente quando vem da tela Equipe
  const [produtos, setProdutos] = useState([])
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    // A RLS já limita: membro só recebe as próprias linhas. O filtro por
    // "seller" só existe para o admin escolher DENTRE as linhas que ele
    // já tem permissão de ver (que é tudo).
    let query = supabase
      .from('products')
      .select('id, game, title, price, status, created_by')
      .order('created_at', { ascending: false })
    if (isAdmin && seller) query = query.eq('created_by', seller)
    const { data } = await query
    setProdutos(data || [])
  }, [isAdmin, seller])

  useFocusEffect(useCallback(() => { load() }, [load]))

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  return (
    <View style={styles.screen}>
      {isAdmin && seller && (
        <View style={styles.filterBar}>
          <Text style={styles.filterText}>Contas de {sellerName}</Text>
          <Pressable onPress={() => router.setParams({ seller: undefined, sellerName: undefined })}>
            <Text style={styles.filterClear}>limpar</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={produtos}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl tintColor="#E7B94C" refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma conta cadastrada ainda.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/produtos/${item.id}`)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.game}>{item.game}</Text>
              <Text style={styles.title}>{item.title}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.amount}>{money(item.price)}</Text>
              <Text style={{ color: STATUS_COR[item.status], fontSize: 12, marginTop: 4, textTransform: 'capitalize' }}>
                {item.status}
              </Text>
            </View>
          </Pressable>
        )}
      />

      <Pressable style={styles.fab} onPress={() => router.push('/produtos/novo')}>
        <Text style={styles.fabText}>+ Nova conta</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0F1115' },
  empty: { color: '#8B93A7', textAlign: 'center', marginTop: 40 },
  filterBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#1D212C', padding: 12, marginHorizontal: 16, marginTop: 16, borderRadius: 8
  },
  filterText: { color: '#E7B94C', fontWeight: '600' },
  filterClear: { color: '#8B93A7', fontSize: 12 },
  card: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#161922', borderColor: '#2A2F3B', borderWidth: 1,
    borderRadius: 10, padding: 14, marginBottom: 10
  },
  game: { color: '#28C08A', fontSize: 11, textTransform: 'uppercase' },
  title: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginTop: 2 },
  amount: { color: '#E7B94C', fontSize: 16, fontWeight: '700' },
  fab: {
    position: 'absolute', bottom: 20, right: 20, backgroundColor: '#E7B94C',
    paddingVertical: 12, paddingHorizontal: 18, borderRadius: 24
  },
  fabText: { color: '#0F1115', fontWeight: '700' }
})
