import { useCallback, useState } from 'react'
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase.js'

export default function Equipe() {
  const router = useRouter()
  const [membros, setMembros] = useState([])

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

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={{ padding: 16 }}
      data={membros}
      keyExtractor={(item) => item.id}
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
  detalhe: { color: '#8B93A7', fontSize: 11, marginTop: 2 }
})
