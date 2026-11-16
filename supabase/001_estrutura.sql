-- =====================================================================
-- VITRINE CONCURSEIRA VIAJADA — 001: estrutura do banco
-- Cria as tabelas (vitrines e produtos), as regras de validação,
-- as regras de segurança (RLS) e a pasta de fotos (Storage).
--
-- Como usar: Supabase > SQL Editor > New query > colar tudo > Run.
-- Rodar UMA vez só, num projeto novo.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Função auxiliar: atualiza "atualizado_em" sozinho a cada alteração
-- ---------------------------------------------------------------------
create or replace function public.tocar_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- Tabela VITRINES: o perfil (uma por conta)
-- ---------------------------------------------------------------------
create table public.vitrines (
  id            uuid primary key default gen_random_uuid(),
  -- "restrict": apagar a conta de login NÃO apaga a vitrine sem querer
  dona_id       uuid not null unique references auth.users(id) on delete restrict,
  slug          text not null unique
                check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 40),
  nome          text not null check (char_length(btrim(nome)) between 1 and 60),
  instagram     text check (instagram ~ '^[A-Za-z0-9._]{1,30}$'),  -- só o @, sem o "@"
  bio           text check (char_length(bio) <= 300),
  avatar        text check (char_length(avatar) <= 300),          -- caminho da foto no Storage
  categorias_achadinhos text[] not null default array['Maternidade','Beleza','Papelaria','Casa']
                check (cardinality(categorias_achadinhos) between 1 and 30),
  categorias_estudos    text[] not null default array['Cursos','Materiais','Ferramentas']
                check (cardinality(categorias_estudos) between 1 and 30),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- permite que "produtos" confira que a vitrine é mesmo da mesma dona
  unique (id, dona_id)
);

create trigger vitrines_atualizado_em
  before update on public.vitrines
  for each row execute function public.tocar_atualizado_em();


-- ---------------------------------------------------------------------
-- Tabela PRODUTOS: cada item da vitrine
-- ---------------------------------------------------------------------
create table public.produtos (
  id              uuid primary key default gen_random_uuid(),
  vitrine_id      uuid not null,
  dona_id         uuid not null references auth.users(id) on delete restrict,

  -- onde aparece
  aba             text not null check (aba in ('achadinhos', 'estudos')),
  categoria       text not null check (char_length(btrim(categoria)) between 1 and 40),

  -- o que é
  tipo            text not null check (tipo in ('produto', 'infoproduto', 'gratis')),
  nome            text not null check (char_length(btrim(nome)) between 1 and 60),
  frase           text check (char_length(frase) <= 70),
  emoji           text not null default '🛍️' check (char_length(emoji) <= 16),
  foto            text check (char_length(foto) <= 300),         -- caminho da foto no Storage

  -- para onde leva
  link            text not null
                  check (link ~* '^https?://[^[:space:]]+\.[^[:space:]]+$' and char_length(link) <= 2000),
  loja            text not null
                  check (loja in ('shopee', 'ml', 'amazon', 'hotmart', 'kiwify', 'eduzz', 'drive', 'outra')),
  loja_nome       text check (char_length(loja_nome) <= 40),

  -- quanto ela pagou e quando (sempre o 1º dia do mês)
  preco_pago      numeric(10,2) check (preco_pago >= 0),
  pago_em         date,

  -- cupom próprio (só se der comissão a ela)
  tem_cupom       boolean not null default false,
  cupom_codigo    text check (char_length(cupom_codigo) <= 40),
  cupom_desconto  text check (char_length(cupom_desconto) <= 40),

  -- selo: no máximo um
  selo            text check (selo in ('favorito', 'recomprei')),

  -- opinião
  opiniao_texto   text check (char_length(opiniao_texto) <= 1500),
  opiniao_gosto   text[] not null default '{}' check (cardinality(opiniao_gosto) <= 10),
  opiniao_atencao text check (char_length(opiniao_atencao) <= 300),

  -- organização: maior "ordem" aparece primeiro (item novo entra no topo)
  ordem           double precision not null default extract(epoch from clock_timestamp()),
  apagado_em      timestamptz,          -- vazio = na vitrine; com data = na lixeira
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),

  -- a vitrine precisa ser da MESMA dona do produto
  foreign key (vitrine_id, dona_id) references public.vitrines (id, dona_id) on delete cascade,

  -- regras que dependem de mais de um campo
  constraint loja_outra_tem_nome   check (loja <> 'outra' or char_length(btrim(coalesce(loja_nome, ''))) > 0),
  constraint preco_tem_data        check (preco_pago is null or pago_em is not null),
  constraint data_tem_preco        check (pago_em is null or preco_pago is not null),
  constraint data_primeiro_do_mes  check (pago_em is null or extract(day from pago_em) = 1),
  constraint gratis_sem_preco      check (tipo <> 'gratis' or preco_pago is null),
  constraint gratis_sem_cupom      check (tipo <> 'gratis' or tem_cupom = false),
  constraint cupom_tem_codigo      check (tem_cupom = false or char_length(btrim(coalesce(cupom_codigo, ''))) > 0)
);

create index produtos_vitrine_idx on public.produtos (vitrine_id, ordem desc) where apagado_em is null;
create index produtos_dona_idx    on public.produtos (dona_id);
create index produtos_lixeira_idx on public.produtos (apagado_em) where apagado_em is not null;

create trigger produtos_atualizado_em
  before update on public.produtos
  for each row execute function public.tocar_atualizado_em();


-- ---------------------------------------------------------------------
-- SEGURANÇA (RLS): quem pode ver e quem pode mudar
-- ---------------------------------------------------------------------
alter table public.vitrines enable row level security;
alter table public.produtos enable row level security;

-- VITRINES: qualquer pessoa vê; só a dona edita a própria.
-- (Criar e apagar vitrine: só pelo painel, pelo desenvolvedor.)
create policy "vitrines: qualquer um le"
  on public.vitrines for select
  to anon, authenticated
  using (true);

create policy "vitrines: dona edita a sua"
  on public.vitrines for update
  to authenticated
  using (dona_id = (select auth.uid()))
  with check (dona_id = (select auth.uid()));

-- PRODUTOS: visitante vê só o que não está na lixeira;
-- a dona vê também a própria lixeira.
create policy "produtos: le os visiveis e a propria lixeira"
  on public.produtos for select
  to anon, authenticated
  using (apagado_em is null or dona_id = (select auth.uid()));

create policy "produtos: dona cria os seus"
  on public.produtos for insert
  to authenticated
  with check (dona_id = (select auth.uid()));

-- "Apagar" pela vitrine = mandar para a lixeira (é um UPDATE em apagado_em).
create policy "produtos: dona edita os seus"
  on public.produtos for update
  to authenticated
  using (dona_id = (select auth.uid()))
  with check (dona_id = (select auth.uid()));

-- Não existe regra de DELETE de propósito: ninguém apaga de vez pelo site.
-- Quem esvazia a lixeira (após 30 dias) é o robô diário, com a chave secreta.


-- ---------------------------------------------------------------------
-- PERMISSÕES da API (o "expose new tables" está desligado,
-- então cada acesso é liberado aqui, de propósito)
-- ---------------------------------------------------------------------
grant select on public.vitrines to anon, authenticated;
grant update (nome, instagram, bio, avatar, categorias_achadinhos, categorias_estudos)
  on public.vitrines to authenticated;

grant select on public.produtos to anon, authenticated;
grant insert on public.produtos to authenticated;
grant update (aba, categoria, tipo, nome, frase, emoji, foto, link, loja, loja_nome,
              preco_pago, pago_em, tem_cupom, cupom_codigo, cupom_desconto, selo,
              opiniao_texto, opiniao_gosto, opiniao_atencao, ordem, apagado_em)
  on public.produtos to authenticated;


-- ---------------------------------------------------------------------
-- STORAGE: pasta pública "fotos" (só imagens, até 300 KB cada)
-- Caminhos: <dona_id>/avatar.jpg  e  <dona_id>/produtos/<id>.jpg
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 307200, array['image/jpeg', 'image/webp', 'image/png']);

-- Qualquer pessoa vê as fotos pelo link público (bucket público).
-- A dona só mexe dentro da própria pasta (a 1ª pasta do caminho = id dela).
create policy "fotos: dona ve a propria pasta"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "fotos: dona envia na propria pasta"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "fotos: dona substitui na propria pasta"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "fotos: dona apaga na propria pasta"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = (select auth.uid())::text);
