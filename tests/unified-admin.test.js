const { test } = require("node:test");
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const { validate, definitions } = require("../server/validation");
const { decodeProduct } = require("../server/product-details");
const { JSDOM } = require("jsdom");
const validProduct = {
  categoria_id: 1,
  nome: "Feijoada",
  descricao: "Arroz, couve e farofa",
  preco: 0,
  imagem_url: null,
  imagem_alt: null,
  destaque: true,
  selo: null,
  ordem: 0,
  ordem_destaque: 0,
  ativo: true,
  variacoes: [
    { nome: "Média", preco: 85 },
    { nome: "Grande", preco: 95 },
  ],
  adicionais: [{ nome: "Extra", preco: 5 }],
  opcoes: [{ nome: "Acompanhamento", valores: ["Arroz", "Farofa"] }],
  dias_disponiveis: [3, 6],
};
test("Product details validate and derive price without losing weekly availability", () => {
  const result = validate("produtos", validProduct);
  assert.equal(result.preco, 85);
  assert.deepEqual(decodeProduct(result).variacoes, validProduct.variacoes);
  assert.deepEqual(decodeProduct(result).dias_disponiveis, [3, 6]);
  assert.equal(
    validate("produtos", {
      ...validProduct,
      variacoes: [{ nome: "Único", preco: null }],
    }).preco,
    null,
  );
  for (const patch of [
    { variacoes: [{ nome: "X", preco: -1 }] },
    { variacoes: [{ nome: "X", preco: 1.234 }] },
    { dias_disponiveis: [7] },
    { dias_disponiveis: [3, 3] },
    { opcoes: [{ nome: "Sabores", valores: [] }] },
    { adicionais: [{ nome: "Extra", preco: null }] },
  ])
    assert.throws(() => validate("produtos", patch, true));
});
test("All 78 catalog products pass API validation", () => {
  const vm = require("node:vm"),
    context = { window: {} };
  vm.runInNewContext(fs.readFileSync("assets/js/cardapio-data.js", "utf8"), context);
  const products = JSON.parse(
    JSON.stringify(context.window.BOTECO_MENU.products),
  );
  assert.equal(products.length, 78);
  for (const p of products)
    validate("produtos", {
      ...validProduct,
      nome: p.name,
      descricao: p.description,
      variacoes: p.variants.map((v) => ({ nome: v.name, preco: v.price })),
      adicionais: p.addons.map((a) => ({ nome: a.name, preco: a.price })),
      opcoes: p.options.map((o) => ({ nome: o.name, valores: o.values })),
      dias_disponiveis: p.days,
    });
});
const flush = () => new Promise((resolve) => setTimeout(resolve, 25));
test("Unified admin: authentication, real metrics, charts, details editor, save, moderation and logout", async () => {
  const data = {
    categorias: [{ id: 1, nome: "Pratos", slug: "pratos", ativo: 1, ordem: 0 }],
    produtos: [{ id: 1, ...validProduct }],
    secoes: [],
    fotos: [],
    avaliacoes: [
      {
        id: 1,
        nome_cliente: "Cliente",
        nota: 5,
        comentario: "Gostei da comida",
        status: "pendente",
        criado_em: new Date().toISOString(),
      },
    ],
    estabelecimento: [],
    horarios_funcionamento: [],
    intervalos_funcionamento: [],
  };
  const dom = new JSDOM(fs.readFileSync("admin/index.html", "utf8"), {
    url: "http://localhost:3000/admin/",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const w = dom.window,
    d = w.document;
  let authenticated = false,
    saveBody;
  w.confirm = () => true;
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  w.fetch = async (url, options = {}) => {
    let payload;
    let status = 200;
    if (url === "/api/auth/login") {
      authenticated = true;
      payload = { nome: "Admin" };
    } else if (!authenticated) {
      status = 401;
      payload = { error: "Não autenticado" };
    } else if (url === "/api/auth/me") payload = { nome: "Admin" };
    else if (url === "/api/auth/logout") {
      authenticated = false;
      return { status: 204, ok: true };
    } else if (url === "/api/admin/modelos") payload = definitions;
    else if (url === "/api/admin-upload") payload = { url: "https://example.com/upload.webp" };
    else {
      const [table, id] = url.slice("/api/admin/".length).split("/");
      if (options.method === "PATCH") {
        const body = JSON.parse(options.body);
        if (table === "produtos") {
          saveBody = body;
          Object.assign(
            data.produtos[0],
            decodeProduct(validate("produtos", body, true)),
          );
        } else
          Object.assign(
            data[table].find((r) => r.id === Number(id)),
            body,
          );
        payload = { ok: true };
      } else payload = data[table];
    }
    return { status, ok: status < 400, json: async () => payload };
  };
  try {
    w.eval(
      fs.readFileSync("admin/overview.js", "utf8") +
        "\n" +
        fs.readFileSync("admin/app.js", "utf8"),
    );
    await flush();
    assert(d.querySelector("#dashboard").hidden);
    d.querySelector("#loginForm [name=email]").value = "admin@test.com";
    d.querySelector("#loginForm [name=password]").value = "test-password";
    d.querySelector("#loginForm").dispatchEvent(
      new w.Event("submit", { cancelable: true }),
    );
    await flush();
    assert(
      !d.querySelector("#dashboard").hidden,
      d.querySelector("#loginMessage").textContent,
    );
    assert(
      d.querySelector("#view").textContent.includes("Produtos no cardápio"),
    );
    for (const page of [
      "charts",
      "menu",
      "categories",
      "sections",
      "content",
      "gallery",
      "events",
      "reviews",
      "settings",
      "numbers",
    ]) {
      d.querySelector(`[data-page="${page}"]`).click();
      assert(d.querySelector("#view").innerHTML.length > 50, page);
    }
    // Every image editor hides technical URLs and preserves required-image rules.
    for (const [pageName, key] of [["gallery", "imagem_url"], ["sections", "imagem_url"], ["settings", "logo_url"]]) {
      d.querySelector(`[data-page="${pageName}"]`).click();
      d.querySelector("#createRecord").click();
      assert.equal(d.querySelector(`[name="${key}"]`).type, "hidden");
      assert(d.querySelector("#productPhotoPreview").hidden);
      assert(!d.querySelector("#productPhotoPreview").hasAttribute("src"));
      if (pageName !== "sections") {
        d.querySelector("#editorForm").dispatchEvent(new w.Event("submit", { cancelable: true }));
        await flush();
        assert(d.querySelector("#editorError").textContent.includes("imagem"));
        assert(d.querySelector("#editor").open);
      }
      const upload = d.querySelector("#imageUpload");
      Object.defineProperty(upload, "files", { value: [new w.File(["image"], "photo.webp", { type: "image/webp" })] });
      upload.dispatchEvent(new w.Event("change", { bubbles: true }));
      assert(d.querySelector('#editorForm [type="submit"]').disabled);
      await flush();
      assert.equal(d.querySelector(`[name="${key}"]`).value, "https://example.com/upload.webp");
      assert(!d.querySelector("#productPhotoPreview").hidden);
      assert(!d.querySelector('#editorForm [type="submit"]').disabled);
      d.querySelector("#removeProductPhoto").hidden = false;
      d.querySelector("#removeProductPhoto").click();
      assert.equal(d.querySelector(`[name="${key}"]`).value, "");
      d.querySelector("#cancelEditor").click();
    }
    d.querySelector('[data-page="charts"]').click();
    assert.equal(d.querySelectorAll(".chart-grid .panel").length, 4);
    d.querySelector("#period").value = "7";
    d.querySelector("#period").dispatchEvent(
      new w.Event("change", { bubbles: true }),
    );
    assert(d.querySelector("#view").textContent.includes("7 dias"));
    d.querySelector('[data-page="menu"]').click();
    d.querySelector('[data-edit="1"]').click();
    assert(d.querySelector("#editor").open);
    assert.equal(d.querySelectorAll('[data-kind="variacoes"]').length, 2);
    assert.equal(d.querySelectorAll("[name=day]:checked").length, 2);
    d.querySelector('[data-kind="variacoes"] [data-detail-price]').value = "87";
    d.querySelector("#editorForm").dispatchEvent(
      new w.Event("submit", { bubbles: true, cancelable: true }),
    );
    await flush();
    assert.equal(saveBody.variacoes[0].preco, 87);
    assert.deepEqual(saveBody.dias_disponiveis, [3, 6]);
    assert.equal(data.produtos[0].preco, 87);
    assert(!d.querySelector("#editor").open);
    d.querySelector('[data-page="reviews"]').click();
    d.querySelector('[data-status="aprovada"]').click();
    await flush();
    assert.equal(data.avaliacoes[0].status, "aprovada");
    assert.equal(d.querySelector("#pendingBadge").textContent, "0");
    assert.equal(w.localStorage.length, 0);
    d.querySelector("#logout").click();
    await flush();
    assert(d.querySelector("#dashboard").hidden);
  } finally {
    dom.window.close();
  }
});
test("Site renders API variants, additional prices and availability", () => {
  const dom = new JSDOM(fs.readFileSync("index.html", "utf8"), {
    url: "http://localhost:3000/",
    runScripts: "outside-only",
  });
  const w = dom.window,
    d = w.document;
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  try {
    w.eval(fs.readFileSync("assets/js/cardapio-data.js", "utf8"));
    w.eval(fs.readFileSync("assets/js/cardapio.js", "utf8"));
    w.updateBotecoMenu({
      categorias: [{ id: 1, nome: "Pratos" }],
      produtos: [{ id: 1, ...validProduct }],
      estabelecimento: { whatsapp: "5511940068689" },
    });
    assert(d.querySelector(".menu-price").textContent.includes("85,00"));
    d.querySelector('[data-product="1"]').click();
    const text = d.querySelector("#productContent").textContent;
    for (const label of [
      "Média",
      "Grande",
      "95,00",
      "quarta",
      "sábado",
      "Extra",
      "5,00",
      "Acompanhamento",
    ])
      assert(text.includes(label), label);
  } finally {
    dom.window.close();
  }
});

test('Catalog import is idempotent, preserves existing entries and rolls back on failure', async () => {
  const { importCatalog } = require('../server/import-catalog');
  const categories=new Map(),products=new Set();let commits=0,rollbacks=0,releases=0,fail=false;
  const conn={async beginTransaction(){},async commit(){commits++},async rollback(){rollbacks++},release(){releases++},async query(sql,values){
    if(fail)throw Error('Falha simulada');
    if(sql.startsWith('SELECT id FROM categorias'))return categories.has(values[0])?[{id:categories.get(values[0])}]:[];
    if(sql.startsWith('INSERT INTO categorias')){const id=categories.size+1;categories.set(values[1],id);return{insertId:id}}
    if(sql.startsWith('SELECT id FROM produtos'))return products.has(values[0])?[{id:1}]:[];
    if(sql.startsWith('INSERT INTO produtos')){products.add(values.at(-1));return{insertId:products.size}}
    throw Error('Unexpected query: '+sql);
  }};
  const db={async getConnection(){return conn}};
  assert.equal((await importCatalog(db)).created,78);assert.equal(products.size,78);assert.equal(categories.size,8);
  assert.equal((await importCatalog(db)).created,0);assert.equal(commits,2);assert.equal(releases,2);
  fail=true;await assert.rejects(importCatalog(db));assert.equal(rollbacks,1);assert.equal(releases,3);
});
