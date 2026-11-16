-- =====================================================================
-- VITRINE CONCURSEIRA VIAJADA — 002: cria o perfil da vitrine
-- Rodar DEPOIS de criar a conta de login da dona em
-- Authentication > Users > Add user.
-- Troque os campos <...> antes de rodar. O e-mail de login não fica
-- publicado aqui de propósito (ver Authentication > Users).
-- Nome, bio, foto e @ podem ser mudados depois pela tela "Editar perfil".
-- =====================================================================
insert into public.vitrines (dona_id, slug, nome, bio)
select id,
       'concurseiraviajada',
       '<NOME QUE APARECE NA VITRINE>',
       '<BIO>'
from auth.users
where email = '<E-MAIL DE LOGIN DA DONA>';

-- Conferência: deve mostrar 1 linha com a vitrine.
select slug, nome, categorias_achadinhos, categorias_estudos from public.vitrines;
