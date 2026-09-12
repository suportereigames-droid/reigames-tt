import { useEffect, useState } from 'react'
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, Alert, Image } from 'react-native'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../context/AuthContext.jsx'

const GAMES = ['EFOOTBALL', 'Clash of Clans', 'Clash Royale', 'Brawl Stars', 'Hay Day', 'Wartune Ultra']
const STATUS = ['disponivel', 'reservado', 'vendido', 'oculto']
const BUCKET = 'product-images'

export default function ProdutoForm({ id }) {
  const { user } = useAuth()
  const router = useRouter()
  const isEditing = Boolean(id)

  const [form, setForm] = useState({
    game: GAMES[0], title: '', description: '', price: '', cost: '', status: 'disponivel'
  })
  const [itens, setItens] = useState([])
  const [carregando, setCarregando] = useState(isEditing)
  const [salvando, setSalvando] = useState(false)
  const [enviandoMidia, setEnviandoMidia] = useState(false)

  useEffect(() => {
    if (!isEditing) return
    supabase.from('products').select('*').eq('id', id).single().then(({ data }) => {
      if (data) {
        setForm({
          game: data.game, title: data.title, description: data.description,
          price: String(data.price), cost: data.cost != null ? String(data.cost) : '', status: data.status
        })
        setItens((data.media || []).map((m) => ({ id: m.path, kind: 'existente', type: m.type, path: m.path, url: m.url })))
      }
      setCarregando(false)
    })
  }, [id])

  async function escolherMidia() {
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permissao.granted) {
      Alert.alert('Precisamos de permissão para acessar suas fotos e vídeos.')
      return
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.8
    })
    if (!resultado.canceled) {
      const novos = resultado.assets.map((asset) => ({
        id: `novo-${Date.now()}-${Math.random()}`,
        kind: 'novo',
        type: asset.type === 'video' ? 'video' : 'image',
        asset,
        url: asset.uri
      }))
      setItens((prev) => [...prev, ...novos])
    }
  }

  async function removerItem(item) {
    if (item.kind === 'existente') {
      await supabase.storage.from(BUCKET).remove([item.path])
    }
    setItens((prev) => prev.filter((i) => i.id !== item.id))
  }

  function moverItem(index, direcao) {
    setItens((prev) => {
      const nova = [...prev]
      const destino = index + direcao
      if (destino < 0 || destino >= nova.length) return prev
      ;[nova[index], nova[destino]] = [nova[destino], nova[index]]
      return nova
    })
  }

  async function salvar() {
    if (!form.title || !form.price) {
      Alert.alert('Preencha ao menos o título e o preço.')
      return
    }
    setSalvando(true)
    setEnviandoMidia(itens.some((i) => i.kind === 'novo'))
    try {
      const mediaFinal = []
      for (const item of itens) {
        if (item.kind === 'existente') {
          mediaFinal.push({ type: item.type, path: item.path, url: item.url })
        } else {
          const extensao = (item.asset.uri.split('.').pop() || (item.type === 'video' ? 'mp4' : 'jpg')).split('?')[0]
          const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extensao}`
          const resposta = await fetch(item.asset.uri)
          const arrayBuffer = await resposta.arrayBuffer()
          const { error } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
            contentType: item.asset.mimeType || (item.type === 'video' ? 'video/mp4' : 'image/jpeg')
          })
          if (error) throw error
          const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
          mediaFinal.push({ type: item.type, path, url: data.publicUrl })
        }
      }

      const payload = {
        game: form.game, title: form.title, description: form.description,
        price: Number(form.price), cost: form.cost ? Number(form.cost) : null, status: form.status,
        media: mediaFinal
      }
      const { error } = isEditing
        ? await supabase.from('products').update(payload).eq('id', id)
        : await supabase.from('products').insert({ ...payload, created_by: user.id })
      if (error) throw error
      router.replace('/produtos')
    } catch (err) {
      Alert.alert('Não foi possível salvar', 'Verifique os campos e tente de novo.')
    } finally {
      setSalvando(false)
      setEnviandoMidia(false)
    }
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

      <Text style={styles.label}>Quanto você pagou nessa conta (R$)</Text>
      <TextInput style={styles.input} keyboardType="decimal-pad" value={form.cost} onChangeText={(v) => setForm({ ...form, cost: v })} placeholderTextColor="#8B93A7" placeholder="opcional" />
      <Text style={styles.hint}>
        Só pra seu controle — nunca aparece no site, nem pro comprador, nem pra outros membros da equipe.
        {form.price && form.cost ? ` Margem atual: R$ ${(Number(form.price) - Number(form.cost)).toFixed(2).replace('.', ',')}` : ''}
      </Text>

      <Text style={styles.label}>Status</Text>
      <View style={styles.chipsRow}>
        {STATUS.map((s) => (
          <Pressable key={s} onPress={() => setForm({ ...form, status: s })} style={[styles.chip, form.status === s && styles.chipActive]}>
            <Text style={[styles.chipText, form.status === s && styles.chipTextActive]}>{s}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Fotos e vídeos</Text>
      <Text style={styles.hint}>A primeira é a capa do anúncio. Use as setinhas pra mudar a ordem.</Text>
      <View style={styles.midiaRow}>
        {itens.map((item, i) => (
          <View key={item.id} style={styles.midiaItem}>
            {item.type === 'video' ? (
              <View style={[styles.thumb, styles.videoThumb]}><Text style={{ color: '#8B93A7', fontSize: 10 }}>VÍDEO</Text></View>
            ) : (
              <Image source={{ uri: item.url }} style={styles.thumb} resizeMode="cover" />
            )}
            {i === 0 && (
              <View style={styles.capaBadge}><Text style={styles.capaBadgeTexto}>CAPA</Text></View>
            )}
            <Pressable style={styles.removerBtn} onPress={() => removerItem(item)}>
              <Text style={styles.removerBtnText}>✕</Text>
            </Pressable>
            <View style={styles.moverRow}>
              <Pressable disabled={i === 0} onPress={() => moverItem(i, -1)} style={styles.moverBtn}>
                <Text style={[styles.moverTexto, i === 0 && styles.moverDesabilitado]}>◀</Text>
              </Pressable>
              <Pressable disabled={i === itens.length - 1} onPress={() => moverItem(i, 1)} style={styles.moverBtn}>
                <Text style={[styles.moverTexto, i === itens.length - 1 && styles.moverDesabilitado]}>▶</Text>
              </Pressable>
            </View>
          </View>
        ))}
        <Pressable style={styles.addMidiaBtn} onPress=
cat > components/ProdutoForm.jsx << 'FORMEOF'
import { useEffect, useState } from 'react'
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, Alert, Image } from 'react-native'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../context/AuthContext.jsx'

const GAMES = ['EFOOTBALL', 'Clash of Clans', 'Clash Royale', 'Brawl Stars', 'Hay Day', 'Wartune Ultra']
const STATUS = ['disponivel', 'reservado', 'vendido', 'oculto']
const BUCKET = 'product-images'

export default function ProdutoForm({ id }) {
  const { user } = useAuth()
  const router = useRouter()
  const isEditing = Boolean(id)

  const [form, setForm] = useState({
    game: GAMES[0], title: '', description: '', price: '', cost: '', status: 'disponivel'
  })
  const [itens, setItens] = useState([])
  const [carregando, setCarregando] = useState(isEditing)
  const [salvando, setSalvando] = useState(false)
  const [enviandoMidia, setEnviandoMidia] = useState(false)

  useEffect(() => {
    if (!isEditing) return
    supabase.from('products').select('*').eq('id', id).single().then(({ data }) => {
      if (data) {
        setForm({
          game: data.game, title: data.title, description: data.description,
          price: String(data.price), cost: data.cost != null ? String(data.cost) : '', status: data.status
        })
        setItens((data.media || []).map((m) => ({ id: m.path, kind: 'existente', type: m.type, path: m.path, url: m.url })))
      }
      setCarregando(false)
    })
  }, [id])

  async function escolherMidia() {
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permissao.granted) {
      Alert.alert('Precisamos de permissão para acessar suas fotos e vídeos.')
      return
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.8
    })
    if (!resultado.canceled) {
      const novos = resultado.assets.map((asset) => ({
        id: `novo-${Date.now()}-${Math.random()}`,
        kind: 'novo',
        type: asset.type === 'video' ? 'video' : 'image',
        asset,
        url: asset.uri
      }))
      setItens((prev) => [...prev, ...novos])
    }
  }

  async function removerItem(item) {
    if (item.kind === 'existente') {
      await supabase.storage.from(BUCKET).remove([item.path])
    }
    setItens((prev) => prev.filter((i) => i.id !== item.id))
  }

  function moverItem(index, direcao) {
    setItens((prev) => {
      const nova = [...prev]
      const destino = index + direcao
      if (destino < 0 || destino >= nova.length) return prev
      ;[nova[index], nova[destino]] = [nova[destino], nova[index]]
      return nova
    })
  }

  async function salvar() {
    if (!form.title || !form.price) {
      Alert.alert('Preencha ao menos o título e o preço.')
      return
    }
    setSalvando(true)
    setEnviandoMidia(itens.some((i) => i.kind === 'novo'))
    try {
      const mediaFinal = []
      for (const item of itens) {
        if (item.kind === 'existente') {
          mediaFinal.push({ type: item.type, path: item.path, url: item.url })
        } else {
          const extensao = (item.asset.uri.split('.').pop() || (item.type === 'video' ? 'mp4' : 'jpg')).split('?')[0]
          const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extensao}`
          const resposta = await fetch(item.asset.uri)
          const arrayBuffer = await resposta.arrayBuffer()
          const { error } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
            contentType: item.asset.mimeType || (item.type === 'video' ? 'video/mp4' : 'image/jpeg')
          })
          if (error) throw error
          const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
          mediaFinal.push({ type: item.type, path, url: data.publicUrl })
        }
      }

      const payload = {
        game: form.game, title: form.title, description: form.description,
        price: Number(form.price), cost: form.cost ? Number(form.cost) : null, status: form.status,
        media: mediaFinal
      }
      const { error } = isEditing
        ? await supabase.from('products').update(payload).eq('id', id)
        : await supabase.from('products').insert({ ...payload, created_by: user.id })
      if (error) throw error
      router.replace('/produtos')
    } catch (err) {
      Alert.alert('Não foi possível salvar', 'Verifique os campos e tente de novo.')
    } finally {
      setSalvando(false)
      setEnviandoMidia(false)
    }
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

      <Text style={styles.label}>Quanto você pagou nessa conta (R$)</Text>
      <TextInput style={styles.input} keyboardType="decimal-pad" value={form.cost} onChangeText={(v) => setForm({ ...form, cost: v })} placeholderTextColor="#8B93A7" placeholder="opcional" />
      <Text style={styles.hint}>
        Só pra seu controle — nunca aparece no site, nem pro comprador, nem pra outros membros da equipe.
        {form.price && form.cost ? ` Margem atual: R$ ${(Number(form.price) - Number(form.cost)).toFixed(2).replace('.', ',')}` : ''}
      </Text>

      <Text style={styles.label}>Status</Text>
      <View style={styles.chipsRow}>
        {STATUS.map((s) => (
          <Pressable key={s} onPress={() => setForm({ ...form, status: s })} style={[styles.chip, form.status === s && styles.chipActive]}>
            <Text style={[styles.chipText, form.status === s && styles.chipTextActive]}>{s}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Fotos e vídeos</Text>
      <Text style={styles.hint}>A primeira é a capa do anúncio. Use as setinhas pra mudar a ordem.</Text>
      <View style={styles.midiaRow}>
        {itens.map((item, i) => (
          <View key={item.id} style={styles.midiaItem}>
            {item.type === 'video' ? (
              <View style={[styles.thumb, styles.videoThumb]}><Text style={{ color: '#8B93A7', fontSize: 10 }}>VÍDEO</Text></View>
            ) : (
              <Image source={{ uri: item.url }} style={styles.thumb} resizeMode="cover" />
            )}
            {i === 0 && (
              <View style={styles.capaBadge}><Text style={styles.capaBadgeTexto}>CAPA</Text></View>
            )}
            <Pressable style={styles.removerBtn} onPress={() => removerItem(item)}>
              <Text style={styles.removerBtnText}>✕</Text>
            </Pressable>
            <View style={styles.moverRow}>
              <Pressable disabled={i === 0} onPress={() => moverItem(i, -1)} style={styles.moverBtn}>
                <Text style={[styles.moverTexto, i === 0 && styles.moverDesabilitado]}>◀</Text>
              </Pressable>
              <Pressable disabled={i === itens.length - 1} onPress={() => moverItem(i, 1)} style={styles.moverBtn}>
                <Text style={[styles.moverTexto, i === itens.length - 1 && styles.moverDesabilitado]}>▶</Text>
              </Pressable>
            </View>
          </View>
        ))}
        <Pressable style={styles.addMidiaBtn} onPress={escolherMidia}>
          <Text style={{ color: '#E7B94C', fontSize: 24 }}>+</Text>
        </Pressable>
      </View>

      <Pressable style={styles.saveBtn} onPress={salvar} disabled={salvando}>
        <Text style={styles.saveBtnText}>
          {enviandoMidia ? 'Enviando mídia...' : salvando ? 'Salvando...' : 'Salvar conta'}
        </Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0F1115' },
  label: { color: '#8B93A7', fontSize: 12, textTransform: 'uppercase', marginTop: 16, marginBottom: 6 },
  hint: { color: '#8B93A7', fontSize: 11, marginBottom: 8 },
  input: { backgroundColor: '#1D212C', borderColor: '#2A2F3B', borderWidth: 1, borderRadius: 8, color: '#FFFFFF', padding: 12 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#2A2F3B', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  chipActive: { backgroundColor: '#E7B94C', borderColor: '#E7B94C' },
  chipText: { color: '#8B93A7', fontSize: 12 },
  chipTextActive: { color: '#0F1115', fontWeight: '700' },
  midiaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  midiaItem: { position: 'relative', width: 84 },
  thumb: { width: 84, height: 84, borderRadius: 8, backgroundColor: '#1D212C' },
  videoThumb: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2A2F3B' },
  capaBadge: { position: 'absolute', left: 4, top: 4, backgroundColor: '#E7B94C', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  capaBadgeTexto: { color: '#0F1115', fontSize: 9, fontWeight: '700' },
  removerBtn: { position: 'absolute', top: -6, right: -6, backgroundColor: '#0F1115', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  removerBtnText: { color: '#E8562F', fontSize: 12 },
  moverRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  moverBtn: { paddingHorizontal: 6, paddingVertical: 2 },
  moverTexto: { color: '#E7B94C', fontSize: 14 },
  moverDesabilitado: { color: '#2A2F3B' },
  addMidiaBtn: { width: 84, height: 84, borderRadius: 8, borderWidth: 1, borderColor: '#E7B94C', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  saveBtn: { backgroundColor: '#E7B94C', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 28, marginBottom: 40 },
  saveBtnText: { color: '#0F1115', fontWeight: '700', fontSize: 16 }
})
