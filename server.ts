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
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function saveImage(base64Data: string | undefined): string | null {
  if (!base64Data || !base64Data.startsWith("data:image")) return base64Data || null;
  
  try {
    const [header, data] = base64Data.split(",");
    const extensionMatch = header.match(/data:image\/([A-Za-z-+\/]+);base64/);
    if (!extensionMatch || !data) return null;

    const extension = extensionMatch[1] === 'jpeg' ? 'jpg' : extensionMatch[1];
    const buffer = Buffer.from(data, "base64");
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

  // Ensure 'image' column exists (for existing databases)
  try {
    db.prepare("SELECT image FROM materials LIMIT 1").get();
  } catch (e) {
    console.log("Adding 'image' column to materials table...");
    db.prepare("ALTER TABLE materials ADD COLUMN image TEXT").run();
  }

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

  // Request logger
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

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
    try {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Nama lokasi wajib diisi." });
      }
      const result = db.prepare("INSERT INTO locations (name) VALUES (?)").run(name);
      res.json({ id: result.lastInsertRowid });
    } catch (error: any) {
      console.error("Error creating location:", error);
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({ error: "Nama lokasi sudah ada." });
      }
      res.status(500).json({ error: "Gagal menambah lokasi." });
    }
  });

  app.put("/api/locations/:id", (req, res) => {
    try {
      const id = Number(req.params.id);
      const { name } = req.body;
      db.prepare("UPDATE locations SET name = ? WHERE id = ?").run(name, id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating location:", error);
      res.status(500).json({ error: "Gagal memperbarui lokasi." });
    }
  });

  app.delete("/api/locations/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID Lokasi tidak valid." });
      }
      console.log(`Attempting to delete location with ID: ${id}`);
      
      // Check if location exists
      const location = db.prepare("SELECT name FROM locations WHERE id = ?").get(id) as { name: string };
      if (!location) {
        return res.status(404).json({ error: "Lokasi tidak ditemukan." });
      }

      // Check if location is being used by any material
      const usage = db.prepare("SELECT COUNT(*) as count FROM materials WHERE location = ?").get(location.name) as { count: number };
      if (usage && usage.count > 0) {
        return res.status(400).json({ 
          error: `Lokasi ini masih digunakan oleh ${usage.count} barang.`,
          details: "Anda harus memindahkan barang-barang tersebut ke lokasi lain sebelum bisa menghapus lokasi ini."
        });
      }
      
      const result = db.prepare("DELETE FROM locations WHERE id = ?").run(id);
      console.log(`Deleted location. Changes: ${result.changes}`);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting location:", error);
      res.status(500).json({ error: "Gagal menghapus lokasi." });
    }
  });

  app.post("/api/categories", (req, res) => {
    try {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Nama kategori wajib diisi." });
      }
      const result = db.prepare("INSERT INTO categories (name) VALUES (?)").run(name);
      res.json({ id: result.lastInsertRowid });
    } catch (error: any) {
      console.error("Error creating category:", error);
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({ error: "Nama kategori sudah ada." });
      }
      res.status(500).json({ error: "Gagal menambah kategori." });
    }
  });

  app.put("/api/categories/:id", (req, res) => {
    try {
      const id = Number(req.params.id);
      const { name } = req.body;
      db.prepare("UPDATE categories SET name = ? WHERE id = ?").run(name, id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating category:", error);
      res.status(500).json({ error: "Gagal memperbarui kategori." });
    }
  });

  app.delete("/api/categories/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID Kategori tidak valid." });
      }
      console.log(`Attempting to delete category with ID: ${id}`);
      
      // Check if category exists
      const category = db.prepare("SELECT id FROM categories WHERE id = ?").get(id);
      if (!category) {
        return res.status(404).json({ error: "Kategori tidak ditemukan." });
      }

      // Check if category is being used by any material
      const usage = db.prepare("SELECT COUNT(*) as count FROM materials WHERE category_id = ?").get(id) as { count: number };
      if (usage && usage.count > 0) {
        return res.status(400).json({ 
          error: `Kategori ini masih digunakan oleh ${usage.count} barang.`,
          details: "Anda harus menghapus atau memindahkan barang-barang tersebut ke kategori lain sebelum bisa menghapus kategori ini."
        });
      }
      
      const result = db.prepare("DELETE FROM categories WHERE id = ?").run(id);
      console.log(`Deleted category. Changes: ${result.changes}`);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ error: "Gagal menghapus kategori." });
    }
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
    try {
      const { name, category_id, unit, min_stock, location, image } = req.body;
      if (!name || !unit) {
        return res.status(400).json({ error: "Nama dan Satuan wajib diisi." });
      }
      const imagePath = saveImage(image);
      const result = db.prepare(
        "INSERT INTO materials (name, category_id, unit, min_stock, location, image) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(name, category_id, unit, min_stock, location, imagePath);
      res.json({ id: result.lastInsertRowid });
    } catch (error) {
      console.error("Error creating material:", error);
      res.status(500).json({ error: "Gagal membuat bahan baru." });
    }
  });

  app.put("/api/materials/:id", (req, res) => {
    try {
      const id = Number(req.params.id);
      const { name, category_id, unit, min_stock, location, image } = req.body;
      
      if (!name || !unit) {
        return res.status(400).json({ error: "Nama dan Satuan wajib diisi." });
      }

      let imagePath = image;
      // Only save if it's a new base64 string
      if (image && image.startsWith("data:image")) {
        imagePath = saveImage(image);
      }

      db.prepare(
        "UPDATE materials SET name = ?, category_id = ?, unit = ?, min_stock = ?, location = ?, image = ? WHERE id = ?"
      ).run(name, category_id, unit, min_stock, location, imagePath, id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating material:", error);
      res.status(500).json({ error: "Gagal memperbarui bahan." });
    }
  });

  app.delete("/api/materials/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID Bahan tidak valid." });
      }
      console.log(`Attempting to delete material with ID: ${id}`);
      
      // Check if material exists
      const material = db.prepare("SELECT id FROM materials WHERE id = ?").get(id);
      if (!material) {
        return res.status(404).json({ error: "Bahan tidak ditemukan." });
      }

      // Also delete related transactions to maintain referential integrity
      const deleteOp = db.transaction(() => {
        db.prepare("DELETE FROM transactions WHERE material_id = ?").run(id);
        const result = db.prepare("DELETE FROM materials WHERE id = ?").run(id);
        return result.changes;
      });
      
      const changes = deleteOp();
      console.log(`Deleted material. Changes: ${changes}`);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting material:", error);
      res.status(500).json({ error: "Gagal menghapus bahan." });
    }
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
