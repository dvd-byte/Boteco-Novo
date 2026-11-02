// Explicit local restoration drill; never targets an existing database.
require("dotenv").config({ quiet: true });
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  zlib = require("node:zlib"),
  { spawnSync } = require("node:child_process"),
  mariadb = require("mariadb");
const root = path.resolve(__dirname, "..");
function run(file, args, options = {}) {
  const r = spawnSync(file, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    ...options,
  });
  if (r.status !== 0) throw Error("Falha no comando " + path.basename(file));
  return r.stdout;
}
(async () => {
  if (
    process.env.DB_HOST !== "127.0.0.1" ||
    process.env.DB_PORT !== "3307" ||
    process.env.NODE_ENV === "production" ||
    !fs.existsSync(path.join(root, ".data/my.ini"))
  )
    throw Error(
      "Este ensaio requer a instância local isolada em 127.0.0.1:3307",
    );
  const scratch = fs.mkdtempSync(path.join(root, ".data/restore-drill-"));
  const cnf = path.join(scratch, "client.cnf");
  fs.writeFileSync(cnf, "[client]\nuser=root\nhost=127.0.0.1\nport=3307\n", {
    mode: 0o600,
  });
  const source = path.join(scratch, "uploads");
  fs.mkdirSync(source);
  fs.writeFileSync(
    path.join(source, "fixture.txt"),
    "upload-restoration-fixture",
  );
  const backupDir = path.join(scratch, "backups");
  const bash = "C:/Program Files/Git/bin/bash.exe",
    bin = "C:/Program Files/MariaDB 13.0/bin";
  const unix = (p) =>
    p
      .replaceAll("\\", "/")
      .replace(/^([A-Za-z]):/, (_, drive) => "/" + drive.toLowerCase());
  let conn,
    created = false;
  const restoreDB = "boteco_restore_" + crypto.randomBytes(6).toString("hex");
  try {
    run(bash, ["deploy/backup.sh"], {
      env: {
        ...process.env,
        PATH: bin + path.delimiter + process.env.PATH,
        BACKUP_CNF: unix(cnf),
        BACKUP_DIR: unix(backupDir),
        UPLOAD_DIR: unix(source),
        DB_NAME: process.env.DB_NAME,
      },
    });
    const backup = path.join(
      backupDir,
      fs.readdirSync(backupDir).find((n) => !n.startsWith(".")),
    );
    const checks = fs
      .readFileSync(path.join(backup, "SHA256SUMS"), "utf8")
      .trim()
      .split("\n");
    for (const line of checks) {
      const [hash, rawName] = line.trim().split(/\s+/);
      const name = rawName.replace(/^\*/, "");
      if (
        crypto
          .createHash("sha256")
          .update(fs.readFileSync(path.join(backup, name)))
          .digest("hex") !== hash
      )
        throw Error("Checksum inválido");
    }
    conn = await mariadb.createConnection({
      host: "127.0.0.1",
      port: 3307,
      user: "root",
      connectTimeout: 5000,
    });
    await conn.query("CREATE DATABASE " + restoreDB + " CHARACTER SET utf8mb4");
    created = true;
    run(
      path.join(bin, "mariadb.exe"),
      ["--defaults-extra-file=" + cnf, restoreDB],
      {
        input: zlib.gunzipSync(
          fs.readFileSync(path.join(backup, "database.sql.gz")),
        ),
      },
    );
    const [tables] = await conn.query(
      "SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema=?",
      [restoreDB],
    );
    if (Number(tables.total) < 10) throw Error("Tabelas ausentes");
    for (const table of [
      "produtos",
      "categorias",
      "fotos",
      "avaliacoes",
      "administradores",
      "sessoes",
      "secoes",
      "estabelecimento",
      "horarios_funcionamento",
      "intervalos_funcionamento",
    ]) {
      const [a] = await conn.query(
        "SELECT COUNT(*) AS total FROM `" + process.env.DB_NAME + "`." + table,
      );
      const [b] = await conn.query(
        "SELECT COUNT(*) AS total FROM " + restoreDB + "." + table,
      );
      if (a.total !== b.total) throw Error("Contagem divergente em " + table);
    }
    const restored = path.join(scratch, "restored-uploads");
    fs.mkdirSync(restored);
    run("tar", ["-xzf", path.join(backup, "uploads.tar.gz"), "-C", restored]);
    if (
      fs.readFileSync(path.join(restored, "fixture.txt"), "utf8") !==
      "upload-restoration-fixture"
    )
      throw Error("Upload divergente");
    console.log(
      "PASS: backup.sh, SHA256, restauração MariaDB (10 tabelas comparadas) e arquivo de upload.",
    );
  } finally {
    if (created) await conn.query("DROP DATABASE " + restoreDB);
    if (conn) await conn.end();
    fs.unlinkSync(cnf);
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
