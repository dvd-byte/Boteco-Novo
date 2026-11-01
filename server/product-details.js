// Product detail validation is shared by the API and catalog importer.
const fields = ["variacoes", "adicionais", "opcoes", "dias_disponiveis"];
function invalid(message) {
  const e = Error(message);
  e.status = 400;
  throw e;
}
function text(value, label, max = 160) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    invalid(label + " inválido");
  return value.trim();
}
function price(value, nullable = false) {
  if (value === null && nullable) return null;
  if (
    !["string", "number"].includes(typeof value) ||
    !/^\d{1,8}(\.\d{1,2})?$/.test(String(value))
  )
    invalid("Preço inválido");
  return Number(value);
}
function validateDetail(key, value) {
  if (!Array.isArray(value) || value.length > 50)
    invalid(key + " deve ser uma lista de até 50 itens");
  if (key === "dias_disponiveis") {
    if (
      value.some((d) => !Number.isInteger(d) || d < 0 || d > 6) ||
      new Set(value).size !== value.length
    )
      invalid("Dias inválidos");
    return value;
  }
  const result = value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item))
      invalid(key + " inválido");
    const nome = text(item.nome, "Nome");
    if (key === "opcoes") {
      if (
        !Array.isArray(item.valores) ||
        !item.valores.length ||
        item.valores.length > 50
      )
        invalid("Informe as opções do grupo");
      return { nome, valores: item.valores.map((v) => text(v, "Opção")) };
    }
    return { nome, preco: price(item.preco, key === "variacoes") };
  });
  if (new Set(result.map((v) => v.nome.toLowerCase())).size !== result.length)
    invalid("Nomes repetidos em " + key);
  return result;
}
function decodeProduct(row) {
  const result = { ...row };
  for (const key of fields) {
    const value = row[key];
    result[key] = typeof value === "string" ? JSON.parse(value) : value || [];
  }
  return result;
}
module.exports = { fields, validateDetail, decodeProduct };
