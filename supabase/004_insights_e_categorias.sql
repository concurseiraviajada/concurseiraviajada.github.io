-- =====================================================================
-- VITRINE CONCURSEIRA VIAJADA — 004: Insights (contadores) e categorias
--
-- INSIGHTS: só CONTAGENS ANÔNIMAS somadas por dia. Nada que identifique
-- a pessoa (sem IP, sem aparelho, sem cookies). Ex.: "o produto X teve
-- 5 cliques hoje vindos do Instagram".
--   - visitas_diarias: quantas vezes a vitrine foi aberta, por origem
--   - cliques_diarios: quantos cliques para a loja, por produto e origem
-- Visitantes NÃO escrevem nas tabelas diretamente: só chamam as funções
-- registrar_visita / registrar_clique, que validam tudo e somam +1.
-- Só a dona logada consegue LER os números.
--
-- CATEGORIAS: renomear e mover itens em uma única operação (ou tudo
-- muda, ou nada muda), respeitando as regras de segurança.
--
-- Como usar: SQL Editor > New query > colar tudo > Run. Rodar UMA vez.
-- =====================================================================

-- Origens aceitas (qualquer outra vira 'outro')
create or replace function public.origem_valida(p text)
returns text language sql immutable set search_path = '' as $$
  select case when p in ('bio','stories','instagram','whatsapp','google','facebook','direto','outro')
              then p else 'outro' end;
$$;

-- "Hoje" no horário de Brasília
create or replace function public.hoje_brasil()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;


-- ---------------------------------------------------------------------
-- Tabelas de contagem
-- ---------------------------------------------------------------------
create table public.visitas_diarias (
  vitrine_id uuid not null references public.vitrines(id) on delete cascade,
  dia        date not null,
  origem     text not null check (origem = public.origem_valida(origem)),
  total      integer not null default 0 check (total between 0 and 1000000),
  primary key (vitrine_id, dia, origem)
);

create table public.cliques_diarios (
  produto_id uuid not null references public.produtos(id) on delete cascade,  -- some junto com o produto
  dia        date not null,
  origem     text not null check (origem = public.origem_valida(origem)),
  total      integer not null default 0 check (total between 0 and 1000000),
  primary key (produto_id, dia, origem)
);
create index cliques_diarios_dia_idx on public.cliques_diarios (dia);

alter table public.visitas_diarias enable row level security;
alter table public.cliques_diarios enable row level security;

-- Só a dona lê os números da própria vitrine
create policy "visitas: dona le as suas"
  on public.visitas_diarias for select to authenticated
  using (exists (select 1 from public.vitrines v where v.id = vitrine_id and v.dona_id = (select auth.uid())));

create policy "cliques: dona le os seus"
  on public.cliques_diarios for select to authenticated
  using (exists (select 1 from public.produtos p where p.id = produto_id and p.dona_id = (select auth.uid())));

grant select on public.visitas_diarias, public.cliques_diarios to authenticated;
-- (nenhum insert/update/delete liberado: só as funções abaixo escrevem)


-- ---------------------------------------------------------------------
-- Funções que os visitantes chamam (somam +1, com validação)
-- "security definer": rodam com permissão própria, mas só fazem isto.
-- ---------------------------------------------------------------------
create or replace function public.registrar_visita(p_slug text, p_origem text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  select id into v_id from public.vitrines where slug = p_slug;
  if v_id is null then return; end if;
  insert into public.visitas_diarias as t (vitrine_id, dia, origem, total)
  values (v_id, public.hoje_brasil(), public.origem_valida(p_origem), 1)
  on conflict (vitrine_id, dia, origem) do update set total = least(t.total + 1, 1000000);
end;
$$;

create or replace function public.registrar_clique(p_produto uuid, p_origem text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- só conta produto que existe e está na vitrine (fora da lixeira)
  if not exists (select 1 from public.produtos where id = p_produto and apagado_em is null) then return; end if;
  insert into public.cliques_diarios as t (produto_id, dia, origem, total)
  values (p_produto, public.hoje_brasil(), public.origem_valida(p_origem), 1)
  on conflict (produto_id, dia, origem) do update set total = least(t.total + 1, 1000000);
end;
$$;

revoke all on function public.registrar_visita(text, text) from public;
revoke all on function public.registrar_clique(uuid, text) from public;
grant execute on function public.registrar_visita(text, text) to anon, authenticated;
grant execute on function public.registrar_clique(uuid, text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- Categorias: renomear e mover itens (só a dona; regras de segurança valem)
-- "security invoker": roda com a permissão de quem chama.
-- Apagar categoria é feito pela tela (só se estiver vazia).
-- ---------------------------------------------------------------------
create or replace function public.renomear_categoria(p_aba text, p_antigo text, p_novo text)
returns void language plpgsql security invoker set search_path = '' as $$
declare v public.vitrines;
begin
  p_novo := btrim(p_novo);
  if p_aba not in ('achadinhos','estudos') then raise exception 'aba inválida'; end if;
  if char_length(p_novo) not between 1 and 40 then raise exception 'nome inválido'; end if;
  select * into v from public.vitrines where dona_id = (select auth.uid());
  if v.id is null then raise exception 'sem permissão'; end if;
  if p_aba = 'achadinhos' then
    if not p_antigo = any(v.categorias_achadinhos) then raise exception 'categoria não existe'; end if;
    if p_novo = any(v.categorias_achadinhos) and p_novo <> p_antigo then raise exception 'já existe'; end if;
    update public.vitrines set categorias_achadinhos = array_replace(categorias_achadinhos, p_antigo, p_novo) where id = v.id;
  else
    if not p_antigo = any(v.categorias_estudos) then raise exception 'categoria não existe'; end if;
    if p_novo = any(v.categorias_estudos) and p_novo <> p_antigo then raise exception 'já existe'; end if;
    update public.vitrines set categorias_estudos = array_replace(categorias_estudos, p_antigo, p_novo) where id = v.id;
  end if;
  -- todos os itens da categoria (inclusive os da lixeira) acompanham o nome novo
  update public.produtos set categoria = p_novo where vitrine_id = v.id and aba = p_aba and categoria = p_antigo;
end;
$$;

create or replace function public.mover_categoria(p_aba text, p_de text, p_para text)
returns integer language plpgsql security invoker set search_path = '' as $$
declare v public.vitrines; n integer;
begin
  select * into v from public.vitrines where dona_id = (select auth.uid());
  if v.id is null then raise exception 'sem permissão'; end if;
  if p_de = p_para then raise exception 'mesma categoria'; end if;
  if not p_para = any(case when p_aba = 'achadinhos' then v.categorias_achadinhos else v.categorias_estudos end) then
    raise exception 'categoria de destino não existe';
  end if;
  -- move todos os itens (inclusive os da lixeira, para não ficarem órfãos)
  update public.produtos set categoria = p_para where vitrine_id = v.id and aba = p_aba and categoria = p_de;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- a função de renomear troca a categoria dos itens: precisa poder atualizar essa coluna
-- (já liberada no 001). Só usuárias logadas chamam:
revoke all on function public.renomear_categoria(text, text, text) from public;
revoke all on function public.mover_categoria(text, text, text) from public;
grant execute on function public.renomear_categoria(text, text, text) to authenticated;
grant execute on function public.mover_categoria(text, text, text) to authenticated;
