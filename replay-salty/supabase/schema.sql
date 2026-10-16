-- Replay Salty: exécuter ce fichier dans Supabase > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now(),
  constraint username_length check (username is null or char_length(username) between 3 and 24)
);

create table if not exists public.replays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 90),
  game text not null,
  format text,
  player_one text,
  player_two text,
  description text check (description is null or char_length(description) <= 240),
  replay_url text,
  file_path text,
  visibility text not null default 'public' check (visibility in ('public','unlisted','private')),
  created_at timestamptz not null default now(),
  constraint replay_source_required check (replay_url is not null or file_path is not null)
);

create index if not exists replays_created_at_idx on public.replays(created_at desc);
create index if not exists replays_game_idx on public.replays(game);
create index if not exists replays_user_id_idx on public.replays(user_id);

alter table public.profiles enable row level security;
alter table public.replays enable row level security;

drop policy if exists "Public profiles are readable" on public.profiles;
create policy "Public profiles are readable" on public.profiles
for select using (true);

drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile" on public.profiles
for insert to authenticated with check (auth.uid() = id);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles
for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Public replays are readable" on public.replays;
create policy "Public replays are readable" on public.replays
for select using (visibility = 'public' or auth.uid() = user_id);

drop policy if exists "Users publish own replays" on public.replays;
create policy "Users publish own replays" on public.replays
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users update own replays" on public.replays;
create policy "Users update own replays" on public.replays
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users delete own replays" on public.replays;
create policy "Users delete own replays" on public.replays
for delete to authenticated using (auth.uid() = user_id);

-- Crée le profil lors de l'inscription. Le pseudo peut être modifié ensuite.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, nullif(new.raw_user_meta_data ->> 'username', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Bucket privé : les fichiers sont servis via URL signée temporaire.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'replay-files', 'replay-files', true, 52428800,
  array['text/plain','application/json','application/octet-stream','application/zip','video/mp4','video/webm']
)
on conflict (id) do update set public = true, file_size_limit = 52428800;

drop policy if exists "Users upload to own replay folder" on storage.objects;
create policy "Users upload to own replay folder" on storage.objects
for insert to authenticated
with check (bucket_id = 'replay-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Public can read published replay files" on storage.objects;
create policy "Public can read published replay files" on storage.objects
for select using (bucket_id = 'replay-files');

drop policy if exists "Users delete own replay files" on storage.objects;
create policy "Users delete own replay files" on storage.objects
for delete to authenticated
using (bucket_id = 'replay-files' and (storage.foldername(name))[1] = auth.uid()::text);

-- Le bucket est public car les replays sont publics dans cette première version.
-- Les noms contiennent un UUID aléatoire. N'y stockez jamais de données personnelles.
-- Pour des replays privés/non répertoriés, utilisez un bucket privé et une route serveur
-- qui vérifie les droits avant de générer une URL signée.
