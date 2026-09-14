import { useCallback, useEffect, useState } from 'react'
import { View, Text, FlatList, Pressable, StyleSheet, TextInput, Alert, Modal, ScrollView, Image } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { supabase } from '../../lib/supabase.js'
import { base64ToArrayBuffer } from '../../lib/base64ToArrayBuffer.js'
import { useAuth } from '../../context/AuthContext.jsx'

const BUCKET = 'product-images'

function PainelMembro({ membro, onFechar, onAtualizado }) {
  const router = useRouter()
  const [aba, setAba] = useState('conta')
  const [ativo, setAtivo] = useState(!membro.frozen)
  const [whatsapp, setWhatsapp] = useState('')
  const [loja, setLoja] = useState({ slug: '', display_name: '', titulo: '', logo_url: '', frases: '' })
  const [carregando, setCarregando] = useState(true)
  const [processando, setProcessando] = useState(false)
  const [enviandoLogo, setEnviandoLogo] = useState(false)
  const [novoEmail, setNovoEmail] = useState('')
  const [novaSenha, setNovaSenha] = useState('')

  useEffect(() => {
    async function carregar() {
      const [{ data: perfil }, { data: pagina }] = await Promise.all([
        supabase.from('profiles').select('whatsapp').eq('id', membro.id).single(),
        supabase.from('seller_pages').select('*').eq('seller_id', membro.id).single()
      ])
      setWhatsapp(perfil?.whatsapp || '')
      setLoja({
        slug: pagina?.slug || '',
        display_name: pagina?.display_name || membro.full_name,
        titulo: pagina?.titulo || '',
        logo_url: pagina?.logo_url || '',
        frases: pagina?.frases || ''
      })
      setCarregando(false)
    }
    carregar()
  }, [membro.id])

  async function chamarAcao(action, extra = {}) {
    setProcessando(true)
    try {
      const { data: sessao } = await supabase.auth.getSession()
      const { data, error } = await supabase.functions.invoke('manage-team-member', {
        body: { action, memberId: membro.id, ...extra },
        headers: { Authorization: `Bearer ${sessao.session.access_token}` }
      })
      if (error || data?.error) {
        Alert.alert('Não foi possível concluir', data?.error || error?.message || 'Tente novamente.')
        return false
      }
      return true
    } finally {
      setProcessando(false)
    }
  }

  async function alternarStatus() {
    const vaiAtivar = !ativo
    const ok = await chamarAcao(vaiAtivar ? 'unfreeze' : 'freeze')
    if (ok) { setAtivo(vaiAtivar); onAtualizado() }
  }

  async function salvarWhatsapp() {
    setProcessando(true)
    const { error } = await supabase.from('profiles').update({ whatsapp }).eq('id', membro.id)
    setProcessando(false)
    if (!error) Alert.alert('Salvo!')
  }

  async function enviarLogo() {
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permissao.granted) {
      Alert.alert('Precisamos de permissão para acessar suas fotos.')
      return
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 })
    if (resultado.canceled || !resultado.assets?.[0]) return
    setEnviandoLogo(true)
    const asset = resultado.assets[0]
    const extensao = (asset.uri.split('.').pop() || 'jpg').split('?')[0]
    const path = `lojas/${membro.id}-${Date.now()}.${extensao}`
    const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 })
    const arrayBuffer = base64ToArrayBuffer(base64)
    const { error } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, { contentType: asset.mimeType || 'image/jpeg' })
    setEnviandoLogo(false)
    if (error) { Alert.alert('Não foi possível enviar', error.message); return }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    setLoja((l) => ({ ...l, logo_url: data.publicUrl }))
  }

  async function salvarLoja() {
    setProcessando(true)
    const slugLimpo = loja.slug.trim().toLowerCase().replace(/\s+/g, '-')
    const { error } = await supabase.from('seller_pages').upsert({
      seller_id: membro.id,
      slug: slugLimpo,
      display_name: loja.display_name || membro.full_name,
      titulo: loja.titulo || null,
      logo_url: loja.logo_url || null,
      frases: loja.frases || null
    })
    setProcessando(false)
    if (error) {
      Alert.alert('Não foi possível salvar', error.message.includes('duplicate') ? 'Esse link já está em uso.' : error.message)
      return
    }
    setLoja((l) => ({ ...l, slug: slugLimpo }))
    Alert.alert('Salvo! O link já está no ar.')
  }

  async function trocarEmail() {
    if (!novoEmail.trim()) return
    const ok = await chamarAcao('update-email', { newEmail: novoEmail.trim() })
    if (ok) { Alert.alert('E-mail atualizado!'); setNovoEmail('') }
  }

  async function trocarSenha() {
    if (novaSenha.length < 6) { Alert.alert('A senha precisa ter pelo menos 6 caracteres.'); return }
    const ok = await chamarAcao('update-password', { newPassword: novaSenha })
    if (ok) { Alert.alert('Senha atualizada!'); setNovaSenha('') }
  }

  function confirmarExclusao() {
    Alert.alert('Excluir membro', `Tem certeza que quer excluir o login de ${membro.full_name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive',
        onPress: async () => {
          const ok = await chamarAcao('delete')
          if (ok) { onAtualizado(); onFechar() }
        }
      }
    ])
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onFechar}>
      <View style={styles.backdrop}>
        <View style={styles.painel}>
          <View style={styles.painelHeader}>
            <Text style={styles.painelTitulo}>{membro.full_name}</Text>
            <Pressable onPress={onFechar}><Text style={{ color: '#8B93A7', fontSize: 20 }}>✕</Text></Pressable>
          </View>

          <View style={styles.statusRow}>
            <Text style={{ color: '#FFFFFF' }}>Status da conta</Text>
            <Pressable onPress={alternarStatus} disabled={processando} style={[styles.statusBadge, { backgroundColor: ativo ? 'rgba(63,178,127,0.15)' : 'rgba(232,86,47,0.15)' }]}>
              <Text style={{ color: ativo ? '#3FB27F' : '#E8562F', fontWeight: '700', fontSize: 12 }}>
                {ativo ? '● Ativo' : '○ Inativo'}
              </Text>
            </Pressable>
          </View>
          {!ativo && <Text style={styles.hint}>Enquanto inativo, essa pessoa não consegue fazer login.</Text>}

          <Pressable
            onPress={() => { router.push({ pathname: '/produtos', params: { seller: membro.id, sellerName: membro.full_name } }); onFechar() }}
          >
            <Text style={{ color: '#E7B94C', marginVertical: 10 }}>Ver contas dessa pessoa →</Text>
          </Pressable>

          <View style={styles.abas}>
            <Pressable onPress={() => setAba('conta')} style={[styles.aba, aba === 'conta' && styles.abaAtiva]}>
              <Text style={[styles.abaTexto, aba === 'conta' && styles.abaTextoAtivo]}>Conta</Text>
            </Pressable>
            <Pressable onPress={() => setAba('loja')} style={[styles.aba, aba === 'loja' && styles.abaAtiva]}>
              <Text style={[styles.abaTexto, aba === 'loja' && styles.abaTextoAtivo]}>Loja pessoal</Text>
            </Pressable>
          </View>

          {carregando ? (
            <Text style={styles.hint}>Carregando...</Text>
          ) : (
            <ScrollView style={{ marginTop: 12 }}>
              {aba === 'conta' ? (
                <>
                  <Text style={styles.label}>WhatsApp</Text>
                  <TextInput style={styles.input} value={whatsapp} onChangeText={setWhatsapp} placeholder="(DDD) 9 9999-9999" placeholderTextColor="#8B93A7" />
                  <Pressable style={styles.btnPequeno} onPress={salvarWhatsapp} disabled={processando}>
                    <Text style={styles.btnPequenoTexto}>Salvar</Text>
                  </Pressable>

                  <Text style={styles.label}>Trocar e-mail</Text>
                  <TextInput style={styles.input} value={novoEmail} onChangeText={setNovoEmail} placeholder="novo@email.com" placeholderTextColor="#8B93A7" autoCapitalize="none" />
                  <Pressable style={styles.btnPequeno} onPress={trocarEmail} disabled={processando}>
                    <Text style={styles.btnPequenoTexto}>Trocar</Text>
                  </Pressable>

                  <Text style={styles.label}>Trocar senha</Text>
                  <TextInput style={styles.input} value={novaSenha} onChangeText={setNovaSenha} placeholder="mínimo 6 caracteres" placeholderTextColor="#8B93A7" secureTextEntry />
                  <Pressable style={styles.btnPequeno} onPress={trocarSenha} disabled={processando}>
                    <Text style={styles.btnPequenoTexto}>Trocar</Text>
                  </Pressable>

                  <Pressable onPress={confirmarExclusao} style={{ marginTop: 20, marginBottom: 30 }}>
                    <Text style={{ color: '#E8562F' }}>Excluir membro</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.label}>Link personalizado</Text>
                  <TextInput style={styles.input} value={loja.slug} onChangeText={(v) => setLoja({ ...loja, slug: v })} placeholder="nome-da-pessoa" placeholderTextColor="#8B93A7" autoCapitalize="none" />

                  <Text style={styles.label}>Título da loja</Text>
                  <TextInput style={styles.input} value={loja.titulo} onChangeText={(v) => setLoja({ ...loja, titulo: v })} placeholder="Ex: Loja da Mika" placeholderTextColor="#8B93A7" />

                  <Text style={styles.label}>Logo</Text>
                  {loja.logo_url ? <Image source={{ uri: loja.logo_url }} style={{ width: 64, height: 64, borderRadius: 32, marginBottom: 8 }} /> : null}
                  <Pressable style={styles.btnPequeno} onPress={enviarLogo} disabled={enviandoLogo}>
                    <Text style={styles.btnPequenoTexto}>{enviandoLogo ? 'Enviando...' : loja.logo_url ? 'Trocar logo' : 'Escolher logo'}</Text>
                  </Pressable>

                  <Text style={styles.label}>Frases</Text>
                  <TextInput
                    style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                    multiline
                    value={loja.frases}
                    onChangeText={(v) => setLoja({ ...loja, frases: v })}
                    placeholder={'Entrega rápida\nContas com garantia'}
                    placeholderTextColor="#8B93A7"
                  />
                  <Text style={styles.hint}>Uma frase por linha — aparecem do lado da logo.</Text>

                  <Pressable style={[styles.btnPequeno, { backgroundColor: '#E7B94C', marginTop: 16, marginBottom: 30 }]} onPress={salvarLoja} disabled={processando}>
                    <Text style={{ color: '#0F1115', fontWeight: '700' }}>{processando ? 'Salvando...' : 'Salvar loja'}</Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  )
}

export default function Equipe() {
  const router = useRouter()
  const { isAdmin } = useAuth()
  const [membros, setMembros] = useState([])
  const [mostrarForm, setMostrarForm] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'membro' })
  const [membroSelecionado, setMembroSelecionado] = useState(null)

  const load = useCallback(async () => {
    const { data: perfis } = await supabase.from('profiles').select('id, full_name, role, frozen').order('full_name')
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

  async function criarMembro() {
    if (!form.fullName.trim() || !form.email.trim() || !form.password) {
      Alert.alert('Preencha nome, e-mail e senha.')
      return
    }
    setSalvando(true)
    try {
      const { data: sessao } = await supabase.auth.getSession()
      const { data, error } = await supabase.functions.invoke('create-team-member', {
        body: {
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role
        },
        headers: { Authorization: `Bearer ${sessao.session.access_token}` }
      })
      if (error || data?.error) {
        Alert.alert('Não foi possível criar', data?.error || error?.message || 'Tente novamente.')
        return
      }
      Alert.alert('Membro criado!', `Agora é só passar o e-mail e a senha pra ${form.fullName} fazer login no app.`)
      setForm({ fullName: '', email: '', password: '', role: 'membro' })
      setMostrarForm(false)
      load()
    } finally {
      setSalvando(false)
    }
  }

  if (mostrarForm) {
    return (
      <View style={styles.screen}>
        <View style={{ padding: 20 }}>
          <Text style={styles.tituloForm}>Adicionar membro da equipe</Text>

          <Text style={styles.label}>Nome</Text>
          <TextInput style={styles.input} value={form.fullName} onChangeText={(v) => setForm({ ...form, fullName: v })} placeholderTextColor="#8B93A7" />

          <Text style={styles.label}>E-mail (vai usar pra fazer login)</Text>
          <TextInput
            style={styles.input}
            value={form.email}
            onChangeText={(v) => setForm({ ...form, email: v })}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor="#8B93A7"
          />

          <Text style={styles.label}>Senha (mínimo 6 caracteres)</Text>
          <TextInput
            style={styles.input}
            value={form.password}
            onChangeText={(v) => setForm({ ...form, password: v })}
            secureTextEntry
            placeholderTextColor="#8B93A7"
          />
          <Text style={styles.hint}>Você define essa senha agora e já passa pronta pra pessoa — ela pode trocar depois.</Text>

          <Text style={styles.label}>Cargo</Text>
          <View style={styles.chipsRow}>
            <Pressable
              onPress={() => setForm({ ...form, role: 'membro' })}
              style={[styles.chip, form.role === 'membro' && styles.chipActive]}
            >
              <Text style={[styles.chipText, form.role === 'membro' && styles.chipTextActive]}>Membro da equipe</Text>
            </Pressable>
            <Pressable
              onPress={() => setForm({ ...form, role: 'admin' })}
              style={[styles.chip, form.role === 'admin' && styles.chipActive]}
            >
              <Text style={[styles.chipText, form.role === 'admin' && styles.chipTextActive]}>Admin</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>Admin vê tudo (todas as contas, pedidos e vendas). Membro só vê o que ele mesmo postar.</Text>

          <Pressable style={styles.saveBtn} onPress={criarMembro} disabled={salvando}>
            <Text style={styles.saveBtnText}>{salvando ? 'Criando...' : 'Criar login'}</Text>
          </Pressable>
          <Pressable style={{ marginTop: 12, alignItems: 'center' }} onPress={() => setMostrarForm(false)}>
            <Text style={{ color: '#8B93A7' }}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        style={styles.screen}
        contentContainerStyle={{ padding: 16 }}
        data={membros}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          isAdmin ? (
            <Pressable style={styles.addBtn} onPress={() => setMostrarForm(true)}>
              <Text style={styles.addBtnText}>+ Adicionar membro da equipe</Text>
            </Pressable>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => (isAdmin ? setMembroSelecionado(item) : router.push({ pathname: '/produtos', params: { seller: item.id, sellerName: item.full_name } }))}
          >
            <View>
              <Text style={styles.nome}>{item.full_name}</Text>
              <Text style={styles.papel}>{item.role === 'admin' ? 'admin' : 'membro da equipe'} · {item.frozen ? 'inativo' : 'ativo'}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.total}>{item.total} contas</Text>
              <Text style={styles.detalhe}>{item.disponivel} disponíveis · {item.vendido} vendidas</Text>
            </View>
          </Pressable>
        )}
      />

      {membroSelecionado && (
        <PainelMembro membro={membroSelecionado} onFechar={() => setMembroSelecionado(null)} onAtualizado={load} />
      )}
    </View>
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
  detalhe: { color: '#8B93A7', fontSize: 11, marginTop: 2 },
  addBtn: { backgroundColor: '#E7B94C', borderRadius: 8, padding: 14, alignItems: 'center', marginBottom: 16 },
  addBtnText: { color: '#0F1115', fontWeight: '700' },
  tituloForm: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginBottom: 16 },
  label: { color: '#8B93A7', fontSize: 12, textTransform: 'uppercase', marginTop: 14, marginBottom: 6 },
  hint: { color: '#8B93A7', fontSize: 11, marginTop: 6 },
  input: { backgroundColor: '#1D212C', borderColor: '#2A2F3B', borderWidth: 1, borderRadius: 8, color: '#FFFFFF', padding: 12 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#2A2F3B', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  chipActive: { backgroundColor: '#E7B94C', borderColor: '#E7B94C' },
  chipText: { color: '#8B93A7', fontSize: 12 },
  chipTextActive: { color: '#0F1115', fontWeight: '700' },
  saveBtn: { backgroundColor: '#E7B94C', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#0F1115', fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  painel: { backgroundColor: '#0F1115', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, maxHeight: '88%' },
  painelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  painelTitulo: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, backgroundColor: '#161922', borderRadius: 8, padding: 12, borderColor: '#2A2F3B', borderWidth: 1 },
  statusBadge: { borderRadius: 20, paddingVertical: 4, paddingHorizontal: 10 },
  abas: { flexDirection: 'row', gap: 20, borderBottomWidth: 1, borderBottomColor: '#2A2F3B', marginTop: 8 },
  aba: { paddingBottom: 8 },
  abaAtiva: { borderBottomWidth: 2, borderBottomColor: '#E7B94C' },
  abaTexto: { color: '#8B93A7', fontSize: 14, fontWeight: '600' },
  abaTextoAtivo: { color: '#FFFFFF' },
  btnPequeno: { backgroundColor: '#1D212C', borderColor: '#2A2F3B', borderWidth: 1, borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 8 },
  btnPequenoTexto: { color: '#E7B94C', fontWeight: '600' }
})
