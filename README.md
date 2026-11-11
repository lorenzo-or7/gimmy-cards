# Gimmy Cards — plataforma de leilões

Leilões de cartas colecionáveis da comunidade Gimmy Cards: lances com ordem de registro no servidor, arremate imediato, encerramento automático, pedidos, comprovantes, inadimplência, cartas armazenadas, entregas e painel administrativo.

**Stack:** React 19 · TypeScript (strict) · Vite 6 · Tailwind CSS 4 · Motion · Supabase (PostgreSQL, Auth, Storage, Realtime, pg_cron) · Vitest · Playwright + axe.

---

## 1. Rodar localmente

```bash
npm install
npm run dev
```

Abra **http://localhost:5173**.

Sem variáveis do Supabase, o site abre em **modo demonstração**: as migrations SQL reais rodam dentro do navegador (PGlite) com dados de exemplo identificados como DEMO. Um botão **DEMO** no canto da tela permite entrar como admin ou participante, simular o encerramento do leilão ao vivo, vencer prazos de pagamento e restaurar os dados. Nada sai do navegador. O modo demo **nunca** é usado quando o Supabase está configurado.

> Windows: se o Smart App Control bloquear binários nativos do Rollup, o `package.json` já força o `@rollup/wasm-node` (sem binário nativo).

## 2. Configurar o Supabase (produção)

1. Crie um projeto em https://supabase.com (região São Paulo recomendada).
2. **Database → Extensions**: habilite `pg_cron` (e `pgcrypto`, normalmente já ativo).
3. Aplique as migrations **em ordem** (SQL Editor ou `supabase db push` com a CLI):

   | Arquivo | Conteúdo |
   |---|---|
   | `supabase/migrations/20261110000100_core_schema.sql` | Tabelas, enums, índices, restrições |
   | `supabase/migrations/20261110000200_functions.sql` | Regras críticas: `place_bid`, `buy_now`, `close_due_lots`, pedidos, pagamentos, inadimplência, entregas, papéis, auditoria |
   | `supabase/migrations/20261110000300_rls.sql` | Row Level Security e permissões de execução |
   | `supabase/migrations/20261110000350_api.sql` | API de leitura/escrita usada pelo frontend (RPC) |
   | `supabase/migrations/20261110000400_storage_realtime_cron.sql` | Buckets (`card-images` público, `payment-proofs` privado), Realtime e agendamentos `pg_cron` |
   | `supabase/migrations/20261111000100_pokemon_favorites.sql` | Catálogo de Pokémon (#1–#251 + populares), Pokémon por carta, favoritos e avisos especiais na publicação |
   | `supabase/migrations/20261111000200_payment_deadline_18h.sql` | Prazo oficial de pagamento: segunda-feira seguinte, 18h (Brasília) |

4. **Authentication → Providers → Email**: mantenha *Confirm email* ligado.
   **Authentication → URL Configuration**: *Site URL* = seu domínio; adicione `https://SEU-DOMINIO/nova-senha` e `https://SEU-DOMINIO/entrar` em *Redirect URLs* (e `http://localhost:5173/*` para testes).
5. Copie `.env.example` para `.env.local` e preencha:

   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

   A chave `service_role` **nunca** vai no frontend.

### Variáveis de ambiente

| Variável | Onde achar | Obrigatória |
|---|---|---|
| `VITE_SUPABASE_URL` | Project Settings → API → Project URL | sim (produção) |
| `VITE_SUPABASE_ANON_KEY` | Project Settings → API → anon public | sim (produção) |

### Criar o primeiro administrador

1. Cadastre-se normalmente pelo site (`/cadastro`) e confirme o e-mail.
2. No **SQL Editor** do Supabase (roda como dono do banco), execute:

   ```sql
   update public.profiles set role = 'super_admin'
   where id = (select id from auth.users where email = 'SEU-EMAIL@exemplo.com');
   ```

3. Saia e entre de novo. O link **Painel administrativo** aparece no menu da conta.
4. Outros administradores são promovidos pelo próprio painel (**Participantes**), apenas pelo administrador principal. O sistema impede remover o último administrador principal.

O papel nunca vem do cadastro: o gatilho `handle_new_user` sempre cria `participant`, e o gatilho `profiles_guard` bloqueia qualquer troca de papel feita por quem não é administrador principal.

## 3. Como as regras são garantidas no servidor

- **Lance** (`place_bid`): trava a linha do lote (`FOR UPDATE`), valida horário pelo relógio do servidor, mínimo, incremento, teto do arremate, limite de 20 lances/minuto e idempotência (`client_key`). A ordem é o `id` monotônico do lance (identity), serializado pela trava — não depende do relógio do celular.
- **Lances iguais** são permitidos; classificação = maior valor, depois registro mais antigo. Cada participante vale pelo seu maior lance; um mesmo valor não pode ser registrado duas vezes pela mesma pessoa (`unique (lot_id, user_id, amount)`).
- **Ofertas abaixo do maior lance** são aceitas (≥ lance inicial e acima do próprio lance anterior) e entram como classificação secundária.
- **Arremate imediato** (`buy_now`): atômico; fecha o lote, registra vencedor e classificação; qualquer chamada seguinte recebe `LOT_CLOSED`. Lances comuns não podem atingir o valor de arremate (`USE_BUYOUT`), então nunca há dois vencedores nem ultrapassagem do teto.
- **Encerramento**: `close_due_lots()` roda a cada minuto via `pg_cron`, mesmo sem ninguém no site; lances após `ends_at` são recusados de qualquer forma. Ao fechar, a classificação é congelada em `lot_rankings`; quando o leilão inteiro fecha, é criado um pedido por participante com prazo na segunda seguinte, 18h (Brasília).
- **Pagamento**: enviar comprovante muda o status para "em análise"; só um admin confirma. Comprovantes ficam no bucket privado, acessados por link assinado de 5 minutos.
- **Inadimplência**: só após o prazo e com motivo; a oferta vai ao próximo da classificação pelo valor do próprio lance, com 24 h para aceitar; índice único impede duas ofertas ativas no mesmo lote; tudo vai para `audit_log`.
- **Armazenamento/entregas**: itens pagos viram `stored_items` (1 por item de pedido, `unique`), solicitações de envio só aceitam itens do próprio dono.

## 4. Novidades da V3

- Prazo de pagamento: **segunda-feira seguinte ao encerramento, 18h** (Brasília). Pedidos criados antes da migration mantêm o prazo já informado; ajuste manual por `admin_set_order_due`, se necessário.
- Página `/sorteios` e seção na Home com as cinco artes oficiais por marco de membros (100, 250, 500, 750, 1.000). Não há contagem de membros, datas ou vencedores no sistema.
- Regras em formato de guia (`/regras`), separando regras dos leilões e regras do grupo do WhatsApp.
- Pokémon favoritos: `/conta/favoritos` e campo “Pokémon da carta” no cadastro administrativo.
- Links oficiais: grupo do WhatsApp, Instagram @gimmycards e assinatura Or7 (https://lorenzo-or7.github.io/).

### Novidades da V4

- Redesign com sistema de grid/tipografia (`.shell`, `.section-y`, `.t-display`…), navbar segmentada estável no scroll e indicador “Ao vivo” vermelho (`LiveBadge`, token `--live`).
- Mascote oficial em `public/mascot/` (WebP 900px + `-sm` 360px), usado via `<Mascot pose=… />`; atmosfera do hero em `public/brand/atmosfera.webp`.
- Recorte de fotos no admin (`CropEditor`, react-easy-crop): frente e verso independentes, zoom, giro de 90°, endireitar ±45°, proporção 5:7 sugerida, restaurar original. Resultado salvo em WebP.
- Desempenho: o banco do modo demo roda num **Web Worker** (`src/lib/demo/pglite.worker.ts`); migrations e seed acontecem dentro do worker, sem travar a interface. Contadores só re-renderizam ao cruzar horários relevantes (`useNowAt`).
- Medição: `npm run build`, `npx vite preview --port 5190` e `node tests/perf/measure.mjs <rótulo>` (resultados em `tests/perf/before.json` e `after.json`).
- Observação de desenvolvimento: se uma classe Tailwind nova não aparecer no `npm run dev`, reinicie o servidor; o build de produção não tem esse problema.

### Novidades da V5

- Navbar em cápsula única de vidro (`.nav-glass`), logo no centro geométrico (`grid minmax(0,1fr) auto minmax(0,1fr)`), indicador ativo único (linha ciano que desliza entre links) e controles com a mesma linguagem (`HEADER_ICON_BTN`).
- Biblioteca de mascotes com 10 poses em `<Mascot pose=… />`: `auctioneer`, `collector`, `happy`, `sleeping`, `flying`, `jumping`, `waving`, `sad`, `celebrating`, `confused` (nomes antigos em português continuam válidos). Originais em `assets/mascot-originals/`.
- Uso contextual: `celebrating` só após confirmação do servidor; `sad` em erros recuperáveis; `confused` em buscas sem resultado e itens não encontrados; `waving` no cadastro concluído.
- Modo demo: a sessão sobrevive a recarregamentos (rotina de varredura agora usa a mesma fila de consultas e a aba libera o banco no `pagehide`).

## 5. Testes

```bash
npm test            # Vitest: domínio, formatação, validações, componentes + banco (PGlite)
npm run test:db     # só os testes de banco
npx playwright install chromium   # uma vez
npm run test:e2e    # Playwright (modo demo) + axe nos dois temas
npm run lint
npm run typecheck
npm run build
```

Os testes de banco executam **as migrations reais** dentro do PGlite (PostgreSQL em WASM), com stubs mínimos do `auth` do Supabase. A migration de Storage/Realtime/cron não roda ali (depende da plataforma Supabase).

## 6. Estrutura

```
supabase/migrations/     schema, regras, RLS, API e storage/cron
src/lib/                 api (RPC tipada), backend (Supabase | demo), domínio, formatação, erros, imagens
src/lib/demo/            modo demonstração (PGlite + seed via funções reais)
src/components/          ui (design system), cards (flip, holográfico, galeria), auction, layout
src/pages/public|auth|account|admin
tests/db                 testes SQL (PGlite)   tests/e2e  Playwright + axe
```

## 7. Pendências externas

- Projeto Supabase (URL + anon key) e aplicação das migrations.
- Domínio e URLs de redirecionamento do Auth.
- SMTP próprio no Supabase (o SMTP padrão tem limite baixo de e-mails por hora).
- Login com Google: opcional; habilitar o provider no Supabase e adicionar o botão (não implementado nesta versão).
- Revisão jurídica dos textos de Regras e Privacidade (marcados como texto inicial).
