// =====================================================================
// VITRINE CONCURSEIRA VIAJADA — robô diário (roda no GitHub Actions)
//  1. Consulta o banco (mantém o Supabase grátis ativo: ele pausa após
//     ~1 semana sem atividade).
//  2. Esvazia a lixeira: itens apagados há mais de 30 dias saem de vez
//     (o item e a foto).
//  3. Cópia de segurança em backup/: perfil + itens VISÍVEIS + fotos.
//     (A lixeira não entra: o repositório é público.)
//     O arquivo só muda quando os dados mudam, então só há commit nesses dias.
//
// Precisa da variável SUPABASE_SECRET_KEY (guardada nos Secrets do GitHub).
// O endereço do projeto e o slug são lidos de js/config.js.
// Sem dependências: só Node 20+.
// =====================================================================
import { readFile, writeFile, mkdir, readdir, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const DIAS_LIXEIRA = 30;
const PASTA = "backup";

const config = await readFile("js/config.js", "utf8");
const pegar = nome => (new RegExp(`const ${nome} = "([^"]+)"`).exec(config) || [])[1];
const URL_BASE = pegar("SUPABASE_URL");
const SLUG = pegar("VITRINE_SLUG");
const CHAVE = process.env.SUPABASE_SECRET_KEY;
if(!URL_BASE || !SLUG) throw new Error("Não achei SUPABASE_URL/VITRINE_SLUG em js/config.js");
if(!CHAVE || !CHAVE.startsWith("sb_secret_")) throw new Error("Falta o segredo SUPABASE_SECRET_KEY (sb_secret_...) no GitHub");

const H = { apikey: CHAVE, Authorization: `Bearer ${CHAVE}` };

async function api(caminho, opcoes = {}){
  const r = await fetch(URL_BASE + caminho, { ...opcoes, headers: { ...H, ...(opcoes.headers || {}) } });
  if(!r.ok) throw new Error(`${opcoes.method || "GET"} ${caminho} -> ${r.status} ${await r.text()}`);
  const tipo = r.headers.get("content-type") || "";
  return tipo.includes("json") ? r.json() : r.arrayBuffer();
}

// ---------- 1. Leitura (isso já conta como atividade no banco) ----------
const [vitrine] = await api(`/rest/v1/vitrines?slug=eq.${encodeURIComponent(SLUG)}&select=*`);
if(!vitrine) throw new Error(`Vitrine "${SLUG}" não encontrada`);
const todos = await api(`/rest/v1/produtos?vitrine_id=eq.${vitrine.id}&select=*&order=ordem.desc`);
console.log(`Banco respondeu: vitrine "${vitrine.slug}", ${todos.length} itens (incluindo lixeira).`);

// ---------- 2. Esvaziar a lixeira (mais de 30 dias) ----------
const limite = Date.now() - DIAS_LIXEIRA * 86400000;
const vencidos = todos.filter(p => p.apagado_em && new Date(p.apagado_em).getTime() < limite);
for(const p of vencidos){
  if(p.foto){
    await api(`/storage/v1/object/fotos`, { method:"DELETE", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ prefixes:[p.foto] }) })
      .catch(e => console.warn("  (foto já não existia)", e.message));
  }
  await api(`/rest/v1/produtos?id=eq.${p.id}`, { method:"DELETE" });
  console.log(`Lixeira: "${p.nome}" apagado de vez.`);
}
if(!vencidos.length) console.log("Lixeira: nada com mais de 30 dias.");

// ---------- 3. Cópia de segurança ----------
const visiveis = todos.filter(p => !p.apagado_em);
const semDona = ({ dona_id, vitrine_id, apagado_em, ...resto }) => resto;
const { dona_id, ...perfil } = vitrine;
const copia = { vitrine: perfil, produtos: visiveis.map(semDona) };
const texto = JSON.stringify(copia, null, 2) + "\n";

await mkdir(path.join(PASTA, "fotos"), { recursive:true });
const arquivo = path.join(PASTA, "vitrine.json");
const antes = existsSync(arquivo) ? await readFile(arquivo, "utf8") : "";
if(antes !== texto){ await writeFile(arquivo, texto); console.log("Cópia: dados atualizados."); }
else console.log("Cópia: nada mudou nos dados.");

// Fotos: baixa as que faltam e remove as que não são mais usadas
const usadas = new Set([vitrine.avatar, ...visiveis.map(p => p.foto)].filter(Boolean));
for(const caminho of usadas){
  const destino = path.join(PASTA, "fotos", ...caminho.split("/"));
  if(existsSync(destino)) continue;
  const bytes = await api(`/storage/v1/object/public/fotos/${caminho.split("/").map(encodeURIComponent).join("/")}`);
  await mkdir(path.dirname(destino), { recursive:true });
  await writeFile(destino, Buffer.from(bytes));
  console.log(`Cópia: foto nova ${caminho}`);
}
async function limpar(pasta, rel = ""){
  for(const nome of await readdir(pasta)){
    const cheio = path.join(pasta, nome), r = rel ? `${rel}/${nome}` : nome;
    if((await stat(cheio)).isDirectory()){
      await limpar(cheio, r);
      if(!(await readdir(cheio)).length) await rm(cheio, { recursive:true });
    } else if(!usadas.has(r)){ await rm(cheio); console.log(`Cópia: foto removida ${r}`); }
  }
}
await limpar(path.join(PASTA, "fotos"));
console.log("Robô terminou ✅");
