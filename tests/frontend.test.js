const { test, after } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  { JSDOM } = require("jsdom");
const app = require("../server/app"),
  db = require("../server/db");
let server;
after(async () => {
  await db.end();
  if (server) await new Promise((r) => server.close(r));
});
test("Site renderiza dados reais da API e envia avaliação para moderação", async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = "http://127.0.0.1:" + server.address().port;
  const content = await (await fetch(base + "/api/public/conteudo")).json();
  let sent;
  const dom = new JSDOM(fs.readFileSync("index.html", "utf8"), {
    url: base,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const w = dom.window;
  w.IntersectionObserver = class {
    observe() {}
  };
  w.fetch = async (url, opts) => {
    if (opts) {
      sent = JSON.parse(opts.body);
      return {
        ok: true,
        json: async () => ({ message: "Avaliação enviada para moderação." }),
      };
    }
    return { ok: true, json: async () => content };
  };
  w.eval(fs.readFileSync("boteco.js", "utf8"));
  await w.eval(fs.readFileSync("cms.js", "utf8"));
  const d = w.document;
  assert.equal(
    d.querySelectorAll("#menuGrid .menu-card").length,
    content.produtos.length,
  );
  assert.equal(
    d.querySelectorAll(".filter-btn").length,
    content.categorias.length + 1,
  );
  assert.equal(d.querySelectorAll(".hour-card").length, 7);
  assert.equal(
    d.querySelectorAll(".gallery-item").length,
    content.fotos.filter((f) => f.grupo === "galeria").length,
  );
  assert.equal(
    d.querySelector(".hero").style.backgroundImage.includes("ambiente2.jpeg"),
    true,
  );
  d.querySelector('[data-rating="5"]').click();
  d.querySelector("#reviewName").value = "Visitante teste";
  d.querySelector("#reviewComment").value = "Uma experiência excelente";
  d.querySelector("#reviewForm").dispatchEvent(
    new w.Event("submit", { cancelable: true }),
  );
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(sent.nota, 5);
  assert.equal(sent.nome_cliente, "Visitante teste");
  assert.equal(
    d.querySelector('[role="status"]').textContent,
    "Avaliação enviada para moderação.",
  );
  assert.equal(w.localStorage.length, 0);
  dom.window.close();
});
