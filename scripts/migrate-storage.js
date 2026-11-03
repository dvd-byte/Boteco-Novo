// Default: inventory only. --apply uploads and changes references with compare-and-swap.
require("dotenv").config({ quiet: true });
const fs = require("node:fs/promises"),
  path = require("node:path"),
  db = require("../server/db"),
  { references, targets } = require("../server/image-references"),
  { getStorage } = require("../server/storage"),
  validateMedia = require("../server/media");
(async () => {
  let conn;
  try {
    const refs = await references(db);
    if (process.argv.includes("--rollback")) {
      const file = process.argv[process.argv.indexOf("--rollback") + 1];
      const manifest = JSON.parse(await fs.readFile(file, "utf8"));
      conn = await db.getConnection();
      await conn.beginTransaction();
      for (const r of manifest) {
        if (!targets.some(([t, c]) => t === r.table && c === r.column))
          throw Error("Manifesto inválido");
        await conn.query(
          `UPDATE ${r.table} SET ${r.column}=? WHERE id=? AND ${r.column}=?`,
          [r.old, r.id, r.url],
        );
      }
      await conn.commit();
      console.log("Referências elegíveis revertidas; arquivos preservados.");
      return;
    }
    const local = refs.filter(
      (r) => r.url.startsWith("/uploads/") || r.url.startsWith("imagens/"),
    );
    const mapping = new Map();
    const manifest = [];
    const apply = process.argv.includes("--apply");
    const storage = apply ? getStorage() : null;
    if (apply && storage.provider !== "s3")
      throw Error("Migração exige STORAGE_PROVIDER=s3");
    for (const r of local) {
      try {
        await validateMedia({ imagem_url: r.url });
        console.log(
          JSON.stringify({
            table: r.table,
            id: r.id,
            url: r.url,
            status: apply ? "migrando" : "disponivel",
          }),
        );
        if (apply) {
          if (!mapping.has(r.url)) {
            const source = r.url.startsWith("/uploads/")
              ? path.join(process.env.UPLOAD_DIR || "uploads", r.url.slice(9))
              : r.url;
            mapping.set(
              r.url,
              (await storage.put(await fs.readFile(decodeURIComponent(source))))
                .url,
            );
          }
          manifest.push({ ...r, old: r.url, url: mapping.get(r.url) });
        }
      } catch {
        console.log(
          JSON.stringify({
            table: r.table,
            id: r.id,
            status: "falha_arquivo_ou_storage",
          }),
        );
        if (apply) throw Error("Migração interrompida; banco não alterado");
      }
    }
    if (!apply) return;
    await fs.mkdir(".data", { recursive: true });
    const file = ".data/storage-migration-" + Date.now() + ".json";
    await fs.writeFile(file, JSON.stringify(manifest, null, 2), {
      flag: "wx",
      mode: 0o600,
    });
    conn = await db.getConnection();
    await conn.beginTransaction();
    for (const r of manifest) {
      const result = await conn.query(
        `UPDATE ${r.table} SET ${r.column}=? WHERE id=? AND ${r.column}=?`,
        [r.url, r.id, r.old],
      );
      if (result.affectedRows !== 1)
        throw Error(
          "Registro alterado durante a migração; transação cancelada",
        );
    }
    await conn.commit();
    console.log(
      "Migração concluída. Preserve fora da aplicação o manifesto: " + file,
    );
  } catch (e) {
    if (conn) await conn.rollback();
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    if (conn) conn.release();
    await db.end();
  }
})();
