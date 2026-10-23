require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const helmet = require("helmet");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const NODE_ENV = process.env.NODE_ENV || "development";
const FRONTEND = path.resolve(__dirname, "..", "frontend");
const DATA_DIR = path.join(__dirname, "data");
const PRIVATE_DIR = path.join(__dirname, "private", "posters");
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(PRIVATE_DIR, { recursive: true });

const secret = process.env.SESSION_SECRET || "";
if (secret.length < 32) {
  console.error("SESSION_SECRET is missing or too short. Create backend/.env using .env.example.");
  process.exit(1);
}

const db = new Database(path.join(DATA_DIR, "elitemotion.sqlite"));
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    collection TEXT NOT NULL,
    code TEXT NOT NULL,
    priceToman REAL NOT NULL DEFAULT 0,
    priceUSD REAL NOT NULL DEFAULT 0,
    previewUrl TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);
if (db.prepare("SELECT COUNT(*) AS count FROM products").get().count === 0) {
  try {
    const seed = JSON.parse(fs.readFileSync(path.join(FRONTEND, "products.json"), "utf8"));
    const insert = db.prepare(`INSERT OR IGNORE INTO products
      (id,name,description,collection,code,priceToman,priceUSD,previewUrl,active,position)
      VALUES (@id,@name,@description,@collection,@code,@priceToman,@priceUSD,@previewUrl,@active,@position)`);
    const tx = db.transaction(rows => rows.forEach(p => insert.run({
      id:String(p.id || crypto.randomUUID()), name:String(p.name || "Untitled"),
      description:String(p.description || ""), collection:p.collection === "Black & White" ? "Black & White" : "Black & Gold",
      code:String(p.code || ""), priceToman:Number(p.priceToman || 0), priceUSD:Number(p.priceUSD || 0),
      previewUrl:String(p.previewUrl || ""), active:p.active === false ? 0 : 1, position:Number(p.position || 0)
    })));
    tx(seed.products || []);
  } catch (e) { console.error("Product seed skipped:", e.message); }
}

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "https:", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: NODE_ENV === "production" ? [] : null
    }
  }
}));
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));

// MemoryStore is suitable only for local testing. Use a persistent session store before deployment.
app.use(session({
  name: "elitemotion.sid",
  secret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "strict", secure: NODE_ENV === "production", maxAge: 1000 * 60 * 60 * 4 },
  genid: () => crypto.randomUUID()
}));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false, message: { error: "Too many attempts. Try again in 15 minutes." } });
const setupLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: "draft-7", legacyHeaders: false });
const productSelect = `id,name,description,collection,code,priceToman,priceUSD,previewUrl,active,position`;
function adminExists() { return db.prepare("SELECT COUNT(*) AS count FROM admins").get().count > 0; }
function isAdmin(req, res, next) {
  if (!req.session.adminId) return res.status(401).json({ error: "Please sign in." });
  next();
}
function csrfCheck(req, res, next) {
  const supplied = req.get("X-CSRF-Token");
  if (!req.session.csrfToken || !supplied || supplied !== req.session.csrfToken) return res.status(403).json({ error: "Security token expired. Refresh and try again." });
  next();
}
function newCsrf(req) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  return req.session.csrfToken;
}
function safeProduct(row) {
  return { ...row, active: Boolean(row.active), priceToman: Number(row.priceToman), priceUSD: Number(row.priceUSD), position: Number(row.position) };
}
function validateProduct(body, partial=false) {
  const result = {};
  const fields = ["name","description","collection","code","priceToman","priceUSD","previewUrl","active","position"];
  for (const key of fields) {
    if (!(key in body)) { if (!partial && ["name","collection","code","priceToman","priceUSD"].includes(key)) return { error:`Missing field: ${key}` }; else continue; }
    const value = body[key];
    if (["name","description","code","previewUrl","collection"].includes(key)) {
      if (typeof value !== "string") return { error:`Invalid field: ${key}` };
      const max = key === "description" ? 500 : key === "previewUrl" ? 1000 : 120;
      if (value.length > max) return { error:`${key} is too long.` };
      if (!partial && ["name","code","collection"].includes(key) && !value.trim()) return { error:`${key} is required.` };
      if (key === "collection" && !["Black & Gold","Black & White"].includes(value)) return { error:"Invalid collection." };
      if (key === "previewUrl" && value && !/^https?:\\/\\//i.test(value)) return { error:"Preview URL must start with http:// or https://." };
      result[key] = value.trim();
    } else if (["priceToman","priceUSD","position"].includes(key)) {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0 || (key === "position" && !Number.isInteger(n))) return { error:`Invalid number for ${key}.` };
      result[key] = n;
    } else if (key === "active") {
      if (typeof value !== "boolean") return { error:"active must be true or false." };
      result.active = value ? 1 : 0;
    }
  }
  return { value: result };
}
function publicProduct(row) {
  const p = safeProduct(row);
  return { ...p };
}

app.get("/api/products", (req, res) => {
  const rows = db.prepare(`SELECT ${productSelect} FROM products WHERE active=1 ORDER BY position ASC, created_at DESC`).all();
  res.json({ products: rows.map(publicProduct) });
});
app.get("/api/admin/status", (req, res) => res.json({ adminExists: adminExists() }));
app.get("/api/admin/csrf", (req, res) => res.json({ csrfToken: newCsrf(req) }));
app.get("/api/admin/me", (req, res) => res.json({ authenticated: Boolean(req.session.adminId) }));

app.post("/api/admin/setup", setupLimiter, csrfCheck, async (req, res) => {
  if (adminExists()) return res.status(409).json({ error: "Admin setup is already complete." });
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(username)) return res.status(400).json({ error: "Username must be 3–40 characters: letters, numbers, dot, underscore, or hyphen." });
  if (password.length < 12 || password.length > 200) return res.status(400).json({ error: "Password must be at least 12 characters." });
  const hash = await bcrypt.hash(password, 12);
  try {
    db.prepare("INSERT INTO admins (username,password_hash) VALUES (?,?)").run(username, hash);
    res.status(201).json({ ok: true });
  } catch (e) { res.status(409).json({ error: "Could not create admin. Username may already exist." }); }
});
app.post("/api/admin/login", loginLimiter, csrfCheck, async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  const admin = db.prepare("SELECT id,username,password_hash FROM admins WHERE username=?").get(username);
  if (!admin || !(await bcrypt.compare(password, admin.password_hash))) return res.status(401).json({ error: "Invalid username or password." });
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: "Could not start a secure session." });
    req.session.adminId = admin.id;
    req.session.username = admin.username;
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
    req.session.save(saveErr => {
      if (saveErr) return res.status(500).json({ error: "Could not save session." });
      res.json({ ok: true });
    });
  });
});
app.post("/api/admin/logout", csrfCheck, isAdmin, (req, res) => {
  req.session.destroy(err => {
    res.clearCookie("elitemotion.sid", { httpOnly:true, sameSite:"strict", secure:NODE_ENV === "production" });
    if (err) return res.status(500).json({ error: "Could not sign out." });
    res.json({ ok:true });
  });
});
app.get("/api/admin/products", isAdmin, (req, res) => {
  const rows = db.prepare(`SELECT ${productSelect} FROM products ORDER BY position ASC, created_at DESC`).all();
  res.json({ products: rows.map(safeProduct) });
});
app.post("/api/admin/products", csrfCheck, isAdmin, (req, res) => {
  const checked = validateProduct(req.body);
  if (checked.error) return res.status(400).json({ error: checked.error });
  const p = checked.value;
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO products (${productSelect}) VALUES (@id,@name,@description,@collection,@code,@priceToman,@priceUSD,@previewUrl,@active,@position)`)
    .run({ id, name:p.name, description:p.description || "", collection:p.collection, code:p.code, priceToman:p.priceToman, priceUSD:p.priceUSD, previewUrl:p.previewUrl || "", active:p.active === undefined ? 1 : p.active, position:p.position || 0 });
  res.status(201).json({ product: safeProduct(db.prepare(`SELECT ${productSelect} FROM products WHERE id=?`).get(id)) });
});
app.put("/api/admin/products/:id", csrfCheck, isAdmin, (req, res) => {
  const current = db.prepare(`SELECT ${productSelect} FROM products WHERE id=?`).get(req.params.id);
  if (!current) return res.status(404).json({ error:"Product not found." });
  const checked = validateProduct(req.body, true);
  if (checked.error) return res.status(400).json({ error:checked.error });
  const p = { ...current, ...checked.value };
  db.prepare(`UPDATE products SET name=@name,description=@description,collection=@collection,code=@code,priceToman=@priceToman,priceUSD=@priceUSD,previewUrl=@previewUrl,active=@active,position=@position WHERE id=@id`)
    .run({ ...p, active: typeof p.active === "boolean" ? (p.active ? 1 : 0) : Number(p.active), id:req.params.id });
  res.json({ product:safeProduct(db.prepare(`SELECT ${productSelect} FROM products WHERE id=?`).get(req.params.id)) });
});
app.delete("/api/admin/products/:id", csrfCheck, isAdmin, (req, res) => {
  const result = db.prepare("DELETE FROM products WHERE id=?").run(req.params.id);
  if (!result.changes) return res.status(404).json({ error:"Product not found." });
  res.json({ ok:true });
});

app.use(express.static(FRONTEND, { index:"index.html", dotfiles:"deny", setHeaders(res, filePath) {
  if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-store");
}}));
app.get("/admin", (req, res) => res.sendFile(path.join(FRONTEND, "admin.html")));
app.use((req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error:"API endpoint not found." });
  res.status(404).sendFile(path.join(FRONTEND, "index.html"));
});
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error:"Unexpected server error." });
});

app.listen(PORT, () => {
  console.log(`ELITEMOTION running at http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
  console.log("Payments and automatic digital delivery are intentionally disabled.");
});
