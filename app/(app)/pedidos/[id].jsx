import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, Pressable, Linking, ActivityIndicator } from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../../../lib/supabase.js'

const money = (v) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`

const OPCOES_STATUS = [
  { valor: 'pendente', texto: 'Pendente', cor: '#E7B94C' },
  { valor: 'pago', texto: 'Pago', cor: '#28C08A' },
  { valor: 'cancelado', texto: 'Cancelado', cor: '#E8562F' }
]

export default function PedidoDetalhe() {
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const [pedido, setPedido] = useState(null)
  const [salvando, setSalvando] = useState(false)

  const load = useCallback(async () => {
    // Se o pedido não for de um produto seu (e você não for admin), a RLS
    // simplesmente não devolve a linha.
    const { data } = await supabase
      .from('orders')
      .select('id, buyer_name, buyer_whatsapp, amount, status, mp_payment_id, created_at, products(title, game)')
      .eq('id', id)
      .single()
    setPedido(data)
  }, [id])

  useFocusEffect(useCallback(() => { load() }, [load]))

  async function atualizarStatus(novoStatus) {
    setSalvando(true)
    await supabase.from('orders').update({ status: novoStatus }).eq('id', id)
    await load()
    setSalvando(false)
  }

  function abrirWhatsapp() {
    const numero = pedido.buyer_whatsapp.replace(/\D/g, '')
    Linking.openURL(`https://wa.me/55${numero}`)
  }

  if (!pedido) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#E7B94C" />
      </View>
    )
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.game}>{pedido.products?.game}</Text>
      <Text style={styles.title}>{pedido.products?.title}</Text>
      <Text style={styles.amount}>{money(pedido.amount)}</Text>

      <View style={styles.section}>
        <Text style={styles.label}>Comprador</Text>
        <Text style={styles.value}>{pedido.buyer_name}</Text>
        <Text style={styles.value}>{pedido.buyer_whatsapp}</Text>
        <Pressable style={styles.whatsBtn} onPress={abrirWhatsapp}>
          <Text style={styles.whatsBtnText}>Chamar no WhatsApp para entrega</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Status do pedido</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {OPCOES_STATUS.map((op) => (
            <Pressable
              key={op.valor}
              disabled={salvando}
              onPress={() => atualizarStatus(op.valor)}
              style={[
                styles.statusBtn,
                { borderColor: op.cor },
                pedido.status === op.valor && { backgroundColor: op.cor }
              ]}
            >
              <Text style={{ color: pedido.status === op.valor ? '#0F1115' : op.cor, fontWeight: '600' }}>
                {op.texto}
              </Text>
            </Pressable>
          ))}
        </View>
        {pedido.mp_payment_id && (
          <Text style={styles.mpInfo}>Confirmado pelo Mercado Pago (pagamento #{pedido.mp_payment_id})</Text>
        )}
      </View>

      <Pressable style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>Voltar</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0F1115', padding: 20 },
  center: { flex: 1, backgroundColor: '#0F1115', justifyContent: 'center' },
  game: { color: '#28C08A', fontSize: 12, textTransform: 'uppercase' },
  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', marginTop: 2 },
  amount: { color: '#E7B94C', fontSize: 20, fontWeight: '700', marginTop: 6 },
  section: { marginTop: 24, borderTopColor: '#2A2F3B', borderTopWidth: 1, paddingTop: 16 },
  label: { color: '#8B93A7', fontSize: 12, textTransform: 'uppercase' },
  value: { color: '#FFFFFF', fontSize: 15, marginTop: 4 },
  whatsBtn: { marginTop: 12, backgroundColor: '#28C08A', padding: 12, borderRadius: 8, alignItems: 'center' },
  whatsBtnText: { color: '#0F1115', fontWeight: '700' },
  statusBtn: { borderWidth: 1, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16 },
  mpInfo: { color: '#8B93A7', fontSize: 12, marginTop: 12 },
  back: { marginTop: 32, alignItems: 'center' },
  backText: { color: '#8B93A7' }
})
