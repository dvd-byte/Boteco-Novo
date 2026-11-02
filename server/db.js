require("dotenv").config();
const mariadb = require("mariadb");
const fs = require("node:fs");
const tls =
  process.env.DB_SSL === "true"
    ? {
        rejectUnauthorized: true,
        ...(process.env.DB_SSL_CA
          ? { ca: fs.readFileSync(process.env.DB_SSL_CA, "utf8") }
          : {}),
      }
    : undefined;
const pool = mariadb.createPool({
  ssl: tls,
  connectTimeout: 5000,
  acquireTimeout: 10000,
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "boteco",
  connectionLimit: 5,
  bigIntAsNumber: true,
  insertIdAsNumber: true,
  decimalAsNumber: false,
});
module.exports = pool;
