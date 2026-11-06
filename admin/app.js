"use strict";
const $ = (s) => document.querySelector(s);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (value) =>
  value == null
    ? "Consultar valor"
    : Number(value).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
const safeUrl = (value) =>
  /^(https?:\/\/|\/uploads\/|\/?imagens\/)/i.test(value || "")
    ? esc(value.startsWith("imagens/") ? "/" + value : value)
    : "/imagens/logo-boteco.png";
const dateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dateKey(d);
};
const tables = [
  "categorias",
  "produtos",
  "secoes",
  "fotos",
  "avaliacoes",
  "estabelecimento",
  "horarios_funcionamento",
  "intervalos_funcionamento",
];
let cache = {},
  models = {},
  state = {},
  page = "numbers",
  period = 30,
  settingsTab = "estabelecimento",
  editing = null,
  busy = false,
  toastTimer;
const pages = {
  numbers: [
    "Tudo em um só lugar.",
    "Um retrato do estabelecimento, em números.",
    "Visão geral",
  ],
  charts: [
    "Os números contam histórias.",
    "Compare o cardápio e acompanhe as avaliações reais.",
    "Análises",
  ],
  menu: [
    "Cardápio da casa.",
    "Produtos, tamanhos, adicionais e disponibilidade.",
    "Cardápio",
  ],
  categories: [
    "Cada sabor no seu lugar.",
    "Categorias e ordem dos filtros do site.",
    "Categorias",
  ],
  sections: [
    "As palavras da casa.",
    "Textos e imagens das seções do site.",
    "Textos do site",
  ],
  content: [
    "A história do Boteco.",
    "Edite a apresentação e a imagem do ambiente.",
    "O Boteco",
  ],
  events: [
    "Todo encontro merece um lugar.",
    "Apresente o espaço para comemorações.",
    "Eventos",
  ],
  gallery: [
    "Momentos que dão vontade de ficar.",
    "Fotos da galeria e da faixa do Instagram.",
    "Fotos e galeria",
  ],
  reviews: [
    "A voz de quem já veio.",
    "Aprove ou rejeite as avaliações recebidas.",
    "Avaliações",
  ],
  settings: [
    "As informações da casa.",
    "Contatos, endereço e horários de funcionamento.",
    "Informações e horários",
  ],
};
const fieldLabels = {
  nome: "Nome",
  slug: "Identificador da categoria",
  ordem: "Ordem de exibição",
  ativo: "Visível no site",
  categoria_id: "Categoria",
  descricao: "Descrição / acompanhamentos",
  preco: "Preço único (R$)",
  imagem_url: "Imagem",
  imagem_alt: "Descrição da imagem",
  destaque: "Exibir nos destaques",
  selo: "Selo do produto",
  ordem_destaque: "Ordem nos destaques",
  chave: "Seção",
  subtitulo: "Subtítulo",
  titulo: "Título",
  botao_texto: "Texto do botão",
  botao_url: "Link do botão",
  grupo: "Grupo",
  texto_alternativo: "Descrição da foto",
  legenda: "Legenda",
  link_url: "Link da publicação",
  telefone: "Telefone",
  whatsapp: "WhatsApp com DDI e DDD",
  whatsapp_secundario: "Segundo WhatsApp (opcional)",
  email: "E-mail",
  endereco: "Rua",
  numero: "Número",
  complemento: "Complemento",
  bairro: "Bairro",
  cidade: "Cidade",
  estado: "Estado (UF)",
  cep: "CEP",
  maps_url: "Link do Google Maps",
  maps_embed_url: "Link de incorporação do mapa",
  instagram_url: "Instagram",
  facebook_url: "Facebook",
  logo_url: "Logo",
  dia_semana: "Dia da semana",
  fechado: "Fechado",
  horario_id: "Dia da semana",
  abertura: "Abertura",
  fechamento: "Fechamento",
  encerra_no_dia_seguinte: "Encerra no dia seguinte",
};
const dayNames = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];
const sectionNames = {
  inicio: "Início",
  o_boteco: "O Boteco",
  events: "Eventos",
  eventos: "Eventos",
  specials: "Destaques",
  menu: "Cardápio",
  gallery: "Galeria",
  reviews: "Avaliações",
  instagram: "Instagram",
  location: "Localização",
  hours: "Horários",
};
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 5000);
}
function pill(status) {
  return `<span class="pill ${status === "pendente" ? "pending" : status === "rejeitada" ? "rejected" : status === "off" ? "off" : ""}">${{ aprovada: "Aprovada", pendente: "Pendente", rejeitada: "Rejeitada", active: "Ativo", off: "Oculto" }[status] || esc(status)}</span>`;
}
async function api(path, options = {}) {
  const response = await fetch("/api/" + path, {
    ...options,
    headers:
      options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" },
  });
  if (response.status === 401) {
    $("#dashboard").hidden = true;
    $("#loginScreen").hidden = false;
    throw Error("Entre novamente para continuar.");
  }
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok)
    throw Error(data.error || "Não foi possível concluir a operação.");
  return data;
}
function toState() {
  state = {
    categories: cache.categorias.map((c) => ({
      id: String(c.id),
      name: c.nome,
      active: !!c.ativo,
    })),
    products: cache.produtos.map((p) => ({
      id: String(p.id),
      name: p.nome,
      category: String(p.categoria_id),
      price: p.preco,
      image: p.imagem_url,
      active: !!p.ativo,
      featured: !!p.destaque,
    })),
    reviews: cache.avaliacoes.map((r) => ({
      id: String(r.id),
      name: r.nome_cliente,
      rating: r.nota,
      comment: r.comentario,
      status: r.status,
      date: dateKey(new Date(r.criado_em)),
    })),
  };
}
async function reload() {
  const results = await Promise.all(tables.map((t) => api("admin/" + t)));
  tables.forEach((t, i) => (cache[t] = results[i]));
  for (const t of ["categorias", "produtos", "fotos"])
    cache[t].sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || a.id - b.id);
  toState();
  render();
}
function tableForPage() {
  return {
    menu: "produtos",
    categories: "categorias",
    sections: "secoes",
    content: "secoes",
    events: "secoes",
    gallery: "fotos",
    reviews: "avaliacoes",
    settings: settingsTab,
  }[page];
}
function recordsForPage() {
  let rows = cache[tableForPage()] || [];
  if (page === "content") rows = rows.filter((s) => s.chave === "o_boteco");
  if (page === "events")
    rows = rows.filter((s) => ["eventos", "events"].includes(s.chave));
  return rows;
}
function recordName(row, table) {
  if (table === "horarios_funcionamento") return dayNames[row.dia_semana];
  if (table === "intervalos_funcionamento") {
    const day = cache.horarios_funcionamento.find(
      (h) => h.id === row.horario_id,
    );
    return `${dayNames[day?.dia_semana] || "Dia"} · ${row.abertura.slice(0, 5)} às ${row.fechamento.slice(0, 5)}`;
  }
  return (
    row.nome ||
    row.titulo ||
    row.legenda ||
    row.texto_alternativo ||
    "Registro " + row.id
  );
}
function catalogPrice(p) {
  const variants = p.variacoes || [];
  if (!variants.length) return money(p.preco);
  if (variants.some((v) => v.preco === null)) return "Consultar valor";
  const prices = variants.map((v) => Number(v.preco));
  return (
    (new Set(prices).size > 1 ? "A partir de " : "") +
    money(Math.min(...prices))
  );
}
function recordsHtml(rows) {
  const table = tableForPage();
  if (!rows.length) return empty("Nenhum cadastro encontrado.");
  if (table === "produtos")
    return `<div class="table-wrap product-table"><table><thead><tr><th>Produto</th><th>Preço</th><th>Status</th><th>Ações</th></tr></thead><tbody>${rows.map((r) => `<tr><td><div class="product-cell"><img src="${safeUrl(r.imagem_url)}" alt=""><div><strong>${esc(r.nome)}</strong><small>${esc(cache.categorias.find((c) => c.id === r.categoria_id)?.nome || "")} ${r.destaque ? "· ★ Destaque" : ""}</small></div></div></td><td data-label="Preço">${catalogPrice(r)}</td><td data-label="Status">${pill(r.ativo ? "active" : "off")}</td><td data-label="Ações">${recordActions(r, table)}</td></tr>`).join("")}</tbody></table></div>`;
  return `<div class="${table === "fotos" ? "photo-grid" : "record-list"}">${rows.map((r) => `<article class="${table === "fotos" ? "photo-card" : "panel"}">${table === "fotos" ? `<img src="${safeUrl(r.imagem_url)}" alt="${esc(r.texto_alternativo)}"><div>` : ""}<div class="record-title"><h3>${esc(recordName(r, table))}</h3>${"ativo" in r ? pill(r.ativo ? "active" : "off") : ""}</div><p class="record-summary">${esc(table === "categorias" ? `${cache.produtos.filter((p) => p.categoria_id === r.id).length} produtos · Ordem ${r.ordem}` : table === "horarios_funcionamento" ? (r.fechado ? "Fechado" : "Aberto") : table === "intervalos_funcionamento" ? (r.encerra_no_dia_seguinte ? "Encerra no dia seguinte" : "Mesmo dia") : r.descricao || r.grupo || "")}</p>${recordActions(r, table)}${table === "fotos" ? "</div>" : ""}</article>`).join("")}</div>`;
}
function recordActions(r, t) {
  return `<div class="actions"><button class="button secondary" data-edit="${r.id}" data-table="${t}">Editar</button>${t !== "estabelecimento" ? `<button class="button danger" data-delete="${r.id}" data-table="${t}">Excluir</button>` : ""}</div>`;
}
function reviewCards(status = "") {
  return (
    cache.avaliacoes
      .filter((r) => !status || r.status === status)
      .map(
        (r) =>
          `<article class="review-card"><div class="review-meta"><strong>${esc(r.nome_cliente)}</strong><span class="stars">${"★".repeat(r.nota)}${"☆".repeat(5 - r.nota)}</span>${pill(r.status)}</div><p>${esc(r.comentario)}</p><p class="subtext">${new Date(r.criado_em).toLocaleDateString("pt-BR")}</p><div class="actions">${[
            "aprovada",
            "pendente",
            "rejeitada",
          ]
            .filter((s) => s !== r.status)
            .map(
              (s) =>
                `<button class="button secondary" data-review="${r.id}" data-status="${s}">${{ aprovada: "Aprovar", pendente: "Voltar para pendente", rejeitada: "Rejeitar" }[s]}</button>`,
            )
            .join("")}</div></article>`,
      )
      .join("") || empty("Nenhuma avaliação neste status.")
  );
}
function render() {
  if (!cache.produtos) return;
  const meta = pages[page];
  $("#pageTitle").textContent = meta[0];
  $("#pageDescription").textContent = meta[1];
  $("#breadcrumb").textContent = meta[2];
  document.querySelectorAll("[data-page]").forEach((b) => {
    b.classList.toggle("active", b.dataset.page === page);
    if (b.dataset.page === page) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  $("#pendingBadge").textContent = cache.avaliacoes.filter(
    (r) => r.status === "pendente",
  ).length;
  if (page === "numbers" || page === "charts") {
    $("#view").innerHTML = page === "numbers" ? numbers() : charts();
    return;
  }
  if (page === "reviews") {
    $("#view").innerHTML =
      `<div class="toolbar"><p class="subtext">Somente avaliações aprovadas aparecem no site.</p><select id="reviewFilter" aria-label="Status"><option value="">Todos os status</option><option value="pendente">Pendentes</option><option value="aprovada">Aprovadas</option><option value="rejeitada">Rejeitadas</option></select></div><div id="reviewResults">${reviewCards()}</div>`;
    return;
  }
  const table = tableForPage(),
    rows = recordsForPage();
  $("#view").innerHTML = `${
    page === "settings"
      ? `<div class="admin-tabs">${[
          ["estabelecimento", "Informações"],
          ["horarios_funcionamento", "Dias de funcionamento"],
          ["intervalos_funcionamento", "Horários"],
        ]
          .map(
            ([t, l]) =>
              `<button class="button ${t === settingsTab ? "" : "secondary"}" data-tab="${t}">${l}</button>`,
          )
          .join("")}</div>`
      : ""
  }<div class="toolbar"><div class="toolbar-group">${table === "produtos" ? '<button class="button secondary" id="importCatalog">Importar cardápio do PDF</button>' : ""}<input type="search" id="recordSearch" placeholder="Buscar…" aria-label="Buscar cadastro">${table === "produtos" ? `<select id="categoryFilter" aria-label="Categoria"><option value="">Todas as categorias</option>${cache.categorias.map((c) => `<option value="${c.id}">${esc(c.nome)}</option>`).join("")}</select>` : ""}</div>${table === "estabelecimento" && rows.length ? "" : `<button class="button" id="createRecord">+ ${table === "produtos" ? "Novo produto" : table === "fotos" ? "Nova foto" : "Novo cadastro"}</button>`}</div><div id="records">${recordsHtml(rows)}</div>`;
}
function field(name, type, value, row) {
  if (editing.table === "produtos" && name === "imagem_url")
    return `<input type="hidden" name="imagem_url" value="${esc(value || "")}">`;
  const label = fieldLabels[name] || name;
  let input = "";
  const attrs = `name="${name}"`;
  const select = (items) =>
    `<select ${attrs} required>${items.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(value) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
  if (name === "categoria_id")
    input = select(cache.categorias.map((c) => [c.id, c.nome]));
  else if (name === "horario_id")
    input = select(
      cache.horarios_funcionamento.map((h) => [h.id, dayNames[h.dia_semana]]),
    );
  else if (name === "dia_semana")
    input = select(dayNames.map((d, i) => [i, d]));
  else if (name === "grupo")
    input = select([
      ["galeria", "Galeria"],
      ["instagram", "Instagram"],
    ]);
  else if (name === "chave") input = select(Object.entries(sectionNames));
  else if (type === "bool")
    return `<label class="field"><span class="checkbox-label"><input type="checkbox" ${attrs} ${value ? "checked" : ""}>${label}</span></label>`;
  else if (type === "long")
    input = `<textarea ${attrs}>${esc(value)}</textarea>`;
  else {
    const number = ["int", "id", "nullableprice"].includes(type);
    input = `<input ${attrs} type="${type === "time" ? "time" : number ? "number" : name === "email" ? "email" : "text"}" value="${esc(value)}" ${number ? `min="0" step="${type === "nullableprice" ? "0.01" : "1"}"` : ""} ${!["optional", "url?", "nullableprice"].includes(type) ? "required" : ""}>`;
  }
  return `<label class="field ${type === "long" || name.includes("url") ? "full" : ""}">${label}${input}${editing.table === "produtos" && productHint(name) ? `<small>${productHint(name)}</small>` : ""}${name === "slug" ? "<small>Use letras minúsculas, números e hífens.</small>" : ""}</label>`;
}
function productHint(name) {
  return ({preco: "Use para um produto com preço único. Se cadastrar tamanhos abaixo, os preços dos tamanhos terão prioridade. Vazio significa valor sob consulta.",
    imagem_alt: "Opcional: descreva a foto para pessoas que usam leitor de tela. Não é o endereço da imagem.",
    selo: "Opcional: texto curto, como Mais pedido.",
    ordem: "Números menores aparecem primeiro na categoria.",
    ordem_destaque: "Números menores aparecem primeiro. Só tem efeito quando o produto está nos destaques."})[name] || "";
}
function detailRow(kind, value = {}) {
  const options = kind === "opcoes";
  return `<div class="detail-row ${options ? "options-row" : ""}" data-kind="${kind}"><label class="field">${options ? "Grupo (ex.: Sabores)" : "Nome"}<input data-detail-name value="${esc(value.nome || "")}" required></label>${options ? `<label class="field full">Opções — uma por linha<textarea data-detail-values required>${esc((value.valores || []).join("\n"))}</textarea></label>` : `<label class="field">Preço (R$)<input type="number" data-detail-price min="0" step="0.01" value="${value.preco == null ? "" : esc(value.preco)}" ${value.preco === null ? "disabled" : ""} ${value.preco === null ? "" : "required"}></label>${kind === "variacoes" ? `<label class="field"><span><input type="checkbox" data-consult ${value.preco === null ? "checked" : ""}> Sob consulta</span></label>` : ""}`}<button type="button" class="button danger remove-row" data-remove-detail>Remover</button></div>`;
}
function productDetails(row) {
  return (
    ["variacoes", "adicionais", "opcoes"]
      .map(
        (kind) =>
          `<fieldset class="detail-group"><legend>${{ variacoes: "Tamanhos e preços", adicionais: "Adicionais opcionais", opcoes: "Sabores, bases e acompanhamentos" }[kind]}</legend><div id="rows-${kind}">${(row[kind] || []).map((v) => detailRow(kind, v)).join("")}</div><button type="button" class="button secondary" data-add-detail="${kind}">+ Adicionar ${kind === "opcoes" ? "grupo" : "opção"}</button>${kind === "variacoes" ? '<p class="small-note">Com variações, o site calcula “A partir de” automaticamente pelo menor preço. Sem variações, utiliza o preço único.</p>' : ""}</fieldset>`,
      )
      .join("") +
    `<fieldset class="detail-group"><legend>Disponível nos dias</legend><div class="weekday-list">${dayNames.map((d, i) => `<label><input type="checkbox" name="day" value="${i}" ${(row.dias_disponiveis || []).includes(i) ? "checked" : ""}>${d}</label>`).join("")}</div><p class="small-note">Nenhum dia selecionado significa disponibilidade sem restrição semanal.</p></fieldset>`
  );
}
function editRecord(table, id) {
  let row = cache[table].find((r) => String(r.id) === String(id)) || {};
  if (!id && table === "secoes" && ["content", "events"].includes(page))
    row = { chave: page === "content" ? "o_boteco" : "events" };
  editing = { table, id };
  $("#editorTitle").textContent = id
    ? "Editar " + (table === "produtos" ? "produto" : "cadastro")
    : "Novo cadastro";
  $("#editorFields").innerHTML =
    Object.entries(models[table])
      .filter(([, type]) => type !== "details")
      .map(([key, type]) =>
        field(
          key,
          type,
          row[key] ??
            (type === "bool"
              ? key === "ativo"
              : ["int", "day"].includes(type)
                ? 0
                : ""),
          row,
        ),
      )
      .join("") +

    (["produtos", "secoes", "fotos", "estabelecimento"].includes(table)
      ? `<label class="field image-upload">Enviar imagem (JPEG, PNG ou WebP, até 5 MB)<input type="file" id="imageUpload" accept="image/jpeg,image/png,image/webp"><small>${table === "produtos" ? "Foto opcional. Escolha um arquivo e depois salve o produto para confirmar a alteração." : "A imagem enviada preenche o campo de imagem automaticamente."}</small></label>${table === "produtos" ? `<div class="product-photo-preview full"><img id="productPhotoPreview" ${row.imagem_url ? `src="${safeUrl(row.imagem_url)}"` : ""} alt="Prévia da foto do produto" ${row.imagem_url ? "" : "hidden"}><p id="productPhotoStatus" role="status">${row.imagem_url ? "Foto atual do produto." : "Nenhuma foto cadastrada. Você pode salvar sem foto."}</p><button type="button" class="button" id="removeProductPhoto" ${row.imagem_url ? "" : "hidden"}>Remover foto</button></div>` : ""}`
      : "") +
    (table === "produtos" ? productDetails(row) : "") +
    '<p class="form-error editor-feedback" id="editorError" role="alert"></p>';
  $("#editor").showModal();
}
function collectForm(form) {
  const data = {},
    fd = new FormData(form);
  for (const [key, type] of Object.entries(models[editing.table])) {
    if (type === "details") continue;
    const value = fd.get(key);
    data[key] =
      type === "bool"
        ? fd.has(key)
        : ["int", "id", "day"].includes(type)
          ? Number(value)
          : type === "nullableprice"
            ? value === ""
              ? null
              : Number(value)
            : value;
  }
  if (editing.table === "produtos") {
    for (const kind of ["variacoes", "adicionais", "opcoes"])
      data[kind] = Array.from(
        form.querySelectorAll(`[data-kind="${kind}"]`),
      ).map((row) => ({
        nome: row.querySelector("[data-detail-name]").value.trim(),
        ...(kind === "opcoes"
          ? {
              valores: row
                .querySelector("[data-detail-values]")
                .value.split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
            }
          : {
              preco: row.querySelector("[data-consult]")?.checked
                ? null
                : Number(row.querySelector("[data-detail-price]").value),
            }),
      }));
    data.dias_disponiveis = fd.getAll("day").map(Number);
  }
  return data;
}
async function mutate(fn) {
  if (busy) return;
  busy = true;
  try {
    await fn();
    await reload();
    toast("Alterações salvas e disponíveis no site.");
  } catch (e) {
    toast(e.message);
    throw e;
  } finally {
    busy = false;
  }
}
function closeNav() {
  $("#sidebar").classList.remove("open");
  $("#scrim").hidden = true;
  $("#menuToggle").setAttribute("aria-expanded", "false");
}
function go(next) {
  if (!pages[next]) return;
  page = next;
  history.replaceState(null, "", "#" + page);
  render();
  closeNav();
  $("#main").focus({ preventScroll: true });
}
async function start() {
  const admin = await api("auth/me");
  models = await api("admin/modelos");
  await reload();
  $("#adminName").textContent = admin.nome || "Administrador";
  $("#loginScreen").hidden = true;
  $("#dashboard").hidden = false;
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const d = b.dataset;
  if (b.id === "removeProductPhoto") {
    $("#editorForm").elements.imagem_url.value = "";
    $("#productPhotoPreview").hidden = true;
    $("#productPhotoPreview").removeAttribute("src");
    $("#productPhotoStatus").textContent = "Foto removida. Salve o produto para confirmar.";
    $("#imageUpload").value = "";
    b.hidden = true;
    return;
  }
  try {
    if (d.page || d.go) go(d.page || d.go);
    if (d.tab) {
      settingsTab = d.tab;
      render();
    }
    if (
      b.id === "importCatalog" &&
      confirm(
        "Importar os itens do PDF? Cadastros já importados serão preservados. Os produtos anteriores continuarão ativos e poderão ser ocultados no painel.",
      )
    )
      await mutate(() =>
        api("admin/importar-cardapio", {
          method: "POST",
          body: JSON.stringify({ replace: false }),
        }),
      );
    if (b.id === "createRecord") editRecord(tableForPage());
    if (d.edit) editRecord(d.table, d.edit);
    if (d.editProduct) editRecord("produtos", d.editProduct);
    if (d.toggleProduct)
      await mutate(() =>
        api("admin/produtos/" + d.toggleProduct, {
          method: "PATCH",
          body: JSON.stringify({
            ativo: !cache.produtos.find((p) => String(p.id) === d.toggleProduct)
              .ativo,
          }),
        }),
      );
    if (d.delete && confirm("Excluir este cadastro?"))
      await mutate(() =>
        api(`admin/${d.table}/${d.delete}`, { method: "DELETE" }),
      );
    if (d.review)
      await mutate(() =>
        api("admin/avaliacoes/" + d.review, {
          method: "PATCH",
          body: JSON.stringify({ status: d.status }),
        }),
      );
    if (d.addDetail)
      $("#rows-" + d.addDetail).insertAdjacentHTML(
        "beforeend",
        detailRow(d.addDetail, { preco: 0 }),
      );
    if ("removeDetail" in d) b.closest(".detail-row").remove();
    if (["closeEditor", "cancelEditor"].includes(b.id)) $("#editor").close();
    if (b.id === "logout") {
      await api("auth/logout", { method: "POST" });
      cache = {};
      state = {};
      $("#view").replaceChildren();
      $("#editor").close();
      $("#dashboard").hidden = true;
      $("#loginScreen").hidden = false;
    }
    if (b.id === "menuToggle") {
      const open = !$("#sidebar").classList.contains("open");
      $("#sidebar").classList.toggle("open", open);
      $("#scrim").hidden = !open;
      b.setAttribute("aria-expanded", String(open));
    }
    if (b.id === "scrim") closeNav();
  } catch (e) {
    toast(e.message);
  }
});
document.addEventListener("change", async (e) => {
  if (e.target.id === "period") {
    period = Number(e.target.value);
    render();
  }
  if (e.target.id === "reviewFilter")
    $("#reviewResults").innerHTML = reviewCards(e.target.value);
  if (e.target.hasAttribute("data-consult")) {
    const input = e.target
      .closest(".detail-row")
      .querySelector("[data-detail-price]");
    input.disabled = e.target.checked;
    input.required = !e.target.checked;
  }
  if (e.target.id === "imageUpload") {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast("A imagem deve ter até 5 MB.");
      return;
    }
    const fd = new FormData();
    fd.append("imagem", file);
    e.target.disabled = true;
    const uploadEditor = editing;
    const photoStatus = $("#productPhotoStatus");
    const removePhoto = $("#removeProductPhoto");
    if (removePhoto) removePhoto.disabled = true;
    if (photoStatus) photoStatus.textContent = "Enviando foto… Aguarde antes de salvar.";
    const submitButton = $("#editorForm").querySelector('[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    try {
      const data = await api("admin-upload", { method: "POST", body: fd });
      if (editing !== uploadEditor) return;
      $("#editorForm").elements[
        editing.table === "estabelecimento" ? "logo_url" : "imagem_url"
      ].value = data.url;
      const preview = $("#productPhotoPreview");
      if (preview) { preview.src = data.url; preview.hidden = false; }
      if (removePhoto) removePhoto.hidden = false;
      if (photoStatus) photoStatus.textContent = "Foto enviada. Salve o produto para confirmar.";
      toast("Imagem enviada. Salve o cadastro para publicá-la.");
    } catch (err) {
      if (photoStatus) photoStatus.textContent = "Não foi possível enviar a foto. Tente novamente; a foto anterior foi mantida.";
      toast(err.message);
    } finally {
      e.target.disabled = false;
      if (submitButton) submitButton.disabled = false;
      if (removePhoto) removePhoto.disabled = false;
    }
  }
  if (e.target.id === "categoryFilter") filterRecords();
});
function filterRecords() {
  const text = $("#recordSearch")?.value.toLocaleLowerCase("pt-BR") || "",
    category = $("#categoryFilter")?.value;
  $("#records").innerHTML = recordsHtml(
    recordsForPage().filter(
      (r) =>
        recordName(r, tableForPage())
          .toLocaleLowerCase("pt-BR")
          .includes(text) &&
        (!category || String(r.categoria_id) === category),
    ),
  );
}
document.addEventListener("input", (e) => {
  if (e.target.id === "recordSearch") filterRecords();
});
$("#editorForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (busy) return;
  const submit = e.target.querySelector("[type=submit]");
  submit.disabled = true;
  $("#editorError").textContent = "";
  try {
    const body = collectForm(e.target);
    await mutate(() =>
      api("admin/" + editing.table + (editing.id ? "/" + editing.id : ""), {
        method: editing.id ? "PATCH" : "POST",
        body: JSON.stringify(body),
      }),
    );
    $("#editor").close();
  } catch (err) {
    $("#editorError").textContent = err.message;
  } finally {
    submit.disabled = false;
  }
});
$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const b = e.target.querySelector("button");
  b.disabled = true;
  $("#loginMessage").textContent = "";
  try {
    await api("auth/login", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(new FormData(e.target))),
    });
    await start();
    e.target.reset();
  } catch (err) {
    $("#loginMessage").textContent = err.message;
  } finally {
    b.disabled = false;
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeNav();
});
document.addEventListener(
  "error",
  (e) => {
    if (e.target.tagName === "IMG" && !e.target.dataset.fallback) {
      e.target.dataset.fallback = "true";
      e.target.src = "/imagens/logo-boteco.png";
    }
  },
  true,
);
$("#today").textContent = new Date().toLocaleDateString("pt-BR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
page = pages[location.hash.slice(1)] ? location.hash.slice(1) : "numbers";
start().catch((e) => {
  $("#loginMessage").textContent =
    e.message === "Entre novamente para continuar." ? "" : e.message;
});
