// Converte uma string base64 em ArrayBuffer, sem precisar de nenhuma
// biblioteca externa (o "atob" não existe em todo ambiente do React Native).
// Usado no lugar de fetch(uri).arrayBuffer(), que em alguns aparelhos/versões
// do Expo gera arquivos vazios ou corrompidos ao enviar pro Supabase Storage.
export function base64ToArrayBuffer(base64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const str = base64.replace(/=+$/, '')
  const output = []
  let bc = 0
  let bs = 0
  let buffer
  let i = 0
  while ((buffer = str.charAt(i++))) {
    buffer = chars.indexOf(buffer)
    if (~buffer) {
      bs = bc % 4 ? bs * 64 + buffer : buffer
      if (bc++ % 4) output.push(255 & (bs >> ((-2 * bc) & 6)))
    }
  }
  return new Uint8Array(output).buffer
}
