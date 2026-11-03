const {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const sharp = require("sharp"),
  { createHash } = require("node:crypto"),
  fs = require("node:fs/promises"),
  path = require("node:path");
function error(message, status = 503) {
  return Object.assign(Error(message), { status });
}
function config(env = process.env) {
  const provider = env.STORAGE_PROVIDER || "local";
  if (!["local", "s3"].includes(provider))
    throw Error("STORAGE_PROVIDER inválido");
  if (env.NODE_ENV === "production" && provider !== "s3")
    throw Error("Produção exige STORAGE_PROVIDER=s3");
  if (provider === "local")
    return {
      provider,
      dir: path.resolve(env.UPLOAD_DIR || path.join(__dirname, "../uploads")),
    };
  for (const key of [
    "STORAGE_ENDPOINT",
    "STORAGE_REGION",
    "STORAGE_BUCKET",
    "STORAGE_ACCESS_KEY_ID",
    "STORAGE_SECRET_ACCESS_KEY",
    "STORAGE_PUBLIC_BASE_URL",
  ])
    if (!env[key]) throw Error("Configuração ausente: " + key);
  for (const key of ["STORAGE_ENDPOINT", "STORAGE_PUBLIC_BASE_URL"]) {
    const u = new URL(env[key]);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.search ||
      u.hash
    )
      throw Error(key + " deve ser HTTPS sem credenciais ou parâmetros");
  }
  return {
    provider,
    endpoint: env.STORAGE_ENDPOINT,
    region: env.STORAGE_REGION,
    bucket: env.STORAGE_BUCKET,
    base: env.STORAGE_PUBLIC_BASE_URL.replace(/\/$/, ""),
    credentials: {
      accessKeyId: env.STORAGE_ACCESS_KEY_ID,
      secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
    },
    forcePathStyle: env.STORAGE_FORCE_PATH_STYLE === "true",
  };
}
function createStorage(env = process.env, injected) {
  const c = config(env);
  const client =
    c.provider === "s3"
      ? injected ||
        new S3Client({
          ...c,
          maxAttempts: 3,
          requestHandler: { connectionTimeout: 5000, requestTimeout: 20000 },
        })
      : null;
  return {
    provider: c.provider,
    base: c.base,
    async put(input) {
      if (!Buffer.isBuffer(input) || input.length > 5 * 1024 * 1024)
        throw error("Arquivo excede o limite de 5 MB", 400);
      let body;
      try {
        const image = sharp(input, {
          limitInputPixels: 40000000,
          animated: false,
        });
        const metadata = await image.metadata();
        if (
          !["jpeg", "png", "webp"].includes(metadata.format) ||
          metadata.pages > 1
        )
          throw Error();
        body = await image.rotate().webp({ quality: 85 }).toBuffer();
      } catch {
        throw error(
          "Imagem inválida; use JPEG, PNG ou WebP até 40 megapixels",
          400,
        );
      }
      const hash = createHash("sha256").update(body).digest("hex");
      const key = "images/" + hash + ".webp";
      if (!client) {
        await fs.mkdir(c.dir, { recursive: true });
        const name = hash + ".webp";
        await fs
          .writeFile(path.join(c.dir, name), body, { flag: "wx" })
          .catch((e) => {
            if (e.code !== "EEXIST") throw e;
          });
        return { url: "/uploads/" + name, key: name, provider: "local" };
      }
      try {
        try {
          await client.send(
            new PutObjectCommand({
              Bucket: c.bucket,
              Key: key,
              Body: body,
              ContentType: "image/webp",
              CacheControl: "public,max-age=31536000,immutable",
              IfNoneMatch: "*",
              Metadata: { sha256: hash },
            }),
          );
        } catch (e) {
          if (e.$metadata?.httpStatusCode !== 412) throw e;
        }
        const head = await client.send(
          new HeadObjectCommand({ Bucket: c.bucket, Key: key }),
        );
        if (
          head.Metadata?.sha256 !== hash ||
          Number(head.ContentLength) !== body.length
        )
          throw Error("integrity");
        return { url: c.base + "/" + key, key, provider: "s3" };
      } catch {
        throw error(
          "Armazenamento indisponível. A imagem anterior foi preservada.",
        );
      }
    },
    async remove(key) {
      if (!client || !/^images\/[a-f0-9]{64}\.webp$/.test(key))
        throw error("Objeto inválido", 400);
      try {
        await client.send(
          new DeleteObjectCommand({ Bucket: c.bucket, Key: key }),
        );
      } catch {
        throw error("Remoção pendente; tente novamente mais tarde.");
      }
    },
    async exists(url) {
      if (!client || !url.startsWith(c.base + "/")) return;
      const key = url.slice(c.base.length + 1);
      if (!/^images\/[a-f0-9]{64}\.webp$/.test(key))
        throw error("Referência externa inválida", 400);
      try {
        await client.send(
          new HeadObjectCommand({ Bucket: c.bucket, Key: key }),
        );
      } catch {
        throw error("Não foi possível confirmar a imagem no armazenamento.");
      }
    },
  };
}
let instance;
exports.createStorage = createStorage;
exports.getStorage = () => instance || (instance = createStorage());
