# Vitrine Concurseira Viajada

Vitrine de "achadinhos" com links de afiliado (Shopee, Mercado Livre e outras plataformas)
para o link na bio do Instagram. Cada item mostra quanto foi pago e quando, uma opinião
sincera e leva direto para a loja.

## Como funciona
- Site estático (HTML, CSS e JavaScript, sem build) publicado no GitHub Pages.
- Banco de dados, login e fotos no [Supabase](https://supabase.com), protegidos por regras de segurança (RLS).
- Um robô diário (GitHub Actions) mantém o banco ativo, esvazia a lixeira e salva uma cópia de segurança em `backup/`.
- Se o banco ficar fora do ar, a página mostra a última cópia de segurança.

## Arquivos
| Arquivo | O que tem |
|---|---|
| `index.html` | a estrutura da página |
| `css/estilo.css` | cores, tamanhos, visual |
| `js/config.js` | endereço do banco e chave pública |
| `js/dados.js` | tudo que conversa com o banco |
| `js/app.js` | a vitrine, os filtros, os painéis e os formulários |
| `supabase/` | estrutura do banco e testes de segurança |
| `scripts/robo.mjs` | o robô diário |
| `CLAUDE.md` | decisões do projeto |

## Testar no computador
```
python -m http.server 5500
```
e abrir http://localhost:5500
