# Vitrine Concurseira Viajada — guia do projeto

Vitrine de links de afiliado para o "link na bio" do Instagram da marca **Concurseira Viajada**
(público: mães e concurseiras; beleza com praticidade e estudos). Quem usa a vitrine no dia a dia
é chamada aqui de **"a usuária"** (a dona da vitrine).
Responsável técnico: o desenvolvedor do projeto.

> ⚠️ Este repositório é **PÚBLICO** (exigência do GitHub Pages grátis). Não escrever aqui
> dados pessoais, e-mails de login, senhas ou chaves secretas.

## Como trabalhar neste projeto
- **Nenhuma decisão sem consultar o desenvolvedor.** Propor, explicar de forma simples, recomendar e esperar o "ok".
- Escrever em português, explicando qualquer termo técnico.
- As decisões abaixo **não mudam sem perguntar**.

## Estrutura atual
```
index.html        estrutura da página (sem CSS/JS dentro)
css/estilo.css    todo o visual
js/vendor/supabase-2.119.0.js   biblioteca oficial supabase-js (UMD), cópia fixa — conferida com o hash do npm
js/config.js      URL do projeto + chave PÚBLICA (sb_publishable_...). Nunca a secreta.
js/dados.js       ÚNICO arquivo que fala com o Supabase: login, carregarVitrine, salvarProduto, marcarLixeira, salvarPerfil, fotos
js/app.js         tela, filtros, painel de opinião, formulário, login, "Modo edição"
supabase/         SQL aplicado no projeto (001, 002…) e testes (testes/teste_seguranca.sql)
scripts/robo.mjs  robô diário (Node, sem dependências): mantém o banco ativo, esvazia a lixeira (30 dias), salva a cópia
.github/workflows/robo-diario.yml   agenda o robô (06:17 de Brasília) + "sinal de vida" após 50 dias sem commit
backup/           cópia de segurança gerada pelo robô (vitrine.json + fotos/). NÃO editar à mão.
```
- HTML/CSS/JS puros, **sem build** (sem npm/Node). Scripts clássicos (não módulos), nesta ordem: `vendor/supabase` → `config.js` → `dados.js` → `app.js`. O cliente Supabase se chama `sb` (o nome `supabase` é o da biblioteca).
- Biblioteca copiada para o projeto (decisão do desenvolvedor): o site não depende de CDN e funciona no plano B. Atualizar manualmente de vez em quando.
- Sessão de login fica salva no aparelho **até tocar em "Sair"** (decisão do desenvolvedor).
- **Cache**: `index.html` carrega CSS/JS com `?v=AAAAMMDDx`. **Ao mudar qualquer CSS/JS, trocar essa versão** (senão celulares mostram a versão antiga).
- **Plano B** (`js/dados.js`): se o banco não responder em 8 s, a página lê `backup/vitrine.json` e as fotos de `backup/fotos/`; o Modo edição fica desligado.
- Para testar no navegador do app (que não carrega CSS/JS via `file://`), usar o servidor local `vitrine` de `.claude/launch.json` (`python -m http.server 5500`).
- O commit inicial guarda o protótipo original em arquivo único (vindo do chat).

## Decisões tomadas

### Produto / tela
- **Sem nota de 1 a 5 estrelas.** Só dois selos, **no máximo 1 por item**: "❤️ Favorito" e "🔁 Já recomprei".
- **Aviso de favoritos**: aparece (nunca bloqueia) quando os favoritos passam de **20% dos itens, mínimo 5**. "Já recomprei" não tem limite.
- **Sem página intermediária por produto**: o clique no cartão vai direto para a loja; a opinião fica no painel "💬 Ver minha opinião" (opinião, "O que eu gosto", "Ponto de atenção").
- **Preço = o que ela pagou, com mês/ano** ("💸 Paguei R$ X em mês/ano"), nunca "preço atual". Opcional.
- **Duas abas**: `🛍️ Achadinhos` | `🎓 Estudos e materiais`. A página abre na aba que tem itens; se as duas tiverem (ou nenhuma), abre em Achadinhos. Depois que a pessoa toca numa aba, não troca mais sozinha.
- **3 tipos de item**: 📦 Produto · 🎓 Infoproduto · 🆓 Grátis. **Não existe tipo "Cupom".**
- **Cupom**: chavinha "🏷️ Tenho cupom próprio" (código + desconto) em produto/infoproduto, **só para cupom DELA que gera comissão**. Cupom genérico de loja não entra. Cartão destaca o cupom com botão "📋 Copiar".
- **Sem filtro "Com cupom"** (pareceria forçar venda).
- **Item grátis**: sem preço e sem cupom; cartão mostra só "🆓 Grátis"; material fica em **link (Google Drive ou próprio), nunca arquivo no Supabase**.
- **Permuta NUNCA entra na vitrine** (ela mostra permuta só no perfil do Instagram). Não sugerir formas de exibir permuta.
- **Princípio**: todo item da vitrine gera ganho para ela (link de afiliado ou cupom próprio), exceto os grátis. A usuária **não vende nada próprio** — o texto "Eu não vendo nada" do aviso de transparência continua verdadeiro.
- **Aba sugerida pelo tipo** no formulário (produto → Achadinhos; infoproduto/grátis → Estudos), ela pode trocar.
- **Categorias por aba**, salvas no perfil, ela pode **criar** novas (renomear/apagar fica para depois):
  - Achadinhos: Maternidade · Beleza · **Papelaria** (ex-"Estudos") · Casa
  - Estudos e materiais: Cursos · Materiais · Ferramentas
- **Lojas** detectadas pelo link: Shopee, Mercado Livre, Amazon, Hotmart, Kiwify, Eduzz, Google Drive; senão "Outra" + nome digitado. Filtro de lojas (só na aba Achadinhos) mostra só lojas que têm itens.
- **Apagar**: confirmação explicando como recuperar → toast "Desfazer" → **lixeira** no Modo edição com "Restaurar" → robô apaga de vez após **30 dias** (item + foto).
- **Login**: botão discreto **"Entrar"** no **canto superior direito** (sai do rodapé), abre **painel pop-up** com e-mail + senha (olhinho para mostrar senha). **Sem "Esqueci minha senha"** e **sem "Criar conta"**: o desenvolvedor cria a conta e redefine senhas pelo painel do Supabase.
- **Tela "Editar perfil"** no Modo edição: foto (avatar), nome, bio, @ do Instagram.
- **Aviso de transparência** (aprovado 16/11/2026): links de afiliado ou cupons dela; "usei de verdade"; ela não vende nada. Parágrafo dos 🆓 Grátis (materiais feitos por ela, não são cópias) só aparece se existir item grátis. **Não citar Hotmart/Kiwify em textos institucionais** (associação negativa com venda de cursos) e **sem linha de "me chama no direct"** sobre direitos autorais (chamaria atenção para má-fé que não existe). Já **nos cartões** o nome da plataforma (etiqueta e botão, ex.: "Conhecer na Hotmart") **fica**: é a fonte do produto.

### Infraestrutura
- **Supabase** (plano grátis): banco, login e fotos. Conta no e-mail do desenvolvedor; a usuária entra como membro da organização com papel **Developer ou inferior** (não Owner/Admin).
- **Cota grátis = 2 projetos ativos POR PESSOA** (somando todas as organizações onde é Owner/Admin; pausados não contam). Decisão: **1 projeto para tudo da usuária** (vitrine e, no futuro, uma página-raiz tipo linktree que leva à vitrine etc.) + **1 projeto do desenvolvedor** (ex.: segundo cérebro). **Não há projeto de testes na nuvem.**
- **Duas organizações** no Supabase: uma da marca Concurseira Viajada (só o projeto da vitrine) e uma do desenvolvedor. Conta Supabase criada com **"Continue with GitHub"**. Região: **South America (São Paulo)**. Projeto da vitrine: **`concurseira-viajada`**. Senha do banco guardada pelo desenvolvedor no Google Senhas (nunca no chat/repositório).
- Testes: antes do lançamento, o próprio projeto da vitrine serve de teste (ainda sem visitantes). Depois do lançamento, mudanças no banco vão como arquivos SQL revisados no repositório, aplicadas com cópia de segurança feita antes.
- **Login por e-mail** (padrão SaaS). A conta da usuária usa um **e-mail interno** (não publicado aqui; ver Supabase > Authentication > Users), criada pelo painel (Add user > Create new user, auto confirm) em 15/11/2026. Se um dia der problema, plano B = e-mail real da usuária.
- **Cadastro público desligado** (Authentication > Sign In / Providers > "Allow new users to sign up" = off). Login anônimo também desligado.
- **Hospedagem**: GitHub Pages numa **organização do GitHub com o nome da marca** : org **`concurseiraviajada`**, repo **`concurseiraviajada.github.io`** (site: https://concurseiraviajada.github.io). Repositório **público** (Pages grátis exige). Domínio .com.br talvez depois.
- **Preparado para várias usuárias** (futuro SaaS): tudo ligado a `dona_id`; vitrine identificada por `slug`; **uma vitrine por conta**.
- **Proteção contra pausa do plano grátis** (Supabase pausa após ~1 semana sem atividade):
  1. Robô diário (GitHub Actions) consulta o banco; se falhar, o GitHub manda e-mail ao desenvolvedor. Também evita o GitHub desligar agendamentos após 60 dias sem alterações.
  2. **Cópia de segurança DIÁRIA** (perfil + itens + fotos) no repositório; só faz commit se algo mudou. **Só os itens visíveis** (a lixeira NÃO entra, porque o repositório é público).
  3. **Plano B**: se o Supabase não responder, a página mostra a última cópia do repositório (link nunca fica vazio; só não dá para editar).
  4. No plano B, ao tocar em "Entrar", a usuária vê "a vitrine está em modo de segurança, Avisa o suporte 💛" (visitantes não veem nada diferente).

### Banco de dados (desenho aprovado)
**`vitrines`** (uma por conta): `id`, `dona_id` (único), `slug` (único, minúsculas sem acento), `nome`, `instagram` (só o @), `bio`, `avatar` (caminho), `categorias_achadinhos` (lista), `categorias_estudos` (lista), `criado_em`, `atualizado_em`.

**`produtos`**: `id`, `vitrine_id`, `dona_id` (repetido de propósito, simplifica RLS), `aba` (`achadinhos`|`estudos`), `categoria`, `tipo` (`produto`|`infoproduto`|`gratis`), `nome` (≤60), `frase` (≤70), `emoji`, `foto` (caminho), `link` (http/https), `loja` (`shopee`|`ml`|`amazon`|`hotmart`|`kiwify`|`eduzz`|`drive`|`outra`), `loja_nome` (obrigatório se `outra`), `preco_pago` (número ≥ 0, opcional, proibido em grátis; exibido "R$ 1.234,56"), `pago_em` (mês/ano, obrigatório se tem preço), `tem_cupom` (proibido em grátis), `cupom_codigo` (obrigatório se `tem_cupom`), `cupom_desconto`, `selo` (`favorito`|`recomprei`|nulo), `opiniao_texto`, `opiniao_gosto` (lista), `opiniao_atencao`, `ordem`, `apagado_em` (nulo = na vitrine; data = na lixeira), `criado_em`, `atualizado_em`.
- Regras de validação **no próprio banco** (CHECKs), não só na tela.
- "Atualizado em" do rodapé = alteração mais recente (automático).

**Storage `fotos`**: `fotos/<dona_id>/avatar-<hora>.jpg` e `fotos/<dona_id>/produtos/<id>-<hora>.jpg` (a hora no nome evita cache antigo); só imagens, limite 300 KB; fotos comprimidas no navegador (~35 KB, 400–500 px), lazy loading.

**RLS**: qualquer um lê (visitante só vê itens fora da lixeira); só a dona logada cria/edita/manda para a lixeira o que é dela; **ninguém apaga de vez pelo site** (só o robô, após 30 dias). **Nada privado no banco** (nada de visitantes, CPF, telefone, comissões, senhas de lojas). Chave **secreta** (`sb_secret_...`) **nunca** no site nem no repositório: só nos Secrets do GitHub, para o robô.

## Roteiro
1. ✅ Organizar arquivos, CLAUDE.md, README.md.
2. ✅ Supabase: conta, organização e projeto `concurseira-viajada`; 001 e 002 aplicados; teste de segurança 17/17 ✅ (15/11/2026).
3. ✅ Login real (e-mail + senha) no painel pop-up, botão "Entrar" no canto, aviso de modo de segurança. Testado de fora: visitante lê, não cria/edita/apaga, cadastro bloqueado, upload de foto bloqueado.
4. ✅ Vitrine ligada ao Supabase (abas, tipos, cupom, lojas, fotos comprimidas no Storage com lazy loading, lixeira com Desfazer/Restaurar, editar perfil, criar categoria). Começa VAZIA (decisão do desenvolvedor: sem os exemplos do protótipo). Testado pelo desenvolvedor logado como a usuária (adicionar, foto, cupom, editar, lixeira, perfil, sair) em 16/11/2026.
5. ✅ Robô diário + cópia de segurança + plano B. Segredo `SUPABASE_SECRET_KEY` (chave `robo_github`, só para o robô) nos Secrets do repo; permissões do robô em `supabase/003_permissoes_robo.sql`. Primeira execução OK em 16/11/2026 (cópia sem lixeira e sem dona_id). Commits do robô também disparam o deploy do Pages.
6. ✅ Publicado em https://concurseiraviajada.github.io (Pages a partir do `main`, HTTPS). Prévia de link (Open Graph): título "Achadinhos da Concurseira Viajada", descrição "Produtos e materiais de estudo que eu uso de verdade, com quanto paguei e minha opinião sincera.", imagem `img/previa.jpg` (1200×630, arte da marca gerada por script). Ícones: `favicon.ico`, `img/icone-32.png`, `img/icone-180.png` (iniciais CV). Ao trocar a imagem, mudar o `?v=` do og:image.
7. Testar no celular: a usuária adiciona um item e outra pessoa vê.

**Extras para depois (não fazer agora):** contador de cliques por item, link direto para cada item (stories), reordenar arrastando (campo `ordem` já previsto), renomear/apagar categorias, página-raiz da usuária (tipo linktree) levando à vitrine.
