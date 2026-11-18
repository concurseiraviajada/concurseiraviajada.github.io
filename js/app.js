/* =====================================================================
   VITRINE CONCURSEIRA VIAJADA — tela: abas, filtros, cartões, painéis e formulários
   Tudo que fala com o banco está em js/dados.js (carregado antes deste).
   ===================================================================== */
const EMOJIS = ["🛍️","👜","🍼","🧸","✨","💄","💇‍♀️","🧴","📚","🖍️","⏱️","💻","💡","🧽","🏠","☕","🎓","📝","📄","🎧"];

const ABAS = { achadinhos:{ txt:"🛍️ Achadinhos" }, estudos:{ txt:"🎓 Estudos e materiais" } };
const TIPOS = { produto:{ txt:"📦 Produto", aba:"achadinhos" }, infoproduto:{ txt:"🎓 Infoproduto", aba:"estudos" }, gratis:{ txt:"🆓 Grátis", aba:"estudos" } };
// prep = "na Shopee", "no Mercado Livre"…
const LOJAS = {
  shopee: { nome:"Shopee",        prep:"na", cor:"#EE4D2D", tinta:"#fff" },
  ml:     { nome:"Mercado Livre", prep:"no", cor:"#FFE600", tinta:"#2D3277" },
  amazon: { nome:"Amazon",        prep:"na", cor:"#FF9900", tinta:"#131921" },
  hotmart:{ nome:"Hotmart",       prep:"na", cor:"#F04E23", tinta:"#fff" },
  kiwify: { nome:"Kiwify",        prep:"na", cor:"#00A859", tinta:"#fff" },
  eduzz:  { nome:"Eduzz",         prep:"na", cor:"#1F3D8C", tinta:"#fff" },
  drive:  { nome:"Google Drive",  prep:"no", cor:"#1A73E8", tinta:"#fff" },
  outra:  { nome:"Outra",         prep:"em", cor:"#8C3B6B", tinta:"#fff" },
};
const SELOS = { favorito:{txt:"❤️ Favorito", cls:"fav"}, recomprei:{txt:"🔁 Já recomprei", cls:""} };
const DIAS_LIXEIRA = 30;

/* ---------- Estado ---------- */
let V = null;              // perfil da vitrine
let PRODUTOS = [];         // todos (inclui a lixeira, se for a dona logada)
let carregando = true, erroCarga = false;
let usuarioId = null, admin = false;
let abaAtual = "achadinhos", catAtual = "Todos", lojaAtual = "todas", busca = "", filtroSelo = null;
let abaEscolhida = false;  // vira true quando a pessoa toca numa aba (aí a página não troca mais sozinha)

// Abre na aba que tem itens; se as duas tiverem (ou nenhuma), abre em Achadinhos
function abaInicial(){
  const tem = aba => visiveis().some(p => p.aba === aba);
  return !tem("achadinhos") && tem("estudos") ? "estudos" : "achadinhos";
}

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
const visiveis = () => PRODUTOS.filter(p => !p.apagadoEm);
const naLixeira = () => PRODUTOS.filter(p => p.apagadoEm);
const porId = id => PRODUTOS.find(p => p.id === id);
const loja = p => { const L = LOJAS[p.loja] || LOJAS.outra; return p.loja === "outra" ? { ...L, nome: p.lojaNome || "Loja" } : L; };
const novoUUID = () => (crypto.randomUUID ? crypto.randomUUID()
  : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)));

function toast(msg, acao){
  const t = $("#toast");
  t.innerHTML = esc(msg) + (acao ? ` <button type="button" class="toast-acao">${esc(acao.txt)}</button>` : "");
  t.classList.toggle("com-acao", !!acao);
  if(acao) t.querySelector("button").onclick = () => { t.classList.remove("show"); acao.fn(); };
  t.classList.add("show"); clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), acao ? 6500 : 2600);
}

/* ---------- Preço e datas ---------- */
const MESES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const mesAtual = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0"); };
function quando(ym){ const m = /^(\d{4})-(\d{2})$/.exec(ym || ""); return m ? `${MESES[+m[2]-1]}/${m[1].slice(2)}` : ""; }
const reais = n => "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 });
// "1.234,5" / "39,90" / "39.90" -> número (ou null se vazio, NaN se inválido)
function lerPreco(v){
  const bruto = String(v ?? "").trim(); if(!bruto) return null;
  let s = bruto.replace(/[^\d,.]/g, ""); if(!s) return NaN;
  if(s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if(/\.\d{3}$/.test(s)) s = s.replace(/\./g, "");      // "1.234" = mil duzentos…
  const n = Math.round(parseFloat(s) * 100) / 100;
  return isNaN(n) || n > 99999999 ? NaN : n;
}
function paguei(p, curto){
  if(p.tipo === "gratis") return curto ? `<span>🆓 Grátis</span>` : "🆓 Grátis";
  if(p.preco == null) return "";
  const q = quando(p.pagoEm);
  return curto ? `<small>💸 Paguei${q ? ` em ${q}` : ""}</small><span>${reais(p.preco)}</span>`
               : `Paguei ${reais(p.preco)}${q ? ` em ${q}` : ""}`;
}
function ctaTxt(p){
  const L = loja(p);
  if(p.tipo === "gratis") return "Baixar grátis";
  if(p.temCupom) return `Usar cupom ${L.prep} ${L.nome}`;
  if(p.tipo === "infoproduto") return `Conhecer ${L.prep} ${L.nome}`;
  return `Ver preço atual ${L.prep} ${L.nome}`;
}
const corLoja = L => `background:${L.cor};color:${L.tinta}`;
const temOpiniao = p => p.opiniao && (p.opiniao.texto || (p.opiniao.gosto||[]).length || p.opiniao.atencao);
const cupomHtml = p => p.temCupom && p.tipo !== "gratis"
  ? `<button type="button" class="cupom" data-copiar="${esc(p.cupomCodigo)}">🏷️ <b>${esc(p.cupomCodigo)}</b>${p.cupomDesconto ? ` · ${esc(p.cupomDesconto)}` : ""}<span>📋 Copiar</span></button>` : "";
const imgFoto = (p, extra="") => p.foto ? `<img src="${esc(urlFoto(p.foto))}" alt="" loading="lazy" decoding="async" onerror="this.remove()" ${extra}>` : "";

/* ---------- Cabeçalho ---------- */
function renderCabecalho(){
  if(!V) return;
  $("#avatar").innerHTML = V.avatar ? `<img src="${esc(urlFoto(V.avatar))}" alt="Foto de ${esc(V.nome)}">` : esc((V.nome || "?").trim()[0].toUpperCase());
  $("#nome").textContent = V.nome;
  $("#modo-nome").textContent = V.nome;             // "✏️ Modo <nome>" na barra de edição
  const h = $("#handle");
  if(V.instagram){ h.textContent = "@" + V.instagram; h.href = "https://instagram.com/" + encodeURIComponent(V.instagram); h.hidden = false; }
  else h.hidden = true;
  $("#bio").textContent = V.bio || "";
}

/* ---------- Abas, filtros e grade ---------- */
function renderChips(){
  $("#abas").innerHTML = Object.entries(ABAS).map(([k, a]) =>
    `<button class="aba ${k===abaAtual?"on":""}" data-aba="${k}" role="tab" aria-selected="${k===abaAtual}">${a.txt}</button>`).join("");
  const daAba = visiveis().filter(p => p.aba === abaAtual);
  const cats = [...new Set(daAba.map(p => p.cat))];
  if(catAtual !== "Todos" && !cats.includes(catAtual)) catAtual = "Todos";
  const temSelo = s => daAba.some(p => p.selo === s);
  $("#chips").innerHTML =
    (temSelo("favorito") ? `<button class="chip fav ${filtroSelo==="favorito"?"on":""}" data-selo="favorito">❤️ Favoritos da ${esc(V?.nome || "")}</button>` : "") +
    (temSelo("recomprei") ? `<button class="chip fav ${filtroSelo==="recomprei"?"on":""}" data-selo="recomprei">🔁 Já recomprei</button>` : "") +
    ((temSelo("favorito") || temSelo("recomprei")) && cats.length ? `<span class="chip-sep"></span>` : "") +
    (cats.length > 1 ? ["Todos", ...cats].map(c => `<button class="chip ${c===catAtual?"on":""}" data-c="${esc(c)}">${esc(c)}</button>`).join("") : "");
  // filtro de lojas: só na aba Achadinhos e só com as lojas que têm itens
  const lojas = abaAtual === "achadinhos" ? [...new Set(daAba.map(p => p.loja === "outra" ? "outra:" + p.lojaNome : p.loja))] : [];
  if(lojaAtual !== "todas" && !lojas.includes(lojaAtual)) lojaAtual = "todas";
  $("#stores").innerHTML = lojas.length > 1
    ? [["todas","Todas as lojas"], ...lojas.map(k => [k, k.startsWith("outra:") ? k.slice(6) : LOJAS[k].nome])].map(([k, n]) =>
        `<button class="store-btn ${k===lojaAtual?"on":""}" data-l="${esc(k)}">${esc(n)}</button>`).join("")
    : "";
  $("#price-hint").hidden = !daAba.some(p => p.preco != null);
}

function render(){
  document.body.classList.toggle("admin", admin);
  $("#entrar").style.display = admin ? "none" : "";
  $("#n-lixeira").textContent = naLixeira().length ? ` (${naLixeira().length})` : "";
  $("#aviso-gratis").hidden = !visiveis().some(p => p.tipo === "gratis");   // só fala dos grátis se existir algum
  const datas = [V?.atualizadoEm, ...visiveis().map(p => p.atualizadoEm)].filter(Boolean).sort();
  $("#upd").textContent = datas.length ? new Date(datas[datas.length-1]).toLocaleDateString("pt-BR") : "—";

  if(carregando){ $("#grid").innerHTML = `<div class="empty">Carregando a vitrine…</div>`; return; }
  if(erroCarga){ $("#grid").innerHTML = `<div class="empty">Não consegui carregar a vitrine agora 😕<br>Tente de novo em instantes.</div>`; return; }

  const q = norm(busca);
  const daAba = visiveis().filter(p => p.aba === abaAtual);
  const lista = daAba.filter(p =>
    (!filtroSelo || p.selo === filtroSelo) &&
    (catAtual === "Todos" || p.cat === catAtual) &&
    (lojaAtual === "todas" || (p.loja === "outra" ? "outra:" + p.lojaNome : p.loja) === lojaAtual) &&
    (!q || norm([p.nome, p.nota, p.cat, loja(p).nome].join(" ")).includes(q)));

  let vazio = "Nenhum produto encontrado 🙈";
  if(!daAba.length) vazio = admin ? "Nada nesta aba ainda. Toque no + para adicionar."
    : abaAtual === "achadinhos" ? "Em breve os primeiros achadinhos 💛" : "Em breve materiais de estudo 💛";

  $("#grid").innerHTML = lista.length ? lista.map(p => {
    const L = loja(p), S = SELOS[p.selo];
    return `<div class="card">
      <div class="tools"><button data-edit="${p.id}" aria-label="Editar">✏️</button><button data-del="${p.id}" aria-label="Apagar">🗑️</button></div>
      <a class="hit" href="${esc(p.link)}" target="_blank" rel="noopener sponsored" data-clique="${p.id}">
      <div class="thumb">${esc(p.emoji || "🛍️")}${imgFoto(p)}
        <span class="badge" style="${corLoja(L)}">${esc(L.nome)}</span>
        ${S ? `<span class="selo ${S.cls}">${S.txt}</span>` : ""}
      </div>
      <div class="info">
        <div class="name">${esc(p.nome)}</div>
        ${p.nota ? `<div class="note">${esc(p.nota)}</div>` : ""}
        <div class="price">${paguei(p, true)}</div>
        <div class="cta" style="${corLoja(L)}">${esc(ctaTxt(p))}</div>
      </div></a>
      ${cupomHtml(p)}
      ${temOpiniao(p) ? `<button class="op-btn" data-op="${p.id}">💬 Ver minha opinião</button>` : ""}
    </div>`;
  }).join("") : `<div class="empty">${vazio}</div>`;
}

/* ---------- Painel (base) ---------- */
function abrirPainel(html){
  $("#sheet").innerHTML = `<div class="grab"></div><button class="close" aria-label="Fechar" data-close>×</button>` + html;
  $("#sheet").scrollTop = 0;
  $("#overlay").classList.add("open"); $("#overlay").setAttribute("aria-hidden","false");
}
function fecharPainel(){ $("#overlay").classList.remove("open"); $("#overlay").setAttribute("aria-hidden","true"); }

function abrirOpiniao(p){
  const L = loja(p), S = SELOS[p.selo], o = p.opiniao || {};
  const meta = paguei(p, false);
  abrirPainel(`
    <div class="sheet-top">
      <div class="sheet-emoji">${p.foto ? imgFoto(p, 'style="width:100%;height:100%;object-fit:cover;border-radius:14px"') : esc(p.emoji || "🛍️")}</div>
      <div><h3 id="sheet-title">${esc(p.nome)}</h3><div class="meta">${meta ? meta + " · " : ""}${esc(L.nome)}</div></div>
    </div>
    ${S ? `<span class="selo-inline">${S.txt}</span>` : ""}
    ${o.texto ? `<div class="quote">“${esc(o.texto)}”</div>` : ""}
    ${(o.gosto||[]).length ? `<h4>O que eu gosto</h4><ul>${o.gosto.map(g => `<li>${esc(g)}</li>`).join("")}</ul>` : ""}
    ${o.atencao ? `<h4>Ponto de atenção</h4><div class="atencao">⚠️ ${esc(o.atencao)}</div>` : ""}
    ${cupomHtml(p)}
    <a class="cta" style="${corLoja(L)}" href="${esc(p.link)}" target="_blank" rel="noopener sponsored" data-clique="${p.id}">${esc(ctaTxt(p))}</a>
    <p class="fine">${p.tipo === "gratis" ? "Material gratuito · abre em outra página" : "Link de afiliado · a compra é feita direto na loja"}</p>`);
}

/* ---------- Fotos: comprimidas no próprio aparelho antes de enviar ---------- */
function comprimir(file, { max = 500, quadrado = false, alvo = 35 * 1024 } = {}){
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = async () => {
      URL.revokeObjectURL(url);
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if(quadrado){ const l = Math.min(sw, sh); sx = (sw - l) / 2; sy = (sh - l) / 2; sw = sh = l; }
      const k = Math.min(1, max / Math.max(sw, sh));
      const c = document.createElement("canvas");
      c.width = Math.round(sw * k); c.height = Math.round(sh * k);
      const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
      const blobDe = q => new Promise(r => c.toBlob(r, "image/jpeg", q));
      let q = 0.82, blob = await blobDe(q);
      while(blob && blob.size > alvo && q > 0.45){ q -= 0.08; blob = await blobDe(q); }
      blob ? res(blob) : rej(new Error("falha ao comprimir"));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("imagem inválida")); };
    img.src = url;
  });
}

/* ---------- Formulário de adicionar/editar ---------- */
let rascunho = null;       // item sendo editado
const NOVA_CAT = "__nova__";

function detectarLoja(link){
  const l = String(link).toLowerCase();
  if(/shopee\.|shope\.ee/.test(l)) return "shopee";
  if(/mercadoli[vb]re|meli\.la/.test(l)) return "ml";
  if(/amazon\.|amzn\.to|a\.co\//.test(l)) return "amazon";
  if(/hotmart\.|hotm\.art/.test(l)) return "hotmart";
  if(/kiwify\./.test(l)) return "kiwify";
  if(/eduzz\./.test(l)) return "eduzz";
  if(/drive\.google\.|docs\.google\./.test(l)) return "drive";
  return null;
}

const segs = (nome, opcoes, atual) => opcoes.map(([v, t]) =>
  `<button type="button" data-seg="${nome}" data-v="${esc(v)}" class="${String(atual)===String(v)?"on":""}">${t}</button>`).join("");

function opcoesCategoria(){
  const cats = V.categorias[rascunho.aba] || [];
  const atual = cats.includes(rascunho.cat) ? rascunho.cat : (rascunho.cat === NOVA_CAT ? NOVA_CAT : cats[0]);
  rascunho.cat = atual;
  return cats.map(c => `<option ${c===atual?"selected":""}>${esc(c)}</option>`).join("") +
    `<option value="${NOVA_CAT}" ${atual===NOVA_CAT?"selected":""}>➕ Nova categoria…</option>`;
}

function abrirForm(id){
  const p = id ? porId(id) : null;
  const tipoInicial = abaAtual === "estudos" ? "infoproduto" : "produto";
  rascunho = p ? JSON.parse(JSON.stringify(p)) : {
    id:null, aba:abaAtual, cat:null, tipo:tipoInicial, nome:"", nota:"", emoji:"🛍️", foto:null, link:"", loja:"shopee", lojaNome:"",
    preco:null, pagoEm:mesAtual(), temCupom:false, cupomCodigo:"", cupomDesconto:"", selo:null, opiniao:{ texto:"", gosto:[], atencao:"" } };
  rascunho.fotoAntiga = rascunho.foto; rascunho.fotoNova = null;
  const o = rascunho.opiniao;

  abrirPainel(`
    <h3 id="sheet-title" style="margin-bottom:4px">${p ? "Editar item" : "Novo item"}</h3>
    <p class="hint" style="margin-top:0">Só os campos com * são obrigatórios.</p>
    <form class="form" id="form" novalidate>
      <label>O que é isso?</label>
      <div class="seg" id="seg-tipo">${segs("tipo", Object.entries(TIPOS).map(([k, t]) => [k, t.txt]), rascunho.tipo)}</div>

      <label>Em qual aba aparece?</label>
      <div class="seg" id="seg-aba">${segs("aba", Object.entries(ABAS).map(([k, a]) => [k, a.txt]), rascunho.aba)}</div>

      <label for="f-cat">Categoria</label>
      <select name="cat" id="f-cat">${opcoesCategoria()}</select>
      <div id="bloco-nova-cat" hidden><input type="text" name="nova_cat" placeholder="Nome da nova categoria" maxlength="40" style="margin-top:8px"></div>

      <label>Link * <small>(de afiliado, ou do material grátis)</small></label>
      <input type="url" name="link" value="${esc(rascunho.link)}" placeholder="Cole aqui o link" inputmode="url">
      <p class="hint" id="loja-hint"></p>

      <label for="f-loja">Loja / plataforma</label>
      <select name="loja" id="f-loja">${Object.entries(LOJAS).map(([k, L]) => `<option value="${k}" ${k===rascunho.loja?"selected":""}>${esc(L.nome)}</option>`).join("")}</select>
      <div id="bloco-loja-nome" hidden><input type="text" name="loja_nome" value="${esc(rascunho.lojaNome)}" placeholder="Nome da plataforma (ex.: Pomodoro Gourmet)" maxlength="40" style="margin-top:8px"></div>

      <label>Nome *</label>
      <input type="text" name="nome" value="${esc(rascunho.nome)}" placeholder="Ex.: Escova secadora" maxlength="60">

      <div id="bloco-preco">
        <div class="row">
          <div><label>Quanto você pagou</label><input type="text" name="preco" value="${rascunho.preco != null ? esc(rascunho.preco.toLocaleString("pt-BR",{minimumFractionDigits:2})) : ""}" placeholder="39,90" inputmode="decimal"></div>
          <div><label>Quando</label><input type="month" name="pagoEm" value="${esc(rascunho.pagoEm || mesAtual())}" max="${mesAtual()}"></div>
        </div>
        <p class="hint">Opcional. Aparece como “Paguei R$ 39,90 em ${quando(mesAtual())}”. Em branco, o cartão fica sem preço.</p>
      </div>

      <div id="bloco-cupom">
        <label class="chave"><input type="checkbox" name="tem_cupom" ${rascunho.temCupom?"checked":""}> 🏷️ Tenho cupom próprio</label>
        <p class="hint" style="margin-top:2px">Só use se o cupom for seu e te render comissão.</p>
        <div class="row" id="campos-cupom" hidden>
          <div><label>Código *</label><input type="text" name="cupom_codigo" value="${esc(rascunho.cupomCodigo)}" placeholder="CUPOM10" maxlength="40" autocapitalize="characters"></div>
          <div><label>Desconto</label><input type="text" name="cupom_desconto" value="${esc(rascunho.cupomDesconto)}" placeholder="10% off" maxlength="40"></div>
        </div>
      </div>

      <label>Frase curta <small>(aparece no cartão)</small></label>
      <input type="text" name="nota" value="${esc(rascunho.nota)}" placeholder="Ex.: Cabelo pronto antes de o bebê acordar." maxlength="70">

      <label>Foto <small>(opcional — sem foto, aparece o ícone)</small></label>
      <div class="photo">
        <div class="prev" id="prev">${rascunho.foto ? imgFoto(rascunho) : esc(rascunho.emoji)}</div>
        <label class="pick">📷 Escolher foto<input type="file" accept="image/*" id="foto" hidden></label>
        <button type="button" class="login-link" id="tirar-foto" style="margin:0" ${rascunho.foto ? "" : "hidden"}>remover</button>
      </div>
      <label>Ícone</label>
      <div class="seg" id="seg-emoji">${segs("emoji", EMOJIS.map(e => [e, e]), rascunho.emoji)}</div>

      <label>Selo <small>(no máximo um)</small></label>
      <div class="seg" id="seg-selo">${segs("selo", [["","Nenhum"],["favorito","❤️ Favorito"],["recomprei","🔁 Já recomprei"]], rascunho.selo || "")}</div>
      <div id="fav-warn"></div>

      <details class="more" ${temOpiniao(rascunho) ? "open" : ""}>
        <summary>💬 Minha opinião (opcional)</summary>
        <label>O que eu acho</label>
        <textarea name="op_texto" maxlength="1500" placeholder="Conte como você usa no dia a dia…">${esc(o.texto)}</textarea>
        <label>O que eu gosto <small>(um por linha)</small></label>
        <textarea name="op_gosto" placeholder="Seca rápido&#10;Rende bastante">${esc((o.gosto||[]).join("\n"))}</textarea>
        <label>Ponto de atenção <small>(o ponto fraco sincero)</small></label>
        <input type="text" name="op_atencao" value="${esc(o.atencao)}" maxlength="300" placeholder="Ex.: É pesadinha">
      </details>

      <p class="err" id="err"></p>
      <div class="actions">
        <button type="button" class="btn ghost" data-close>Cancelar</button>
        <button type="submit" class="btn primary" id="btn-salvar">${p ? "Salvar" : "Adicionar"}</button>
      </div>
    </form>`);
  atualizarForm(); avisoFavoritos();
}

// Mostra/esconde partes do formulário conforme as escolhas
function atualizarForm(){
  const f = $("#form"); if(!f) return;
  const gratis = rascunho.tipo === "gratis";
  $("#bloco-preco").hidden = gratis;
  $("#bloco-cupom").hidden = gratis;
  $("#campos-cupom").hidden = gratis || !f.tem_cupom.checked;
  $("#bloco-loja-nome").hidden = f.loja.value !== "outra";
  $("#bloco-nova-cat").hidden = f.cat.value !== NOVA_CAT;
}

function avisoFavoritos(){
  const el = $("#fav-warn"); if(!el) return;
  const outros = visiveis().filter(p => p.selo === "favorito" && p.id !== rascunho.id).length;
  const total = visiveis().length + (rascunho.id ? 0 : 1);
  const limite = Math.max(5, Math.floor(total * 0.2));
  el.innerHTML = rascunho.selo === "favorito" && outros >= limite
    ? `<div class="warn">Já existem ${outros} favoritos (de ${total} itens). Com muitos favoritos o selo perde o valor — que tal trocar algum?</div>` : "";
}

async function salvarForm(form){
  const f = new FormData(form);
  const link = String(f.get("link") || "").trim();
  const nome = String(f.get("nome") || "").trim();
  const gratis = rascunho.tipo === "gratis";
  const preco = gratis ? null : lerPreco(f.get("preco"));
  const lojaSel = String(f.get("loja"));
  const lojaNome = String(f.get("loja_nome") || "").trim();
  const temCupom = !gratis && !!f.get("tem_cupom");
  const cupomCodigo = String(f.get("cupom_codigo") || "").trim().toUpperCase();
  let cat = String(f.get("cat"));
  const novaCat = String(f.get("nova_cat") || "").trim();

  const erros = [];
  if(!/^https?:\/\/\S+\.\S+/.test(link)) erros.push("cole um link válido");
  if(!nome) erros.push("preencha o nome");
  if(Number.isNaN(preco)) erros.push("o valor pago não parece um número");
  if(lojaSel === "outra" && !lojaNome) erros.push("escreva o nome da plataforma");
  if(temCupom && !cupomCodigo) erros.push("escreva o código do cupom");
  if(cat === NOVA_CAT && !novaCat) erros.push("escreva o nome da nova categoria");
  if(erros.length){ $("#err").textContent = "Falta: " + erros.join(", ") + "."; return; }

  const btn = $("#btn-salvar"), txtBtn = btn.textContent;
  btn.disabled = true; btn.textContent = "Salvando…"; $("#err").textContent = "";
  const novo = !rascunho.id;
  const id = rascunho.id || novoUUID();
  let fotoEnviada = null;
  try{
    // 1) categoria nova vai primeiro para o perfil da vitrine
    if(cat === NOVA_CAT){
      const existentes = V.categorias[rascunho.aba];
      const igual = existentes.find(c => norm(c) === norm(novaCat));
      cat = igual || novaCat;
      if(!igual) V = await salvarPerfil(V, { categorias: { ...V.categorias, [rascunho.aba]: [...existentes, novaCat] } });
    }
    // 2) foto nova vai para o Storage
    let foto = rascunho.foto;
    if(rascunho.fotoNova){
      fotoEnviada = await enviarFoto(rascunho.fotoNova, `${V.donaId}/produtos/${id}-${Date.now()}.jpg`);
      foto = fotoEnviada;
    }
    // 3) o item vai para o banco
    const p = {
      ...rascunho, id, cat, link, nome, foto, loja: lojaSel, lojaNome,
      preco, pagoEm: preco != null ? (f.get("pagoEm") || mesAtual()) : null,
      temCupom, cupomCodigo, cupomDesconto: String(f.get("cupom_desconto") || "").trim(),
      nota: String(f.get("nota") || "").trim(),
      opiniao: {
        texto: String(f.get("op_texto") || "").trim(),
        gosto: String(f.get("op_gosto") || "").split("\n").map(s => s.trim()).filter(Boolean).slice(0, 10),
        atencao: String(f.get("op_atencao") || "").trim(),
      },
    };
    const salvo = await salvarProduto(p, V, novo);
    // 4) foto antiga substituída/removida sai do Storage
    if(rascunho.fotoAntiga && rascunho.fotoAntiga !== salvo.foto) apagarFoto(rascunho.fotoAntiga);

    if(novo) PRODUTOS.unshift(salvo); else PRODUTOS = PRODUTOS.map(x => x.id === salvo.id ? salvo : x);
    fecharPainel();
    abaAtual = salvo.aba; abaEscolhida = true;
    if(novo){ catAtual = "Todos"; lojaAtual = "todas"; filtroSelo = null; busca = ""; $("#q").value = ""; }
    renderChips(); render();
    toast(novo ? "✅ Item adicionado" : "✅ Alterações salvas");
    if(novo) window.scrollTo({ top: $("#abas").offsetTop - 20, behavior:"smooth" });
  }catch(e){
    console.error(e);
    if(fotoEnviada) apagarFoto(fotoEnviada);
    btn.disabled = false; btn.textContent = txtBtn;
    $("#err").textContent = /fetch|network|Failed/i.test(e.message || "")
      ? "Sem conexão agora. Confira a internet e tente de novo."
      : "Não consegui salvar 😕 Confira os campos e tente de novo.";
  }
}

/* ---------- Apagar (lixeira) ---------- */
function confirmarApagar(id){
  const p = porId(id); if(!p) return;
  abrirPainel(`
    <h3 id="sheet-title">Apagar item?</h3>
    <p style="margin:10px 0 8px">“${esc(p.nome)}” vai sair da vitrine e ninguém mais vai ver.</p>
    <p class="hint" style="font-size:13.5px">Mudou de ideia depois? Ele fica <strong>${DIAS_LIXEIRA} dias na 🗑️ Lixeira</strong> (no Modo ${esc(V.nome)}),
      e lá você toca em <strong>Restaurar</strong> para ele voltar. Depois desse prazo, ele é apagado de vez.</p>
    <div class="actions">
      <button type="button" class="btn ghost" data-close>Cancelar</button>
      <button type="button" class="btn danger" data-confirm-del="${p.id}">Apagar</button>
    </div>`);
}
async function moverLixeira(id, paraLixeira){
  try{
    const salvo = await marcarLixeira(id, paraLixeira);
    PRODUTOS = PRODUTOS.map(x => x.id === id ? salvo : x);
    renderChips(); render();
    return true;
  }catch(e){ console.error(e); toast("⚠️ Não consegui agora. Tente de novo."); return false; }
}
function diasRestantes(p){
  const passados = (Date.now() - new Date(p.apagadoEm).getTime()) / 86400000;
  return Math.max(0, Math.ceil(DIAS_LIXEIRA - passados));
}
function abrirLixeira(){
  const itens = naLixeira().sort((a, b) => String(b.apagadoEm).localeCompare(String(a.apagadoEm)));
  abrirPainel(`
    <h3 id="sheet-title">🗑️ Lixeira</h3>
    <p class="hint" style="margin-top:4px">Itens apagados ficam aqui por ${DIAS_LIXEIRA} dias. Ninguém mais vê.</p>
    ${itens.length ? `<ul class="lixeira">${itens.map(p => `
      <li><div class="lx-img">${p.foto ? imgFoto(p) : esc(p.emoji)}</div>
        <div class="lx-txt"><strong>${esc(p.nome)}</strong><small>apaga de vez em ${diasRestantes(p)} dia${diasRestantes(p)===1?"":"s"}</small></div>
        <button type="button" class="btn ghost" data-restaurar="${p.id}">Restaurar</button></li>`).join("")}</ul>`
      : `<p class="empty" style="padding:24px 0">A lixeira está vazia 🎉</p>`}
    <div class="actions"><button type="button" class="btn ghost" data-close>Fechar</button></div>`);
}

/* ---------- Editar perfil ---------- */
let perfilRascunho = null;
function abrirPerfil(){
  perfilRascunho = { avatarNovo:null, removerAvatar:false };
  abrirPainel(`
    <h3 id="sheet-title" style="margin-bottom:4px">Editar perfil</h3>
    <form class="form" id="form-perfil" novalidate>
      <label>Foto</label>
      <div class="photo">
        <div class="prev redondo" id="prev-avatar">${V.avatar ? `<img src="${esc(urlFoto(V.avatar))}" alt="">` : esc(V.nome[0] || "?")}</div>
        <label class="pick">📷 Trocar foto<input type="file" accept="image/*" id="foto-avatar" hidden></label>
        <button type="button" class="login-link" id="tirar-avatar" style="margin:0" ${V.avatar ? "" : "hidden"}>remover</button>
      </div>
      <label>Nome *</label>
      <input type="text" name="nome" value="${esc(V.nome)}" maxlength="60">
      <label>Instagram <small>(só o usuário, sem o @)</small></label>
      <input type="text" name="instagram" value="${esc(V.instagram)}" placeholder="seuperfil" maxlength="31" autocapitalize="off" spellcheck="false">
      <label>Bio</label>
      <textarea name="bio" maxlength="300">${esc(V.bio)}</textarea>
      <p class="err" id="err"></p>
      <div class="actions">
        <button type="button" class="btn ghost" data-close>Cancelar</button>
        <button type="submit" class="btn primary" id="btn-salvar-perfil">Salvar</button>
      </div>
    </form>`);
}
async function salvarFormPerfil(form){
  const nome = form.nome.value.trim();
  const instagram = form.instagram.value.trim().replace(/^@/, "");
  const bio = form.bio.value.trim();
  if(!nome){ $("#err").textContent = "Preencha o nome."; return; }
  if(instagram && !/^[A-Za-z0-9._]{1,30}$/.test(instagram)){ $("#err").textContent = "O usuário do Instagram só pode ter letras, números, ponto e _."; return; }
  const btn = $("#btn-salvar-perfil"); btn.disabled = true; btn.textContent = "Salvando…";
  const avatarAntigo = V.avatar; let enviado = null;
  try{
    const campos = { nome, instagram, bio };
    if(perfilRascunho.removerAvatar) campos.avatar = null;    // volta a mostrar a inicial do nome
    if(perfilRascunho.avatarNovo){
      enviado = await enviarFoto(perfilRascunho.avatarNovo, `${V.donaId}/avatar-${Date.now()}.jpg`);
      campos.avatar = enviado;
    }
    V = await salvarPerfil(V, campos);
    if((enviado || perfilRascunho.removerAvatar) && avatarAntigo) apagarFoto(avatarAntigo);
    fecharPainel(); renderCabecalho(); renderChips(); render(); toast("✅ Perfil atualizado");
  }catch(e){
    console.error(e); if(enviado) apagarFoto(enviado);
    btn.disabled = false; btn.textContent = "Salvar";
    $("#err").textContent = "Não consegui salvar 😕 Tente de novo.";
  }
}

/* ---------- Painel de Insights (só a dona vê) ---------- */
const INICIO_INSIGHTS = "18/11/2026";          // dia em que a contagem começou
const DIAS_SEM_CLIQUE = 30;
let insightsCache = null;                      // { visitas, cliques } dos últimos 90 dias
const isoDia = d => { const x = new Date(d); return x.getFullYear() + "-" + String(x.getMonth()+1).padStart(2,"0") + "-" + String(x.getDate()).padStart(2,"0"); };
const diasAtras = n => isoDia(Date.now() - n * 86400000);
const fmt = n => Number(n).toLocaleString("pt-BR");

function barra(valor, maximo){
  const pct = maximo ? Math.max(2, Math.round(valor / maximo * 100)) : 0;
  return `<span class="ins-barra" aria-hidden="true"><span style="width:${valor ? pct : 0}%"></span></span>`;
}

async function abrirInsights(periodo = 30){
  abrirPainel(`<h3 id="sheet-title">📊 Insights</h3><p class="hint" style="margin-top:6px">Carregando os números…</p>`);
  try{
    if(!insightsCache) insightsCache = await carregarInsights(diasAtras(89));
  }catch(e){
    console.error(e);
    abrirPainel(`<h3 id="sheet-title">📊 Insights</h3><p class="err">Não consegui carregar os números agora. Tente de novo em instantes.</p>
      <div class="actions"><button type="button" class="btn ghost" data-close>Fechar</button></div>`);
    return;
  }
  const desde = diasAtras(periodo - 1), desde30 = diasAtras(DIAS_SEM_CLIQUE - 1);
  const visitas = insightsCache.visitas.filter(v => v.dia >= desde);
  const cliques = insightsCache.cliques.filter(c => c.dia >= desde);
  const totalVisitas = visitas.reduce((s, v) => s + v.total, 0);
  const totalCliques = cliques.reduce((s, c) => s + c.total, 0);
  const taxa = totalVisitas ? Math.round(totalCliques / totalVisitas * 100) : 0;

  const porOrigem = {};
  visitas.forEach(v => porOrigem[v.origem] = (porOrigem[v.origem] || 0) + v.total);
  const origens = Object.entries(porOrigem).sort((a, b) => b[1] - a[1]);
  const maxOrigem = origens.length ? origens[0][1] : 0;

  const porItem = {}, porItem30 = {};
  cliques.forEach(c => porItem[c.produto_id] = (porItem[c.produto_id] || 0) + c.total);
  insightsCache.cliques.filter(c => c.dia >= desde30).forEach(c => porItem30[c.produto_id] = (porItem30[c.produto_id] || 0) + c.total);
  const itens = visiveis().map(p => ({ p, n: porItem[p.id] || 0 })).sort((a, b) => b.n - a.n || a.p.nome.localeCompare(b.p.nome));
  const maxItem = itens.length ? itens[0].n : 0;
  const semClique = p => !porItem30[p.id] && p.criadoEm && (Date.now() - new Date(p.criadoEm).getTime()) >= DIAS_SEM_CLIQUE * 86400000;

  const chip = n => `<button type="button" class="chip ${n===periodo?"on":""}" data-periodo="${n}">${n} dias</button>`;
  abrirPainel(`
    <h3 id="sheet-title">📊 Insights</h3>
    <p class="hint" style="margin-top:4px">Contagens anônimas: dá pra saber quantos, nunca quem. Suas próprias visitas (logada) não contam.
      Contando desde ${INICIO_INSIGHTS}.</p>
    <div class="chips ins-periodo">${chip(7)}${chip(30)}${chip(90)}</div>

    <div class="ins-numeros">
      <div class="ins-num"><strong>${fmt(totalVisitas)}</strong><span>visitas na vitrine</span></div>
      <div class="ins-num"><strong>${fmt(totalCliques)}</strong><span>cliques para a loja</span></div>
      <div class="ins-num"><strong>${totalVisitas ? taxa + "%" : "—"}</strong><span>${totalVisitas ? `de cada 100 visitas, ${taxa} clicam` : "sem visitas no período"}</span></div>
    </div>

    <h4>De onde vieram as visitas</h4>
    ${origens.length ? `<ul class="ins-lista">${origens.map(([o, n]) => `
      <li title="${esc(ORIGENS[o] || o)}: ${fmt(n)} visita${n===1?"":"s"}"><span class="ins-nome">${esc(ORIGENS[o] || o)}</span>${barra(n, maxOrigem)}<span class="ins-valor">${fmt(n)}</span></li>`).join("")}</ul>`
      : `<p class="hint">Nenhuma visita contada ainda neste período.</p>`}
    <p class="hint">Dica: na bio do Instagram use o link <strong>concurseiraviajada.github.io/?de=bio</strong> e nos stories
      <strong>…/?de=stories</strong>, para saber de onde cada visita veio.</p>

    <h4>Cliques por item</h4>
    ${itens.length ? `<ul class="ins-lista ins-itens">${itens.map(({ p, n }) => `
      <li title="${esc(p.nome)}: ${fmt(n)} clique${n===1?"":"s"}">
        <span class="ins-nome"><span class="ins-emoji">${esc(p.emoji || "🛍️")}</span>${esc(p.nome)}
          ${semClique(p) ? `<em class="ins-selo">💤 sem cliques em ${DIAS_SEM_CLIQUE} dias</em>` : ""}</span>
        ${barra(n, maxItem)}<span class="ins-valor">${fmt(n)}</span></li>`).join("")}</ul>
      <p class="hint">“💤 sem cliques em ${DIAS_SEM_CLIQUE} dias” aparece em itens que estão na vitrine há mais de ${DIAS_SEM_CLIQUE} dias
        e ninguém clicou nesse tempo. Tirar ou não é decisão sua.</p>`
      : `<p class="hint">Nenhum item na vitrine ainda.</p>`}
    <div class="actions"><button type="button" class="btn ghost" data-close>Fechar</button></div>`);
}

/* ---------- Painel de Categorias (renomear, mover itens, apagar vazias) ---------- */
// Regra: categoria com itens NÃO pode ser apagada. Primeiro mova os itens
// (com confirmação), depois apague a categoria vazia (com confirmação).
// A contagem inclui itens da lixeira, para nada ficar sem categoria ao restaurar.
const contarNaCategoria = (aba, cat) => {
  const todos = PRODUTOS.filter(p => p.aba === aba && p.cat === cat);
  return { total: todos.length, lixeira: todos.filter(p => p.apagadoEm).length };
};
const os_ = n => n.total === 1 ? "o" : "os";           // "o 1 item" / "os 4 itens"
const Os_ = n => n.total === 1 ? "O" : "Os";
const txtItens = ({ total, lixeira }) => total
  ? `${total} ite${total===1?"m":"ns"}${lixeira ? ` (${lixeira} na lixeira)` : ""}` : "vazia";

function abrirCategorias(){
  const secao = aba => {
    const cats = V.categorias[aba];
    return `<h4>${ABAS[aba].txt}</h4><ul class="cat-lista">${cats.map(c => {
      const n = contarNaCategoria(aba, c);
      const podeApagar = !n.total && cats.length > 1;
      return `<li><div class="cat-txt"><strong>${esc(c)}</strong><small>${txtItens(n)}</small></div>
        <div class="cat-acoes">
          <button type="button" class="btn ghost" data-cat="renomear" data-aba="${aba}" data-nome="${esc(c)}" aria-label="Renomear ${esc(c)}">✏️</button>
          ${n.total ? `<button type="button" class="btn ghost" data-cat="mover" data-aba="${aba}" data-nome="${esc(c)}">Mover itens</button>` : ""}
          <button type="button" class="btn ghost" data-cat="apagar" data-aba="${aba}" data-nome="${esc(c)}" ${podeApagar ? "" : "disabled"}
            title="${podeApagar ? "Apagar" : n.total ? "Mova os itens antes de apagar" : "Precisa existir pelo menos uma categoria"}" aria-label="Apagar ${esc(c)}">🗑️</button>
        </div></li>`;
    }).join("")}</ul>`;
  };
  abrirPainel(`
    <h3 id="sheet-title">🏷️ Categorias</h3>
    <p class="hint" style="margin-top:4px">Para apagar uma categoria com itens, primeiro toque em <strong>Mover itens</strong>.
      Quando ela ficar vazia, o 🗑️ é liberado.</p>
    ${secao("achadinhos")}${secao("estudos")}
    <p class="hint">Para criar uma categoria nova, use “➕ Nova categoria…” no formulário do item.</p>
    <div class="actions"><button type="button" class="btn ghost" data-close>Fechar</button></div>`);
}

function categoriaRenomear(aba, nome){
  const n = contarNaCategoria(aba, nome);
  abrirPainel(`
    <h3 id="sheet-title">Renomear categoria</h3>
    <form class="form" id="form-cat-renomear" novalidate data-aba="${aba}" data-nome="${esc(nome)}">
      <label>Novo nome para “${esc(nome)}”</label>
      <input type="text" name="novo" value="${esc(nome)}" maxlength="40">
      <p class="hint">${n.total ? `${Os_(n)} ${txtItens(n)} desta categoria ${n.total === 1 ? "passa" : "passam"} para o nome novo.` : "A categoria está vazia."}</p>
      <p class="err" id="err"></p>
      <div class="actions">
        <button type="button" class="btn ghost" data-cat="voltar">Cancelar</button>
        <button type="submit" class="btn primary">Salvar</button>
      </div>
    </form>`);
}
async function salvarRenomear(form){
  const aba = form.dataset.aba, antigo = form.dataset.nome, novo = form.novo.value.trim();
  if(!novo){ $("#err").textContent = "Escreva o nome."; return; }
  if(novo === antigo) return abrirCategorias();
  if(V.categorias[aba].some(c => c !== antigo && norm(c) === norm(novo))){ $("#err").textContent = "Já existe uma categoria com esse nome nesta aba."; return; }
  const btn = form.querySelector("[type=submit]"); btn.disabled = true; btn.textContent = "Salvando…";
  try{ await renomearCategoria(aba, antigo, novo); if(catAtual === antigo) catAtual = novo; await recarregar(); abrirCategorias(); toast("✅ Categoria renomeada"); }
  catch(e){ console.error(e); btn.disabled = false; btn.textContent = "Salvar"; $("#err").textContent = "Não consegui renomear agora 😕 Tente de novo."; }
}

function categoriaMover(aba, nome){
  const outras = V.categorias[aba].filter(c => c !== nome);
  if(!outras.length){ toast("Crie outra categoria antes de mover os itens."); return; }
  abrirPainel(`
    <h3 id="sheet-title">Mover itens</h3>
    <form class="form" id="form-cat-mover" novalidate data-aba="${aba}" data-nome="${esc(nome)}">
      <label>Mover ${os_(contarNaCategoria(aba, nome))} ${txtItens(contarNaCategoria(aba, nome))} de “${esc(nome)}” para:</label>
      <select name="para">${outras.map(c => `<option>${esc(c)}</option>`).join("")}</select>
      <div class="actions">
        <button type="button" class="btn ghost" data-cat="voltar">Cancelar</button>
        <button type="submit" class="btn primary">Continuar</button>
      </div>
    </form>`);
}
function confirmarMover(form){
  const aba = form.dataset.aba, de = form.dataset.nome, para = form.para.value, n = contarNaCategoria(aba, de);
  abrirPainel(`
    <h3 id="sheet-title">Mover itens?</h3>
    <p style="margin:10px 0 8px">${Os_(n)} <strong>${txtItens(n)}</strong> de “${esc(de)}” ${n.total === 1 ? "vai" : "vão"} para <strong>“${esc(para)}”</strong>.</p>
    <p class="hint" style="font-size:13.5px">Depois disso, “${esc(de)}” fica vazia e pode ser apagada. Se mudar de ideia, dá pra mover de volta.</p>
    <div class="actions">
      <button type="button" class="btn ghost" data-cat="voltar">Cancelar</button>
      <button type="button" class="btn primary" data-cat="mover-ok" data-aba="${aba}" data-nome="${esc(de)}" data-para="${esc(para)}">Mover</button>
    </div>`);
}
async function moverOk(bt){
  bt.disabled = true; bt.textContent = "Movendo…";
  try{ const n = await moverCategoria(bt.dataset.aba, bt.dataset.nome, bt.dataset.para); await recarregar(); abrirCategorias(); toast(`✅ ${n} ite${n===1?"m movido":"ns movidos"}`); }
  catch(e){ console.error(e); bt.disabled = false; bt.textContent = "Mover"; toast("⚠️ Não consegui mover agora. Tente de novo."); }
}

function categoriaApagar(aba, nome){
  if(contarNaCategoria(aba, nome).total){ toast("Mova os itens antes de apagar."); return; }
  abrirPainel(`
    <h3 id="sheet-title">Apagar categoria?</h3>
    <p style="margin:10px 0 8px">A categoria <strong>“${esc(nome)}”</strong> (${ABAS[aba].txt}) está vazia e vai sair da lista.</p>
    <p class="hint" style="font-size:13.5px">Nenhum item é apagado. Se precisar dela de novo, é só criar outra com o mesmo nome.</p>
    <div class="actions">
      <button type="button" class="btn ghost" data-cat="voltar">Cancelar</button>
      <button type="button" class="btn danger" data-cat="apagar-ok" data-aba="${aba}" data-nome="${esc(nome)}">Apagar</button>
    </div>`);
}
async function apagarOk(bt){
  const aba = bt.dataset.aba, nome = bt.dataset.nome;
  bt.disabled = true; bt.textContent = "Apagando…";
  try{
    V = await salvarPerfil(V, { categorias: { ...V.categorias, [aba]: V.categorias[aba].filter(c => c !== nome) } });
    renderChips(); render(); abrirCategorias(); toast("🗑️ Categoria apagada");
  }catch(e){ console.error(e); bt.disabled = false; bt.textContent = "Apagar"; toast("⚠️ Não consegui apagar agora. Tente de novo."); }
}

/* ---------- Insights: de onde a pessoa veio e contagem anônima ---------- */
// Prioridade: marca no link (?de=bio, ?de=stories…) > site de onde veio > "direto".
// A origem vale para a visita inteira (cliques seguintes contam com a mesma).
const ORIGENS = { bio:"Link da bio", stories:"Stories", instagram:"Instagram (outros)", whatsapp:"WhatsApp",
  google:"Google", facebook:"Facebook", direto:"Direto / sem origem", outro:"Outros sites" };
const ORIGEM = (() => {
  const url = new URL(location.href);
  const marca = (url.searchParams.get("de") || "").toLowerCase().trim();
  // tira a marca do endereço SEMPRE: se a pessoa compartilhar o link, não leva o "?de=" junto
  if(url.searchParams.has("de")){ url.searchParams.delete("de"); history.replaceState(null, "", url.pathname + url.search + url.hash); }
  try{ const salva = sessionStorage.getItem("vitrine-origem"); if(salva && ORIGENS[salva]) return salva; }catch(e){}
  let o = marca;
  if(!o){
    let host = ""; try{ host = document.referrer ? new URL(document.referrer).hostname : ""; }catch(e){}
    if(!host || host === location.hostname) o = "direto";
    else if(/instagram/.test(host)) o = "instagram";
    else if(/whatsapp|wa\.me/.test(host)) o = "whatsapp";
    else if(/(^|\.)google\./.test(host)) o = "google";
    else if(/facebook|fb\.|messenger/.test(host)) o = "facebook";
    else o = "outro";
  }
  if(!ORIGENS[o]) o = "outro";
  try{ sessionStorage.setItem("vitrine-origem", o); }catch(e){}
  return o;
})();
// Não conta a própria dona (logada) nem o modo de segurança.
// Cada pessoa conta 1 visita por sessão e 1 clique por item por sessão.
const deveContar = () => !admin && !modoSeguranca;
function contarVisita(){
  if(!deveContar()) return;
  try{ if(sessionStorage.getItem("vitrine-visita")) return; sessionStorage.setItem("vitrine-visita", "1"); }catch(e){}
  registrarVisita(ORIGEM);
}
function contarClique(id){
  if(!deveContar() || !id) return;
  try{ const k = "vitrine-clique-" + id; if(sessionStorage.getItem(k)) return; sessionStorage.setItem(k, "1"); }catch(e){}
  registrarClique(id, ORIGEM);
}

/* ---------- Eventos ---------- */
$("#abas").addEventListener("click", e => { const b = e.target.closest("[data-aba]"); if(!b) return;
  abaAtual = b.dataset.aba; abaEscolhida = true; catAtual = "Todos"; lojaAtual = "todas"; filtroSelo = null; renderChips(); render(); });
$("#chips").addEventListener("click", e => { const b = e.target.closest(".chip"); if(!b) return;
  if(b.dataset.selo) filtroSelo = filtroSelo === b.dataset.selo ? null : b.dataset.selo; else catAtual = b.dataset.c; renderChips(); render(); });
$("#stores").addEventListener("click", e => { const b = e.target.closest(".store-btn"); if(!b) return; lojaAtual = b.dataset.l; renderChips(); render(); });
$("#q").addEventListener("input", e => { busca = e.target.value; render(); });

async function copiarCupom(codigo){
  try{ await navigator.clipboard.writeText(codigo); toast(`📋 Cupom ${codigo} copiado`); }
  catch(e){ toast(`Cupom: ${codigo}`); }
}
$("#grid").addEventListener("click", e => {
  const ir = e.target.closest("[data-clique]"); if(ir) contarClique(ir.dataset.clique);
  const op = e.target.closest("[data-op]"), ed = e.target.closest("[data-edit]"), del = e.target.closest("[data-del]"), cp = e.target.closest("[data-copiar]");
  if(op) abrirOpiniao(porId(op.dataset.op));
  if(ed) abrirForm(ed.dataset.edit);
  if(del) confirmarApagar(del.dataset.del);
  if(cp) copiarCupom(cp.dataset.copiar);
});

$("#overlay").addEventListener("click", async e => {
  if(e.target.id === "overlay" || e.target.closest("[data-close]")) return fecharPainel();
  const cp = e.target.closest("[data-copiar]"); if(cp) return copiarCupom(cp.dataset.copiar);
  const ir = e.target.closest("[data-clique]"); if(ir){ contarClique(ir.dataset.clique); return; }
  const per = e.target.closest("[data-periodo]"); if(per) return abrirInsights(Number(per.dataset.periodo));
  const ct = e.target.closest("[data-cat]");
  if(ct && !ct.disabled){
    const { aba, nome } = ct.dataset;
    if(ct.dataset.cat === "renomear") return categoriaRenomear(aba, nome);
    if(ct.dataset.cat === "mover") return categoriaMover(aba, nome);
    if(ct.dataset.cat === "apagar") return categoriaApagar(aba, nome);
    if(ct.dataset.cat === "mover-ok") return moverOk(ct);
    if(ct.dataset.cat === "apagar-ok") return apagarOk(ct);
    if(ct.dataset.cat === "voltar") return abrirCategorias();
  }
  const seg = e.target.closest("[data-seg]");
  if(seg){
    const campo = seg.dataset.seg, valor = seg.dataset.v || null;
    seg.parentElement.querySelectorAll("button").forEach(b => b.classList.toggle("on", b === seg));
    rascunho[campo] = valor;
    if(campo === "tipo"){       // o tipo sugere a aba (ela pode trocar depois)
      rascunho.aba = TIPOS[valor].aba;
      document.querySelectorAll("#seg-aba button").forEach(b => b.classList.toggle("on", b.dataset.v === rascunho.aba));
    }
    if(campo === "tipo" || campo === "aba"){ $("#f-cat").innerHTML = opcoesCategoria(); }
    if(campo === "emoji" && !rascunho.foto && !rascunho.fotoNova) $("#prev").textContent = rascunho.emoji;
    if(campo === "selo") avisoFavoritos();
    atualizarForm();
    return;
  }
  const olho = e.target.closest("[data-olho]");
  if(olho){
    const campo = $("#senha"), mostrar = campo.type === "password";
    campo.type = mostrar ? "text" : "password";
    olho.textContent = mostrar ? "🙈" : "👁️";
    olho.setAttribute("aria-label", mostrar ? "Esconder senha" : "Mostrar senha");
    return;
  }
  if(e.target.id === "tirar-avatar"){
    perfilRascunho.avatarNovo = null; perfilRascunho.removerAvatar = true;
    $("#prev-avatar").textContent = (V.nome || "?").trim()[0].toUpperCase(); e.target.hidden = true; return;
  }
  if(e.target.id === "tirar-foto"){ rascunho.foto = null; rascunho.fotoNova = null; $("#prev").textContent = rascunho.emoji; e.target.hidden = true; return; }
  const cd = e.target.closest("[data-confirm-del]");
  if(cd){
    const id = cd.dataset.confirmDel; cd.disabled = true;
    if(await moverLixeira(id, true)){
      fecharPainel();
      toast("🗑️ Item apagado", { txt:"Desfazer", fn: async () => { if(await moverLixeira(id, false)) toast("↩️ Item de volta na vitrine"); } });
    } else cd.disabled = false;
    return;
  }
  const rs = e.target.closest("[data-restaurar]");
  if(rs){ rs.disabled = true; if(await moverLixeira(rs.dataset.restaurar, false)){ toast("↩️ Item de volta na vitrine"); abrirLixeira(); } else rs.disabled = false; }
});
$("#overlay").addEventListener("input", e => {
  if(e.target.name === "link"){
    const l = detectarLoja(e.target.value), hint = $("#loja-hint");
    if(l){ $("#f-loja").value = l; hint.textContent = `Reconheci: ${LOJAS[l].nome} ✓`; }
    else if(/^https?:\/\/\S+\.\S+/.test(e.target.value.trim())){ $("#f-loja").value = "outra"; hint.textContent = "Não reconheci a loja: escreva o nome da plataforma abaixo."; }
    else hint.textContent = "";
    atualizarForm();
  }
});
$("#overlay").addEventListener("change", async e => {
  if(e.target.name === "loja" || e.target.name === "cat" || e.target.name === "tem_cupom") atualizarForm();
  if(e.target.id === "foto" && e.target.files[0]){
    try{
      rascunho.fotoNova = await comprimir(e.target.files[0], { max:500, alvo:35*1024 });
      $("#prev").innerHTML = `<img src="${URL.createObjectURL(rascunho.fotoNova)}" alt="">`;
      $("#tirar-foto").hidden = false;
    }catch(err){ toast("Não consegui abrir essa imagem"); }
  }
  if(e.target.id === "foto-avatar" && e.target.files[0]){
    try{
      perfilRascunho.avatarNovo = await comprimir(e.target.files[0], { max:400, quadrado:true, alvo:40*1024 });
      $("#prev-avatar").innerHTML = `<img src="${URL.createObjectURL(perfilRascunho.avatarNovo)}" alt="">`;
      perfilRascunho.removerAvatar = false; $("#tirar-avatar").hidden = false;
    }catch(err){ toast("Não consegui abrir essa imagem"); }
  }
});
$("#overlay").addEventListener("submit", e => {
  e.preventDefault();
  if(e.target.id === "form") salvarForm(e.target);
  if(e.target.id === "form-login") fazerLogin(e.target);
  if(e.target.id === "form-perfil") salvarFormPerfil(e.target);
  if(e.target.id === "form-cat-renomear") salvarRenomear(e.target);
  if(e.target.id === "form-cat-mover") confirmarMover(e.target);
});
document.addEventListener("keydown", e => { if(e.key === "Escape") fecharPainel(); });

/* ---------- Login (funções em js/dados.js) ---------- */
const AVISO_SEGURANCA = `
  <h3 id="sheet-title">Vitrine em modo de segurança</h3>
  <div class="warn" style="font-size:14.5px;margin-top:12px">
    Todo mundo continua vendo os produtos normalmente, mas agora não dá pra entrar,
    adicionar nem editar. <strong>Avisa o suporte 💛</strong>
  </div>
  <div class="actions"><button type="button" class="btn ghost" data-close>Ok</button></div>`;

async function abrirLogin(){
  abrirPainel(`<h3 id="sheet-title">Entrar</h3><p class="hint" style="margin-top:4px">Verificando…</p>`);
  if(!(await bancoNoAr())){ abrirPainel(AVISO_SEGURANCA); return; }
  abrirPainel(`
    <h3 id="sheet-title" style="margin-bottom:4px">Entrar</h3>
    <p class="hint" style="margin-top:0">Área só para a dona da vitrine.</p>
    <form class="form" id="form-login" novalidate>
      <label for="email">E-mail</label>
      <input type="email" id="email" name="email" autocomplete="username" inputmode="email" autocapitalize="off" spellcheck="false">
      <label for="senha">Senha</label>
      <div class="senha">
        <input type="password" id="senha" name="senha" autocomplete="current-password">
        <button type="button" class="olho" data-olho aria-label="Mostrar senha">👁️</button>
      </div>
      <p class="err" id="err"></p>
      <div class="actions">
        <button type="button" class="btn ghost" data-close>Cancelar</button>
        <button type="submit" class="btn primary" id="btn-entrar">Entrar</button>
      </div>
    </form>`);
  setTimeout(() => $("#email")?.focus(), 250);
}

async function fazerLogin(form){
  const email = form.email.value.trim().toLowerCase(), senha = form.senha.value;
  if(!email || !senha){ $("#err").textContent = "Preencha o e-mail e a senha."; return; }
  const btn = $("#btn-entrar"); btn.disabled = true; btn.textContent = "Entrando…"; $("#err").textContent = "";
  const r = await entrar(email, senha);
  btn.disabled = false; btn.textContent = "Entrar";
  if(r.ok){ fecharPainel(); await atualizarLogin(await usuarioLogado(), true); }
  else if(r.motivo === "senha") $("#err").textContent = "E-mail ou senha incorretos.";
  else if(r.motivo === "fora_do_ar") abrirPainel(AVISO_SEGURANCA);
  else $("#err").textContent = "Não consegui entrar agora. Tente de novo em instantes.";
}

// Recarrega a vitrine quando a conta logada muda (a dona também recebe a lixeira)
async function atualizarLogin(id, avisar){
  if(id === usuarioId && !avisar) return;
  usuarioId = id;
  const eraAdmin = admin;
  await recarregar();            // recalcula "admin"
  if(avisar && admin){ window.scrollTo({ top:0, behavior:"smooth" }); toast(`Modo ${V.nome} ativado ✏️`); }
  else if(avisar && usuarioId && !admin){ toast("Esta conta não é dona desta vitrine."); }
  else if(eraAdmin && !admin) toast("Você saiu 👋");
}
async function recarregar(){
  try{ const r = await carregarVitrine(); V = r.vitrine; PRODUTOS = r.produtos; erroCarga = false; }
  catch(e){ console.error(e); erroCarga = true; }
  carregando = false;
  // no plano B (cópia de segurança) ninguém edita, nem a dona logada
  admin = !modoSeguranca && !!(usuarioId && V && usuarioId === V.donaId);
  if(!abaEscolhida) abaAtual = abaInicial();
  renderCabecalho(); renderChips(); render();
}

$("#entrar").addEventListener("click", abrirLogin);
$("#sair").addEventListener("click", async () => { await sair(); await atualizarLogin(null); });
$("#btn-lixeira").addEventListener("click", abrirLixeira);
$("#btn-perfil").addEventListener("click", abrirPerfil);
$("#btn-categorias").addEventListener("click", abrirCategorias);
$("#btn-insights").addEventListener("click", () => { insightsCache = null; abrirInsights(30); });
$("#fab").addEventListener("click", () => abrirForm(null));

/* ---------- Início ---------- */
(async () => {
  render();
  usuarioId = await usuarioLogado();
  await recarregar();
  contarVisita();
  aoMudarLogin(id => { if(id !== usuarioId) atualizarLogin(id); });   // sessão expirou ou saiu em outra aba
})();
