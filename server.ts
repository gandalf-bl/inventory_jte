import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IMAGE_DIR = path.join(__dirname, "public", "images");
if (!fs.existsSync(IMAGE_DIR)) {
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
}

const db = new Database("inventory.db");

function saveImage(base64Data: string | undefined): string | null {
  if (!base64Data || !base64Data.startsWith("data:image")) return base64Data || null;
  
  try {
    const matches = base64Data.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return null;

    const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const buffer = Buffer.from(matches[2], "base64");
    const fileName = `img_${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
    const filePath = path.join(IMAGE_DIR, fileName);
    
    fs.writeFileSync(filePath, buffer);
    return `/images/${fileName}`;
  } catch (error) {
    console.error("Error saving image:", error);
    return null;
  }
}

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER,
      unit TEXT NOT NULL,
      stock INTEGER DEFAULT 0,
      min_stock INTEGER DEFAULT 5,
      location TEXT,
      image TEXT,
      FOREIGN KEY (category_id) REFERENCES categories (id)
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_id INTEGER,
      type TEXT CHECK(type IN ('IN', 'OUT')) NOT NULL,
      quantity INTEGER NOT NULL,
      date DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      FOREIGN KEY (material_id) REFERENCES materials (id)
    );
  `);

  const categoryCount = db.prepare("SELECT COUNT(*) as count FROM categories").get() as { count: number };
  if (categoryCount.count === 0) {
    const insertCategory = db.prepare("INSERT INTO categories (name) VALUES (?)");
    ["Komponen Elektronika", "Kabel & Konektor", "Alat Ukur", "Modul Praktikum", "Lain-lain"].forEach(cat => insertCategory.run(cat));

    const insertLocation = db.prepare("INSERT INTO locations (name) VALUES (?)");
    ["Rak A1", "Rak A2", "Rak B1", "Rak B2", "Rak C1", "Lemari Alat", "Meja Kerja", "Gudang"].forEach(loc => insertLocation.run(loc));

    const insertMaterial = db.prepare("INSERT INTO materials (name, category_id, unit, stock, min_stock, location) VALUES (?, ?, ?, ?, ?, ?)");
    insertMaterial.run("Resistor 220 Ohm", 1, "Pcs", 150, 50, "Rak A1");
    insertMaterial.run("Kabel Jumper Male-Male", 2, "Set", 20, 10, "Rak B2");
    insertMaterial.run("Multimeter Digital", 3, "Unit", 12, 5, "Lemari Alat");
    insertMaterial.run("Arduino Uno R3", 4, "Unit", 8, 3, "Rak C1");
    insertMaterial.run("Solder 40W", 5, "Unit", 15, 5, "Meja Kerja");
  }
}

async function startServer() {
  initDb();
  
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Serve images
  app.use("/images", express.static(IMAGE_DIR));

  // API Routes
  app.get("/api/categories", (req, res) => {
    const categories = db.prepare("SELECT * FROM categories").all();
    res.json(categories);
  });

  app.get("/api/locations", (req, res) => {
    const locations = db.prepare("SELECT * FROM locations").all();
    res.json(locations);
  });

  app.post("/api/locations", (req, res) => {
    const { name } = req.body;
    const result = db.prepare("INSERT INTO locations (name) VALUES (?)").run(name);
    res.json({ id: result.lastInsertRowid });
  });

  app.put("/api/locations/:id", (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    db.prepare("UPDATE locations SET name = ? WHERE id = ?").run(name, id);
    res.json({ success: true });
  });

  app.delete("/api/locations/:id", (req, res) => {
    const { id } = req.params;
    // Check if location is being used by any material
    const location = db.prepare("SELECT name FROM locations WHERE id = ?").get() as { name: string };
    if (location) {
      const usage = db.prepare("SELECT COUNT(*) as count FROM materials WHERE location = ?").get() as { count: number };
      if (usage.count > 0) {
        return res.status(400).json({ error: "Lokasi masih digunakan oleh beberapa bahan." });
      }
      db.prepare("DELETE FROM locations WHERE id = ?").run(id);
    }
    res.json({ success: true });
  });

  app.get("/api/materials", (req, res) => {
    const materials = db.prepare(`
      SELECT m.*, c.name as category_name 
      FROM materials m 
      LEFT JOIN categories c ON m.category_id = c.id
    `).all();
    res.json(materials);
  });

  app.post("/api/materials", (req, res) => {
    const { name, category_id, unit, min_stock, location, image } = req.body;
    const imagePath = saveImage(image);
    const result = db.prepare(
      "INSERT INTO materials (name, category_id, unit, min_stock, location, image) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(name, category_id, unit, min_stock, location, imagePath);
    res.json({ id: result.lastInsertRowid });
  });

  app.put("/api/materials/:id", (req, res) => {
    const { id } = req.params;
    const { name, category_id, unit, min_stock, location, image } = req.body;
    
    let imagePath = image;
    // Only save if it's a new base64 string
    if (image && image.startsWith("data:image")) {
      imagePath = saveImage(image);
    }

    db.prepare(
      "UPDATE materials SET name = ?, category_id = ?, unit = ?, min_stock = ?, location = ?, image = ? WHERE id = ?"
    ).run(name, category_id, unit, min_stock, location, imagePath, id);
    res.json({ success: true });
  });

  app.delete("/api/materials/:id", (req, res) => {
    const { id } = req.params;
    // Also delete related transactions to maintain referential integrity
    const deleteOp = db.transaction(() => {
      db.prepare("DELETE FROM transactions WHERE material_id = ?").run(id);
      db.prepare("DELETE FROM materials WHERE id = ?").run(id);
    });
    deleteOp();
    res.json({ success: true });
  });

  app.post("/api/transactions", (req, res) => {
    const { material_id, type, quantity, notes } = req.body;
    
    const transaction = db.transaction(() => {
      db.prepare("INSERT INTO transactions (material_id, type, quantity, notes) VALUES (?, ?, ?, ?)")
        .run(material_id, type, quantity, notes);
      const adjustment = type === 'IN' ? quantity : -quantity;
      db.prepare("UPDATE materials SET stock = stock + ? WHERE id = ?")
        .run(adjustment, material_id);
    });
    transaction();
    res.json({ success: true });
  });

  app.get("/api/stats", (req, res) => {
    const totalMaterials = db.prepare("SELECT COUNT(*) as count FROM materials").get() as { count: number };
    const lowStock = db.prepare("SELECT COUNT(*) as count FROM materials WHERE stock <= min_stock").get() as { count: number };
    const recentTransactions = db.prepare(`
      SELECT t.*, m.name as material_name 
      FROM transactions t 
      JOIN materials m ON t.material_id = m.id 
      ORDER BY t.date DESC LIMIT 5
    `).all();
    
    res.json({
      totalMaterials: totalMaterials.count,
      lowStock: lowStock.count,
      recentTransactions
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
