import * as SQLite from 'expo-sqlite';

// Open the database (creates it if it doesn't exist)
const db = SQLite.openDatabaseSync('btracker.db');

export const initDatabase = () => {
  try {
    db.execSync(`
      PRAGMA journal_mode = WAL;
      
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT,
        password_hash TEXT,
        pin_hash TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS income (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'AED',
        date TEXT NOT NULL,
        category TEXT NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'AED',
        date TEXT NOT NULL,
        category TEXT NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        icon TEXT DEFAULT 'ellipse-outline',
        is_custom INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        theme TEXT DEFAULT 'dark',
        currency TEXT DEFAULT 'AED',
        last_sync_time TEXT
      );
    `);

    // --- Data Migrations (safe to run each time) ---

    // Add currency column to income table if it doesn't exist
    try { db.execSync("ALTER TABLE income ADD COLUMN currency TEXT NOT NULL DEFAULT 'AED';"); } catch (e) {}
    // Add currency column to expenses table if it doesn't exist
    try { db.execSync("ALTER TABLE expenses ADD COLUMN currency TEXT NOT NULL DEFAULT 'AED';"); } catch (e) {}
    // Add icon column to categories if missing
    try { db.execSync("ALTER TABLE categories ADD COLUMN icon TEXT DEFAULT 'ellipse-outline';"); } catch (e) {}
    // Ensure users table has the new hashed columns
    try { db.execSync("ALTER TABLE users ADD COLUMN password_hash TEXT;"); } catch (e) {}
    try { db.execSync("ALTER TABLE users ADD COLUMN pin_hash TEXT;"); } catch (e) {}
    try { db.execSync("ALTER TABLE app_settings ADD COLUMN default_currency_mode TEXT DEFAULT 'AED';"); } catch (e) {}
    try { db.execSync("ALTER TABLE app_settings ADD COLUMN biometrics_enabled INTEGER DEFAULT 0;"); } catch (e) {}

    // v3 migration (Investments & Goals) - Infrastructure only on main
    try {
      db.execSync(`
        CREATE TABLE IF NOT EXISTS investments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          amount REAL NOT NULL,
          currency TEXT NOT NULL,
          date TEXT NOT NULL,
          category TEXT NOT NULL,
          notes TEXT
        );
        CREATE TABLE IF NOT EXISTS goals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          target_amount REAL NOT NULL,
          current_amount REAL DEFAULT 0,
          currency TEXT NOT NULL,
          target_date TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (e) {}


    // Restore correct icons for all default categories (safe upsert-style update)
    const iconUpdates = [
      ['Salary',       'briefcase-outline',       'income'],
      ['Freelance',    'laptop-outline',           'income'],
      ['Business',     'storefront-outline',       'income'],
      ['Gift',         'gift-outline',             'income'],
      ['Other Income', 'wallet-outline',           'income'],
      ['Grocery',      'cart-outline',             'expense'],
      ['Travel',       'airplane-outline',         'expense'],
      ['Fuel',         'car-outline',              'expense'],
      ['Dining',       'restaurant-outline',       'expense'],
      ['Shopping',     'bag-handle-outline',       'expense'],
      ['Medical',      'medical-outline',          'expense'],
      ['Rent',         'home-outline',             'expense'],
      ['Bills',        'receipt-outline',          'expense'],
      ['Baby',         'happy-outline',            'expense'],
      ['Entertainment','game-controller-outline',  'expense'],
      ['Others',       'ellipse-outline',          'expense'],
    ];
    for (const [name, icon, type] of iconUpdates) {
      db.runSync(
        "UPDATE categories SET icon = ? WHERE name = ? AND type = ? AND (icon IS NULL OR icon = 'ellipse-outline' OR icon = '')",
        [icon, name, type]
      );
    }

    // Insert default settings if they don't exist
    const settingsResult = db.getAllSync('SELECT COUNT(*) as count FROM app_settings');
    if (settingsResult[0].count === 0) {
      db.execSync("INSERT INTO app_settings (theme, currency) VALUES ('dark', 'AED')");
    }

    // Insert default categories if they don't exist
    const result = db.getAllSync('SELECT COUNT(*) as count FROM categories');
    if (result[0].count === 0) {
      db.execSync(`
        INSERT INTO categories (name, type, icon, is_custom) VALUES 
        ('Salary',       'income',  'briefcase-outline',   0),
        ('Freelance',    'income',  'laptop-outline',      0),
        ('Business',     'income',  'storefront-outline',  0),
        ('Gift',         'income',  'gift-outline',        0),
        ('Other Income', 'income',  'wallet-outline',      0),
        ('Grocery',      'expense', 'cart-outline',        0),
        ('Travel',       'expense', 'airplane-outline',    0),
        ('Fuel',         'expense', 'car-outline',         0),
        ('Dining',       'expense', 'restaurant-outline',  0),
        ('Shopping',     'expense', 'bag-handle-outline',  0),
        ('Medical',      'expense', 'medical-outline',     0),
        ('Rent',         'expense', 'home-outline',        0),
        ('Bills',        'expense', 'receipt-outline',     0),
        ('Baby',         'expense', 'happy-outline',       0),
        ('Entertainment','expense', 'game-controller-outline', 0),
        ('Others',       'expense', 'ellipse-outline',     0);
      `);
    }

    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Error initializing database:", error);
  }
};

export const getDb = () => db;

export const getAppSettings = () => {
  try {
    return db.getFirstSync('SELECT * FROM app_settings');
  } catch (e) {
    return { theme: 'dark', currency: 'AED' };
  }
};
