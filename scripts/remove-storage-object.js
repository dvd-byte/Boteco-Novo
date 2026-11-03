// Offline maintenance only: stop every writer before executing --delete.
require("dotenv").config({ quiet: true });
const db = require("../server/db"),
  { references } = require("../server/image-references"),
  { getStorage } = require("../server/storage");
(async () => {
  try {
    const storage = getStorage();
    if (storage.provider !== "s3") throw Error("Requer armazenamento S3");
    const key = process.argv[2];
    if (!/^images\/[a-f0-9]{64}\.webp$/.test(key || ""))
      throw Error("Informe uma chave images/<sha256>.webp");
    const url = storage.base + "/" + key;
    const used = (await references(db)).filter((r) => r.url === url);
    console.log(
      JSON.stringify({
        key,
        references: used.map((r) => ({ table: r.table, id: r.id })),
      }),
    );
    if (used.length) throw Error("Objeto ainda associado; remoção bloqueada");
    if (process.argv.includes("--delete")) {
      if (process.env.STORAGE_OFFLINE_MAINTENANCE !== "true")
        throw Error(
          "Pare todos os processos que gravam e configure STORAGE_OFFLINE_MAINTENANCE=true",
        );
      await storage.remove(key);
      console.log("Objeto removido");
    } else console.log("Simulação: nenhuma exclusão executada");
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();
