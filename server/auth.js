const {
  scryptSync,
  randomBytes,
  timingSafeEqual,
  createHash,
} = require("node:crypto");
exports.hash = (password) => {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
};
exports.verify = (password, hash) => {
  try {
    const [salt, key] = hash.split(":");
    return timingSafeEqual(
      scryptSync(password, salt, 64),
      Buffer.from(key, "hex"),
    );
  } catch {
    return false;
  }
};
exports.digest = (token) => createHash("sha256").update(token).digest("hex");
