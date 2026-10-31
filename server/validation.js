const fail = (message) => {
  const e = Error(message);
  e.status = 400;
  throw e;
};
const definitions = {
  categorias: { nome: "text", slug: "slug", ordem: "int", ativo: "bool" },
  produtos: {
    categoria_id: "id",
    nome: "text",
    descricao: "long",
    preco: "price",
    imagem_url: "url",
    imagem_alt: "text",
    destaque: "bool",
    selo: "optional",
    ordem: "int",
    ordem_destaque: "int",
    ativo: "bool",
  },
  secoes: {
    chave: "slug",
    subtitulo: "optional",
    titulo: "text",
    descricao: "long",
    imagem_url: "url?",
    imagem_alt: "optional",
    botao_texto: "optional",
    botao_url: "url?",
  },
  fotos: {
    grupo: "group",
    imagem_url: "url",
    texto_alternativo: "text",
    legenda: "optional",
    link_url: "url?",
    ordem: "int",
    ativo: "bool",
  },
  estabelecimento: {
    nome: "text",
    descricao: "long",
    telefone: "text",
    whatsapp: "text",
    email: "optional",
    endereco: "text",
    numero: "text",
    complemento: "optional",
    bairro: "text",
    cidade: "text",
    estado: "state",
    cep: "text",
    maps_url: "url",
    maps_embed_url: "map",
    instagram_url: "url",
    facebook_url: "url?",
    logo_url: "url",
  },
  horarios_funcionamento: { dia_semana: "day", fechado: "bool" },
  intervalos_funcionamento: {
    horario_id: "id",
    abertura: "time",
    fechamento: "time",
    encerra_no_dia_seguinte: "bool",
  },
};
function safeUrl(s) {
  return (
    typeof s === "string" &&
    (/^https?:\/\/[^\s]+$/i.test(s) ||
      /^(?:\/uploads\/|imagens\/)[a-zA-Z0-9_%. /-]+$/.test(s))
  );
}
function validate(table, body, partial = false) {
  if (!Object.hasOwn(definitions, table)) fail("Recurso inválido");
  if (!body || typeof body !== "object" || Array.isArray(body))
    fail("Dados inválidos");
  const fields = definitions[table];
  if (!fields) fail("Recurso inválido");
  const out = {};
  for (const [key, type] of Object.entries(fields)) {
    let v = body[key];
    if (v === undefined) {
      if (partial) continue;
      if (["optional", "url?"].includes(type)) {
        out[key] = null;
        continue;
      }
      fail(`Campo obrigatório: ${key}`);
    }
    if (type === "bool") {
      if (![true, false, 0, 1].includes(v)) fail(key + " inválido");
      v = Number(v);
    } else if (["int", "id", "day"].includes(type)) {
      v = Number(v);
      if (
        !Number.isInteger(v) ||
        v < (type === "id" ? 1 : 0) ||
        v > 2147483647 ||
        (type === "day" && v > 6)
      )
        fail(key + " inválido");
    } else if (type === "price") {
      v = String(v);
      if (!/^\d{1,8}(\.\d{1,2})?$/.test(v)) fail("Preço inválido");
    } else {
      if (v == null && ["optional", "url?"].includes(type)) {
        out[key] = null;
        continue;
      }
      if (typeof v !== "string") fail(key + " inválido");
      v = v.trim();
      const limits = {
        categorias: { nome: 120, slug: 120 },
        produtos: { nome: 160, selo: 80 },
        secoes: { chave: 80, botao_texto: 120 },
        estabelecimento: {
          nome: 160,
          telefone: 30,
          whatsapp: 30,
          email: 190,
          numero: 20,
          complemento: 120,
          bairro: 120,
          cidade: 120,
          cep: 10,
        },
      };
      if (v.length > (limits[table]?.[key] || Infinity))
        fail(key + " muito longo");
      if (key === "email" && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
        fail("E-mail inválido");
      if (
        v.length >
        (["url", "url?", "map"].includes(type)
          ? 2048
          : type === "long"
            ? 10000
            : 255)
      )
        fail(key + " muito longo");
      if (!v && !["optional", "url?", "long"].includes(type))
        fail(key + " obrigatório");
      if (["url", "url?", "map"].includes(type) && v && !safeUrl(v))
        fail("URL inválida");
      if (
        type === "map" &&
        !/^https:\/\/(www\.)?google\.[a-z.]+\/maps\//.test(v)
      )
        fail("Use um endereço de incorporação do Google Maps");
      if (type === "slug" && !/^[a-z0-9_-]+$/.test(v))
        fail("Slug/chave inválido");
      if (type === "group" && !["galeria", "instagram"].includes(v))
        fail("Grupo inválido");
      if (type === "state" && !/^[A-Z]{2}$/.test(v)) fail("Estado inválido");
      if (type === "time" && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(v))
        fail("Horário inválido");
    }
    out[key] = v;
  }
  if (!Object.keys(out).length) fail("Nenhum campo informado");
  return out;
}
module.exports = { definitions, validate, fail };
