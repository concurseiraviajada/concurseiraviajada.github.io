-- =====================================================================
-- VITRINE CONCURSEIRA VIAJADA — 003: permissões do robô diário
-- O robô (GitHub Actions) usa a chave secreta, que entra no banco como
-- "service_role". Como o projeto não libera tabelas automaticamente,
-- cada permissão é dada aqui, de propósito, só com o necessário:
--   - ler a vitrine e os itens (manter o banco ativo + cópia de segurança)
--   - apagar de vez os itens com mais de 30 dias na lixeira
-- Rodar UMA vez no SQL Editor.
-- =====================================================================
grant usage on schema public to service_role;
grant select on public.vitrines to service_role;
grant select, delete on public.produtos to service_role;
