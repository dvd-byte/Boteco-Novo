const { test, after } = require("node:test"),
  assert = require("node:assert/strict"),
  sharp = require("sharp");
const db = require("../server/db"),
  app = require("../server/app"),
  { createStorage } = require("../server/storage");
let server;
after(async () => {
  if (server) await new Promise((r) => server.close(r));
  await db.end();
});
test("S3 simulado + MariaDB real: upload, associação, reinício limpo, troca e falha preservam referências", async () => {
  const objects = new Map();
  let fail = false;
  const client = {
    async send(cmd) {
      if (fail) throw Error("AccessDenied");
      const i = cmd.input;
      if (cmd.constructor.name === "PutObjectCommand") {
        if (objects.has(i.Key)) throw { $metadata: { httpStatusCode: 412 } };
        objects.set(i.Key, { body: Buffer.from(i.Body), metadata: i.Metadata });
        return {};
      }
      if (cmd.constructor.name === "HeadObjectCommand") {
        const o = objects.get(i.Key);
        if (!o) throw Error("NotFound");
        return { Metadata: o.metadata, ContentLength: o.body.length };
      }
    },
  };
  const env = {
    NODE_ENV: "production",
    STORAGE_PROVIDER: "s3",
    STORAGE_ENDPOINT: "https://s3.example.test",
    STORAGE_REGION: "auto",
    STORAGE_BUCKET: "isolated-test",
    STORAGE_ACCESS_KEY_ID: "test",
    STORAGE_SECRET_ACCESS_KEY: "test",
    STORAGE_PUBLIC_BASE_URL: "https://images.example.test",
    UPLOAD_DIR: "does-not-exist",
  };
  const start = async () => {
    app.locals.storage = createStorage(env, client);
    server = app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    return "http://127.0.0.1:" + server.address().port;
  };
  let base = await start(),
    cookie,
    product,
    category;
  const call = (route, method = "GET", body) =>
    fetch(base + route, {
      method,
      headers: {
        Origin: process.env.PUBLIC_ORIGIN,
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  try {
    let r = await call("/api/auth/login", "POST", {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    });
    assert.equal(r.status, 200);
    cookie = r.headers.get("set-cookie").split(";")[0];
    category = (
      await db.query(
        "INSERT INTO categorias(nome,slug,ativo) VALUES('Storage test',?,1)",
        ["storage-" + Date.now()],
      )
    ).insertId;
    product = (
      await db.query(
        "INSERT INTO produtos(categoria_id,nome,descricao,preco,ativo) VALUES(?,'Storage test','Test',1,1)",
        [category],
      )
    ).insertId;
    const upload = async (color) => {
      const b = await sharp({
        create: { width: 2, height: 2, channels: 3, background: color },
      })
        .png()
        .toBuffer();
      const form = new FormData();
      form.append("imagem", new Blob([b], { type: "image/png" }), "image.png");
      return fetch(base + "/api/admin-upload", {
        method: "POST",
        headers: { Origin: process.env.PUBLIC_ORIGIN, Cookie: cookie },
        body: form,
      });
    };
    r = await upload("red");
    assert.equal(r.status, 201);
    const first = (await r.json()).url;
    assert.equal(
      (
        await call("/api/admin/produtos/" + product, "PATCH", {
          imagem_url: first,
        })
      ).status,
      200,
    );
    await new Promise((r) => server.close(r));
    base = await start();
    const row = await (await call("/api/public/produtos/" + product)).json();
    assert.equal(row.imagem_url, first);
    assert.ok(objects.get(first.split("/").slice(-2).join("/")).body.length);
    r = await upload("blue");
    assert.equal(r.status, 201);
    const second = (await r.json()).url;
    assert.equal(
      (
        await call("/api/admin/produtos/" + product, "PATCH", {
          imagem_url: second,
        })
      ).status,
      200,
    );
    assert.equal(objects.size, 2);
    fail = true;
    assert.equal((await upload("green")).status, 503);
    assert.equal(
      (
        await call("/api/admin/produtos/" + product, "PATCH", {
          imagem_url: first,
        })
      ).status,
      503,
    );
    const [saved] = await db.query(
      "SELECT imagem_url FROM produtos WHERE id=?",
      [product],
    );
    assert.equal(saved.imagem_url, second);
  } finally {
    if (product) await db.query("DELETE FROM produtos WHERE id=?", [product]);
    if (category)
      await db.query("DELETE FROM categorias WHERE id=?", [category]);
    if (cookie)
      await db.query("DELETE FROM sessoes WHERE token_hash=?", [
        require("../server/auth").digest(cookie.split("=")[1]),
      ]);
  }
});
