const fs = require("node:fs");
const path = require("node:path");
const db = require("./db");
const { hash } = require("./auth");
(async () => {
  try {
    for (const sql of fs
      .readFileSync(path.join(__dirname, "schema.sql"), "utf8")
      .split(";")
      .filter((s) => s.trim()))
      await db.query(sql);
    if (process.argv.includes("--admin")) {
      const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
      if (!ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12)
        throw Error(
          "Defina ADMIN_NAME, ADMIN_EMAIL e ADMIN_PASSWORD (mínimo 12 caracteres) no ambiente.",
        );
      await db.query(
        "INSERT INTO administradores(nome,email,senha_hash) VALUES(?,?,?)",
        [
          ADMIN_NAME || "Administrador",
          ADMIN_EMAIL.toLowerCase(),
          hash(ADMIN_PASSWORD),
        ],
      );
      console.log("Administrador criado.");
    }
    console.log("Schema atualizado.");
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();
