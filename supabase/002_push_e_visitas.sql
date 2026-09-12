-- =========================================================
-- REI GAMES — migração para o app TT (push notifications + visitas)
-- Rode DEPOIS do supabase/schema.sql do site, no SQL Editor do Supabase.
-- =========================================================

-- ---------- TOKENS DE PUSH (um usuário pode ter vários aparelhos) ----------
create table if not exists public.push_tokens (
  user_id uuid not null references public.profiles (id) on delete cascade,
  expo_token text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, expo_token)
);

alter table public.push_tokens enable row level security;

create policy "push_tokens: cada um gerencia o próprio"
  on public.push_tokens for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Server-side (Edge Functions com service_role) precisa ler todos os tokens
-- para poder notificar o vendedor certo; isso é feito com a service_role key,
-- que ignora RLS automaticamente — nenhuma policy extra é necessária pra isso.

-- ---------- VISITAS DO SITE ----------
create table if not exists public.site_visits (
  id uuid primary key default gen_random_uuid(),
  path text not null default '/',
  created_at timestamptz not null default now()
);

alter table public.site_visits enable row level security;

-- Qualquer visitante (anon) pode registrar uma visita, mas ninguém de fora
-- consegue LER a tabela (só o dono, autenticado como admin).
create policy "visitas: qualquer um pode registrar"
  on public.site_visits for insert
  to anon
  with check (true);

create policy "visitas: só admin lê"
  on public.site_visits for select
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
