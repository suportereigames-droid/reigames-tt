import { useCallback, useEffect, useState } from 'react'
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, Alert, Image } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { supabase } from '../../lib/supabase.js'
import { base64ToArrayBuffer } from '../../lib/base64ToArrayBuffer.js'
import { useAuth } from '../../context/AuthContext.jsx'

const BUCKET = 'product-images'

export default function Site() {
  const { user, isAdmin } = useAuth()
  const [secao, setSecao] = useState('menu') // 'menu' | 'configuracoes' | 'categorias' | 'categorias-pagina' | 'paginas' | 'menu-site' | 'loja-pessoal'

  const [membros, setMembros] = useState([])
  const [alvoLojaId, setAlvoLojaId] = useState(null)
  const [lojaForm, setLojaForm] = useState({ slug: '', display_name: '', titulo: '', logo_url: '', frases: '', banner_text: '', banner_video_url: '' })
  const [carregandoLoja, setCarregandoLoja] = useState(false)
  const [salvandoLoja, setSalvandoLoja] = useState(false)
  const [enviandoLogoLoja, setEnviandoLogoLoja] = useState(false)
  const [salvoLoja, setSalvoLoja] = useState(false)

  const [logoUrl, setLogoUrl] = useState('')
  const [rodape, setRodape] = useState({ rodape_texto: '' })
  const [salvandoRodape, setSalvandoRodape] = useState(false)
  const [enviandoLogo, setEnviandoLogo] = useState(false)
  const [enviandoImagemPagina, setEnviandoImagemPagina] = useState(false)
  const [paginas, setPaginas] = useState([])
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ slug: '', menu_label: '', content_html: '', page_category_id: null, image_url: null, gallery_category_id: null })
  const [salvando, setSalvando] = useState(false)

  const [categorias, setCategorias] = useState([])
  const [subcategoriasPorCategoria, setSubcategoriasPorCategoria] = useState({})
  const [categoriaAberta, setCategoriaAberta] = useState(null)
  const [novaCategoria, setNovaCategoria] = useState('')
  const [novaSubcategoria, setNovaSubcategoria] = useState('')

  const [categoriasPagina, setCategoriasPagina] = useState([])
  const [novaCategoriaPagina, setNovaCategoriaPagina] = useState('')

  const [banners, setBanners] = useState([])
  const [frasesRotativas, setFrasesRotativas] = useState('')
  const [parceriasCategoriaId, setParceriasCategoriaId] = useState(null)
  const [salvandoBanner, setSalvandoBanner] = useState(false)

  const [itensMenu, setItensMenu] = useState([])
  const [tipoNovoItem, setTipoNovoItem] = useState('pagina')
  const [novoItemPagina, setNovoItemPagina] = useState('')
  const [novoItemCategoria, setNovoItemCategoria] = useState('')
  const [novoItemLabel, setNovoItemLabel] = useState('')
  const [novoItemUrl, setNovoItemUrl] = useState('')

  const load = useCallback(async () => {
    const [{ data: settings }, { data: pages }, { data: cats, error: catsError }, { data: subs, error: subsError }] = await Promise.all([
      supabase.from('site_settings').select('logo_url, rodape_texto, frases_rotativas, parcerias_categoria_id').single(),
      supabase.from('site_pages').select('*').order('sort_order'),
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('subcategories').select('*').order('sort_order')
    ])
    if (catsError) Alert.alert('Erro ao carregar categorias', catsError.message)
    if (subsError) Alert.alert('Erro ao carregar subcategorias', subsError.message)
    setLogoUrl(settings?.logo_url || '')
    setRodape({ rodape_texto: settings?.rodape_texto || '' })
    setPaginas(pages || [])
    setCategorias(cats || [])
    const agrupado = {}
    ;(subs || []).forEach((s) => {
      if (!agrupado[s.category_id]) agrupado[s.category_id] = []
      agrupado[s.category_id].push(s)
    })
    setSubcategoriasPorCategoria(agrupado)
    const { data: catsPagina } = await supabase.from('page_categories').select('*').order('sort_order')
    setCategoriasPagina(catsPagina || [])
    const { data: mi } = await supabase
      .from('menu_items')
      .select('*, site_pages(menu_label), page_categories(name)')
      .order('sort_order')
    setItensMenu(mi || [])

    const { data: bnrs } = await supabase.from('banner_slides').select('*').order('sort_order')
    setBanners(bnrs || [])
    setFrasesRotativas(settings?.frases_rotativas || '')
    setParceriasCategoriaId(settings?.parcerias_categoria_id || null)

    if (isAdmin) {
      const { data: perfis } = await supabase.from('profiles').select('id, full_name').order('full_name')
      setMembros(perfis || [])
    }
    setAlvoLojaId((atual) => atual || user?.id)
  }, [isAdmin, user?.id])

  useFocusEffect(useCallback(() => { load() }, [load]))

  async function escolherLogo() {
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permissao.granted) {
      Alert.alert('Precisamos de permissão para acessar suas fotos.')
      return
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9
    })
    if (resultado.canceled) return

    setEnviandoLogo(true)
    try {
      const asset = resultado.assets[0]
      const extensao = (asset.uri.split('.').pop() || 'png').split('?')[0]
      const path = `logo/${Date.now()}.${extensao}`
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 })
      const arrayBuffer = base64ToArrayBuffer(base64)
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

  async function escolherImagemPagina() {
    try {
      const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permissao.granted) {
        Alert.alert('Precisamos de permissão para acessar suas fotos.')
        return
      }
      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9
      })
      if (resultado.canceled) {
        Alert.alert('Seleção cancelada', 'Nenhuma imagem foi escolhida.')
        return
      }
      if (!resultado.assets || !resultado.assets[0]) {
        Alert.alert('Não foi possível ler a imagem escolhida.')
        return
      }

      setEnviandoImagemPagina(true)
      const asset = resultado.assets[0]
      const extensao = (asset.uri.split('.').pop() || 'jpg').split('?')[0]
      const path = `paginas/${Date.now()}.${extensao}`
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 })
      const arrayBuffer = base64ToArrayBuffer(base64)
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
        contentType: asset.mimeType || 'image/jpeg'
      })
      if (uploadError) {
        Alert.alert('Erro ao enviar a imagem', uploadError.message)
        return
      }
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
      setForm((f) => ({ ...f, image_url: data.publicUrl }))
      Alert.alert('Imagem adicionada!')
    } catch (err) {
      Alert.alert('Erro inesperado', String(err?.message || err))
    } finally {
      setEnviandoImagemPagina(false)
    }
  }

  async function salvarRodape() {
    setSalvandoRodape(true)
    const { error } = await supabase
      .from('site_settings')
      .update({ rodape_texto: rodape.rodape_texto || null })
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
      setForm({ slug: '', menu_label: '', content_html: '', page_category_id: null, image_url: null, gallery_category_id: null })
    } else {
      setForm(pagina)
    }
    setEditando(pagina)
  }

  function gerarSlugValido(texto) {
    return texto
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
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
    Alert.alert('Remover página?', 'Isso apaga a página (e tira ela do menu, se estiver lá).', [
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

  async function escolherImagemGenerica() {
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permissao.granted) {
      Alert.alert('Precisamos de permissão para acessar suas fotos.')
      return null
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 })
    if (resultado.canceled || !resultado.assets?.[0]) return null

    const asset = resultado.assets[0]
    const extensao = (asset.uri.split('.').pop() || 'jpg').split('?')[0]
    const path = `icones/${Date.now()}.${extensao}`
    const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 })
    const arrayBuffer = base64ToArrayBuffer(base64)
    const { error } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
      contentType: asset.mimeType || 'image/jpeg'
    })
    if (error) {
      Alert.alert('Não foi possível enviar a imagem', error.message)
      return null
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return data.publicUrl
  }

  useEffect(() => {
    if (!alvoLojaId) return
    setCarregandoLoja(true)
    setSalvoLoja(false)
    supabase
      .from('seller_pages')
      .select('*')
      .eq('seller_id', alvoLojaId)
      .single()
      .then(({ data }) => {
        if (data) {
          setLojaForm({
            slug: data.slug,
            display_name: data.display_name,
            titulo: data.titulo || '',
            logo_url: data.logo_url || '',
            frases: data.frases || '',
            banner_text: data.banner_text || '',
            banner_video_url: data.banner_video_url || ''
          })
        } else {
          const nome = alvoLojaId === user?.id ? '' : membros.find((m) => m.id === alvoLojaId)?.full_name || ''
          setLojaForm({ slug: '', display_name: nome, titulo: '', logo_url: '', frases: '', banner_text: '', banner_video_url: '' })
        }
        setCarregandoLoja(false)
      })
  }, [alvoLojaId])

  async function enviarLogoLoja() {
    setEnviandoLogoLoja(true)
    const url = await escolherImagemGenerica()
    setEnviandoLogoLoja(false)
    if (!url) return
    setLojaForm((f) => ({ ...f, logo_url: url }))
  }

  async function salvarLoja() {
    if (!lojaForm.slug.trim() || !lojaForm.display_name.trim()) {
      Alert.alert('Preenche pelo menos o link e o nome de exibição.')
      return
    }
    setSalvandoLoja(true)
    const slugLimpo = lojaForm.slug.trim().toLowerCase().replace(/\s+/g, '-')
    const { error } = await supabase.from('seller_pages').upsert({
      seller_id: alvoLojaId,
      slug: slugLimpo,
      display_name: lojaForm.display_name,
      titulo: lojaForm.titulo || null,
      logo_url: lojaForm.logo_url || null,
      frases: lojaForm.frases || null,
      banner_text: lojaForm.banner_text,
      banner_video_url: lojaForm.banner_video_url
    })
    setSalvandoLoja(false)
    if (error) {
      Alert.alert('Não foi possível salvar', error.message.includes('duplicate') ? 'Esse link já está em uso, escolhe outro.' : error.message)
      return
    }
    setLojaForm((f) => ({ ...f, slug: slugLimpo }))
    setSalvoLoja(true)
  }

  async function definirImagemCategoria(categoria) {
    const url = await escolherImagemGenerica()
    if (!url) return
    await supabase.from('categories').update({ image_url: url }).eq('id', categoria.id)
    load()
  }

  async function definirImagemSubcategoria(sub) {
    const url = await escolherImagemGenerica()
    if (!url) return
    await supabase.from('subcategories').update({ image_url: url }).eq('id', sub.id)
    load()
  }

  async function adicionarBanner() {
    const url = await escolherImagemGenerica()
    if (!url) return
    const { error } = await supabase.from('banner_slides').insert({ image_url: url, sort_order: banners.length })
    if (error) {
      Alert.alert('Não foi possível adicionar', error.message)
      return
    }
    load()
  }

  async function moverBanner(index, direcao) {
    const nova = [...banners]
    const destino = index + direcao
    if (destino < 0 || destino >= nova.length) return
    ;[nova[index], nova[destino]] = [nova[destino], nova[index]]
    setBanners(nova)
    await Promise.all(nova.map((b, i) => supabase.from('banner_slides').update({ sort_order: i }).eq('id', b.id)))
  }

  async function excluirBanner(id) {
    await supabase.from('banner_slides').delete().eq('id', id)
    load()
  }

  async function salvarFrasesEParcerias() {
    setSalvandoBanner(true)
    const { error } = await supabase
      .from('site_settings')
      .update({ frases_rotativas: frasesRotativas || null, parcerias_categoria_id: parceriasCategoriaId })
      .eq('id', true)
    setSalvandoBanner(false)
    if (error) {
      Alert.alert('Não foi possível salvar', error.message)
      return
    }
    Alert.alert('Salvo!')
  }

  async function criarCategoriaPagina() {
    const nome = novaCategoriaPagina.trim()
    if (!nome) return
    const { error } = await supabase.from('page_categories').insert({ name: nome, sort_order: categoriasPagina.length })
    if (error) {
      Alert.alert('Não foi possível criar', error.message)
      return
    }
    setNovaCategoriaPagina('')
    load()
  }

  async function excluirCategoriaPagina(categoria) {
    Alert.alert(
      `Apagar "${categoria.name}"?`,
      'As páginas que estavam nela ficam sem categoria — nenhuma página é apagada.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar', style: 'destructive', onPress: async () => {
            await supabase.from('page_categories').delete().eq('id', categoria.id)
            load()
          }
        }
      ]
    )
  }

  async function adicionarItemMenu() {
    const payload = { tipo: tipoNovoItem, sort_order: itensMenu.length }
    if (tipoNovoItem === 'pagina') {
      if (!novoItemPagina) return Alert.alert('Escolha uma página.')
      payload.page_id = novoItemPagina
    } else if (tipoNovoItem === 'categoria') {
      if (!novoItemCategoria) return Alert.alert('Escolha uma categoria.')
      payload.page_category_id = novoItemCategoria
    } else {
      if (!novoItemLabel.trim() || !novoItemUrl.trim()) return Alert.alert('Preencha o texto e o link.')
      payload.label = novoItemLabel.trim()
      payload.url = novoItemUrl.trim()
    }
    const { error } = await supabase.from('menu_items').insert(payload)
    if (error) {
      Alert.alert('Não foi possível adicionar', error.message)
      return
    }
    setNovoItemPagina(''); setNovoItemCategoria(''); setNovoItemLabel(''); setNovoItemUrl('')
    load()
  }

  async function moverItemMenu(index, direcao) {
    const nova = [...itensMenu]
    const destino = index + direcao
    if (destino < 0 || destino >= nova.length) return
    ;[nova[index], nova[destino]] = [nova[destino], nova[index]]
    setItensMenu(nova)
    await Promise.all(nova.map((item, i) => supabase.from('menu_items').update({ sort_order: i }).eq('id', item.id)))
  }

  async function removerItemMenu(id) {
    await supabase.from('menu_items').delete().eq('id', id)
    load()
  }

  function nomeItemMenu(item) {
    if (item.tipo === 'pagina') return item.site_pages?.menu_label || '(página removida)'
    if (item.tipo === 'categoria') return item.page_categories?.name || '(categoria removida)'
    return item.label
  }

  // ---------- Cabeçalho com botão de voltar ----------
  function Cabecalho({ titulo }) {
    return (
      <Pressable style={styles.voltarRow} onPress={() => setSecao('menu')}>
        <Ionicons name="chevron-back" size={20} color="#E7B94C" />
        <Text style={styles.voltarTexto}>{titulo}</Text>
      </Pressable>
    )
  }

  // ---------- Tela: edição de uma página específica ----------
  if (secao === 'paginas' && editando) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20 }}>
        <Pressable style={styles.voltarRow} onPress={() => setEditando(null)}>
          <Ionicons name="chevron-back" size={20} color="#E7B94C" />
          <Text style={styles.voltarTexto}>{editando === 'nova' ? 'Nova página' : 'Editar página'}</Text>
        </Pressable>

        <Text style={styles.label}>Nome no menu</Text>
        <TextInput style={styles.input} value={form.menu_label} onChangeText={(v) => setForm({ ...form, menu_label: v })} placeholder="Ex: Grupo WhatsApp" placeholderTextColor="#8B93A7" />

        <Text style={styles.label}>Link (reigames.com.br/pagina/...)</Text>
        <TextInput style={styles.input} value={form.slug} onChangeText={(v) => setForm({ ...form, slug: v })} placeholder="grupo-whatsapp" placeholderTextColor="#8B93A7" autoCapitalize="none" />

        <Text style={styles.label}>Imagem da página (opcional)</Text>
        <Text style={styles.hint}>Usada na galeria da categoria, se essa página estiver numa.</Text>
        {form.image_url ? <Image source={{ uri: form.image_url }} style={styles.logoPreview} resizeMode="cover" /> : null}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable style={[styles.saveBtnSmall, { flex: 1 }]} onPress={escolherImagemPagina} disabled={enviandoImagemPagina}>
            <Text style={styles.saveBtnText}>{enviandoImagemPagina ? 'Enviando...' : form.image_url ? 'Trocar imagem' : 'Escolher imagem da galeria'}</Text>
          </Pressable>
          {form.image_url && (
            <Pressable
              style={[styles.saveBtnSmall, { backgroundColor: '#2A2F3B' }]}
              onPress={() => setForm((f) => ({ ...f, image_url: null }))}
            >
              <Text style={[styles.saveBtnText, { color: '#E8562F' }]}>Remover</Text>
            </Pressable>
          )}
        </View>

        <Text style={[styles.label, { marginTop: 20 }]}>Código da página (HTML)</Text>
        <TextInput
          style={[styles.input, { height: 180, textAlignVertical: 'top', fontFamily: 'monospace' }]}
          multiline
          value={form.content_html}
          onChangeText={(v) => setForm({ ...form, content_html: v })}
          placeholder="<h1>Grupos de WhatsApp</h1>..."
          placeholderTextColor="#8B93A7"
        />

        <Text style={styles.label}>Esta página mostra a galeria de imagens de uma categoria? (opcional)</Text>
        <Text style={styles.hint}>
          Se escolher uma categoria aqui, essa página vira sozinha uma lista com a imagem + nome de cada
          página dentro dela — o código HTML acima é ignorado nesse caso.
        </Text>
        <View style={styles.chipsRow}>
          <Pressable
            onPress={() => setForm({ ...form, gallery_category_id: null })}
            style={[styles.chip, !form.gallery_category_id && styles.chipActive]}
          >
            <Text style={[styles.chipText, !form.gallery_category_id && styles.chipTextActive]}>Não é galeria</Text>
          </Pressable>
          {categoriasPagina.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => setForm({ ...form, gallery_category_id: c.id })}
              style={[styles.chip, form.gallery_category_id === c.id && styles.chipActive]}
            >
              <Text style={[styles.chipText, form.gallery_category_id === c.id && styles.chipTextActive]}>Galeria de "{c.name}"</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Agrupar dentro de uma categoria (opcional)</Text>
        <View style={styles.chipsRow}>
          <Pressable
            onPress={() => setForm({ ...form, page_category_id: null })}
            style={[styles.chip, !form.page_category_id && styles.chipActive]}
          >
            <Text style={[styles.chipText, !form.page_category_id && styles.chipTextActive]}>Nenhuma</Text>
          </Pressable>
          {categoriasPagina.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => setForm({ ...form, page_category_id: c.id })}
              style={[styles.chip, form.page_category_id === c.id && styles.chipActive]}
            >
              <Text style={[styles.chipText, form.page_category_id === c.id && styles.chipTextActive]}>{c.name}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.hint}>
          Só agrupa visualmente. Pra aparecer no menu do site, adicione a página (ou a categoria) em Site → Menu do site.
        </Text>

        <Pressable style={styles.saveBtn} onPress={salvarPagina} disabled={salvando}>
          <Text style={styles.saveBtnText}>{salvando ? 'Salvando...' : 'Salvar página'}</Text>
        </Pressable>
        <Pressable style={{ marginTop: 12, alignItems: 'center' }} onPress={() => setEditando(null)}>
          <Text style={{ color: '#8B93A7' }}>Cancelar</Text>
        </Pressable>
      </ScrollView>
    )
  }

  // ---------- Tela: Configurações (logo + rodapé) ----------
  if (secao === 'configuracoes') {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20 }}>
        <Cabecalho titulo="Configurações" />

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

        <Text style={styles.label}>Texto do rodapé</Text>
        <TextInput
          style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
          multiline
          value={rodape.rodape_texto}
          onChangeText={(v) => setRodape({ rodape_texto: v })}
          placeholder="© 2023–2026 Rei Games — contas verificadas, entrega com garantia."
          placeholderTextColor="#8B93A7"
        />
        <Text style={styles.hint}>Esse texto aparece exatamente assim, embaixo de todas as páginas do site.</Text>

        <Pressable style={styles.saveBtnSmall} onPress={salvarRodape} disabled={salvandoRodape}>
          <Text style={styles.saveBtnText}>{salvandoRodape ? 'Salvando...' : 'Salvar rodapé'}</Text>
        </Pressable>
      </ScrollView>
    )
  }

  // ---------- Tela: Categorias de página (menu do site) ----------
  if (secao === 'categorias-pagina') {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20 }}>
        <Cabecalho titulo="Categorias de página" />
        <Text style={styles.hint}>
          Agrupam páginas visualmente (ex: Grupos WhatsApp, Termos e Intermediação). Pra aparecer no menu,
          adicione a categoria em Site → Menu do site.
        </Text>

        <View style={styles.addRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={novaCategoriaPagina}
            onChangeText={setNovaCategoriaPagina}
            placeholder="Nova categoria (ex: Grupos WhatsApp)"
            placeholderTextColor="#8B93A7"
          />
          <Pressable style={styles.addBtn} onPress={criarCategoriaPagina}>
            <Text style={styles.addBtnText}>+</Text>
          </Pressable>
        </View>

        {categoriasPagina.length === 0 && <Text style={styles.hint}>Nenhuma categoria criada ainda.</Text>}

        {categoriasPagina.map((cat) => (
          <View key={cat.id} style={styles.pageCard}>
            <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>{cat.name}</Text>
            <Pressable onPress={() => excluirCategoriaPagina(cat)}>
              <Text style={{ color: '#E8562F' }}>Apagar</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    )
  }

  // ---------- Tela: Menu do site ----------
  if (secao === 'menu-site') {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20 }}>
        <Cabecalho titulo="Menu do site" />
        <Text style={styles.hint}>
          Só o que estiver nessa lista aparece no menu (☰) do site, nessa ordem.
        </Text>

        {itensMenu.length === 0 && <Text style={styles.hint}>Nenhum item no menu ainda.</Text>}

        {itensMenu.map((item, i) => (
          <View key={item.id} style={styles.pageCard}>
            <View>
              <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>{nomeItemMenu(item)}</Text>
              <Text style={{ color: '#8B93A7', fontSize: 11, textTransform: 'uppercase' }}>{item.tipo}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Pressable disabled={i === 0} onPress={() => moverItemMenu(i, -1)}>
                <Text style={{ color: i === 0 ? '#2A2F3B' : '#8B93A7', fontSize: 16 }}>▲</Text>
              </Pressable>
              <Pressable disabled={i === itensMenu.length - 1} onPress={() => moverItemMenu(i, 1)}>
                <Text style={{ color: i === itensMenu.length - 1 ? '#2A2F3B' : '#8B93A7', fontSize: 16 }}>▼</Text>
              </Pressable>
              <Pressable onPress={() => removerItemMenu(item.id)}>
                <Text style={{ color: '#E8562F' }}>Remover</Text>
              </Pressable>
            </View>
          </View>
        ))}

        <View style={styles.divider} />

        <Text style={styles.title}>Adicionar item</Text>
        <View style={styles.chipsRow}>
          {[['pagina', 'Página existente'], ['categoria', 'Categoria'], ['link', 'Link personalizado']].map(([valor, texto]) => (
            <Pressable
              key={valor}
              onPress={() => setTipoNovoItem(valor)}
              style={[styles.chip, tipoNovoItem === valor && styles.chipActive]}
            >
              <Text style={[styles.chipText, tipoNovoItem === valor && styles.chipTextActive]}>{texto}</Text>
            </Pressable>
          ))}
        </View>

        {tipoNovoItem === 'pagina' && (
          <View style={styles.chipsRow}>
            {paginas.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => setNovoItemPagina(p.id)}
                style={[styles.chip, novoItemPagina === p.id && styles.chipActive]}
              >
                <Text style={[styles.chipText, novoItemPagina === p.id && styles.chipTextActive]}>{p.menu_label}</Text>
              </Pressable>
            ))}
            {paginas.length === 0 && <Text style={styles.hint}>Nenhuma página criada ainda.</Text>}
          </View>
        )}

        {tipoNovoItem === 'categoria' && (
          <View style={styles.chipsRow}>
            {categoriasPagina.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => setNovoItemCategoria(c.id)}
                style={[styles.chip, novoItemCategoria === c.id && styles.chipActive]}
              >
                <Text style={[styles.chipText, novoItemCategoria === c.id && styles.chipTextActive]}>{c.name}</Text>
              </Pressable>
            ))}
            {categoriasPagina.length === 0 && <Text style={styles.hint}>Nenhuma categoria criada ainda.</Text>}
          </View>
        )}

        {tipoNovoItem === 'link' && (
          <View>
            <TextInput
              style={styles.input}
              value={novoItemLabel}
              onChangeText={setNovoItemLabel}
              placeholder="Texto do item (ex: Fale conosco)"
              placeholderTextColor="#8B93A7"
            />
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              value={novoItemUrl}
              onChangeText={setNovoItemUrl}
              placeholder="Link (ex: https://... ou /pagina/algo)"
              placeholderTextColor="#8B93A7"
              autoCapitalize="none"
            />
          </View>
        )}

        <Pressable style={[styles.saveBtnSmall, { marginTop: 14 }]} onPress={adicionarItemMenu}>
          <Text style={styles.saveBtnText}>+ Adicionar ao menu</Text>
        </Pressable>
      </ScrollView>
    )
  }

  // ---------- Tela: Banner e Parcerias ----------
  // ---------- Tela: Minha Loja (link pessoal do vendedor) ----------
  if (secao === 'loja-pessoal') {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20 }}>
        <Cabecalho titulo="Minha Loja" />
        <Text style={styles.hint}>
          Configure o link pessoal que mostra só as suas contas — ex: reigames.com.br/{lojaForm.slug || 'seu-link'}
        </Text>

        {isAdmin && (
          <>
            <Text style={styles.label}>Editando a loja de</Text>
            <View style={styles.chipsRow}>
              <Pressable
                onPress={() => setAlvoLojaId(user.id)}
                style={[styles.chip, alvoLojaId === user.id && styles.chipActive]}
              >
                <Text style={[styles.chipText, alvoLojaId === user.id && styles.chipTextActive]}>Você (admin)</Text>
              </Pressable>
              {membros.filter((m) => m.id !== user.id).map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => setAlvoLojaId(m.id)}
                  style={[styles.chip, alvoLojaId === m.id && styles.chipActive]}
                >
                  <Text style={[styles.chipText, alvoLojaId === m.id && styles.chipTextActive]}>{m.full_name}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {carregandoLoja ? (
          <Text style={styles.hint}>Carregando...</Text>
        ) : (
          <>
            <Text style={styles.label}>Link personalizado</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: '#8B93A7', fontSize: 13 }}>reigames.com.br/</Text>
              <TextInput
                style={[styles.input, { flex: 1, marginLeft: 4 }]}
                value={lojaForm.slug}
                onChangeText={(v) => setLojaForm({ ...lojaForm, slug: v })}
                placeholder="nome-da-pessoa"
                placeholderTextColor="#8B93A7"
                autoCapitalize="none"
              />
            </View>

            <Text style={styles.label}>Nome de exibição (uso interno)</Text>
            <TextInput
              style={styles.input}
              value={lojaForm.display_name}
              onChangeText={(v) => setLojaForm({ ...lojaForm, display_name: v })}
            />

            <Text style={styles.label}>Título da loja</Text>
            <TextInput
              style={styles.input}
              value={lojaForm.titulo}
              onChangeText={(v) => setLojaForm({ ...lojaForm, titulo: v })}
              placeholder="Ex: Loja da Mika"
              placeholderTextColor="#8B93A7"
            />
            <Text style={styles.hint}>Esse é o título que aparece de verdade no topo da página.</Text>

            <Text style={styles.label}>Logo (opcional)</Text>
            {lojaForm.logo_url ? (
              <Image source={{ uri: lojaForm.logo_url }} style={{ width: 64, height: 64, borderRadius: 32, marginBottom: 8 }} />
            ) : null}
            <Pressable style={styles.saveBtnSmall} onPress={enviarLogoLoja} disabled={enviandoLogoLoja}>
              <Text style={styles.saveBtnText}>
                {enviandoLogoLoja ? 'Enviando...' : lojaForm.logo_url ? 'Trocar logo' : 'Escolher logo'}
              </Text>
            </Pressable>
            <Text style={styles.hint}>Aparece embaixo do título, em formato redondo.</Text>

            <Text style={styles.label}>Frases (opcional)</Text>
            <TextInput
              style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
              multiline
              value={lojaForm.frases}
              onChangeText={(v) => setLojaForm({ ...lojaForm, frases: v })}
              placeholder={'Entrega rápida\nContas com garantia'}
              placeholderTextColor="#8B93A7"
            />
            <Text style={styles.hint}>Uma frase por linha — aparecem do lado da logo.</Text>

            <Text style={styles.label}>Texto de destaque (opcional)</Text>
            <TextInput
              style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
              multiline
              value={lojaForm.banner_text}
              onChangeText={(v) => setLojaForm({ ...lojaForm, banner_text: v })}
            />

            {salvoLoja && <Text style={{ color: '#3FB27F', marginTop: 10 }}>Salvo! O link já está no ar.</Text>}

            <Pressable style={styles.saveBtn} onPress={salvarLoja} disabled={salvandoLoja}>
              <Text style={styles.saveBtnText}>{salvandoLoja ? 'Salvando...' : 'Salvar loja'}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    )
  }

  if (secao === 'banner') {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20 }}>
        <Cabecalho titulo="Banner e Parcerias" />

        <Text style={styles.title}>Banners do topo da home</Text>
        <Text style={styles.hint}>As imagens giram automaticamente, na ordem daqui.</Text>

        {banners.map((b, i) => (
          <View key={b.id} style={styles.pageCard}>
            <Image source={{ uri: b.image_url }} style={{ width: 60, height: 36, borderRadius: 6 }} resizeMode="cover" />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Pressable disabled={i === 0} onPress={() => moverBanner(i, -1)}>
                <Text style={{ color: i === 0 ? '#2A2F3B' : '#8B93A7', fontSize: 16 }}>▲</Text>
              </Pressable>
              <Pressable disabled={i === banners.length - 1} onPress={() => moverBanner(i, 1)}>
                <Text style={{ color: i === banners.length - 1 ? '#2A2F3B' : '#8B93A7', fontSize: 16 }}>▼</Text>
              </Pressable>
              <Pressable onPress={() => excluirBanner(b.id)}>
                <Text style={{ color: '#E8562F' }}>Remover</Text>
              </Pressable>
            </View>
          </View>
        ))}

        <Pressable style={styles.saveBtnSmall} onPress={adicionarBanner}>
          <Text style={styles.saveBtnText}>+ Adicionar banner</Text>
        </Pressable>

        <View style={styles.divider} />

        <Text style={styles.title}>Frases rotativas</Text>
        <Text style={styles.hint}>Uma frase por linha — elas ficam girando embaixo do banner, na home.</Text>
        <TextInput
          style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
          multiline
          value={frasesRotativas}
          onChangeText={setFrasesRotativas}
          placeholder={'REI GAMES 🎮\nCompra 100% segura'}
          placeholderTextColor="#8B93A7"
        />

        <View style={styles.divider} />

        <Text style={styles.title}>Seção "Parcerias" na home</Text>
        <Text style={styles.hint}>
          Escolha uma categoria de página pra usar como "Parcerias" (mostra as páginas dela com imagem
          redonda, tipo Mineirinha, Mika, Pedrosa).
        </Text>
        <View style={styles.chipsRow}>
          <Pressable
            onPress={() => setParceriasCategoriaId(null)}
            style={[styles.chip, !parceriasCategoriaId && styles.chipActive]}
          >
            <Text style={[styles.chipText, !parceriasCategoriaId && styles.chipTextActive]}>Nenhuma</Text>
          </Pressable>
          {categoriasPagina.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => setParceriasCategoriaId(c.id)}
              style={[styles.chip, parceriasCategoriaId === c.id && styles.chipActive]}
            >
              <Text style={[styles.chipText, parceriasCategoriaId === c.id && styles.chipTextActive]}>{c.name}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.saveBtnSmall} onPress={salvarFrasesEParcerias} disabled={salvandoBanner}>
          <Text style={styles.saveBtnText}>{salvandoBanner ? 'Salvando...' : 'Salvar frases e parcerias'}</Text>
        </Pressable>
      </ScrollView>
    )
  }

  // ---------- Tela: Categorias e subcategorias (contas) ----------
  if (secao === 'categorias') {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20 }}>
        <Cabecalho titulo="Categorias e subcategorias" />
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {cat.image_url ? (
                  <Image source={{ uri: cat.image_url }} style={styles.iconeRedondo} />
                ) : (
                  <View style={[styles.iconeRedondo, styles.iconeRedondoVazio]} />
                )}
                <Text style={styles.categoriaNome}>{cat.name}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Text style={{ color: '#8B93A7', fontSize: 12 }}>
                  {(subcategoriasPorCategoria[cat.id] || []).length} subcategoria(s)
                </Text>
                <Pressable onPress={() => definirImagemCategoria(cat)}>
                  <Ionicons name="camera-outline" size={20} color="#E7B94C" />
                </Pressable>
                <Pressable onPress={() => excluirCategoria(cat)}>
                  <Text style={{ color: '#E8562F' }}>Apagar</Text>
                </Pressable>
              </View>
            </Pressable>

            {categoriaAberta === cat.id && (
              <View style={styles.subcategoriaArea}>
                {(subcategoriasPorCategoria[cat.id] || []).map((sub) => (
                  <View key={sub.id} style={styles.subcategoriaLinha}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {sub.image_url ? (
                        <Image source={{ uri: sub.image_url }} style={styles.iconeRedondoPequeno} />
                      ) : (
                        <View style={[styles.iconeRedondoPequeno, styles.iconeRedondoVazio]} />
                      )}
                      <Text style={{ color: '#FFFFFF' }}>{sub.name}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Pressable onPress={() => definirImagemSubcategoria(sub)}>
                        <Ionicons name="camera-outline" size={18} color="#E7B94C" />
                      </Pressable>
                      <Pressable onPress={() => excluirSubcategoria(sub.id)}>
                        <Text style={{ color: '#E8562F', fontSize: 12 }}>Remover</Text>
                      </Pressable>
                    </View>
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
      </ScrollView>
    )
  }

  // ---------- Tela: Páginas ----------
  if (secao === 'paginas') {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20 }}>
        <View style={styles.rowBetween}>
          <Cabecalho titulo="Páginas" />
          <Pressable onPress={() => abrirEdicao('nova')}>
            <Text style={{ color: '#E7B94C', fontWeight: '700' }}>+ Nova</Text>
          </Pressable>
        </View>

        {paginas.length === 0 && <Text style={styles.hint}>Nenhuma página criada ainda.</Text>}

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

  // ---------- Tela: Menu principal ----------
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.title}>Site</Text>

      <Pressable style={styles.menuItem} onPress={() => setSecao('configuracoes')}>
        <View style={styles.menuItemEsquerda}>
          <Ionicons name="settings-outline" size={22} color="#E7B94C" />
          <Text style={styles.menuItemTexto}>Configurações</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#8B93A7" />
      </Pressable>

      <Pressable style={styles.menuItem} onPress={() => setSecao('menu-site')}>
        <View style={styles.menuItemEsquerda}>
          <Ionicons name="list-outline" size={22} color="#E7B94C" />
          <Text style={styles.menuItemTexto}>Menu do site</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#8B93A7" />
      </Pressable>

      <Pressable style={styles.menuItem} onPress={() => setSecao('loja-pessoal')}>
        <View style={styles.menuItemEsquerda}>
          <Ionicons name="storefront-outline" size={22} color="#E7B94C" />
          <Text style={styles.menuItemTexto}>Minha Loja</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#8B93A7" />
      </Pressable>

      <Pressable style={styles.menuItem} onPress={() => setSecao('banner')}>
        <View style={styles.menuItemEsquerda}>
          <Ionicons name="images-outline" size={22} color="#E7B94C" />
          <Text style={styles.menuItemTexto}>Banner e Parcerias</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#8B93A7" />
      </Pressable>

      <Pressable style={styles.menuItem} onPress={() => setSecao('categorias')}>
        <View style={styles.menuItemEsquerda}>
          <Ionicons name="pricetags-outline" size={22} color="#E7B94C" />
          <Text style={styles.menuItemTexto}>Categorias e subcategorias</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#8B93A7" />
      </Pressable>

      <Pressable style={styles.menuItem} onPress={() => setSecao('categorias-pagina')}>
        <View style={styles.menuItemEsquerda}>
          <Ionicons name="folder-outline" size={22} color="#E7B94C" />
          <Text style={styles.menuItemTexto}>Categorias de página</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#8B93A7" />
      </Pressable>

      <Pressable style={styles.menuItem} onPress={() => setSecao('paginas')}>
        <View style={styles.menuItemEsquerda}>
          <Ionicons name="document-text-outline" size={22} color="#E7B94C" />
          <Text style={styles.menuItemTexto}>Páginas</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#8B93A7" />
      </Pressable>
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
  addRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  addBtn: { backgroundColor: '#E7B94C', borderRadius: 8, width: 44, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#0F1115', fontWeight: '700', fontSize: 18 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { borderWidth: 1, borderColor: '#2A2F3B', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  chipActive: { backgroundColor: '#E7B94C', borderColor: '#E7B94C' },
  chipText: { color: '#8B93A7', fontSize: 12 },
  chipTextActive: { color: '#0F1115', fontWeight: '700' },
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
  },
  menuItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#161922', borderColor: '#2A2F3B', borderWidth: 1,
    borderRadius: 10, padding: 16, marginBottom: 10
  },
  menuItemEsquerda: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuItemTexto: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  voltarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 2 },
  voltarTexto: { color: '#E7B94C', fontSize: 18, fontWeight: '700' },
  iconeRedondo: { width: 32, height: 32, borderRadius: 16 },
  iconeRedondoPequeno: { width: 24, height: 24, borderRadius: 12 },
  iconeRedondoVazio: { backgroundColor: '#2A2F3B' }
})
