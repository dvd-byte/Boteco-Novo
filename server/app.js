const { decodeProduct } = require("./product-details");
require("dotenv").config();
const express = require("express"),
  helmet = require("helmet"),
  { rateLimit } = require("express-rate-limit"),
  multer = require("multer");
const fs = require("node:fs"),
  path = require("node:path"),
  { randomBytes } = require("node:crypto");
const db = require("./db"),
  { verify, digest } = require("./auth"),
  { definitions, validate, fail } = require("./validation");
const app = express(),
  root = path.resolve(__dirname, ".."),
  production = process.env.NODE_ENV === "production";
const origin = process.env.PUBLIC_ORIGIN || "http://localhost:3000";
if (production && !origin.startsWith("https://"))
  throw Error("PUBLIC_ORIGIN precisa usar HTTPS em produção");
app.set("trust proxy", Number(process.env.TRUST_PROXY || 0));
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdnjs.cloudflare.com",
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com",
        ],
        imgSrc: ["'self'", "https:", "data:"],
        frameSrc: ["https://www.google.com", "https://maps.google.com"],
        upgradeInsecureRequests: production ? [] : null,
      },
    },
  }),
);
app.use(express.json({ limit: "64kb" }));
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 180,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);
app.use("/api", (req, res, next) => {
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.get("origin") !== origin
  )
    return res.status(403).json({ error: "Origem não autorizada" });
  next();
});
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
require("./read-api")(app, db, auth, wrap);
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
const cookieName = production ? "__Host-boteco" : "boteco";
async function auth(req, res, next) {
  try {
    const token = (req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(cookieName + "="))
      ?.split("=")[1];
    if (!token) return res.status(401).json({ error: "Faça login" });
    const rows = await db.query(
      "SELECT a.id,a.nome,a.email FROM sessoes s JOIN administradores a ON a.id=s.administrador_id WHERE token_hash=? AND expira_em>NOW()",
      [digest(token)],
    );
    if (!rows.length) return res.status(401).json({ error: "Sessão expirada" });
    req.admin = rows[0];
    req.token = token;
    next();
  } catch (e) {
    next(e);
  }
}
app.get(
  "/api/health",
  wrap(async (req, res) => {
    await db.query("SELECT 1");
    res.json({ ok: true });
  }),
);
app.post(
  "/api/auth/login",
  rateLimit({ windowMs: 900000, limit: 10 }),
  wrap(async (req, res) => {
    const { email, password } = req.body || {};
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      password.length > 256
    )
      fail("Dados inválidos");
    const rows = await db.query("SELECT * FROM administradores WHERE email=?", [
      email.trim().toLowerCase(),
    ]);
    const valid = verify(
      password,
      rows[0]?.senha_hash || "0000000000000000:" + "00".repeat(64),
    );
    if (!valid) return res.status(401).json({ error: "Credenciais inválidas" });
    const token = randomBytes(32).toString("hex");
    await db.query("DELETE FROM sessoes WHERE expira_em<NOW()");
    await db.query(
      "INSERT INTO sessoes VALUES(?,?,DATE_ADD(NOW(), INTERVAL 8 HOUR))",
      [digest(token), rows[0].id],
    );
    res.cookie(cookieName, token, {
      httpOnly: true,
      secure: production,
      sameSite: "strict",
      path: "/",
      maxAge: 28800000,
    });
    res.json({ nome: rows[0].nome });
  }),
);
app.post(
  "/api/auth/logout",
  auth,
  wrap(async (req, res) => {
    await db.query("DELETE FROM sessoes WHERE token_hash=?", [
      digest(req.token),
    ]);
    res.clearCookie(cookieName, {
      path: "/",
      secure: production,
      sameSite: "strict",
      httpOnly: true,
    });
    res.sendStatus(204);
  }),
);
app.get("/api/auth/me", auth, (req, res) => res.json(req.admin));
app.get(
  "/api/public/conteudo",
  wrap(async (req, res) => {
    const [
      categorias,
      produtos,
      secoes,
      fotos,
      avaliacoes,
      info,
      horarios,
      intervalos,
    ] = await Promise.all([
      db.query("SELECT * FROM categorias WHERE ativo=1 ORDER BY ordem,id"),
      db.query(
        "SELECT p.* FROM produtos p JOIN categorias c ON c.id=p.categoria_id WHERE p.ativo=1 AND c.ativo=1 ORDER BY p.ordem,p.id",
      ),
      db.query("SELECT * FROM secoes"),
      db.query("SELECT * FROM fotos WHERE ativo=1 ORDER BY ordem,id"),
      db.query(
        "SELECT id,nome_cliente,nota,comentario,criado_em FROM avaliacoes WHERE status='aprovada' ORDER BY criado_em DESC LIMIT 100",
      ),
      db.query("SELECT * FROM estabelecimento WHERE id=1"),
      db.query("SELECT * FROM horarios_funcionamento ORDER BY dia_semana"),
      db.query("SELECT * FROM intervalos_funcionamento ORDER BY abertura"),
    ]);
    res.json({
      categorias,
      produtos: produtos.map(decodeProduct),
      secoes,
      fotos,
      avaliacoes,
      estabelecimento: info[0] || null,
      horarios: horarios.map((h) => ({
        ...h,
        intervalos: h.fechado
          ? []
          : intervalos.filter((i) => i.horario_id === h.id),
      })),
    });
  }),
);
app.post(
  "/api/public/avaliacoes",
  rateLimit({ windowMs: 3600000, limit: 5 }),
  wrap(async (req, res) => {
    const { nome_cliente, nota, comentario, website, started_at } =
      req.body || {};
    if (
      website ||
      !Number.isFinite(started_at) ||
      Date.now() - started_at < 3000 ||
      Date.now() - started_at > 86400000
    )
      fail("Envio inválido. Recarregue a página e tente novamente.");
    if (
      typeof nome_cliente !== "string" ||
      nome_cliente.trim().length < 2 ||
      nome_cliente.length > 120 ||
      typeof comentario !== "string" ||
      comentario.trim().length < 5 ||
      comentario.length > 1500 ||
      !Number.isInteger(nota) ||
      nota < 1 ||
      nota > 5
    )
      fail("Confira nome, comentário e nota de 1 a 5");
    await db.query(
      "INSERT INTO avaliacoes(nome_cliente,nota,comentario) VALUES(?,?,?)",
      [nome_cliente.trim(), nota, comentario.trim()],
    );
    res.status(201).json({ message: "Avaliação enviada para moderação." });
  }),
);
app.use("/api/admin", auth, (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.post(
  "/api/admin/importar-cardapio",
  wrap(async (req, res) => {
    if (typeof req.body?.replace !== "boolean")
      fail("Confirme o modo de importação");
    const { importCatalog } = require("./import-catalog");
    res.json(await importCatalog(db, req.body.replace));
  }),
);
app.get("/api/admin/modelos", (req, res) => res.json(definitions));
app.get(
  "/api/admin/avaliacoes",
  wrap(async (req, res) =>
    res.json(
      await db.query("SELECT * FROM avaliacoes ORDER BY criado_em DESC"),
    ),
  ),
);
app.patch(
  "/api/admin/avaliacoes/:id",
  wrap(async (req, res) => {
    if (!["aprovada", "rejeitada", "pendente"].includes(req.body?.status))
      fail("Status inválido");
    const r = await db.query(
      "UPDATE avaliacoes SET status=?,moderado_em=NOW(),moderado_por=? WHERE id=?",
      [req.body.status, req.admin.id, req.params.id],
    );
    if (!r.affectedRows) return res.sendStatus(404);
    res.json({ ok: true });
  }),
);
app.get(
  "/api/admin/:table",
  wrap(async (req, res) => {
    if (!Object.hasOwn(definitions, req.params.table))
      return res.sendStatus(404);
    const rows = await db.query(
      `SELECT * FROM ${req.params.table} ORDER BY id`,
    );
    res.json(req.params.table === "produtos" ? rows.map(decodeProduct) : rows);
  }),
);
app.post(
  "/api/admin/:table",
  wrap(async (req, res) => {
    const table = req.params.table,
      data = validate(table, req.body);
    await require("./media")(data, app.locals.storage);
    if (table === "estabelecimento") data.id = 1;
    const keys = Object.keys(data);
    const r = await db.query(
      `INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
      Object.values(data),
    );
    res.status(201).json({ id: r.insertId });
  }),
);
app.patch(
  "/api/admin/:table/:id",
  wrap(async (req, res) => {
    const table = req.params.table,
      data = validate(table, req.body, true);
    await require("./media")(data, app.locals.storage);
    if (table === "intervalos_funcionamento") {
      const [old] = await db.query(
        "SELECT * FROM intervalos_funcionamento WHERE id=?",
        [req.params.id],
      );
      const v = { ...old, ...data };
      if (!v.encerra_no_dia_seguinte && v.fechamento <= v.abertura)
        fail("Fechamento deve ser posterior à abertura");
    }
    const r = await db.query(
      `UPDATE ${table} SET ${Object.keys(data)
        .map((k) => k + "=?")
        .join(",")} WHERE id=?`,
      [...Object.values(data), req.params.id],
    );
    if (!r.affectedRows) return res.sendStatus(404);
    res.json({ ok: true });
  }),
);
app.delete(
  "/api/admin/:table/:id",
  wrap(async (req, res) => {
    const table = req.params.table;
    if (!Object.hasOwn(definitions, table) || table === "estabelecimento")
      fail("Exclusão não permitida");
    const r = await db.query(`DELETE FROM ${table} WHERE id=?`, [
      req.params.id,
    ]);
    if (!r.affectedRows) return res.sendStatus(404);
    res.sendStatus(204);
  }),
);
const uploadDir = path.resolve(
  process.env.UPLOAD_DIR || path.join(root, "uploads"),
);
app.locals.storage = require("./storage").getStorage();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});
app.post(
  "/api/admin-upload",
  auth,
  upload.single("imagem"),
  wrap(async (req, res) => {
    const b = req.file?.buffer;
    if (!b) fail("Selecione uma imagem");
    const result = await app.locals.storage.put(b);
    res.status(201).json({ url: result.url });
  }),
);
app.use(
  "/uploads",
  express.static(uploadDir, { maxAge: "7d", dotfiles: "deny" }),
);
app.use("/admin", (req, res, next) => { res.set("X-Robots-Tag", "noindex, nofollow"); next(); });
app.get("/index.html", (req, res) => res.redirect(301, "/"));
app.get("/images/heronova2.jpg", (req, res) => res.sendFile(path.join(root, "imagens", "heronova2.jpg")));
app.use("/admin", express.static(path.join(root, "admin")));
app.use("/imagens", express.static(path.join(root, "imagens")));
for (const file of [
  "index.html",
  "robots.txt",
  "sitemap.xml",
  "assets/css/boteco.css",
  "assets/css/identity.css",
  "assets/css/vintage.css",
  "assets/js/boteco.js",
  "assets/js/cardapio-data.js",
  "assets/js/cardapio.js",
  "assets/js/cms.js",
])
  app.get(file === "index.html" ? "/" : "/" + file, (req, res) =>
    res.sendFile(path.join(root, file)),
  );
app.use((err, req, res, next) => {
  console.error({
    event: "request_failed",
    code: err.code || err.type || "REQUEST_ERROR",
  });
  const conflict = [
    "ER_DUP_ENTRY",
    "ER_ROW_IS_REFERENCED_2",
    "ER_NO_REFERENCED_ROW_2",
  ].includes(err.code);
  res
    .status(
      err.status ||
        (conflict ? 409 : err.code?.startsWith("LIMIT_") ? 400 : 500),
    )
    .json({
      error: conflict
        ? "Registro duplicado ou vínculo inválido. Transfira/remova os produtos antes de excluir uma categoria."
        : err.status
          ? err.type === "entity.parse.failed"
            ? "JSON inválido"
            : err.message
          : err.code?.startsWith("LIMIT_")
            ? "Arquivo excede o limite de 5 MB"
            : "Não foi possível concluir a operação",
    });
});
if (require.main === module)
  app.listen(Number(process.env.PORT || 3000), "0.0.0.0", () =>
    console.log("Boteco API iniciada na porta " + (process.env.PORT || 3000)),
  );
module.exports = app;
