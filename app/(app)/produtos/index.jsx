import { useCallback, useMemo, useState } from 'react'
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl, TextInput, Image } from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../../../lib/supabase.js'
import { useAuth } from '../../../context/AuthContext.jsx'

const money = (v) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`
const STATUS_COR = { disponivel: '#28C08A', reservado: '#E7B94C', vendido: '#8B93A7', oculto: '#8B93A7' }

export default function Produtos() {
  const { isAdmin, user } = useAuth()
  const router = useRouter()
  const params = useLocalSearchParams() // pode vir de Equipe com { seller, sellerName }

  const [produtos, setProdutos] = useState([])
  const [membros, setMembros] = useState([])
  const [categorias, setCategorias] = useState([])
  const [refreshing, setRefreshing] = useState(false)

  const [busca, setBusca] = useState('')
  const [sellerFiltro, setSellerFiltro] = useState(params.seller || null)
  const [sellerNomeFiltro, setSellerNomeFiltro] = useState(params.sellerName || null)
  const [gameFiltro, setGameFiltro] = useState(null)

  const load = useCallback(async () => {
    // Não dá mais pra confiar só na RLS aqui: desde que liberamos a
    // contagem geral de disponíveis pra todo mundo (painel de Visão
    // Geral), a RLS passou a deixar qualquer membro LER contas
    // disponíveis de outras pessoas também — então filtramos aqui na
    // tela mesmo, pra "Minhas contas" continuar mostrando só as
    // próprias contas de quem não é admin.
    let query = supabase.from('products').select('id, game, title, price, status, created_by, media').order('created_at', { ascending: false })
    if (!isAdmin) query = query.eq('created_by', user.id)

    const [{ data: prods }, { data: perfis }, { data: cats }] = await Promise.all([
      query,
      isAdmin ? supabase.from('profiles').select('id, full_name').order('full_name') : Promise.resolve({ data: [] }),
      supabase.from('categories').select('id, name').order('sort_order')
    ])
    setProdutos(prods || [])
    setMembros(perfis || [])
    setCategorias(cats || [])
  }, [isAdmin, user?.id])

  useFocusEffect(useCallback(() => { load() }, [load]))

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  function limparFiltroPessoa() {
    setSellerFiltro(null)
    setSellerNomeFiltro(null)
    router.setParams({ seller: undefined, sellerName: undefined })
  }

  const filtrados = useMemo(() => {
    const buscaLower = busca.trim().toLowerCase()
    return produtos.filter((p) => {
      if (sellerFiltro && p.created_by !== sellerFiltro) return false
      if (gameFiltro && p.game !== gameFiltro) return false
      if (buscaLower && !p.title.toLowerCase().includes(buscaLower)) return false
      return true
    })
  }, [produtos, busca, sellerFiltro, gameFiltro])

  return (
    <View style={styles.screen}>
      <View style={styles.buscaBox}>
        <Text style={styles.lupa}>🔎</Text>
        <TextInput
          style={styles.buscaInput}
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar pelo título..."
          placeholderTextColor="#8B93A7"
        />
      </View>

      <View style={styles.chipsRow}>
        <Pressable onPress={() => setGameFiltro(null)} style={[styles.chip, !gameFiltro && styles.chipActive]}>
          <Text style={[styles.chipText, !gameFiltro && styles.chipTextActive]}>Todas categorias</Text>
        </Pressable>
        {categorias.map((c) => (
          <Pressable key={c.id} onPress={() => setGameFiltro(c.name)} style={[styles.chip, gameFiltro === c.name && styles.chipActive]}>
            <Text style={[styles.chipText, gameFiltro === c.name && styles.chipTextActive]}>{c.name}</Text>
          </Pressable>
        ))}
      </View>

      {isAdmin && membros.length > 0 && (
        <View style={styles.chipsRow}>
          <Pressable onPress={limparFiltroPessoa} style={[styles.chip, !sellerFiltro && styles.chipActive]}>
            <Text style={[styles.chipText, !sellerFiltro && styles.chipTextActive]}>Toda equipe</Text>
          </Pressable>
          {membros.map((m) => (
            <Pressable
              key={m.id}
              onPress={() => { setSellerFiltro(m.id); setSellerNomeFiltro(m.full_name) }}
              style={[styles.chip, sellerFiltro === m.id && styles.chipActive]}
            >
              <Text style={[styles.chipText, sellerFiltro === m.id && styles.chipTextActive]}>{m.full_name}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {sellerFiltro && (
        <View style={styles.filterBar}>
          <Text style={styles.filterText}>Contas de {sellerNomeFiltro}</Text>
          <Pressable onPress={limparFiltroPessoa}>
            <Text style={styles.filterClear}>limpar</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={filtrados}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl tintColor="#E7B94C" refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma conta encontrada.</Text>}
        renderItem={({ item }) => {
          const capa = item.media?.[0]
          return (
            <Pressable style={styles.card} onPress={() => router.push(`/produtos/${item.id}`)}>
              <View style={styles.thumbBox}>
                {!capa ? (
                  <View style={[styles.thumb, styles.thumbVazio]} />
                ) : capa.type === 'video' ? (
                  <View style={[styles.thumb, styles.thumbVideo]}>
                    <Text style={styles.playIcone}>▶</Text>
                  </View>
                ) : (
                  <Image source={{ uri: capa.url }} style={styles.thumb} resizeMode="cover" />
                )}
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.game}>{item.game}</Text>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.amount}>{money(item.price)}</Text>
                <Text style={{ color: STATUS_COR[item.status], fontSize: 12, marginTop: 4, textTransform: 'capitalize' }}>
                  {item.status}
                </Text>
              </View>
            </Pressable>
          )
        }}
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
  buscaBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1D212C',
    borderColor: '#2A2F3B', borderWidth: 1, borderRadius: 8,
    marginHorizontal: 16, marginTop: 16, paddingHorizontal: 12
  },
  lupa: { fontSize: 14, marginRight: 8 },
  buscaInput: { flex: 1, color: '#FFFFFF', paddingVertical: 10 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginTop: 12 },
  chip: { borderWidth: 1, borderColor: '#2A2F3B', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  chipActive: { backgroundColor: '#E7B94C', borderColor: '#E7B94C' },
  chipText: { color: '#8B93A7', fontSize: 12 },
  chipTextActive: { color: '#0F1115', fontWeight: '700' },
  filterBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#1D212C', padding: 12, marginHorizontal: 16, marginTop: 12, borderRadius: 8
  },
  filterText: { color: '#E7B94C', fontWeight: '600' },
  filterClear: { color: '#8B93A7', fontSize: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#161922', borderColor: '#2A2F3B', borderWidth: 1,
    borderRadius: 10, padding: 10, marginBottom: 10
  },
  thumbBox: { width: 56, height: 56 },
  thumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#1D212C' },
  thumbVazio: { borderWidth: 1, borderColor: '#2A2F3B' },
  thumbVideo: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2A2F3B' },
  playIcone: { color: '#E7B94C', fontSize: 18 },
  game: { color: '#28C08A', fontSize: 11, textTransform: 'uppercase' },
  title: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginTop: 2 },
  amount: { color: '#E7B94C', fontSize: 16, fontWeight: '700' },
  fab: {
    position: 'absolute', bottom: 20, right: 20, backgroundColor: '#E7B94C',
    paddingVertical: 12, paddingHorizontal: 18, borderRadius: 24
  },
  fabText: { color: '#0F1115', fontWeight: '700' }
})
