const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const { validate } = require("./validation");
async function importCatalog(db, replace = false, sharedConnection = null) {
  const sandbox = { window: {} };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "../assets/js/cardapio-data.js"), "utf8"),
    sandbox,
  );
  const { categories, products } = JSON.parse(
    JSON.stringify(sandbox.window.BOTECO_MENU),
  );
  const conn = sharedConnection || (await db.getConnection());
  let created = 0;
  try {
    if (!sharedConnection) await conn.beginTransaction();
    const cats = {};
    for (const [ordem, c] of categories.entries()) {
      const rows = await conn.query("SELECT id FROM categorias WHERE slug=?", [
        c.id,
      ]);
      cats[c.id] =
        rows[0]?.id ||
        (
          await conn.query(
            "INSERT INTO categorias(nome,slug,ordem,ativo) VALUES(?,?,?,1)",
            [c.name, c.id, ordem],
          )
        ).insertId;
    }
    for (const [ordem, p] of products.entries()) {
      if (
        (
          await conn.query("SELECT id FROM produtos WHERE codigo_cardapio=?", [
            p.id,
          ])
        ).length
      )
        continue;
      const featured = ["baiao-especial", "feijoada", "torresmo"];
      const data = validate("produtos", {
        categoria_id: cats[p.category],
        nome: p.name,
        descricao: p.description,
        preco: p.variants[0].price,
        imagem_url: null,
        imagem_alt: null,
        destaque: featured.includes(p.id),
        selo: p.availability || null,
        ordem,
        ordem_destaque: Math.max(0, featured.indexOf(p.id)),
        ativo: true,
        variacoes: p.variants.map((v) => ({ nome: v.name, preco: v.price })),
        adicionais: p.addons.map((a) => ({ nome: a.name, preco: a.price })),
        opcoes: p.options.map((o) => ({ nome: o.name, valores: o.values })),
        dias_disponiveis: p.days,
      });
      data.codigo_cardapio = p.id;
      const keys = Object.keys(data);
      await conn.query(
        `INSERT INTO produtos (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
        Object.values(data),
      );
      created++;
    }
    if (replace)
      await conn.query(
        "UPDATE produtos SET ativo=0,destaque=0 WHERE codigo_cardapio IS NULL",
      );
    if (!sharedConnection) await conn.commit();
    return { created };
  } catch (e) {
    if (!sharedConnection) await conn.rollback();
    throw e;
  } finally {
    if (!sharedConnection) conn.release();
  }
}
module.exports = { importCatalog };
if (require.main === module) {
  const db = require("./db");
  importCatalog(db, process.argv.includes("--replace-menu"))
    .then((r) =>
      console.log(
        `${r.created} produtos importados; cadastros já importados foram preservados.`,
      ),
    )
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    })
    .finally(() => db.end());
}
