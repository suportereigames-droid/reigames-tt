import { useCallback, useState } from 'react'
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, Alert } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { supabase } from '../../lib/supabase.js'

export default function Site() {
  const [logoUrl, setLogoUrl] = useState('')
  const [paginas, setPaginas] = useState([])
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ slug: '', menu_label: '', content_html: '', show_in_menu: true })
  const [salvando, setSalvando] = useState(false)

  const load = useCallback(async () => {
    const [{ data: settings }, { data: pages }] = await Promise.all([
      supabase.from('site_settings').select('logo_url').single(),
      supabase.from('site_pages').select('*').order('sort_order')
    ])
    setLogoUrl(settings?.logo_url || '')
    setPaginas(pages || [])
  }, [])

  useFocusEffect(useCallback(() => { load() }, [load]))

  async function salvarLogo() {
    await supabase.from('site_settings').update({ logo_url: logoUrl }).eq('id', true)
    Alert.alert('Logo atualizada!')
  }

  function abrirEdicao(pagina) {
    if (pagina === 'nova') {
      setForm({ slug: '', menu_label: '', content_html: '', show_in_menu: true })
    } else {
      setForm(pagina)
    }
    setEditando(pagina)
  }

  async function salvarPagina() {
    if (!form.menu_label || !form.slug) {
      Alert.alert('Preencha o nome e o link da página.')
      return
    }
    setSalvando(true)
    const slugLimpo = form.slug.trim().toLowerCase().replace(/\s+/g, '-')
    const payload = { ...form, slug: slugLimpo }
    const { error } = editando === 'nova'
      ? await supabase.from('site_pages').insert(payload)
      : await supabase.from('site_pages').update(payload).eq('id', form.id)
    setSalvando(false)
    if (error) {
      Alert.alert('Não foi possível salvar', 'Verifique se o link já não está em uso.')
      return
    }
    setEditando(null)
    load()
  }

  async function excluirPagina(id) {
    Alert.alert('Remover página?', 'Isso tira ela do menu do site.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive', onPress: async () => {
          await supabase.from('site_pages').delete().eq('id', id)
          load()
        }
      }
    ])
  }

  if (editando) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20 }}>
        <Text style={styles.title}>{editando === 'nova' ? 'Nova página' : 'Editar página'}</Text>

        <Text style={styles.label}>Nome no menu</Text>
        <TextInput style={styles.input} value={form.menu_label} onChangeText={(v) => setForm({ ...form, menu_label: v })} placeholder="Ex: Grupo WhatsApp" placeholderTextColor="#8B93A7" />

        <Text style={styles.label}>Link (reigames.com.br/pagina/...)</Text>
        <TextInput style={styles.input} value={form.slug} onChangeText={(v) => setForm({ ...form, slug: v })} placeholder="grupo-whatsapp" placeholderTextColor="#8B93A7" autoCapitalize="none" />

        <Text style={styles.label}>Código da página (HTML)</Text>
        <TextInput
          style={[styles.input, { height: 180, textAlignVertical: 'top', fontFamily: 'monospace' }]}
          multiline
          value={form.content_html}
          onChangeText={(v) => setForm({ ...form, content_html: v })}
          placeholder="<h1>Grupos de WhatsApp</h1>..."
          placeholderTextColor="#8B93A7"
        />

        <Pressable style={styles.checkboxRow} onPress={() => setForm({ ...form, show_in_menu: !form.show_in_menu })}>
          <View style={[styles.checkbox, form.show_in_menu && styles.checkboxOn]} />
          <Text style={{ color: '#FFFFFF' }}>Mostrar no menu do site</Text>
        </Pressable>

        <Pressable style={styles.saveBtn} onPress={salvarPagina} disabled={salvando}>
          <Text style={styles.saveBtnText}>{salvando ? 'Salvando...' : 'Salvar página'}</Text>
        </Pressable>
        <Pressable style={{ marginTop: 12, alignItems: 'center' }} onPress={() => setEditando(null)}>
          <Text style={{ color: '#8B93A7' }}>Cancelar</Text>
        </Pressable>
      </ScrollView>
    )
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.title}>Logo do site</Text>
      <TextInput
        style={styles.input}
        value={logoUrl}
        onChangeText={setLogoUrl}
        placeholder="Link direto da imagem da logo"
        placeholderTextColor="#8B93A7"
      />
      <Pressable style={styles.saveBtnSmall} onPress={salvarLogo}>
        <Text style={styles.saveBtnText}>Salvar logo</Text>
      </Pressable>

      <View style={styles.divider} />

      <View style={styles.rowBetween}>
        <Text style={styles.title}>Páginas do menu</Text>
        <Pressable onPress={() => abrirEdicao('nova')}>
          <Text style={{ color: '#E7B94C', fontWeight: '700' }}>+ Nova</Text>
        </Pressable>
      </View>

      {paginas.map((p) => (
        <Pressable key={p.id} style={styles.pageCard} onPress={() => abrirEdicao(p)}>
          <View>
            <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>{p.menu_label}</Text>
            <Text style={{ color: '#8B93A7', fontSize: 12 }}>/pagina/{p.slug}</Text>
          </View>
          <Pressable onPress={() => excluirPagina(p.id)}>
            <Text style={{ color: '#E8562F' }}>Excluir</Text>
          </Pressable>
        </Pressable>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0F1115' },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginBottom: 12 },
  label: { color: '#8B93A7', fontSize: 12, textTransform: 'uppercase', marginTop: 14, marginBottom: 6 },
  input: { backgroundColor: '#1D212C', borderColor: '#2A2F3B', borderWidth: 1, borderRadius: 8, color: '#FFFFFF', padding: 12 },
  saveBtn: { backgroundColor: '#E7B94C', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 24 },
  saveBtnSmall: { backgroundColor: '#E7B94C', borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: '#0F1115', fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#2A2F3B', marginVertical: 24 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#161922', borderColor: '#2A2F3B', borderWidth: 1,
    borderRadius: 10, padding: 14, marginTop: 10
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: '#8B93A7' },
  checkboxOn: { backgroundColor: '#E7B94C', borderColor: '#E7B94C' }
})
