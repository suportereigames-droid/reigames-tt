import { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, RefreshControl, Pressable } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'

const money = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`

const PERIODOS = [
  { chave: 'hoje', label: 'Hoje' },
  { chave: '7dias', label: '7 dias' },
  { chave: '30dias', label: '30 dias' },
  { chave: 'tudo', label: 'Tudo' }
]

function dataCorte(periodo) {
  const agora = new Date()
  if (periodo === 'hoje') { agora.setHours(0, 0, 0, 0); return agora.toISOString() }
  if (periodo === '7dias') { agora.setDate(agora.getDate() - 7); return agora.toISOString() }
  if (periodo === '30dias') { agora.setDate(agora.getDate() - 30); return agora.toISOString() }
  return null
}

const CORES_JOGO = ['#E7B94C', '#28C08A', '#7C9EF2', '#E8562F', '#C084FC', '#F472B6']

export default function Dashboard() {
  const { profile, isAdmin, user, signOut } = useAuth()
  const router = useRouter()
  const [periodo, setPeriodo] = useState('7dias')
  const [stats, setStats] = useState({
    pedidosAbertos: 0, disponivel: 0, vendido: 0, faturado: 0, visitas: 0, porJogo: [], porJogoMinhas: [], vendasPorJogo: []
  })
  const [onlineAgora, setOnlineAgora] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    const corte = dataCorte(periodo)

    let pedidosQuery = supabase.from('orders').select('status, amount, created_at, product_game')
    if (corte) pedidosQuery = pedidosQuery.gte('created_at', corte)

    const [{ data: produtos }, { data: pedidos }, visitas] = await Promise.all([
      supabase.from('products').select('status, game, created_by'),
      pedidosQuery,
      isAdmin
        ? (() => {
            let q = supabase.from('site_visits').select('id', { count: 'exact', head: true })
            if (corte) q = q.gte('created_at', corte)
            return q
          })()
        : Promise.resolve({ count: null })
    ])

    const disponivel = produtos?.filter((p) => p.status === 'disponivel').length || 0
    // "Vendido" agora vem dos PEDIDOS pagos, não do status da conta — assim
    // continua correto mesmo que o anúncio seja apagado depois da venda.
    const pedidosPagos = pedidos?.filter((p) => p.status === 'pago') || []
    const vendido = pedidosPagos.length
    const faturado = pedidosPagos.reduce((s, p) => s + Number(p.amount), 0)
    const pedidosAbertos = pedidos?.filter((p) => p.status === 'pendente').length || 0

    const vendasPorJogoMap = {}
    pedidosPagos.forEach((p) => {
      const jogo = p.product_game || 'Sem categoria'
      if (!vendasPorJogoMap[jogo]) vendasPorJogoMap[jogo] = { unidades: 0, valor: 0 }
      vendasPorJogoMap[jogo].unidades += 1
      vendasPorJogoMap[jogo].valor += Number(p.amount)
    })
    const vendasPorJogo = Object.entries(vendasPorJogoMap)
      .map(([game, dados]) => ({ game, ...dados }))
      .sort((a, b) => b.valor - a.valor)

    const contagemPorJogo = {}
    const contagemPorJogoMinhas = {}
    produtos?.forEach((p) => {
      if (p.status !== 'disponivel') return
      contagemPorJogo[p.game] = (contagemPorJogo[p.game] || 0) + 1
      if (p.created_by === user?.id) {
        contagemPorJogoMinhas[p.game] = (contagemPorJogoMinhas[p.game] || 0) + 1
      }
    })
    const porJogo = Object.entries(contagemPorJogo)
      .map(([game, total]) => ({ game, total }))
      .sort((a, b) => b.total - a.total)
    const porJogoMinhas = Object.entries(contagemPorJogoMinhas)
      .map(([game, total]) => ({ game, total }))
      .sort((a, b) => b.total - a.total)

    setStats({ disponivel, vendido, faturado, visitas: visitas.count || 0, pedidosAbertos, porJogo, porJogoMinhas, vendasPorJogo })
  }, [isAdmin, periodo, user?.id])

  useFocusEffect(useCallback(() => { load() }, [load]))

  // Presença em tempo real: conta quantas abas do SITE estão abertas agora.
  useEffect(() => {
    if (!isAdmin) return
    const canal = supabase.channel('site-presence')
    canal
      .on('presence', { event: 'sync' }, () => {
        setOnlineAgora(Object.keys(canal.presenceState()).length)
      })
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [isAdmin])

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const maiorJogo = stats.porJogo[0]?.total || 1
  const maiorJogoMinhas = stats.porJogoMinhas[0]?.total || 1

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl tintColor="#E7B94C" refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Olá, {profile?.full_name?.split(' ')[0] || ''}</Text>
      <Text style={styles.subtitle}>
        {isAdmin ? 'Visão geral de toda a loja' : 'Resumo das suas contas e pedidos'}
      </Text>

      {/* Seletor de período */}
      <View style={styles.periodoRow}>
        {PERIODOS.map((p) => (
          <Pressable
            key={p.chave}
            onPress={() => setPeriodo(p.chave)}
            style={[styles.periodoChip, periodo === p.chave && styles.periodoChipAtivo]}
          >
            <Text style={[styles.periodoTexto, periodo === p.chave && styles.periodoTextoAtivo]}>{p.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Card grande de faturamento */}
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>{isAdmin ? 'Faturado no período' : 'Você faturou no período'}</Text>
        <Text style={styles.heroValue}>{money(stats.faturado)}</Text>
      </View>

      {/* Visitas + online agora (só admin) */}
      {isAdmin && (
        <View style={styles.visitasCard}>
          <View>
            <Text style={styles.visitasLabel}>Visitas no site no período</Text>
            <Text style={styles.visitasValor}>{stats.visitas}</Text>
          </View>
          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineTexto}>{onlineAgora} no site agora</Text>
          </View>
        </View>
      )}

      {/* Grid de números rápidos */}
      <View style={styles.grid}>
        <Card label="Pedidos em aberto" value={stats.pedidosAbertos} color="#E7B94C" onPress={() => router.push('/pedidos')} />
        <Card label="Contas disponíveis" value={stats.disponivel} color="#28C08A" onPress={() => router.push('/produtos')} />
        <Card label="Contas vendidas" value={stats.vendido} color="#8B93A7" />
      </View>

      {/* Contas disponíveis por jogo */}
      {stats.vendasPorJogo.length > 0 && (
        <View style={styles.porJogoCard}>
          <Text style={styles.porJogoTitulo}>Vendas por jogo (no período)</Text>
          {stats.vendasPorJogo.map((item, i) => (
            <View key={item.game} style={styles.porJogoLinha}>
              <View style={styles.porJogoTextos}>
                <Text style={styles.porJogoNome}>{item.game}</Text>
                <Text style={styles.porJogoNumero}>{item.unidades} vendida{item.unidades > 1 ? 's' : ''} · {money(item.valor)}</Text>
              </View>
              <View style={styles.barraFundo}>
                <View
                  style={[
                    styles.barraPreenchida,
                    { width: `${(item.valor / (stats.vendasPorJogo[0]?.valor || 1)) * 100}%`, backgroundColor: CORES_JOGO[i % CORES_JOGO.length] }
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      )}

      {stats.porJogo.length > 0 && (
        <View style={styles.porJogoCard}>
          <Text style={styles.porJogoTitulo}>Contas disponíveis no site (geral)</Text>
          {stats.porJogo.map((item, i) => (
            <View key={item.game} style={styles.porJogoLinha}>
              <View style={styles.porJogoTextos}>
                <Text style={styles.porJogoNome}>{item.game}</Text>
                <Text style={styles.porJogoNumero}>{item.total}</Text>
              </View>
              <View style={styles.barraFundo}>
                <View
                  style={[
                    styles.barraPreenchida,
                    { width: `${(item.total / maiorJogo) * 100}%`, backgroundColor: CORES_JOGO[i % CORES_JOGO.length] }
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      )}

      {stats.porJogoMinhas.length > 0 ? (
        <View style={styles.porJogoCard}>
          <Text style={styles.porJogoTitulo}>Minhas contas disponíveis</Text>
          {stats.porJogoMinhas.map((item, i) => (
            <View key={item.game} style={styles.porJogoLinha}>
              <View style={styles.porJogoTextos}>
                <Text style={styles.porJogoNome}>{item.game}</Text>
                <Text style={styles.porJogoNumero}>{item.total}</Text>
              </View>
              <View style={styles.barraFundo}>
                <View
                  style={[
                    styles.barraPreenchida,
                    { width: `${(item.total / maiorJogoMinhas) * 100}%`, backgroundColor: CORES_JOGO[i % CORES_JOGO.length] }
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.porJogoCard}>
          <Text style={styles.porJogoTitulo}>Minhas contas disponíveis</Text>
          <Text style={{ color: '#8B93A7', fontSize: 13 }}>
            Você não tem nenhuma conta disponível no momento — bom momento pra postar mais.
          </Text>
        </View>
      )}

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
  title: { color: '#FFFFFF', fontSize: 26, fontWeight: '700' },
  subtitle: { color: '#8B93A7', marginTop: 2, marginBottom: 18 },

  periodoRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  periodoChip: { flex: 1, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#2A2F3B', alignItems: 'center' },
  periodoChipAtivo: { backgroundColor: '#E7B94C', borderColor: '#E7B94C' },
  periodoTexto: { color: '#8B93A7', fontSize: 12, fontWeight: '600' },
  periodoTextoAtivo: { color: '#0F1115' },

  heroCard: {
    backgroundColor: '#1D212C', borderRadius: 16, padding: 20, marginBottom: 12,
    borderWidth: 1, borderColor: '#2A2F3B'
  },
  heroLabel: { color: '#8B93A7', fontSize: 13 },
  heroValue: { color: '#E7B94C', fontSize: 36, fontWeight: '800', marginTop: 6 },

  visitasCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#161922', borderRadius: 14, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#2A2F3B'
  },
  visitasLabel: { color: '#8B93A7', fontSize: 12 },
  visitasValor: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', marginTop: 2 },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0F1115', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 20 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#28C08A' },
  onlineTexto: { color: '#28C08A', fontSize: 11, fontWeight: '600' },

  grid: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  card: { flex: 1, backgroundColor: '#161922', borderColor: '#2A2F3B', borderWidth: 1, borderRadius: 12, padding: 12 },
  cardLabel: { color: '#8B93A7', fontSize: 11 },
  cardValue: { fontSize: 20, fontWeight: '700', marginTop: 6 },

  porJogoCard: { backgroundColor: '#161922', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#2A2F3B', marginBottom: 16 },
  porJogoTitulo: { color: '#FFFFFF', fontWeight: '700', marginBottom: 12 },
  porJogoLinha: { marginBottom: 10 },
  porJogoTextos: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  porJogoNome: { color: '#FFFFFF', fontSize: 13 },
  porJogoNumero: { color: '#8B93A7', fontSize: 13 },
  barraFundo: { height: 6, borderRadius: 3, backgroundColor: '#0F1115', overflow: 'hidden' },
  barraPreenchida: { height: 6, borderRadius: 3 },

  linkCard: { padding: 14, borderRadius: 10, backgroundColor: '#1D212C', marginBottom: 8 },
  linkCardText: { color: '#E7B94C', fontWeight: '600' },
  signOut: { marginTop: 8, alignItems: 'center', padding: 12 },
  signOutText: { color: '#E8562F' }
})
