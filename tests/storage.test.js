const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  sharp = require("sharp");
const { createStorage } = require("../server/storage");
const env = {
  NODE_ENV: "production",
  STORAGE_PROVIDER: "s3",
  STORAGE_ENDPOINT: "https://s3.example.test",
  STORAGE_REGION: "auto",
  STORAGE_BUCKET: "test",
  STORAGE_ACCESS_KEY_ID: "test-key",
  STORAGE_SECRET_ACCESS_KEY: "test-secret",
  STORAGE_PUBLIC_BASE_URL: "https://images.example.test",
};
function mock() {
  const objects = new Map();
  let failure = false;
  return {
    objects,
    set failure(v) {
      failure = v;
    },
    async send(command) {
      if (failure)
        throw Object.assign(Error("secret must not leak"), {
          $metadata: { httpStatusCode: 403 },
        });
      const i = command.input;
      switch (command.constructor.name) {
        case "PutObjectCommand":
          if (objects.has(i.Key)) throw { $metadata: { httpStatusCode: 412 } };
          objects.set(i.Key, {
            Body: Buffer.from(i.Body),
            Metadata: i.Metadata,
          });
          return {};
        case "HeadObjectCommand":
          if (!objects.has(i.Key)) throw Error("missing");
          return {
            ...objects.get(i.Key),
            ContentLength: objects.get(i.Key).Body.length,
          };
        case "DeleteObjectCommand":
          objects.delete(i.Key);
          return {};
      }
    },
  };
}
test("S3: processamento, deduplicação, nova instância sem disco, substituição e falhas", async () => {
  const client = mock();
  const image = await sharp({
    create: { width: 3, height: 3, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  const a = createStorage(env, client);
  const first = await a.put(image);
  assert.match(
    first.url,
    /^https:\/\/images.example.test\/images\/[a-f0-9]{64}\.webp$/,
  );
  assert.equal((await a.put(image)).url, first.url);
  assert.equal(client.objects.size, 1);
  const restarted = createStorage(
    { ...env, UPLOAD_DIR: "nonexistent-directory" },
    client,
  );
  await restarted.exists(first.url);
  assert.ok(client.objects.get(first.key).Body.length);
  const second = await restarted.put(
    await sharp(image).negate().png().toBuffer(),
  );
  assert.notEqual(second.url, first.url);
  assert.equal(client.objects.size, 2);
  client.failure = true;
  await assert.rejects(
    () => restarted.put(image),
    (e) => e.status === 503 && !e.message.includes("secret"),
  );
  assert.equal(client.objects.size, 2);
  client.failure = false;
  await assert.rejects(
    () => restarted.put(Buffer.from("not an image")),
    (e) => e.status === 400,
  );
  await assert.rejects(
    () => restarted.put(Buffer.alloc(5 * 1024 * 1024 + 1)),
    (e) => e.status === 400,
  );
  await assert.rejects(
    () => restarted.remove("../other"),
    (e) => e.status === 400,
  );
});
test("Produção recusa disco local e configuração S3 incompleta/insegura", () => {
  assert.throws(() => createStorage({ NODE_ENV: "production" }));
  assert.throws(() => createStorage({ ...env, STORAGE_SECRET_ACCESS_KEY: "" }));
  assert.throws(() =>
    createStorage({ ...env, STORAGE_ENDPOINT: "http://example.test" }),
  );
});
module.exports = { mock, env };
