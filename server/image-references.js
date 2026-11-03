const targets = [
  ["produtos", "imagem_url"],
  ["fotos", "imagem_url"],
  ["secoes", "imagem_url"],
  ["estabelecimento", "logo_url"],
];
async function references(db) {
  const rows = [];
  for (const [table, column] of targets)
    for (const row of await db.query(
      `SELECT id,${column} AS url FROM ${table} WHERE ${column} IS NOT NULL AND ${column}<>''`,
    ))
      rows.push({ table, column, ...row });
  return rows;
}
module.exports = { targets, references };
