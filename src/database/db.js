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
        default_currency_mode TEXT DEFAULT 'AED',
        biometrics_enabled INTEGER DEFAULT 0,
        last_sync_time TEXT
      );
    `);

    // --- Data Migrations (safe to run each time) ---

    try { db.execSync("ALTER TABLE income ADD COLUMN currency TEXT NOT NULL DEFAULT 'AED';"); } catch (e) {}
    try { db.execSync("ALTER TABLE expenses ADD COLUMN currency TEXT NOT NULL DEFAULT 'AED';"); } catch (e) {}
    try { db.execSync("ALTER TABLE categories ADD COLUMN icon TEXT DEFAULT 'ellipse-outline';"); } catch (e) {}
    try { db.execSync("ALTER TABLE users ADD COLUMN password_hash TEXT;"); } catch (e) {}
    try { db.execSync("ALTER TABLE users ADD COLUMN pin_hash TEXT;"); } catch (e) {}
    try { db.execSync("ALTER TABLE app_settings ADD COLUMN default_currency_mode TEXT DEFAULT 'AED';"); } catch (e) {}
    try { db.execSync("ALTER TABLE app_settings ADD COLUMN biometrics_enabled INTEGER DEFAULT 0;"); } catch (e) {}

    // Attachments & Archive migration
    try { db.execSync("ALTER TABLE income ADD COLUMN attachment_uri TEXT;"); } catch (e) {}
    try { db.execSync("ALTER TABLE expenses ADD COLUMN attachment_uri TEXT;"); } catch (e) {}
    try { db.execSync("ALTER TABLE investment_contributions ADD COLUMN attachment_uri TEXT;"); } catch (e) {}
    try { db.execSync("ALTER TABLE income ADD COLUMN is_archived INTEGER DEFAULT 0;"); } catch (e) {}
    try { db.execSync("ALTER TABLE expenses ADD COLUMN is_archived INTEGER DEFAULT 0;"); } catch (e) {}
    try { db.execSync("ALTER TABLE investment_contributions ADD COLUMN is_archived INTEGER DEFAULT 0;"); } catch (e) {}
    // v3.1 migration (Advanced Investments)
    try {
      try { db.execSync("ALTER TABLE investments RENAME TO investments_old;"); } catch (e) {}

      db.execSync(`
        CREATE TABLE IF NOT EXISTS investments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL,
          name TEXT NOT NULL,
          currency TEXT NOT NULL,
          recurring_amount REAL NOT NULL,
          tenure_value INTEGER NOT NULL,
          tenure_type TEXT NOT NULL, 
          target_amount REAL,
          installments_paid INTEGER DEFAULT 1,
          total_invested REAL DEFAULT 0,
          next_due_date TEXT,
          status TEXT DEFAULT 'Active', 
          start_date TEXT NOT NULL,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      db.execSync(`
        CREATE TABLE IF NOT EXISTS investment_contributions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          investment_id INTEGER NOT NULL,
          amount REAL NOT NULL,
          currency TEXT NOT NULL,
          contribution_date TEXT NOT NULL,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (investment_id) REFERENCES investments (id) ON DELETE CASCADE
        );
      `);

      const oldExists = db.getAllSync("SELECT name FROM sqlite_master WHERE type='table' AND name='investments_old'");
      if (oldExists.length > 0) {
        const oldData = db.getAllSync("SELECT * FROM investments_old");
        oldData.forEach(row => {
          const result = db.runSync(
            "INSERT INTO investments (type, name, currency, recurring_amount, tenure_value, tenure_type, total_invested, start_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [row.category, row.category, row.currency, row.amount, 1, 'Months', row.amount, row.date, row.notes]
          );
          const masterId = result.lastInsertRowId;
          db.runSync(
            "INSERT INTO investment_contributions (investment_id, amount, currency, contribution_date, notes) VALUES (?, ?, ?, ?, ?)",
            [masterId, row.amount, row.currency, row.date, row.notes]
          );
        });
        db.execSync("DROP TABLE IF EXISTS investments_old;");
      }
    } catch (e) { console.log('Investment migration failed:', e); }

    try {

      db.execSync(`
        CREATE TABLE IF NOT EXISTS goals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          target_amount REAL NOT NULL,
          current_amount REAL DEFAULT 0,
          currency TEXT NOT NULL,
          target_date TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      db.execSync(`
        CREATE TABLE IF NOT EXISTS reminders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          type TEXT NOT NULL,
          amount REAL,
          currency TEXT,
          due_date TEXT NOT NULL,
          repeat_type TEXT NOT NULL DEFAULT 'One Time',
          enabled INTEGER DEFAULT 1,
          linked_investment_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (e) { console.log('Goals and reminders table creation failed:', e); }

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
      ['SIP',           'trending-up-outline',     'investment'],
      ['Mutual Fund',   'business-outline',        'investment'],
      ['Gold Investment','medal-outline',          'investment'],
      ['Fixed Deposit', 'lock-closed-outline',     'investment'],
      ['LIC',           'shield-checkmark-outline','investment'],
      ['Chit Fund',     'people-outline',          'investment'],
      ['Stocks',        'bar-chart-outline',       'investment'],
      ['Crypto',        'diamond-outline',         'investment'],
      ['Retirement',    'sunny-outline',           'investment'],
      ['Emergency Fund','umbrella-outline',        'investment'],
      ['Real Estate',   'home-outline',            'investment'],
      ['Child Savings', 'happy-outline',           'investment'],
      ['Education Fund','school-outline',          'investment'],
    ];
    for (const [name, icon, type] of iconUpdates) {
      db.runSync(
        "UPDATE categories SET icon = ? WHERE name = ? AND type = ? AND (icon IS NULL OR icon = 'ellipse-outline' OR icon = '')",
        [icon, name, type]
      );
    }

    const settingsResult = db.getAllSync('SELECT COUNT(*) as count FROM app_settings');
    if (settingsResult[0].count === 0) {
      db.execSync("INSERT INTO app_settings (theme, currency) VALUES ('dark', 'AED')");
    }

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
        ('Others',       'expense', 'ellipse-outline',     0),
        ('SIP',           'investment', 'trending-up-outline', 0),
        ('Mutual Fund',   'investment', 'business-outline',    0),
        ('Gold Investment','investment', 'medal-outline',      0),
        ('Fixed Deposit', 'investment', 'lock-closed-outline', 0),
        ('LIC',           'investment', 'shield-checkmark-outline', 0),
        ('Chit Fund',     'investment', 'people-outline',      0),
        ('Stocks',        'investment', 'bar-chart-outline',   0),
        ('Crypto',        'investment', 'diamond-outline',     0),
        ('Retirement',    'investment', 'sunny-outline',       0),
        ('Emergency Fund','investment', 'umbrella-outline',    0),
        ('Real Estate',   'investment', 'home-outline',        0),
        ('Child Savings', 'investment', 'happy-outline',       0),
        ('Education Fund','investment', 'school-outline',      0);
      `);
    } else {
      db.execSync(`
        DELETE FROM categories WHERE type = 'investment' AND is_custom = 0;
        INSERT INTO categories (name, type, icon, is_custom) VALUES 
        ('SIP',           'investment', 'trending-up-outline', 0),
        ('Mutual Fund',   'investment', 'business-outline',    0),
        ('Gold Investment','investment', 'medal-outline',      0),
        ('Fixed Deposit', 'investment', 'lock-closed-outline', 0),
        ('LIC',           'investment', 'shield-checkmark-outline', 0),
        ('Chit Fund',     'investment', 'people-outline',      0),
        ('Stocks',        'investment', 'bar-chart-outline',   0),
        ('Crypto',        'investment', 'diamond-outline',     0),
        ('Retirement',    'investment', 'sunny-outline',       0),
        ('Emergency Fund','investment', 'umbrella-outline',    0),
        ('Real Estate',   'investment', 'home-outline',        0),
        ('Child Savings', 'investment', 'happy-outline',       0),
        ('Education Fund','investment', 'school-outline',      0);
      `);
    }

    // Dev cleanup one-off trigger:
    try {
      db.execSync("ALTER TABLE app_settings ADD COLUMN dev_cleared INTEGER DEFAULT 0;");
    } catch (e) {
      // already exists or can't alter
    }
    
    try {
      const settings = db.getFirstSync("SELECT dev_cleared FROM app_settings");
      if (settings && (!settings.dev_cleared || settings.dev_cleared < 2)) {
        db.execSync("DELETE FROM income;");
        db.execSync("DELETE FROM expenses;");
        db.execSync("DELETE FROM investments;");
        db.execSync("DELETE FROM investment_contributions;");
        db.execSync("DELETE FROM reminders;");
        db.execSync("DELETE FROM goals;");
        db.execSync("UPDATE app_settings SET dev_cleared = 2;");
        console.log("Dev environment entries cleared successfully!");
      }
    } catch (e) {
      console.error("Failed to run dev clear one-off:", e);
    }

    // Database Speed Indexes for Reports, Dashboard and Filtering performance
    try {
      db.execSync(`
        CREATE INDEX IF NOT EXISTS idx_income_currency_date ON income(currency, date);
        CREATE INDEX IF NOT EXISTS idx_income_is_archived ON income(is_archived);
        CREATE INDEX IF NOT EXISTS idx_expenses_currency_date ON expenses(currency, date);
        CREATE INDEX IF NOT EXISTS idx_expenses_is_archived ON expenses(is_archived);
        CREATE INDEX IF NOT EXISTS idx_investments_status ON investments(status);
        CREATE INDEX IF NOT EXISTS idx_contributions_inv_id ON investment_contributions(investment_id);
        CREATE INDEX IF NOT EXISTS idx_contributions_is_archived ON investment_contributions(is_archived);
        CREATE INDEX IF NOT EXISTS idx_reminders_enabled ON reminders(enabled);
        CREATE INDEX IF NOT EXISTS idx_categories_type_name ON categories(type, name);
      `);
      console.log("Performance indexes created successfully");
    } catch (e) {
      console.error("Failed to create speed indexes:", e);
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
export const updateAppSettings = (key, value) => {
  try {
    const db = getDb();
    db.runSync(`UPDATE app_settings SET ${key} = ?`, [value]);
  } catch (e) {
    console.error('Update settings error:', e);
  }
};

export const getGoals = () => {
  const db = getDb();
  return db.getAllSync('SELECT * FROM goals ORDER BY created_at DESC');
};

export const addGoal = (title, target, currency, targetDate) => {
  const db = getDb();
  db.runSync(
    'INSERT INTO goals (title, target_amount, currency, target_date) VALUES (?, ?, ?, ?)',
    [title, parseFloat(target), currency, targetDate]
  );
};

export const updateGoalProgress = (id, current) => {
  const db = getDb();
  db.runSync('UPDATE goals SET current_amount = ? WHERE id = ?', [parseFloat(current), id]);
};

export const deleteGoal = (id) => {
  const db = getDb();
  db.runSync('DELETE FROM goals WHERE id = ?', [id]);
};
