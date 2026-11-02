const { test, after } = require("node:test"),
  assert = require("node:assert/strict");
const app = require("../server/app"),
  db = require("../server/db");
let server, base, cookie;
const origin = process.env.PUBLIC_ORIGIN;
async function call(path, method = "GET", body, admin = false) {
  const r = await fetch(base + path, {
    method,
    headers: {
      Origin: origin,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(admin ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r;
}
after(async () => {
  if (cookie)
    await db.query("DELETE FROM sessoes WHERE token_hash=?", [
      require("../server/auth").digest(cookie.split("=")[1]),
    ]);
  await db.end();
  if (server) await new Promise((r) => server.close(r));
});
test("API integrada com MariaDB: autenticação, conteúdo, CRUD, vínculos e moderação", async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = "http://127.0.0.1:" + server.address().port;
  assert.equal((await call("/api/health")).status, 200);
  assert.equal((await call("/api/admin/produtos")).status, 401);
  assert.equal(
    (
      await fetch(base + "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
    ).status,
    403,
  );
  let r = await call("/api/auth/login", "POST", {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("set-cookie"), /HttpOnly/i);
  cookie = r.headers.get("set-cookie").split(";")[0];
  let content = await (await call("/api/public/conteudo")).json();
  assert.ok(content.produtos.length > 0);
  assert.equal(content.horarios.length, 7);
  assert.equal(
    content.avaliacoes.some((a) => "status" in a),
    false,
  );
  const suffix = Date.now();
  let cat, product, review;
  try {
    r = await call(
      "/api/admin/categorias",
      "POST",
      { nome: "Teste", slug: "teste-" + suffix, ordem: 0, ativo: 0 },
      true,
    );
    assert.equal(r.status, 201);
    cat = (await r.json()).id;
    const data = {
      categoria_id: cat,
      nome: "Produto teste",
      descricao: "Teste",
      preco: "10.50",
      imagem_url: "imagens/foto2.jpeg",
      imagem_alt: "Teste",
      destaque: true,
      selo: null,
      ordem: 0,
      ordem_destaque: 0,
      ativo: true,
    };
    assert.equal(
      (
        await call(
          "/api/admin/produtos",
          "POST",
          { ...data, preco: "-1" },
          true,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await call(
          "/api/admin/produtos",
          "POST",
          { ...data, imagem_url: "javascript:alert(1)" },
          true,
        )
      ).status,
      400,
    );
    r = await call("/api/admin/produtos", "POST", data, true);
    assert.equal(r.status, 201);
    product = (await r.json()).id;
    assert.equal(
      (
        await call(
          "/api/admin/produtos/" + product,
          "PATCH",
          { imagem_url: "/uploads/missing.png" },
          true,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await call(
          "/api/admin/produtos/" + product,
          "PATCH",
          { imagem_url: "/uploads/../.env" },
          true,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await call(
          "/api/admin/produtos/" + product,
          "PATCH",
          { imagem_url: null, imagem_alt: null },
          true,
        )
      ).status,
      200,
    );
    const [withoutImage] = await db.query(
      "SELECT imagem_url FROM produtos WHERE id=?",
      [product],
    );
    assert.equal(withoutImage.imagem_url, null);
    content = await (await call("/api/public/conteudo")).json();
    assert.ok(!content.produtos.some((p) => p.id === product));
    assert.equal(
      (await call("/api/admin/categorias/" + cat, "DELETE", null, true)).status,
      409,
    );
    assert.equal(
      (
        await call(
          "/api/admin/categorias/" + cat,
          "PATCH",
          { ativo: true },
          true,
        )
      ).status,
      200,
    );
    content = await (await call("/api/public/conteudo")).json();
    assert.equal(content.produtos.find((p) => p.id === product).preco, "10.50");
    assert.equal(
      (
        await call("/api/public/avaliacoes", "POST", {
          nome_cliente: "Teste",
          nota: 6,
          comentario: "Teste comentário",
          started_at: Date.now() - 5000,
        })
      ).status,
      400,
    );
    r = await call("/api/public/avaliacoes", "POST", {
      nome_cliente: "Teste " + suffix,
      nota: 5,
      comentario: "Teste de moderação",
      started_at: Date.now() - 5000,
    });
    assert.equal(r.status, 201);
    const [row] = await db.query(
      "SELECT * FROM avaliacoes WHERE nome_cliente=?",
      ["Teste " + suffix],
    );
    review = row.id;
    assert.equal(row.status, "pendente");
    content = await (await call("/api/public/conteudo")).json();
    assert.ok(!content.avaliacoes.some((a) => a.id === review));
    assert.equal(
      (
        await call(
          "/api/admin/avaliacoes/" + review,
          "PATCH",
          { status: "aprovada" },
          true,
        )
      ).status,
      200,
    );
    content = await (await call("/api/public/conteudo")).json();
    assert.ok(content.avaliacoes.some((a) => a.id === review));
    assert.equal(
      (
        await call(
          "/api/admin/avaliacoes/" + review,
          "PATCH",
          { status: "rejeitada" },
          true,
        )
      ).status,
      200,
    );
    content = await (await call("/api/public/conteudo")).json();
    assert.ok(!content.avaliacoes.some((a) => a.id === review));
    assert.equal((await call("/api/public/produtos?limit=2")).status, 200);
    const listing = await (await call("/api/public/produtos?limit=2")).json();
    assert.ok(listing.items.length <= 2);
    assert.ok(listing.total >= 1);
    assert.equal((await call("/api/public/produtos/" + product)).status, 200);
    assert.equal((await call("/api/public/produtos?limit=-1")).status, 400);
    assert.equal((await call("/api/admin/indicadores")).status, 401);
    const metrics = await (
      await call("/api/admin/indicadores", "GET", null, true)
    ).json();
    assert.ok(Number(metrics.produtos.total) >= 1);
    assert.equal(
      (
        await call("/api/auth/login", "POST", {
          email: process.env.ADMIN_EMAIL,
          password: "incorrect-password",
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await call("/api/admin/avaliacoes/" + review, "PATCH", {
          status: "aprovada",
        })
      ).status,
      401,
    );
    assert.equal((await call("/.env")).status, 404);
    assert.equal((await call("/server/db.js")).status, 404);
    const form = new FormData();
    form.append(
      "imagem",
      new Blob(["<svg/>"], { type: "image/svg+xml" }),
      "test.svg",
    );
    r = await fetch(base + "/api/admin-upload", {
      method: "POST",
      headers: { Origin: origin, Cookie: cookie },
      body: form,
    });
    assert.equal(r.status, 400);
    const image = await require("sharp")({
      create: { width: 2, height: 2, channels: 3, background: "#ffffff" },
    })
      .png()
      .toBuffer();
    const imageForm = new FormData();
    imageForm.append(
      "imagem",
      new Blob([image], { type: "image/png" }),
      "valid.png",
    );
    const uploaded = await fetch(base + "/api/admin-upload", {
      method: "POST",
      headers: { Origin: origin, Cookie: cookie },
      body: imageForm,
    });
    assert.equal(uploaded.status, 201);
    const { url } = await uploaded.json();
    try {
      assert.equal(
        (
          await call(
            "/api/admin/produtos/" + product,
            "PATCH",
            { imagem_url: url },
            true,
          )
        ).status,
        200,
      );
      assert.equal((await call(url)).status, 200);
    } finally {
      await require("node:fs/promises").unlink(
        require("node:path").resolve(
          process.env.UPLOAD_DIR || "uploads",
          url.split("/").pop(),
        ),
      );
    }
    assert.equal(
      (await call("/api/auth/logout", "POST", null, true)).status,
      204,
    );
    assert.equal((await call("/api/auth/me", "GET", null, true)).status, 401);
  } finally {
    if (review) await db.query("DELETE FROM avaliacoes WHERE id=?", [review]);
    if (product) await db.query("DELETE FROM produtos WHERE id=?", [product]);
    if (cat) await db.query("DELETE FROM categorias WHERE id=?", [cat]);
  }
});
