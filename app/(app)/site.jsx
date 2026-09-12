import { useCallback, useState } from 'react'
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, Alert, Image } from 'react-native'
import { useFocusEffect } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../../lib/supabase.js'

const BUCKET = 'product-images'

export default function Site() {
  const [logoUrl, setLogoUrl] = useState('')
  const [rodape, setRodape] = useState({ ano_fundacao: '' })
  const [salvandoRodape, setSalvandoRodape] = useState(false)
  const [enviandoLogo, setEnviandoLogo] = useState(false)
  const [paginas, setPaginas] = useState([])
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ slug: '', menu_label: '', content_html: '', show_in_menu: true })
  const [salvando, setSalvando] = useState(false)

  const [categorias, setCategorias] = useState([])
  const [subcategoriasPorCategoria, setSubcategoriasPorCategoria] = useState({})
  const [categoriaAberta, setCategoriaAberta] = useState(null)
  const [novaCategoria, setNovaCategoria] = useState('')
  const [novaSubcategoria, setNovaSubcategoria] = useState('')

  const load = useCallback(async () => {
    const [{ data: settings }, { data: pages }, { data: cats, error: catsError }, { data: subs, error: subsError }] = await Promise.all([
      supabase.from('site_settings').select('logo_url, ano_fundacao').single(),
      supabase.from('site_pages').select('*').order('sort_order'),
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('subcategories').select('*').order('sort_order')
    ])
    if (catsError) Alert.alert('Erro ao carregar categorias', catsError.message)
    if (subsError) Alert.alert('Erro ao carregar subcategorias', subsError.message)
    setLogoUrl(settings?.logo_url || '')
    setRodape({ ano_fundacao: settings?.ano_fundacao ? String(settings.ano_fundacao) : '' })
    setPaginas(pages || [])
    setCategorias(cats || [])
    const agrupado = {}
    ;(subs || []).forEach((s) => {
      if (!agrupado[s.category_id]) agrupado[s.category_id] = []
      agrupado[s.category_id].push(s)
    })
    setSubcategoriasPorCategoria(agrupado)
  }, [])

  useFocusEffect(useCallback(() => { load() }, [load]))

  async function escolherLogo() {
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permissao.granted) {
      Alert.alert('Precisamos de permissão para acessar suas fotos.')
      return
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9
    })
    if (resultado.canceled) return

    setEnviandoLogo(true)
    try {
      const asset = resultado.assets[0]
      const extensao = (asset.uri.split('.').pop() || 'png').split('?')[0]
      const path = `logo/${Date.now()}.${extensao}`
      const resposta = await fetch(asset.uri)
      const arrayBuffer = await resposta.arrayBuffer()
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
        contentType: asset.mimeType || 'image/png'
      })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
      await supabase.from('site_settings').update({ logo_url: data.publicUrl }).eq('id', true)
      setLogoUrl(data.publicUrl)
      Alert.alert('Logo atualizada!')
    } catch (err) {
      Alert.alert('Não foi possível enviar a logo', 'Tente novamente.')
    } finally {
      setEnviandoLogo(false)
    }
  }

  async function salvarRodape() {
    setSalvandoRodape(true)
    const { error } = await supabase
      .from('site_settings')
      .update({ ano_fundacao: rodape.ano_fundacao ? Number(rodape.ano_fundacao) : null })
      .eq('id', true)
    setSalvandoRodape(false)
    if (error) {
      Alert.alert('Não foi possível salvar', error.message)
      return
    }
    Alert.alert('Salvo!')
  }

  function abrirEdicao(pagina) {
    if (pagina === 'nova') {
      setForm({ slug: '', menu_label: '', content_html: '', show_in_menu: true })
    } else {
      setForm(pagina)
    }
    setEditando(pagina)
  }

  function gerarSlugValido(texto) {
    return texto
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // tira acento
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') // qualquer coisa que não seja letra/número vira hífen
      .replace(/^-+|-+$/g, '') // tira hífen do início/fim
  }

  async function salvarPagina() {
    if (!form.menu_label || !form.slug) {
      Alert.alert('Preencha o nome e o link da página.')
      return
    }
    setSalvando(true)
    const slugLimpo = gerarSlugValido(form.slug)
    const payload = { ...form, slug: slugLimpo }
    const { error } = editando === 'nova'
      ? await supabase.from('site_pages').insert(payload)
      : await supabase.from('site_pages').update(payload).eq('id', form.id)
    setSalvando(false)
    if (error) {
      Alert.alert('Não foi possível salvar', error.message)
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

  async function adicionarCategoria() {
    const nome = novaCategoria.trim()
    if (!nome) return
    const { error } = await supabase.from('categories').insert({ name: nome, sort_order: categorias.length })
    if (error) {
      Alert.alert('Não foi possível criar', error.message)
      return
    }
    setNovaCategoria('')
    load()
  }

  async function excluirCategoria(categoria) {
    Alert.alert(
      `Apagar "${categoria.name}"?`,
      'As subcategorias dela também somem. Contas já cadastradas continuam existindo, só não vão mais achar essa categoria na lista.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar', style: 'destructive', onPress: async () => {
            await supabase.from('categories').delete().eq('id', categoria.id)
            load()
          }
        }
      ]
    )
  }

  async function adicionarSubcategoria(categoriaId) {
    const nome = novaSubcategoria.trim()
    if (!nome) return
    const atuais = subcategoriasPorCategoria[categoriaId] || []
    const { error } = await supabase
      .from('subcategories')
      .insert({ category_id: categoriaId, name: nome, sort_order: atuais.length })
    if (error) {
      Alert.alert('Não foi possível criar', error.message)
      return
    }
    setNovaSubcategoria('')
    load()
  }

  async function excluirSubcategoria(id) {
    await supabase.from('subcategories').delete().eq('id', id)
    load()
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
      {logoUrl ? <Image source={{ uri: logoUrl }} style={styles.logoPreview} resizeMode="contain" /> : null}
      <Pressable style={styles.saveBtnSmall} onPress={escolherLogo} disabled={enviandoLogo}>
        <Text style={styles.saveBtnText}>{enviandoLogo ? 'Enviando...' : logoUrl ? 'Trocar logo' : 'Escolher logo da galeria'}</Text>
      </Pressable>

      <View style={styles.divider} />

      <Text style={styles.title}>Rodapé do site</Text>
      <Text style={styles.hint}>
        O WhatsApp e o Instagram do rodapé/botão flutuante vêm do seu perfil (aba Perfil) — mude por lá.
      </Text>

      <Text style={styles.label}>Ano de fundação</Text>
      <TextInput
        style={styles.input}
        value={rodape.ano_fundacao}
        onChangeText={(v) => setRodape({ ano_fundacao: v.replace(/\D/g, '') })}
        placeholder="2023"
        placeholderTextColor="#8B93A7"
        keyboardType="number-pad"
      />
      <Text style={styles.hint}>Vai aparecer tipo "© 2023–2026" no rodapé, em vez de só o ano atual.</Text>

      <Pressable style={styles.saveBtnSmall} onPress={salvarRodape} disabled={salvandoRodape}>
        <Text style={styles.saveBtnText}>{salvandoRodape ? 'Salvando...' : 'Salvar rodapé'}</Text>
      </Pressable>

      <View style={styles.divider} />

      <Text style={styles.title}>Categorias e subcategorias</Text>
      <Text style={styles.hint}>
        Toca numa categoria pra ver/editar as subcategorias dela. Usadas no cadastro de contas e nos filtros do site.
      </Text>

      <View style={styles.addRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={novaCategoria}
          onChangeText={setNovaCategoria}
          placeholder="Nova categoria (ex: EFOOTBALL)"
          placeholderTextColor="#8B93A7"
        />
        <Pressable style={styles.addBtn} onPress={adicionarCategoria}>
          <Text style={styles.addBtnText}>+</Text>
        </Pressable>
      </View>

      {categorias.map((cat) => (
        <View key={cat.id} style={styles.categoriaBloco}>
          <Pressable
            style={styles.categoriaHeader}
            onPress={() => setCategoriaAberta(categoriaAberta === cat.id ? null : cat.id)}
          >
            <Text style={styles.categoriaNome}>{cat.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Text style={{ color: '#8B93A7', fontSize: 12 }}>
                {(subcategoriasPorCategoria[cat.id] || []).length} subcategoria(s)
              </Text>
              <Pressable onPress={() => excluirCategoria(cat)}>
                <Text style={{ color: '#E8562F' }}>Apagar</Text>
              </Pressable>
            </View>
          </Pressable>

          {categoriaAberta === cat.id && (
            <View style={styles.subcategoriaArea}>
              {(subcategoriasPorCategoria[cat.id] || []).map((sub) => (
                <View key={sub.id} style={styles.subcategoriaLinha}>
                  <Text style={{ color: '#FFFFFF' }}>{sub.name}</Text>
                  <Pressable onPress={() => excluirSubcategoria(sub.id)}>
                    <Text style={{ color: '#E8562F', fontSize: 12 }}>Remover</Text>
                  </Pressable>
                </View>
              ))}
              <View style={styles.addRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={novaSubcategoria}
                  onChangeText={setNovaSubcategoria}
                  placeholder="Nova subcategoria"
                  placeholderTextColor="#8B93A7"
                />
                <Pressable style={styles.addBtn} onPress={() => adicionarSubcategoria(cat.id)}>
                  <Text style={styles.addBtnText}>+</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      ))}

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
  hint: { color: '#8B93A7', fontSize: 12, marginTop: -8, marginBottom: 12 },
  label: { color: '#8B93A7', fontSize: 12, textTransform: 'uppercase', marginTop: 14, marginBottom: 6 },
  input: { backgroundColor: '#1D212C', borderColor: '#2A2F3B', borderWidth: 1, borderRadius: 8, color: '#FFFFFF', padding: 12 },
  saveBtn: { backgroundColor: '#E7B94C', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 24 },
  saveBtnSmall: { backgroundColor: '#E7B94C', borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 10 },
  logoPreview: { width: '100%', height: 80, marginBottom: 4 },
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
  checkboxOn: { backgroundColor: '#E7B94C', borderColor: '#E7B94C' },
  addRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  addBtn: { backgroundColor: '#E7B94C', borderRadius: 8, width: 44, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#0F1115', fontWeight: '700', fontSize: 18 },
  categoriaBloco: {
    backgroundColor: '#161922', borderColor: '#2A2F3B', borderWidth: 1,
    borderRadius: 10, marginBottom: 8, overflow: 'hidden'
  },
  categoriaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  categoriaNome: { color: '#FFFFFF', fontWeight: '600' },
  subcategoriaArea: { borderTopWidth: 1, borderTopColor: '#2A2F3B', padding: 14 },
  subcategoriaLinha: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#2A2F3B'
  }
})
