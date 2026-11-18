/* =====================================================================
   VITRINE CONCURSEIRA VIAJADA — camada de dados (Supabase)
   Único arquivo que conversa com o banco, o login e as fotos.
   A tela (js/app.js) só chama as funções daqui.
   ===================================================================== */

/* ---------- Conexão ---------- */
// "supabase" vem de js/vendor/supabase-2.119.0.js. A sessão fica salva no
// aparelho até a dona tocar em "Sair" (persistSession).
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_CHAVE_PUBLICA, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

/* ---------- Login ---------- */
// O banco está respondendo? (usado no aviso de "modo de segurança")
async function bancoNoAr(){
  try{
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(SUPABASE_URL + "/auth/v1/health", { headers:{ apikey: SUPABASE_CHAVE_PUBLICA }, signal: ctrl.signal });
    clearTimeout(t);
    return r.ok;
  }catch(e){ return false; }
}
// Resposta: { ok:true } | { ok:false, motivo:"senha" | "fora_do_ar" | "outro" }
async function entrar(email, senha){
  try{
    const { error } = await sb.auth.signInWithPassword({ email, password: senha });
    if(!error) return { ok:true };
    if(error.status === 400 || /invalid login credentials/i.test(error.message)) return { ok:false, motivo:"senha" };
    if(!error.status || error.status >= 500) return { ok:false, motivo:"fora_do_ar" };
    return { ok:false, motivo:"outro", detalhe:error.message };
  }catch(e){ return { ok:false, motivo:"fora_do_ar" }; }
}
async function sair(){ try{ await sb.auth.signOut(); }catch(e){} }
// id da conta logada neste aparelho (ou null)
async function usuarioLogado(){ try{ const { data } = await sb.auth.getSession(); return data.session?.user?.id || null; }catch(e){ return null; } }
// Avisa a tela quando entra/sai (inclusive se a sessão expirar)
function aoMudarLogin(fn){ sb.auth.onAuthStateChange((_evento, sessao) => fn(sessao?.user?.id || null)); }

/* ---------- Conversão banco <-> tela ---------- */
function perfilDoBanco(v){
  return { id:v.id, donaId:v.dona_id, slug:v.slug, nome:v.nome, instagram:v.instagram || "", bio:v.bio || "",
    avatar:v.avatar || null, categorias:{ achadinhos:v.categorias_achadinhos || [], estudos:v.categorias_estudos || [] },
    atualizadoEm:v.atualizado_em };
}
function produtoDoBanco(r){
  return { id:r.id, aba:r.aba, cat:r.categoria, tipo:r.tipo, nome:r.nome, nota:r.frase || "", emoji:r.emoji || "🛍️",
    foto:r.foto || null, link:r.link, loja:r.loja, lojaNome:r.loja_nome || "",
    preco: r.preco_pago == null ? null : Number(r.preco_pago),
    pagoEm: r.pago_em ? String(r.pago_em).slice(0,7) : null,          // "2026-03"
    temCupom:!!r.tem_cupom, cupomCodigo:r.cupom_codigo || "", cupomDesconto:r.cupom_desconto || "",
    selo:r.selo || null,
    opiniao:{ texto:r.opiniao_texto || "", gosto:r.opiniao_gosto || [], atencao:r.opiniao_atencao || "" },
    ordem:r.ordem, apagadoEm:r.apagado_em || null, atualizadoEm:r.atualizado_em, criadoEm:r.criado_em };
}
function produtoParaBanco(p){
  const gratis = p.tipo === "gratis", comPreco = !gratis && p.preco != null, comCupom = !gratis && !!p.temCupom;
  const o = p.opiniao || {};
  return {
    aba:p.aba, categoria:p.cat, tipo:p.tipo, nome:p.nome, frase:p.nota || null, emoji:p.emoji || "🛍️",
    foto:p.foto || null, link:p.link, loja:p.loja, loja_nome: p.loja === "outra" ? p.lojaNome : null,
    preco_pago: comPreco ? p.preco : null, pago_em: comPreco ? p.pagoEm + "-01" : null,
    tem_cupom: comCupom, cupom_codigo: comCupom ? p.cupomCodigo : null,
    cupom_desconto: comCupom ? (p.cupomDesconto || null) : null,
    selo:p.selo || null,
    opiniao_texto:o.texto || null, opiniao_gosto:o.gosto || [], opiniao_atencao:o.atencao || null,
  };
}

/* ---------- Leitura ---------- */
// Visitante recebe só os itens fora da lixeira; a dona logada recebe também a lixeira
// (quem decide isso são as regras de segurança do banco).
async function carregarDoBanco(){
  const { data:v, error:e1 } = await sb.from("vitrines").select("*").eq("slug", VITRINE_SLUG).single();
  if(e1) throw e1;
  const { data:ps, error:e2 } = await sb.from("produtos").select("*").eq("vitrine_id", v.id).order("ordem", { ascending:false });
  if(e2) throw e2;
  return { vitrine: perfilDoBanco(v), produtos: ps.map(produtoDoBanco) };
}

/* ---------- Plano B: cópia de segurança do repositório ---------- */
// Se o banco não responder (pausado, fora do ar), a vitrine mostra a última
// cópia salva pelo robô diário em backup/. Ninguém consegue editar nesse modo.
let modoSeguranca = false;
const LIMITE_ESPERA_MS = 8000;

async function carregarCopia(){
  const r = await fetch("backup/vitrine.json", { cache:"no-store" });
  if(!r.ok) throw new Error("sem cópia de segurança");
  const c = await r.json();
  return { vitrine: perfilDoBanco({ ...c.vitrine, dona_id:null }), produtos: c.produtos.map(produtoDoBanco) };
}
async function carregarVitrine(){
  try{
    const tempo = new Promise((_, rej) => setTimeout(() => rej(new Error("banco demorou demais")), LIMITE_ESPERA_MS));
    const r = await Promise.race([carregarDoBanco(), tempo]);
    modoSeguranca = false;
    return r;
  }catch(e){
    console.warn("Banco indisponível, usando a cópia de segurança:", e.message);
    const r = await carregarCopia();     // se nem a cópia existir, o erro sobe para a tela
    modoSeguranca = true;
    return r;
  }
}

/* ---------- Escrita (só funciona para a dona logada) ---------- */
async function salvarProduto(p, vitrine, novo){
  const linha = produtoParaBanco(p);
  const q = novo
    ? sb.from("produtos").insert({ id:p.id, vitrine_id:vitrine.id, dona_id:vitrine.donaId, ...linha })
    : sb.from("produtos").update(linha).eq("id", p.id);
  const { data, error } = await q.select().single();
  if(error) throw error;
  return produtoDoBanco(data);
}
// "Apagar" = mandar para a lixeira. Restaurar = tirar da lixeira.
async function marcarLixeira(id, naLixeira){
  const { data, error } = await sb.from("produtos")
    .update({ apagado_em: naLixeira ? new Date().toISOString() : null }).eq("id", id).select().single();
  if(error) throw error;
  return produtoDoBanco(data);
}
async function salvarPerfil(vitrine, campos){
  const linha = {};
  if("nome" in campos) linha.nome = campos.nome;
  if("instagram" in campos) linha.instagram = campos.instagram || null;
  if("bio" in campos) linha.bio = campos.bio || null;
  if("avatar" in campos) linha.avatar = campos.avatar || null;
  if("categorias" in campos){
    linha.categorias_achadinhos = campos.categorias.achadinhos;
    linha.categorias_estudos = campos.categorias.estudos;
  }
  const { data, error } = await sb.from("vitrines").update(linha).eq("id", vitrine.id).select().single();
  if(error) throw error;
  return perfilDoBanco(data);
}

/* ---------- Fotos (Storage) ---------- */
// Caminhos: <dona>/avatar-<hora>.jpg  e  <dona>/produtos/<id>-<hora>.jpg
// (a "hora" no nome evita que o celular mostre a foto antiga guardada em cache)
function urlFoto(caminho){
  if(!caminho) return null;
  if(/^(data:|blob:|https?:)/.test(caminho)) return caminho;      // pré-visualização local
  if(modoSeguranca) return "backup/fotos/" + caminho;              // plano B: foto da cópia
  return sb.storage.from("fotos").getPublicUrl(caminho).data.publicUrl;
}
async function enviarFoto(blob, caminho){
  const { error } = await sb.storage.from("fotos").upload(caminho, blob, { contentType:"image/jpeg", cacheControl:"31536000", upsert:false });
  if(error) throw error;
  return caminho;
}
async function apagarFoto(caminho){
  if(!caminho || /^(data:|blob:|https?:)/.test(caminho)) return;
  try{ await sb.storage.from("fotos").remove([caminho]); }catch(e){}
}

/* ---------- Insights: contagens ANÔNIMAS (sem dados de quem visita) ---------- */
// Visitantes só chamam estas duas funções do banco, que somam +1 no dia.
// Erros são ignorados de propósito: contar nunca pode atrapalhar a vitrine.
function registrarVisita(origem){
  sb.rpc("registrar_visita", { p_slug: VITRINE_SLUG, p_origem: origem }).then(() => {}, () => {});
}
function registrarClique(produtoId, origem){
  sb.rpc("registrar_clique", { p_produto: produtoId, p_origem: origem }).then(() => {}, () => {});
}
// Só a dona logada consegue ler (regras de segurança do banco)
async function carregarInsights(desde){         // desde = "2026-10-01"
  const [v, c] = await Promise.all([
    sb.from("visitas_diarias").select("dia,origem,total").gte("dia", desde),
    sb.from("cliques_diarios").select("produto_id,dia,origem,total").gte("dia", desde),
  ]);
  if(v.error) throw v.error;
  if(c.error) throw c.error;
  return { visitas: v.data, cliques: c.data };
}

/* ---------- Categorias (renomear e mover de uma vez só, no banco) ---------- */
async function renomearCategoria(aba, antigo, novo){
  const { error } = await sb.rpc("renomear_categoria", { p_aba: aba, p_antigo: antigo, p_novo: novo });
  if(error) throw error;
}
async function moverCategoria(aba, de, para){
  const { data, error } = await sb.rpc("mover_categoria", { p_aba: aba, p_de: de, p_para: para });
  if(error) throw error;
  return data;                                   // quantos itens mudaram
}
