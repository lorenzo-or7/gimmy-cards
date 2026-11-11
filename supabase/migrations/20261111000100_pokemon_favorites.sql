-- =====================================================================
-- Gimmy Cards V2 — Pokémon favoritos
-- New tables, RPCs and notification triggers. Earlier migrations untouched.
-- =====================================================================

-- Standardised Pokémon catalogue (admins can add more from the dashboard)
create table public.pokemon (
  id int generated always as identity primary key,
  dex int unique check (dex is null or dex between 1 and 2000),
  name text not null check (char_length(name) between 2 and 60)
);
create unique index pokemon_name_unique on public.pokemon (lower(name));

create table public.card_pokemon (
  card_id uuid not null references public.cards (id) on delete cascade,
  pokemon_id int not null references public.pokemon (id) on delete restrict,
  primary key (card_id, pokemon_id)
);
create index card_pokemon_pokemon_idx on public.card_pokemon (pokemon_id);

create table public.favorite_pokemon (
  user_id uuid not null references public.profiles (id) on delete cascade,
  pokemon_id int not null references public.pokemon (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, pokemon_id)
);
create index favorite_pokemon_pokemon_idx on public.favorite_pokemon (pokemon_id);

-- notifications can carry an image (card front) for highlighted alerts
alter table public.notifications add column if not exists image_path text;

alter table public.pokemon enable row level security;
alter table public.card_pokemon enable row level security;
alter table public.favorite_pokemon enable row level security;

create policy pokemon_read on public.pokemon for select to anon, authenticated using (true);
create policy card_pokemon_read on public.card_pokemon for select to anon, authenticated using (true);
create policy favorites_own on public.favorite_pokemon for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Notify fans when a lot containing their Pokémon becomes visible.
-- One notification per (user, lot); combos list every matching Pokémon.
-- ---------------------------------------------------------------------
create or replace function public._notify_favorites_for_lot(p_lot uuid)
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; v_lot public.lots%rowtype; v_img text;
begin
  select * into v_lot from public.lots where id = p_lot;
  if not found then return 0; end if;
  if not exists (select 1 from public.auctions a where a.id = v_lot.auction_id and a.status = 'published') then return 0; end if;
  if v_lot.status <> 'open' then return 0; end if;
  select c.front_path into v_img from public.lot_cards lc join public.cards c on c.id = lc.card_id
   where lc.lot_id = p_lot order by lc.position limit 1;
  for r in
    select f.user_id, string_agg(distinct pk.name, ', ' order by pk.name) as names
    from public.lot_cards lc
    join public.card_pokemon cp on cp.card_id = lc.card_id
    join public.favorite_pokemon f on f.pokemon_id = cp.pokemon_id
    join public.pokemon pk on pk.id = cp.pokemon_id
    join public.profiles p on p.id = f.user_id
    where lc.lot_id = p_lot and coalesce((p.notify_prefs ->> 'favorites')::boolean, true)
    group by f.user_id
  loop
    insert into public.notifications (user_id, kind, title, body, link, dedupe_key, image_path)
    values (r.user_id, 'favorite', 'Um Pokémon que você adora chegou ao leilão!',
            r.names || ' em “' || v_lot.title || '”.', '/lote/' || p_lot, 'fav:' || p_lot, v_img)
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
    if found then n := n + 1; end if;
  end loop;
  return n;
end $$;

create or replace function public._fav_on_publish()
returns trigger language plpgsql security definer set search_path = public as $$
declare l record;
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    for l in select id from public.lots where auction_id = new.id loop
      perform public._notify_favorites_for_lot(l.id);
    end loop;
  end if;
  return new;
end $$;
create trigger auctions_fav_notify after update on public.auctions
  for each row execute function public._fav_on_publish();

-- lots added (or re-carded) inside an already published auction
create or replace function public._fav_on_lot_cards()
returns trigger language plpgsql security definer set search_path = public as $$
declare l record;
begin
  for l in select distinct lot_id from inserted loop
    perform public._notify_favorites_for_lot(l.lot_id);
  end loop;
  return null;
end $$;
create trigger lot_cards_fav_notify after insert on public.lot_cards
  referencing new table as inserted
  for each statement execute function public._fav_on_lot_cards();

-- a Pokémon tagged on a card after it is already in a published lot
create or replace function public._fav_on_card_pokemon()
returns trigger language plpgsql security definer set search_path = public as $$
declare l record;
begin
  for l in select distinct lc.lot_id from inserted i join public.lot_cards lc on lc.card_id = i.card_id loop
    perform public._notify_favorites_for_lot(l.lot_id);
  end loop;
  return null;
end $$;
create trigger card_pokemon_fav_notify after insert on public.card_pokemon
  referencing new table as inserted
  for each statement execute function public._fav_on_card_pokemon();

-- ---------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------
create or replace function public.search_pokemon(p_query text default '', p_limit int default 20)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'dex', dex, 'name', name) order by
           (lower(name) like lower(coalesce(p_query, '')) || '%') desc, coalesce(dex, 99999), name), '[]'::jsonb)
  from (select * from public.pokemon
        where coalesce(btrim(p_query), '') = '' or name ilike '%' || btrim(p_query) || '%'
              or dex::text = btrim(p_query)
        order by (lower(name) like lower(coalesce(p_query, '')) || '%') desc, coalesce(dex, 99999), name
        limit least(greatest(p_limit, 1), 60)) x
$$;

create or replace function public.my_favorites()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'dex', p.dex, 'name', p.name, 'created_at', f.created_at,
      'live_lots', (select count(distinct l.id) from public.card_pokemon cp join public.lot_cards lc on lc.card_id = cp.card_id
                    join public.lots l on l.id = lc.lot_id join public.auctions a on a.id = l.auction_id
                    where cp.pokemon_id = p.id and l.status = 'open' and a.status = 'published'))
    order by f.created_at desc), '[]'::jsonb)
  from public.favorite_pokemon f join public.pokemon p on p.id = f.pokemon_id
  where f.user_id = auth.uid()
$$;

create or replace function public.add_favorite_pokemon(p_pokemon_id int)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public.require_user();
begin
  if not exists (select 1 from public.pokemon where id = p_pokemon_id) then raise exception 'NOT_FOUND'; end if;
  if (select count(*) from public.favorite_pokemon where user_id = v_uid) >= 50 then raise exception 'TOO_MANY_FAVORITES'; end if;
  insert into public.favorite_pokemon (user_id, pokemon_id) values (v_uid, p_pokemon_id) on conflict do nothing;
end $$;

create or replace function public.remove_favorite_pokemon(p_pokemon_id int)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public.require_user();
begin
  delete from public.favorite_pokemon where user_id = v_uid and pokemon_id = p_pokemon_id;
end $$;

create or replace function public.card_pokemon_list(p_card uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'dex', p.dex, 'name', p.name) order by p.name), '[]'::jsonb)
  from public.card_pokemon cp join public.pokemon p on p.id = cp.pokemon_id where cp.card_id = p_card
$$;

create or replace function public.admin_set_card_pokemon(p_card_id uuid, p_pokemon_ids int[])
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  if not exists (select 1 from public.cards where id = p_card_id) then raise exception 'NOT_FOUND'; end if;
  delete from public.card_pokemon where card_id = p_card_id and not (pokemon_id = any(coalesce(p_pokemon_ids, '{}')));
  insert into public.card_pokemon (card_id, pokemon_id)
  select p_card_id, x from unnest(coalesce(p_pokemon_ids, '{}')) x
  where exists (select 1 from public.pokemon where id = x)
  on conflict do nothing;
end $$;

create or replace function public.admin_add_pokemon(p_name text, p_dex int default null)
returns int language plpgsql security definer set search_path = public as $$
declare v_id int;
begin
  perform public.require_admin();
  if char_length(btrim(coalesce(p_name, ''))) < 2 then raise exception 'NAME_REQUIRED'; end if;
  select id into v_id from public.pokemon where lower(name) = lower(btrim(p_name));
  if v_id is not null then return v_id; end if;
  insert into public.pokemon (name, dex) values (btrim(p_name), p_dex) returning id into v_id;
  perform public.audit('pokemon_added', 'pokemon', v_id::text, jsonb_build_object('name', p_name, 'dex', p_dex));
  return v_id;
end $$;

-- Card JSON now carries its Pokémon (same keys as before + "pokemon")
create or replace function public._card_json(c public.cards, p_position int default 0)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', c.id, 'title', c.title, 'collection', c.collection, 'language', c.language,
    'condition', c.condition, 'front_path', c.front_path, 'back_path', c.back_path, 'notes', c.notes, 'position', p_position,
    'pokemon', public.card_pokemon_list(c.id))
$$;

-- Featured strip: single-card lots only, from live/upcoming auctions (real query, not a UI filter)
create or replace function public.list_featured_cards(p_limit int default 12)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public._lot_json(l, false) || jsonb_build_object('auction_title', a.title, 'auction_starts_at', a.starts_at)
           order by (a.starts_at <= now()) desc, l.current_price desc nulls last, l.position), '[]'::jsonb)
  from (select l.* from public.lots l join public.auctions a on a.id = l.auction_id
        where l.kind = 'single' and l.status = 'open' and a.status = 'published' and a.ends_at > now()
        order by (a.starts_at <= now()) desc, l.current_price desc nulls last, l.position
        limit least(greatest(p_limit, 1), 30)) l
  join public.auctions a on a.id = l.auction_id
$$;

-- ---------------------------------------------------------------------
-- Grants (helpers stay private)
-- ---------------------------------------------------------------------
revoke execute on function public._notify_favorites_for_lot(uuid), public._fav_on_publish(), public._fav_on_lot_cards(),
  public._fav_on_card_pokemon(), public._card_json(public.cards, int) from public, anon, authenticated;
grant execute on function public.search_pokemon(text, int), public.card_pokemon_list(uuid), public.list_featured_cards(int) to anon, authenticated;
grant execute on function public.my_favorites(), public.add_favorite_pokemon(int), public.remove_favorite_pokemon(int),
  public.admin_set_card_pokemon(uuid, int[]), public.admin_add_pokemon(text, int) to authenticated;

-- ---------------------------------------------------------------------
-- Seed: Pokédex #1–#251 and popular later species. More can be added by admins.
-- ---------------------------------------------------------------------
insert into public.pokemon (dex, name)
select ord, n from unnest(array[
'Bulbasaur','Ivysaur','Venusaur','Charmander','Charmeleon','Charizard','Squirtle','Wartortle','Blastoise','Caterpie',
'Metapod','Butterfree','Weedle','Kakuna','Beedrill','Pidgey','Pidgeotto','Pidgeot','Rattata','Raticate',
'Spearow','Fearow','Ekans','Arbok','Pikachu','Raichu','Sandshrew','Sandslash','Nidoran♀','Nidorina',
'Nidoqueen','Nidoran♂','Nidorino','Nidoking','Clefairy','Clefable','Vulpix','Ninetales','Jigglypuff','Wigglytuff',
'Zubat','Golbat','Oddish','Gloom','Vileplume','Paras','Parasect','Venonat','Venomoth','Diglett',
'Dugtrio','Meowth','Persian','Psyduck','Golduck','Mankey','Primeape','Growlithe','Arcanine','Poliwag',
'Poliwhirl','Poliwrath','Abra','Kadabra','Alakazam','Machop','Machoke','Machamp','Bellsprout','Weepinbell',
'Victreebel','Tentacool','Tentacruel','Geodude','Graveler','Golem','Ponyta','Rapidash','Slowpoke','Slowbro',
'Magnemite','Magneton','Farfetch''d','Doduo','Dodrio','Seel','Dewgong','Grimer','Muk','Shellder',
'Cloyster','Gastly','Haunter','Gengar','Onix','Drowzee','Hypno','Krabby','Kingler','Voltorb',
'Electrode','Exeggcute','Exeggutor','Cubone','Marowak','Hitmonlee','Hitmonchan','Lickitung','Koffing','Weezing',
'Rhyhorn','Rhydon','Chansey','Tangela','Kangaskhan','Horsea','Seadra','Goldeen','Seaking','Staryu',
'Starmie','Mr. Mime','Scyther','Jynx','Electabuzz','Magmar','Pinsir','Tauros','Magikarp','Gyarados',
'Lapras','Ditto','Eevee','Vaporeon','Jolteon','Flareon','Porygon','Omanyte','Omastar','Kabuto',
'Kabutops','Aerodactyl','Snorlax','Articuno','Zapdos','Moltres','Dratini','Dragonair','Dragonite','Mewtwo',
'Mew','Chikorita','Bayleef','Meganium','Cyndaquil','Quilava','Typhlosion','Totodile','Croconaw','Feraligatr',
'Sentret','Furret','Hoothoot','Noctowl','Ledyba','Ledian','Spinarak','Ariados','Crobat','Chinchou',
'Lanturn','Pichu','Cleffa','Igglybuff','Togepi','Togetic','Natu','Xatu','Mareep','Flaaffy',
'Ampharos','Bellossom','Marill','Azumarill','Sudowoodo','Politoed','Hoppip','Skiploom','Jumpluff','Aipom',
'Sunkern','Sunflora','Yanma','Wooper','Quagsire','Espeon','Umbreon','Murkrow','Slowking','Misdreavus',
'Unown','Wobbuffet','Girafarig','Pineco','Forretress','Dunsparce','Gligar','Steelix','Snubbull','Granbull',
'Qwilfish','Scizor','Shuckle','Heracross','Sneasel','Teddiursa','Ursaring','Slugma','Magcargo','Swinub',
'Piloswine','Corsola','Remoraid','Octillery','Delibird','Mantine','Skarmory','Houndour','Houndoom','Kingdra',
'Phanpy','Donphan','Porygon2','Stantler','Smeargle','Tyrogue','Hitmontop','Smoochum','Elekid','Magby',
'Miltank','Blissey','Raikou','Entei','Suicune','Larvitar','Pupitar','Tyranitar','Lugia','Ho-Oh',
'Celebi'
]) with ordinality as t(n, ord);

insert into public.pokemon (dex, name) values
  (254, 'Sceptile'), (257, 'Blaziken'), (260, 'Swampert'), (282, 'Gardevoir'), (359, 'Absol'), (376, 'Metagross'),
  (380, 'Latias'), (381, 'Latios'), (382, 'Kyogre'), (383, 'Groudon'), (384, 'Rayquaza'), (385, 'Jirachi'),
  (386, 'Deoxys'), (445, 'Garchomp'), (448, 'Lucario'), (470, 'Leafeon'), (471, 'Glaceon'), (483, 'Dialga'),
  (484, 'Palkia'), (487, 'Giratina'), (491, 'Darkrai'), (493, 'Arceus'), (571, 'Zoroark'), (658, 'Greninja'),
  (700, 'Sylveon'), (722, 'Rowlet'), (725, 'Litten'), (728, 'Popplio'), (778, 'Mimikyu'), (872, 'Snom'),
  (906, 'Sprigatito'), (909, 'Fuecoco'), (912, 'Quaxly'), (937, 'Ceruledge'), (959, 'Tinkaton'), (1000, 'Gholdengo'),
  (1007, 'Koraidon'), (1008, 'Miraidon');
