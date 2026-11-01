const fs = require("node:fs"),
  cheerio = require("cheerio"),
  db = require("./db");
// Initial photos retained from the original site; no duplicate HTML snapshot needed.
const initialPhotos = [
  {
    grupo: "galeria",
    imagem_url: "imagens/ambiente1.jpeg",
    texto_alternativo: "Ambiente principal do Boteco da Vila",
    ordem: 0,
  },
  {
    grupo: "galeria",
    imagem_url: "imagens/ambiente2.jpeg",
    texto_alternativo: "Ambiente do Boteco da Vila",
    ordem: 1,
  },
  {
    grupo: "galeria",
    imagem_url: "imagens/ambiente-3.jpeg",
    texto_alternativo: "Ambiente do Boteco da Vila",
    ordem: 2,
  },
  {
    grupo: "galeria",
    imagem_url: "imagens/ambiente-4.jpeg",
    texto_alternativo: "Ambiente do Boteco da Vila",
    ordem: 3,
  },
  {
    grupo: "galeria",
    imagem_url: "imagens/ambiente1.jpeg",
    texto_alternativo: "Ambiente do Boteco da Vila",
    ordem: 4,
  },
  {
    grupo: "instagram",
    imagem_url: "imagens/foto-1.jpeg",
    texto_alternativo: "Instagram 1",
    ordem: 0,
  },
  {
    grupo: "instagram",
    imagem_url: "imagens/foto-3.jpeg",
    texto_alternativo: "Instagram 2",
    ordem: 1,
  },
  {
    grupo: "instagram",
    imagem_url: "imagens/foto-4.jpeg",
    texto_alternativo: "Instagram 3",
    ordem: 2,
  },
  {
    grupo: "instagram",
    imagem_url: "imagens/foto-5.jpeg",
    texto_alternativo: "Instagram 4",
    ordem: 3,
  },
  {
    grupo: "instagram",
    imagem_url: "imagens/ambiente-3.jpeg",
    texto_alternativo: "Instagram 5",
    ordem: 4,
  },
  {
    grupo: "instagram",
    imagem_url: "imagens/ambiente2.jpeg",
    texto_alternativo: "Instagram 6",
    ordem: 5,
  },
];
const $ = cheerio.load(
  fs.readFileSync(
    require("node:path").join(__dirname, "../index.html"),
    "utf8",
  ),
);
(async () => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    if ((await conn.query("SELECT id FROM categorias LIMIT 1")).length)
      throw Error("Seed cancelado: banco já contém categorias.");
    const insert = async (t, data) => {
      const keys = Object.keys(data);
      return conn.query(
        `INSERT INTO ${t} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
        Object.values(data),
      );
    };
    await require("./import-catalog").importCatalog(db, false, conn);
    for (const el of $("section[id]").toArray()) {
      const e = $(el),
        id = e.attr("id"),
        title = e.find("h1,h2").first();
      if (!title.length) continue;
      const img = e.find(".about-img img,.events-img img").first(),
        btn = e.find(".hero-btns a,.events-text>a").first();
      await insert("secoes", {
        chave: id === "home" ? "inicio" : id === "about" ? "o_boteco" : id,
        subtitulo: e.find(".sec-sub,.hero-badge").first().text().trim(),
        titulo: title.text(),
        descricao: e
          .find(
            ".sec-desc,.hero-desc,.about-text>p:not(.sec-sub):not(.about-sign),.events-text>p:not(.sec-sub)",
          )
          .first()
          .text(),
        imagem_url:
          id === "home" ? "imagens/ambiente2.jpeg" : img.attr("src") || null,
        imagem_alt: img.attr("alt") || null,
        botao_texto: btn.text().trim() || null,
        botao_url: btn.attr("href") || null,
      });
    }
    for (const photo of initialPhotos) await insert("fotos", photo);
    await insert("estabelecimento", {
      id: 1,
      nome: "Boteco da Vila",
      descricao:
        "Comida boa, cerveja gelada e aquele clima que faz você querer ficar.",
      telefone: "11940068689",
      whatsapp: "5511940068689",
      whatsapp_secundario: "5511981904839",
      endereco: "R. Dalva de Oliveira",
      numero: "90",
      bairro: "Parque Santa Teresa",
      cidade: "Carapicuíba",
      estado: "SP",
      cep: "",
      maps_url: "https://maps.app.goo.gl/RAim4gPCCR5Sewxu9",
      maps_embed_url: $(".loc-map iframe").attr("src"),
      instagram_url: "https://www.instagram.com/botecodavilabar/",
      logo_url: "imagens/logo-boteco.png",
    });
    for (let day = 0; day < 7; day++) {
      const r = await insert("horarios_funcionamento", {
        dia_semana: day,
        fechado: day === 0 || day === 1 ? 1 : 0,
      });
      if (day >= 2)
        await insert("intervalos_funcionamento", {
          horario_id: r.insertId,
          abertura: "12:00",
          fechamento: "23:00",
          encerra_no_dia_seguinte: 0,
        });
    }
    await conn.commit();
    console.log("Conteúdo atual importado.");
  } catch (e) {
    await conn.rollback();
    console.error(e);
    process.exitCode = 1;
  } finally {
    conn.release();
    await db.end();
  }
})();
