-- =====================================================================
-- VITRINE CONCURSEIRA VIAJADA — teste das regras de segurança e validação
-- Simula um VISITANTE, a DONA logada e OUTRA CONTA, tentando ler,
-- criar, editar e apagar. No final DESFAZ TUDO (rollback): nada
-- fica gravado no banco.
--
-- Como usar: SQL Editor > New query > colar tudo > Run.
-- Resultado esperado: todas as linhas com "✅".
-- =====================================================================
begin;

create function pg_temp.testar_seguranca()
returns table (n int, teste text, resultado text)
language plpgsql
as $$
declare
  dona  uuid;
  vit    uuid;
  outra  uuid := gen_random_uuid();   -- uma conta qualquer, que não é a dona
  pid    uuid;
  linhas int;
  qtd    int;
  i      int := 0;
begin
  select v.dona_id, v.id into dona, vit from public.vitrines v where v.slug = 'concurseiraviajada';
  if dona is null then
    raise exception 'Rode antes o 002_perfil_da_vitrine.sql (não achei a vitrine).';
  end if;

  -- ================= DONA LOGADA =================
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', dona, 'role', 'authenticated')::text, true);

  -- 1. Dona cria um produto
  begin
    insert into public.produtos (vitrine_id, dona_id, aba, categoria, tipo, nome, link, loja)
    values (vit, dona, 'achadinhos', 'Beleza', 'produto', 'TESTE', 'https://shopee.com.br/x', 'shopee')
    returning id into pid;
    i := i+1; n := i; teste := 'Dona cria produto'; resultado := '✅ conseguiu'; return next;
  exception when others then
    i := i+1; n := i; teste := 'Dona cria produto'; resultado := '❌ ' || sqlerrm; return next;
  end;

  -- 2. Dona edita o próprio produto
  update public.produtos set nome = 'TESTE editado' where id = pid;
  get diagnostics linhas = row_count;
  i := i+1; n := i; teste := 'Dona edita o próprio produto';
  resultado := case when linhas = 1 then '✅ conseguiu' else '❌ não conseguiu' end; return next;

  -- 3. Dona manda para a lixeira
  update public.produtos set apagado_em = now() where id = pid;
  get diagnostics linhas = row_count;
  i := i+1; n := i; teste := 'Dona manda produto para a lixeira';
  resultado := case when linhas = 1 then '✅ conseguiu' else '❌ não conseguiu' end; return next;

  -- 4. Dona ainda vê o item na própria lixeira
  select count(*) into qtd from public.produtos where id = pid;
  i := i+1; n := i; teste := 'Dona vê a própria lixeira';
  resultado := case when qtd = 1 then '✅ vê' else '❌ não vê' end; return next;

  -- 5. Dona NÃO consegue apagar de vez (só o robô)
  begin
    delete from public.produtos where id = pid;
    get diagnostics linhas = row_count;
    i := i+1; n := i; teste := 'Dona NÃO apaga de vez';
    resultado := case when linhas = 0 then '✅ bloqueado' else '❌ apagou!' end; return next;
  exception when others then
    i := i+1; n := i; teste := 'Dona NÃO apaga de vez'; resultado := '✅ bloqueado'; return next;
  end;

  -- 6. Dona NÃO cria produto em nome de outra conta
  begin
    insert into public.produtos (vitrine_id, dona_id, aba, categoria, tipo, nome, link, loja)
    values (vit, outra, 'achadinhos', 'Beleza', 'produto', 'X', 'https://shopee.com.br/x', 'shopee');
    i := i+1; n := i; teste := 'Dona NÃO cria em nome de outra'; resultado := '❌ conseguiu!'; return next;
  exception when others then
    i := i+1; n := i; teste := 'Dona NÃO cria em nome de outra'; resultado := '✅ bloqueado'; return next;
  end;

  -- 7. Banco recusa item grátis com preço
  begin
    insert into public.produtos (vitrine_id, dona_id, aba, categoria, tipo, nome, link, loja, preco_pago, pago_em)
    values (vit, dona, 'estudos', 'Materiais', 'gratis', 'X', 'https://drive.google.com/x', 'drive', 10, '2026-11-01');
    i := i+1; n := i; teste := 'Banco recusa grátis com preço'; resultado := '❌ aceitou!'; return next;
  exception when others then
    i := i+1; n := i; teste := 'Banco recusa grátis com preço'; resultado := '✅ recusou'; return next;
  end;

  -- 8. Banco recusa loja desconhecida
  begin
    insert into public.produtos (vitrine_id, dona_id, aba, categoria, tipo, nome, link, loja)
    values (vit, dona, 'achadinhos', 'Beleza', 'produto', 'X', 'https://x.com/x', 'lojaqualquer');
    i := i+1; n := i; teste := 'Banco recusa loja desconhecida'; resultado := '❌ aceitou!'; return next;
  exception when others then
    i := i+1; n := i; teste := 'Banco recusa loja desconhecida'; resultado := '✅ recusou'; return next;
  end;

  -- 9. Banco recusa cupom ligado sem código
  begin
    insert into public.produtos (vitrine_id, dona_id, aba, categoria, tipo, nome, link, loja, tem_cupom)
    values (vit, dona, 'achadinhos', 'Beleza', 'produto', 'X', 'https://shopee.com.br/x', 'shopee', true);
    i := i+1; n := i; teste := 'Banco recusa cupom sem código'; resultado := '❌ aceitou!'; return next;
  exception when others then
    i := i+1; n := i; teste := 'Banco recusa cupom sem código'; resultado := '✅ recusou'; return next;
  end;

  -- 10. Dona edita o próprio perfil
  update public.vitrines set bio = bio where id = vit;
  get diagnostics linhas = row_count;
  i := i+1; n := i; teste := 'Dona edita o próprio perfil';
  resultado := case when linhas = 1 then '✅ conseguiu' else '❌ não conseguiu' end; return next;

  -- ================= OUTRA CONTA LOGADA =================
  perform set_config('request.jwt.claims', json_build_object('sub', outra, 'role', 'authenticated')::text, true);

  -- 11. Outra conta NÃO edita produto da dona
  update public.produtos set nome = 'HACKEADO' where dona_id = dona;
  get diagnostics linhas = row_count;
  i := i+1; n := i; teste := 'Outra conta NÃO edita produto da dona';
  resultado := case when linhas = 0 then '✅ bloqueado' else '❌ editou!' end; return next;

  -- 12. Outra conta NÃO edita o perfil da dona
  update public.vitrines set nome = 'HACKEADO' where id = vit;
  get diagnostics linhas = row_count;
  i := i+1; n := i; teste := 'Outra conta NÃO edita perfil da dona';
  resultado := case when linhas = 0 then '✅ bloqueado' else '❌ editou!' end; return next;

  -- ================= VISITANTE (sem login) =================
  execute 'set local role anon';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

  -- 13. Visitante vê a vitrine
  select count(*) into qtd from public.vitrines where id = vit;
  i := i+1; n := i; teste := 'Visitante vê a vitrine';
  resultado := case when qtd = 1 then '✅ vê' else '❌ não vê' end; return next;

  -- 14. Visitante NÃO vê item da lixeira
  select count(*) into qtd from public.produtos where id = pid;
  i := i+1; n := i; teste := 'Visitante NÃO vê a lixeira';
  resultado := case when qtd = 0 then '✅ não vê' else '❌ vê!' end; return next;

  -- 15. Visitante NÃO cria produto
  begin
    insert into public.produtos (vitrine_id, dona_id, aba, categoria, tipo, nome, link, loja)
    values (vit, dona, 'achadinhos', 'Beleza', 'produto', 'X', 'https://shopee.com.br/x', 'shopee');
    i := i+1; n := i; teste := 'Visitante NÃO cria produto'; resultado := '❌ conseguiu!'; return next;
  exception when others then
    i := i+1; n := i; teste := 'Visitante NÃO cria produto'; resultado := '✅ bloqueado'; return next;
  end;

  -- 16. Visitante NÃO edita produto
  begin
    update public.produtos set nome = 'HACKEADO' where dona_id = dona;
    get diagnostics linhas = row_count;
    i := i+1; n := i; teste := 'Visitante NÃO edita produto';
    resultado := case when linhas = 0 then '✅ bloqueado' else '❌ editou!' end; return next;
  exception when others then
    i := i+1; n := i; teste := 'Visitante NÃO edita produto'; resultado := '✅ bloqueado'; return next;
  end;

  -- 17. Visitante NÃO edita o perfil
  begin
    update public.vitrines set nome = 'HACKEADO' where id = vit;
    get diagnostics linhas = row_count;
    i := i+1; n := i; teste := 'Visitante NÃO edita perfil';
    resultado := case when linhas = 0 then '✅ bloqueado' else '❌ editou!' end; return next;
  exception when others then
    i := i+1; n := i; teste := 'Visitante NÃO edita perfil'; resultado := '✅ bloqueado'; return next;
  end;

  execute 'reset role';
end;
$$;

select * from pg_temp.testar_seguranca();

rollback;   -- desfaz tudo: nenhum dado de teste fica no banco
