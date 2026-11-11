/**
 * DEMO database initialisation. Runs inside the PGlite Web Worker, talking to
 * PGlite directly (no message round-trips), so creating the schema and the
 * sample data neither blocks the UI nor pays per-query messaging costs.
 * Progress is broadcast to the page on BOOT_CHANNEL.
 */
import type { PGliteInterface } from '@electric-sql/pglite'
import core from '../../../supabase/migrations/20261110000100_core_schema.sql?raw'
import fns from '../../../supabase/migrations/20261110000200_functions.sql?raw'
import rls from '../../../supabase/migrations/20261110000300_rls.sql?raw'
import api from '../../../supabase/migrations/20261110000350_api.sql?raw'
import favorites from '../../../supabase/migrations/20261111000100_pokemon_favorites.sql?raw'
import deadline18 from '../../../supabase/migrations/20261111000200_payment_deadline_18h.sql?raw'
import { seedDemo } from './seed'

export const BOOT_CHANNEL = 'gimmy-demo-boot'

const STUB = `
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
  end $$;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique not null,
    raw_user_meta_data jsonb not null default '{}'::jsonb,
    demo_password_hash text,
    demo_label text,
    demo_description text
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create table public.demo_files (path text primary key, data text not null);
  create table public.demo_meta (key text primary key, value text);
`

export async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('gimmy-demo:' + s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function initDemoDatabase(db: PGliteInterface, report: (done: number, label: string) => void = () => {}) {
  report(2, 'Verificando estrutura')
  const has = await db.query<{ ok: boolean }>(`select to_regclass('public.demo_meta') is not null as ok`)
  if (has.rows[0].ok) {
    const seeded = await db.query(`select 1 from public.demo_meta where key = 'seeded_at'`)
    if (seeded.rows.length) return
    // an earlier initialisation was interrupted: rebuild from scratch
    await db.exec(`drop schema if exists public cascade; drop schema if exists auth cascade; create schema public;`)
  }
  report(2, 'Criando estrutura do banco')
  await db.exec('create extension if not exists pgcrypto;')
  for (const sql of [STUB, core, fns, rls, api, favorites, deadline18]) await db.exec(sql)
  const setUser = async (id: string | null) => {
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [id ?? ''])
  }
  await setUser(null)
  report(3, 'Gerando dados de demonstração')
  await seedDemo({ db, setUser, sha256 })
  await db.query(`insert into public.demo_meta values ('seeded_at', now()::text)`)
  await setUser(null)
}
