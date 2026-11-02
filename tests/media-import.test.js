const { test, after } = require("node:test"),
  assert = require("node:assert/strict");
const app = require("../server/app"),
  db = require("../server/db"),
  { importCatalog } = require("../server/import-catalog");
let server;
after(async () => {
  await db.end();
  if (server) await new Promise((r) => server.close(r));
});
test("MariaDB: importação repetida preserva registros e transação de teste é revertida", async () => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await importCatalog(db, false, conn);
    const [before] = await conn.query("SELECT COUNT(*) AS total FROM produtos");
    const result = await importCatalog(db, false, conn);
    const [after] = await conn.query("SELECT COUNT(*) AS total FROM produtos");
    assert.equal(result.created, 0);
    assert.equal(before.total, after.total);
    const [duplicates] = await conn.query(
      "SELECT COUNT(*) AS total FROM (SELECT codigo_cardapio FROM produtos WHERE codigo_cardapio IS NOT NULL GROUP BY codigo_cardapio HAVING COUNT(*)>1) d",
    );
    assert.equal(Number(duplicates.total), 0);
  } finally {
    await conn.rollback();
    conn.release();
  }
});
test("MariaDB: galeria e Instagram manuais filtram publicação e ordenam corretamente", async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = "http://127.0.0.1:" + server.address().port;
  const ids = [];
  try {
    for (const [grupo, ativo, ordem] of [
      ["galeria", 1, 20],
      ["galeria", 1, 10],
      ["instagram", 1, 30],
      ["instagram", 0, 0],
    ]) {
      const r = await db.query(
        "INSERT INTO fotos(grupo,imagem_url,texto_alternativo,ordem,ativo) VALUES(?,?,?,?,?)",
        [grupo, "imagens/foto2.jpeg", "Teste isolado", ordem, ativo],
      );
      ids.push(r.insertId);
    }
    const r = await fetch(base + "/api/public/conteudo");
    assert.equal(r.status, 200);
    const data = await r.json();
    const fixtures = data.fotos.filter((f) => ids.includes(f.id));
    assert.deepEqual(
      fixtures.map((f) => f.id),
      [ids[1], ids[0], ids[2]],
    );
    assert.ok(fixtures.every((f) => f.imagem_url === "imagens/foto2.jpeg"));
    assert.equal((await fetch(base + "/imagens/foto2.jpeg")).status, 200);
  } finally {
    for (const id of ids) await db.query("DELETE FROM fotos WHERE id=?", [id]);
  }
});
