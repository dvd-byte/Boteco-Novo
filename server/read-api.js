const { decodeProduct } = require("./product-details");
const { fail } = require("./validation");
function integer(value, fallback, max = 2147483647) {
  if (value === undefined) return fallback;
  if (
    typeof value !== "string" ||
    !/^\d+$/.test(value) ||
    Number(value) < 1 ||
    Number(value) > max
  )
    fail("Parâmetro numérico inválido");
  return Number(value);
}
module.exports = function (app, db, auth, wrap) {
  app.get(
    "/api/public/categorias",
    wrap(async (req, res) =>
      res.json(
        await db.query(
          "SELECT * FROM categorias WHERE ativo=1 ORDER BY ordem,id",
        ),
      ),
    ),
  );
  app.get(
    "/api/public/produtos",
    wrap(async (req, res) => {
      const page = integer(req.query.page, 1, 100000),
        limit = integer(req.query.limit, 24, 100),
        category = integer(req.query.categoria_id, null);
      const where =
        "p.ativo=1 AND c.ativo=1" + (category ? " AND p.categoria_id=?" : "");
      const args = category ? [category] : [];
      const [count] = await db.query(
        `SELECT COUNT(*) AS total FROM produtos p JOIN categorias c ON c.id=p.categoria_id WHERE ${where}`,
        args,
      );
      const rows = await db.query(
        `SELECT p.* FROM produtos p JOIN categorias c ON c.id=p.categoria_id WHERE ${where} ORDER BY p.ordem,p.id LIMIT ? OFFSET ?`,
        [...args, limit, (page - 1) * limit],
      );
      res.json({
        items: rows.map(decodeProduct),
        total: Number(count.total),
        page,
        limit,
      });
    }),
  );
  app.get(
    "/api/public/produtos/:id",
    wrap(async (req, res) => {
      const id = integer(req.params.id);
      const [row] = await db.query(
        "SELECT p.* FROM produtos p JOIN categorias c ON c.id=p.categoria_id WHERE p.id=? AND p.ativo=1 AND c.ativo=1",
        [id],
      );
      if (!row)
        return res.status(404).json({ error: "Produto não encontrado" });
      res.json(decodeProduct(row));
    }),
  );
  app.get(
    "/api/admin/indicadores",
    auth,
    wrap(async (req, res) => {
      res.set("Cache-Control", "no-store");
      const days = integer(req.query.dias, 30, 90);
      const [[products], [categories], [reviews], distribution, history] =
        await Promise.all([
          db.query(
            "SELECT COUNT(*) AS total,COALESCE(SUM(ativo=1),0) AS ativos,COALESCE(SUM(ativo=0),0) AS inativos FROM produtos",
          ),
          db.query("SELECT COUNT(*) AS total FROM categorias"),
          db.query(
            "SELECT COUNT(*) AS total,COALESCE(SUM(status='aprovada'),0) AS aprovadas,COALESCE(SUM(status='pendente'),0) AS pendentes,COALESCE(SUM(status='rejeitada'),0) AS rejeitadas,AVG(CASE WHEN status='aprovada' THEN nota END) AS media_aprovadas FROM avaliacoes",
          ),
          db.query(
            "SELECT c.id,c.nome,COUNT(p.id) AS total FROM categorias c LEFT JOIN produtos p ON p.categoria_id=c.id GROUP BY c.id,c.nome ORDER BY c.ordem,c.id",
          ),
          db.query(
            "SELECT DATE_FORMAT(criado_em,'%Y-%m-%d') AS dia,COUNT(*) AS total FROM avaliacoes WHERE criado_em>=DATE_SUB(CURRENT_DATE,INTERVAL ? DAY) GROUP BY dia ORDER BY dia",
            [days - 1],
          ),
        ]);
      res.json({
        produtos: products,
        categorias: categories,
        avaliacoes: reviews,
        produtos_por_categoria: distribution,
        avaliacoes_por_dia: history,
        periodo_dias: days,
      });
    }),
  );
};
