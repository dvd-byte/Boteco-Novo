const fs = require("node:fs/promises"),
  path = require("node:path");
const { fail } = require("./validation");
module.exports = async function validateMedia(data) {
  for (const key of ["imagem_url", "logo_url"]) {
    const value = data[key];
    if (!value || /^https?:\/\//i.test(value)) continue;
    let decoded;
    try {
      decoded = decodeURIComponent(value);
    } catch {
      fail("Caminho de imagem inválido");
    }
    const uploaded = decoded.startsWith("/uploads/");
    const base = uploaded
      ? path.resolve(
          process.env.UPLOAD_DIR || path.join(__dirname, "../uploads"),
        )
      : path.resolve(__dirname, "../imagens");
    const relative = uploaded
      ? decoded.slice(9)
      : decoded.startsWith("imagens/")
        ? decoded.slice(8)
        : null;
    if (
      !relative ||
      relative.split(/[\\/]/).some((s) => s === ".." || s === ".") ||
      relative.includes("\0")
    )
      fail("Caminho de imagem inválido");
    const target = path.resolve(base, relative);
    if (!target.startsWith(base + path.sep)) fail("Caminho de imagem inválido");
    try {
      const real = await fs.realpath(target);
      const realBase = await fs.realpath(base);
      if (
        !real.startsWith(realBase + path.sep) ||
        (await fs.stat(real)).isDirectory()
      )
        fail("Imagem inválida");
    } catch {
      fail("Imagem local não encontrada. Envie o arquivo antes de salvar.");
    }
  }
};
