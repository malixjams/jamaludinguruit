const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_FILE = path.join(ROOT, "data.json");
const AUTH_FILE = path.join(ROOT, "auth.json");

const sessions = new Map();

const defaultAuth = {
  username: process.env.ADMIN_USER || "admin",
  passwordHash: hashPassword(process.env.ADMIN_PASSWORD || "admin123")
};

const defaultData = {
  profile: {
    name: "Nama Guru Informatika",
    title: "Guru Informatika",
    school: "SMA/SMK Nama Sekolah",
    location: "Indonesia",
    greeting: "Membimbing siswa memahami logika, data, jaringan, dan karya digital yang bermanfaat.",
    photoUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=900&auto=format&fit=crop",
    email: "guru.informatika@example.com",
    phone: "+62 812-0000-0000"
  },
  about: "Saya adalah guru informatika yang berfokus pada pembelajaran praktis, berpikir komputasional, pemrograman dasar, keamanan digital, dan pemanfaatan teknologi untuk memecahkan masalah nyata.",
  heroLinks: [
    { label: "Google Classroom", url: "https://classroom.google.com/" },
    { label: "Drive Materi", url: "https://drive.google.com/" },
    { label: "Kontak WhatsApp", url: "https://wa.me/6281200000000" }
  ],
  materials: [
    {
      title: "Algoritma dan Flowchart",
      description: "Pengantar berpikir logis, simbol flowchart, dan latihan menyusun langkah penyelesaian masalah.",
      url: "https://docs.google.com/"
    },
    {
      title: "Dasar HTML dan CSS",
      description: "Materi membuat halaman web sederhana, struktur dokumen, warna, layout, dan publikasi.",
      url: "https://developer.mozilla.org/en-US/docs/Learn"
    },
    {
      title: "Keamanan Digital",
      description: "Panduan kata sandi, privasi, jejak digital, dan etika menggunakan internet.",
      url: "https://www.siberkreasi.id/"
    }
  ],
  assignments: [
    {
      title: "Tugas 1: Flowchart Aktivitas Harian",
      dueDate: "2026-06-10",
      description: "Buat flowchart untuk satu aktivitas harian dan unggah dalam format PDF.",
      url: "https://classroom.google.com/"
    },
    {
      title: "Tugas 2: Halaman Profil HTML",
      dueDate: "2026-06-17",
      description: "Buat halaman profil pribadi menggunakan HTML dan CSS dasar.",
      url: "https://classroom.google.com/"
    }
  ],
  links: [
    { label: "YouTube", url: "https://youtube.com/" },
    { label: "Instagram", url: "https://instagram.com/" },
    { label: "TikTok", url: "https://tiktok.com/" }
  ]
};

function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(String(password)).digest("hex");
}

function readAuth() {
  if (!fs.existsSync(AUTH_FILE)) {
    fs.writeFileSync(AUTH_FILE, JSON.stringify(defaultAuth, null, 2));
  }
  return JSON.parse(fs.readFileSync(AUTH_FILE, "utf8"));
}

function writeAuth(auth) {
  fs.writeFileSync(AUTH_FILE, JSON.stringify(auth, null, 2));
}

function verifyLogin(username, password) {
  const auth = readAuth();
  return username === auth.username && hashPassword(password) === auth.passwordHash;
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Payload terlalu besar"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Format JSON tidak valid"));
      }
    });
  });
}

function getSession(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/(?:^|; )session=([^;]+)/);
  if (!match) return null;
  return sessions.get(match[1]) || null;
}

function requireAuth(req, res) {
  if (getSession(req)) return true;
  sendJson(res, 401, { error: "Silakan login terlebih dahulu." });
  return false;
}

function sanitizeData(input) {
  const safeItems = (items, shape) => Array.isArray(items)
    ? items.map((item) => shape.reduce((acc, key) => {
        acc[key] = String(item?.[key] || "").trim();
        return acc;
      }, {})).filter((item) => Object.values(item).some(Boolean))
    : [];

  return {
    profile: {
      name: String(input?.profile?.name || "").trim(),
      title: String(input?.profile?.title || "").trim(),
      school: String(input?.profile?.school || "").trim(),
      location: String(input?.profile?.location || "").trim(),
      greeting: String(input?.profile?.greeting || "").trim(),
      photoUrl: String(input?.profile?.photoUrl || "").trim(),
      email: String(input?.profile?.email || "").trim(),
      phone: String(input?.profile?.phone || "").trim()
    },
    about: String(input?.about || "").trim(),
    heroLinks: safeItems(input?.heroLinks, ["label", "url"]),
    materials: safeItems(input?.materials, ["title", "description", "url"]),
    assignments: safeItems(input?.assignments, ["title", "dueDate", "description", "url"]),
    links: safeItems(input?.links, ["label", "url"])
  };
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  const requested = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const types = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".svg": "image/svg+xml"
    };
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === "/api/content" && req.method === "GET") {
      sendJson(res, 200, readData());
      return;
    }

    if (req.url === "/api/login" && req.method === "POST") {
      const body = await parseBody(req);
      if (verifyLogin(body.username, body.password)) {
        const token = crypto.randomBytes(24).toString("hex");
        sessions.set(token, { username: body.username, createdAt: Date.now() });
        res.setHeader("Set-Cookie", `session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`);
        sendJson(res, 200, { ok: true });
        return;
      }
      sendJson(res, 401, { error: "User atau password salah." });
      return;
    }

    if (req.url === "/api/auth-settings" && req.method === "GET") {
      if (!requireAuth(req, res)) return;
      sendJson(res, 200, { username: readAuth().username });
      return;
    }

    if (req.url === "/api/auth-settings" && req.method === "PUT") {
      if (!requireAuth(req, res)) return;
      const body = await parseBody(req);
      const username = String(body.username || "").trim();
      const password = String(body.password || "");
      const confirmPassword = String(body.confirmPassword || "");

      if (username.length < 3) {
        sendJson(res, 400, { error: "User minimal 3 karakter." });
        return;
      }

      if (password && password.length < 6) {
        sendJson(res, 400, { error: "Password minimal 6 karakter." });
        return;
      }

      if (password !== confirmPassword) {
        sendJson(res, 400, { error: "Konfirmasi password tidak sama." });
        return;
      }

      const currentAuth = readAuth();
      const nextAuth = {
        username,
        passwordHash: password ? hashPassword(password) : currentAuth.passwordHash
      };
      writeAuth(nextAuth);

      const session = getSession(req);
      if (session) session.username = username;
      sendJson(res, 200, { ok: true, username });
      return;
    }

    if (req.url === "/api/logout" && req.method === "POST") {
      const cookie = req.headers.cookie || "";
      const match = cookie.match(/(?:^|; )session=([^;]+)/);
      if (match) sessions.delete(match[1]);
      res.setHeader("Set-Cookie", "session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.url === "/api/me" && req.method === "GET") {
      sendJson(res, getSession(req) ? 200 : 401, { loggedIn: Boolean(getSession(req)) });
      return;
    }

    if (req.url === "/api/content" && req.method === "PUT") {
      if (!requireAuth(req, res)) return;
      const body = await parseBody(req);
      const nextData = sanitizeData(body);
      writeData(nextData);
      sendJson(res, 200, { ok: true, data: nextData });
      return;
    }

    serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Terjadi kesalahan server." });
  }
});

// Export server agar bisa dijalankan oleh Vercel Serverless
module.exports = server;
