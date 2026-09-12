import { useLocalSearchParams } from 'expo-router'
import ProdutoForm from '../../../components/ProdutoForm.jsx'

export default function EditarProduto() {
  const { id } = useLocalSearchParams()
  return <ProdutoForm id={id} />
}
