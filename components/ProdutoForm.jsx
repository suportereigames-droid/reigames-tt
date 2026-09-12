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
    game: GAMES[0], title: '', description: '', price: '', whatsapp: '', status: 'disponivel'
  })
  const [media, setMedia] = useState([])
  const [novosArquivos, setNovosArquivos] = useState([])
  const [carregando, setCarregando] = useState(isEditing)
  const [salvando, setSalvando] = useState(false)
  const [enviandoMidia, setEnviandoMidia] = useState(false)

  useEffect(() => {
    if (!isEditing) return
    supabase.from('products').select('*').eq('id', id).single().then(({ data }) => {
      if (data) {
        setForm({
          game: data.game, title: data.title, description: data.description,
          price: String(data.price), whatsapp: data.whatsapp || '', status: data.status
        })
        setMedia(data.media || [])
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
      setNovosArquivos((prev) => [...prev, ...resultado.assets])
    }
  }

  function removerNovoArquivo(index) {
    setNovosArquivos((prev) => prev.filter((_, i) => i !== index))
  }

  async function removerMidiaSalva(index) {
    const item = media[index]
    await supabase.storage.from(BUCKET).remove([item.path])
    setMedia((prev) => prev.filter((_, i) => i !== index))
  }

  async function enviarNovosArquivos() {
    const enviados = []
    for (const asset of novosArquivos) {
      const tipo = asset.type === 'video' ? 'video' : 'image'
      const extensao = (asset.uri.split('.').pop() || (tipo === 'video' ? 'mp4' : 'jpg')).split('?')[0]
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extensao}`
      const resposta = await fetch(asset.uri)
      const arrayBuffer = await resposta.arrayBuffer()
      const { error } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
        contentType: asset.mimeType || (tipo === 'video' ? 'video/mp4' : 'image/jpeg')
      })
      if (error) throw error
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
      enviados.push({ type: tipo, path, url: data.publicUrl })
    }
    return enviados
  }

  async function salvar() {
    if (!form.title || !form.price) {
      Alert.alert('Preencha ao menos o título e o preço.')
      return
    }
    setSalvando(true)
    setEnviandoMidia(novosArquivos.length > 0)
    try {
      const enviados = await enviarNovosArquivos()
      const payload = {
        game: form.game, title: form.title, description: form.description,
        price: Number(form.price), whatsapp: form.whatsapp, status: form.status,
        media: [...media, ...enviados]
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

      <Text style={styles.label}>Fotos e vídeos</Text>
      <View style={styles.midiaRow}>
        {media.map((m, i) => (
          <View key={`salvo-${i}`} style={styles.midiaItem}>
            {m.type === 'video' ? (
              <View style={[styles.thumb, styles.videoThumb]}><Text style={{ color: '#8B93A7', fontSize: 10 }}>VÍDEO</Text></View>
            ) : (
              <Image source={{ uri: m.url }} style={styles.thumb} />
            )}
            <Pressable style={styles.removerBtn} onPress={() => removerMidiaSalva(i)}>
              <Text style={styles.removerBtnText}>✕</Text>
            </Pressable>
          </View>
        ))}
        {novosArquivos.map((a, i) => (
          <View key={`novo-${i}`} style={styles.midiaItem}>
            {a.type === 'video' ? (
              <View style={[styles.thumb, styles.videoThumb]}><Text style={{ color: '#E7B94C', fontSize: 10 }}>NOVO VÍDEO</Text></View>
            ) : (
              <Image source={{ uri: a.uri }} style={styles.thumb} />
            )}
            <Pressable style={styles.removerBtn} onPress={() => removerNovoArquivo(i)}>
              <Text style={styles.removerBtnText}>✕</Text>
            </Pressable>
          </View>
        ))}
        <Pressable style={styles.addMidiaBtn} onPress={escolherMidia}>
          <Text style={{ color: '#E7B94C', fontSize: 24 }}>+</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>Toque no + para escolher fotos ou vídeos da galeria (pode escolher vários juntos).</Text>

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
  input: { backgroundColor: '#1D212C', borderColor: '#2A2F3B', borderWidth: 1, borderRadius: 8, color: '#FFFFFF', padding: 12 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#2A2F3B', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  chipActive: { backgroundColor: '#E7B94C', borderColor: '#E7B94C' },
  chipText: { color: '#8B93A7', fontSize: 12 },
  chipTextActive: { color: '#0F1115', fontWeight: '700' },
  midiaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  midiaItem: { position: 'relative' },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: '#1D212C' },
  videoThumb: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2A2F3B' },
  removerBtn: { position: 'absolute', top: -6, right: -6, backgroundColor: '#0F1115', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  removerBtnText: { color: '#E8562F', fontSize: 12 },
  addMidiaBtn: { width: 72, height: 72, borderRadius: 8, borderWidth: 1, borderColor: '#E7B94C', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  hint: { color: '#8B93A7', fontSize: 11, marginTop: 8 },
  saveBtn: { backgroundColor: '#E7B94C', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 28, marginBottom: 40 },
  saveBtnText: { color: '#0F1115', fontWeight: '700', fontSize: 16 }
})
