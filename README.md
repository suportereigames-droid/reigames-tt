# TT — app da equipe Rei Games

App em React Native (Expo) para a equipe: login, pedidos com notificação
push, contas/produtos (cada membro só vê o que postou), e uma área de dono
(admin) com visão geral de tudo — visitas do site, faturamento e o
desempenho de cada pessoa da equipe.

> **Importante sobre o arquivo .apk**: eu não consigo compilar o `.apk` final
> aqui neste ambiente (não tenho acesso a internet nem ao Android SDK/Gradle
> necessários para o build). O que entrego é o **código-fonte completo e
> funcional** do app. Gerar o `.apk` a partir dele é um único comando —
> veja o passo 4 abaixo — e leva uns 10-15 minutos rodando na nuvem da
> Expo, de graça, sem precisar instalar Android Studio.

## O que o app faz

**Membro da equipe:**
- Faz login com o mesmo tipo de conta usada no site.
- Recebe notificação push assim que cai um pedido de uma conta que ele postou.
- Vê os pedidos das próprias contas: nome/WhatsApp do comprador, valor, e
  pode marcar como pago/cancelado.
- Vê e edita só as contas que ele mesmo cadastrou (a mesma regra de
  permissão do painel web, aplicada no banco via RLS).

**Dono (admin):**
- Recebe notificação de TODOS os pedidos, de qualquer pessoa da equipe.
- Dashboard com: pedidos em aberto, contas disponíveis/vendidas, faturamento
  total e **visitas do site**.
- Aba "Equipe": lista todo mundo, com quantas contas cada um postou; toca no
  nome de uma pessoa (ex: "Mica") e cai direto na lista das contas
  daquela pessoa específica.

## Passo a passo

### 1. Rodar a migração no Supabase
No **mesmo** projeto Supabase do site, abra o SQL Editor e rode
`supabase/002_push_e_visitas.sql` (cria as tabelas `push_tokens` e
`site_visits`).

### 2. Atualizar o site (reigames-shop)
Duas mudanças já aplicadas nos arquivos do site que fiz antes — se você já
publicou o site, é só subir a versão nova:
- `src/components/StoreLayout.jsx`: agora registra uma visita a cada página
  aberta (é isso que alimenta o contador "visitas do site" do dono).
- `supabase/functions/create-preference/index.ts`: agora, ao criar um
  pedido, também dispara a notificação push pro vendedor e pros admins.
  Republique essa função: `supabase functions deploy create-preference`.

### 3. Configurar o app
```bash
cd tt-reigames
npm install
```
Edite `lib/supabase.js` e coloque a mesma URL e chave anônima (`anon key`)
do projeto Supabase usado no site.

Rode `npx expo start` e abra no app **Expo Go** (Android) pra testar antes
de gerar o APK — assim você já confere login, pedidos e notificações.

> Notificação push não funciona no emulador, só em celular físico.

### 4. Gerar o .apk de verdade
```bash
npm install -g eas-cli
eas login          # cria uma conta grátis em expo.dev se ainda não tiver
eas build:configure
eas build -p android --profile preview
```
Isso builda o app nos servidores da Expo e, no final, dá um link pra baixar
o `.apk` direto no celular (não precisa de loja, é instalação direta —
lembre de permitir "instalar de fontes desconhecidas" no Android).

### 5. Ícone do app
Troquei os ícones em `assets/` por um preenchimento simples só pra o build
não quebrar. Troque `icon.png`, `adaptive-icon.png` e
`notification-icon.png` pela logo da Rei Games antes de gerar a versão
final.

## Sobre a Play Store
Você disse que não vai publicar na loja — ótimo, esse fluxo do passo 4 gera
um APK de instalação direta, sem precisar mandar pra revisão de ninguém.
Se um dia quiser publicar mesmo assim, o comando muda só pra
`eas build -p android --profile production` (gera `.aab`, que é o formato
que a Play Store pede).
