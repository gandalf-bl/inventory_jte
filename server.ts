import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import mysql from "mysql2/promise";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database Configuration
const useMySQL = process.env.MYSQL_HOST && process.env.MYSQL_USER && process.env.MYSQL_DATABASE;

let db: any;
let mysqlPool: mysql.Pool | null = null;

async function initDb() {
  if (useMySQL) {
    console.log("Using MySQL Database");
    mysqlPool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      port: parseInt(process.env.MYSQL_PORT || "3306"),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Initialize MySQL Tables
    const connection = await mysqlPool.getConnection();
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS categories (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE
        )
      `);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS materials (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          category_id INT,
          unit VARCHAR(50) NOT NULL,
          stock INT DEFAULT 0,
          min_stock INT DEFAULT 5,
          location VARCHAR(255),
          FOREIGN KEY (category_id) REFERENCES categories(id)
        )
      `);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS transactions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          material_id INT,
          type ENUM('IN', 'OUT') NOT NULL,
          quantity INT NOT NULL,
          date DATETIME DEFAULT CURRENT_TIMESTAMP,
          notes TEXT,
          FOREIGN KEY (material_id) REFERENCES materials(id)
        )
      `);

      // Seed categories if empty
      const [rows]: any = await connection.query("SELECT COUNT(*) as count FROM categories");
      if (rows[0].count === 0) {
        const categories = ["Komponen Elektronika", "Kabel & Konektor", "Alat Ukur", "Modul Praktikum", "Lain-lain"];
        for (const cat of categories) {
          await connection.query("INSERT INTO categories (name) VALUES (?)", [cat]);
        }
      }
    } finally {
      connection.release();
    }
  } else {
    console.log("Using SQLite Database (Fallback)");
    db = new Database("inventory.db");
    db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
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

      const insertMaterial = db.prepare("INSERT INTO materials (name, category_id, unit, stock, min_stock, location) VALUES (?, ?, ?, ?, ?, ?)");
      insertMaterial.run("Resistor 220 Ohm", 1, "Pcs", 150, 50, "Rak A1");
      insertMaterial.run("Kabel Jumper Male-Male", 2, "Set", 20, 10, "Rak B2");
      insertMaterial.run("Multimeter Digital", 3, "Unit", 12, 5, "Lemari Alat");
      insertMaterial.run("Arduino Uno R3", 4, "Unit", 8, 3, "Rak C1");
      insertMaterial.run("Solder 40W", 5, "Unit", 15, 5, "Meja Kerja");
    }
  }
}

async function query(sql: string, params: any[] = []) {
  if (useMySQL && mysqlPool) {
    const [rows] = await mysqlPool.query(sql, params);
    return rows;
  } else {
    if (sql.trim().toUpperCase().startsWith("SELECT")) {
      return db.prepare(sql).all(...params);
    } else {
      return db.prepare(sql).run(...params);
    }
  }
}

async function startServer() {
  await initDb();
  
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/categories", async (req, res) => {
    const categories = await query("SELECT * FROM categories");
    res.json(categories);
  });

  app.get("/api/materials", async (req, res) => {
    const materials = await query(`
      SELECT m.*, c.name as category_name 
      FROM materials m 
      LEFT JOIN categories c ON m.category_id = c.id
    `);
    res.json(materials);
  });

  app.post("/api/materials", async (req, res) => {
    const { name, category_id, unit, min_stock, location } = req.body;
    const result: any = await query(
      "INSERT INTO materials (name, category_id, unit, min_stock, location) VALUES (?, ?, ?, ?, ?)",
      [name, category_id, unit, min_stock, location]
    );
    res.json({ id: result.insertId || result.lastInsertRowid });
  });

  app.post("/api/transactions", async (req, res) => {
    const { material_id, type, quantity, notes } = req.body;
    
    if (useMySQL && mysqlPool) {
      const connection = await mysqlPool.getConnection();
      await connection.beginTransaction();
      try {
        await connection.query(
          "INSERT INTO transactions (material_id, type, quantity, notes) VALUES (?, ?, ?, ?)",
          [material_id, type, quantity, notes]
        );
        const adjustment = type === 'IN' ? quantity : -quantity;
        await connection.query("UPDATE materials SET stock = stock + ? WHERE id = ?", [adjustment, material_id]);
        await connection.commit();
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    } else {
      const transaction = db.transaction(() => {
        db.prepare("INSERT INTO transactions (material_id, type, quantity, notes) VALUES (?, ?, ?, ?)")
          .run(material_id, type, quantity, notes);
        const adjustment = type === 'IN' ? quantity : -quantity;
        db.prepare("UPDATE materials SET stock = stock + ? WHERE id = ?")
          .run(adjustment, material_id);
      });
      transaction();
    }
    res.json({ success: true });
  });

  app.get("/api/stats", async (req, res) => {
    const totalMaterials: any = await query("SELECT COUNT(*) as count FROM materials");
    const lowStock: any = await query("SELECT COUNT(*) as count FROM materials WHERE stock <= min_stock");
    const recentTransactions = await query(`
      SELECT t.*, m.name as material_name 
      FROM transactions t 
      JOIN materials m ON t.material_id = m.id 
      ORDER BY t.date DESC LIMIT 5
    `);
    
    res.json({
      totalMaterials: totalMaterials[0]?.count ?? totalMaterials.count ?? 0,
      lowStock: lowStock[0]?.count ?? lowStock.count ?? 0,
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
