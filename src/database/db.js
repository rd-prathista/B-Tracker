import * as SQLite from 'expo-sqlite';

// Open the database (creates it if it doesn't exist)
const db = SQLite.openDatabaseSync('btracker.db');

const ensureColumnExists = (dbInstance, tableName, columnName, columnDef) => {
  try {
    const tableInfo = dbInstance.getAllSync(`PRAGMA table_info(${tableName});`);
    const exists = tableInfo.some(col => col.name === columnName);
    console.log(`[DB Schema Check] ${tableName}.${columnName}: ${exists ? 'EXISTS' : 'MISSING'}`);
    if (!exists) {
      console.log(`[DB Schema Repair] Executing: ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
      dbInstance.execSync(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef};`);
      console.log(`[DB Schema Repair] Successfully added ${columnName} to ${tableName}`);
    }
  } catch (e) {
    console.error(`[DB Schema Error] Failed to ensure column ${columnName} on table ${tableName}:`, e);
  }
};

const verifyAndRepairSchema = (dbInstance) => {
  console.log('[DB Schema Audit] Running dynamic schema verification & self-healing audit...');
  
  ensureColumnExists(dbInstance, 'loans', 'is_opening_balance', 'INTEGER DEFAULT 0');
  ensureColumnExists(dbInstance, 'loans', 'monthly_emi', 'REAL DEFAULT 0');
  ensureColumnExists(dbInstance, 'loans', 'funded_by', "TEXT DEFAULT 'OTHER'");

  ensureColumnExists(dbInstance, 'investment_contributions', 'is_opening_balance', 'INTEGER DEFAULT 0');
  ensureColumnExists(dbInstance, 'investment_contributions', 'funded_by', "TEXT DEFAULT 'OTHER'");

  ensureColumnExists(dbInstance, 'investments', 'completed_installments', 'INTEGER DEFAULT 0');
  ensureColumnExists(dbInstance, 'investments', 'funded_by', "TEXT DEFAULT 'OTHER'");

  ensureColumnExists(dbInstance, 'expenses', 'payment_source', "TEXT DEFAULT 'Debit Card'");
  ensureColumnExists(dbInstance, 'expenses', 'credit_card_id', 'INTEGER');
  ensureColumnExists(dbInstance, 'expenses', 'funded_by', "TEXT DEFAULT 'OTHER'");

  ensureColumnExists(dbInstance, 'income', 'income_source', "TEXT DEFAULT 'OTHER'");

  try {
    const loansCols = dbInstance.getAllSync(`PRAGMA table_info(loans);`).map(c => c.name);
    const contribCols = dbInstance.getAllSync(`PRAGMA table_info(investment_contributions);`).map(c => c.name);
    console.log('[DB Schema Audit Final] Verified loans columns:', loansCols);
    console.log('[DB Schema Audit Final] Verified investment_contributions columns:', contribCols);
  } catch (e) {
    console.error('[DB Schema Audit Final] Inspection failed:', e);
  }
};

export const initDatabase = () => {
  try {
    // 1. Enable journal mode and open baseline tables
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
        attachment_uri TEXT,
        is_archived INTEGER DEFAULT 0,
        income_source TEXT DEFAULT 'OTHER',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'AED',
        date TEXT NOT NULL,
        category TEXT NOT NULL,
        notes TEXT,
        attachment_uri TEXT,
        is_archived INTEGER DEFAULT 0,
        funded_by TEXT DEFAULT 'OTHER',
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
        dev_cleared INTEGER DEFAULT 0,
        last_sync_time TEXT,
        active_currencies TEXT DEFAULT '["AED", "INR"]'
      );

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
        funded_by TEXT DEFAULT 'OTHER',
        completed_installments INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS investment_contributions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        investment_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL,
        contribution_date TEXT NOT NULL,
        notes TEXT,
        attachment_uri TEXT,
        is_archived INTEGER DEFAULT 0,
        is_opening_balance INTEGER DEFAULT 0,
        funded_by TEXT DEFAULT 'OTHER',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (investment_id) REFERENCES investments (id) ON DELETE CASCADE
      );

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

      CREATE TABLE IF NOT EXISTS loans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_name TEXT NOT NULL,
        type TEXT NOT NULL,
        source_type TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL,
        start_date TEXT NOT NULL,
        expected_return_date TEXT,
        notes TEXT,
        status TEXT DEFAULT 'Active',
        is_archived INTEGER DEFAULT 0,
        funded_by TEXT DEFAULT 'OTHER',
        is_opening_balance INTEGER DEFAULT 0,
        monthly_emi REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS loan_repayments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        loan_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (loan_id) REFERENCES loans (id) ON DELETE CASCADE
      );
    `);

    // 2. Read current user_version
    const versionResult = db.getFirstSync("PRAGMA user_version;");
    const currentVersion = versionResult ? versionResult.user_version : 0;

    console.log(`[DB Init] Current database user_version: ${currentVersion}`);

    if (currentVersion < 18) {
      console.log(`Running database migration/repair (current version: ${currentVersion})`);
      
      // Temporarily disable foreign keys during schema alterations
      db.execSync("PRAGMA foreign_keys = OFF;");

      if (currentVersion < 4) {
        // Case A: User has investments_old from a failed/incomplete migration. Restore it.
        const oldExists = db.getAllSync("SELECT name FROM sqlite_master WHERE type='table' AND name='investments_old'");
        if (oldExists.length > 0) {
          console.log("Restoring investments_old table to investments...");
          try {
            db.execSync(`
              DROP TABLE IF EXISTS investments;
              ALTER TABLE investments_old RENAME TO investments;
            `);
          } catch (e) {
            console.error("Failed to restore investments_old table:", e);
          }
        }

        let hasOldColumns = false;
        const investmentsTableExists = db.getAllSync("SELECT name FROM sqlite_master WHERE type='table' AND name='investments'");
        if (investmentsTableExists.length > 0) {
          const tableInfo = db.getAllSync("PRAGMA table_info(investments);");
          hasOldColumns = tableInfo.some(col => col.name === 'amount' || col.name === 'date');
        }

        if (hasOldColumns) {
          console.log("Migrating legacy investments table to new schema...");
          try {
            db.execSync("ALTER TABLE investments RENAME TO investments_old;");
            
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
                attachment_uri TEXT,
                is_archived INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (investment_id) REFERENCES investments (id) ON DELETE CASCADE
              );
            `);

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
          } catch (e) {
            console.error("Legacy investments migration failed:", e);
          }
        }
      }

      if (currentVersion < 5) {
        db.execSync(`
          CREATE TABLE IF NOT EXISTS loans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            person_name TEXT NOT NULL,
            type TEXT NOT NULL,
            source_type TEXT NOT NULL,
            amount REAL NOT NULL,
            currency TEXT NOT NULL,
            start_date TEXT NOT NULL,
            expected_return_date TEXT,
            notes TEXT,
            status TEXT DEFAULT 'Active',
            is_archived INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS loan_repayments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            loan_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            date TEXT NOT NULL,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (loan_id) REFERENCES loans (id) ON DELETE CASCADE
          );

          CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
          CREATE INDEX IF NOT EXISTS idx_loan_repayments_loan_id ON loan_repayments(loan_id);
        `);
      }

      if (currentVersion < 17) {
        try {
          db.execSync(`
            CREATE TABLE IF NOT EXISTS credit_cards (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              last_4 TEXT NOT NULL,
              bank_name TEXT NOT NULL,
              credit_limit REAL NOT NULL,
              color TEXT NOT NULL,
              status TEXT DEFAULT 'Active',
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
          `);
        } catch (e) { /* Table already exists */ }
      }
    }

    // Dynamic Schema Inspection & Failsafe Auto-Repair Engine
    // Independent of PRAGMA user_version to guarantee columns exist on all live devices
    verifyAndRepairSchema(db);

    db.execSync("PRAGMA user_version = 18;");
    db.execSync("PRAGMA foreign_keys = ON;");
    console.log(`Database initialization & dynamic schema repair successfully completed to version 18!`);

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

    // Clean up any orphaned legacy contributions (where master investment was deleted previously without Cascade)
    try {
      db.execSync(`
        DELETE FROM investment_contributions 
        WHERE investment_id NOT IN (SELECT id FROM investments);
      `);
      console.log("Orphaned legacy investment contributions purged successfully");
    } catch (e) {
      console.error("Failed to clean up orphaned contributions:", e);
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

export const getActiveCurrencies = () => {
  try {
    const settings = getAppSettings();
    if (settings && settings.active_currencies) {
      const parsed = JSON.parse(settings.active_currencies);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error getting active currencies:', e);
  }
  return ['AED', 'INR'];
};

export const isCurrencyActive = (currency) => {
  return getActiveCurrencies().includes(currency);
};

export const activateCurrency = (currency) => {
  const active = getActiveCurrencies();
  if (!active.includes(currency)) {
    active.push(currency);
    updateAppSettings('active_currencies', JSON.stringify(active));
  }
};

export const deactivateCurrency = (currency) => {
  const active = getActiveCurrencies();
  const index = active.indexOf(currency);
  if (index > -1) {
    active.splice(index, 1);
    updateAppSettings('active_currencies', JSON.stringify(active));
  }
};

