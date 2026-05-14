import { getDb } from '../database/db';

export const SUPPORTED_CURRENCIES = ['AED', 'INR'];

/**
 * Add a new transaction (income or expense) with its own currency
 */
export const addTransaction = (type, amount, currency, date, category, notes = '') => {
  const db = getDb();
  let table;
  if (type === 'income') table = 'income';
  else if (type === 'expense') table = 'expenses';
  else if (type === 'investment') table = 'investments';
  else return;


  db.runSync(
    `INSERT INTO ${table} (amount, currency, date, category, notes) VALUES (?, ?, ?, ?, ?)`,
    [parseFloat(amount), currency, date, category, notes]
  );
};

/**
 * Load one row by id (income or expense); includes `type` on the object.
 */
export const getTransactionById = (type, id) => {
  const db = getDb();
  let table;
  if (type === 'income') table = 'income';
  else if (type === 'expense') table = 'expenses';
  else if (type === 'investment') table = 'investments';
  else return null;

  const row = db.getFirstSync(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  if (!row) return null;
  return { ...row, type };
};

/**
 * Update an existing transaction row
 */
export const updateTransaction = (type, id, { amount, currency, date, category, notes = '' }) => {
  const db = getDb();
  let table;
  if (type === 'income') table = 'income';
  else if (type === 'expense') table = 'expenses';
  else if (type === 'investment') table = 'investments';
  else return;

  db.runSync(
    `UPDATE ${table} SET amount = ?, currency = ?, date = ?, category = ?, notes = ? WHERE id = ?`,
    [parseFloat(amount), currency, date, category, notes, id]
  );
};

/**
 * Delete a transaction row
 */
export const deleteTransaction = (type, id) => {
  const db = getDb();
  let table;
  if (type === 'income') table = 'income';
  else if (type === 'expense') table = 'expenses';
  else if (type === 'investment') table = 'investments';
  else return;

  db.runSync(`DELETE FROM ${table} WHERE id = ?`, [id]);
};

const appendTransactionFilters = (alias) => {
  let clause = '';
  const params = [];
  const add = (sql, ...vals) => {
    clause += sql;
    params.push(...vals);
  };
  return {
    clause: () => clause,
    paramList: () => params,
    withCurrency: (currency) => {
      if (!currency) return;
      add(` AND ${alias}.currency = ?`, currency);
    },
    withStartDate: (startDate) => {
      if (!startDate) return;
      add(` AND ${alias}.date >= ?`, startDate);
    },
    withEndDate: (endDate) => {
      if (!endDate) return;
      add(` AND ${alias}.date <= ?`, endDate);
    },
    withSearch: (query) => {
      if (!query) return;
      const q = `%${query}%`;
      add(` AND (${alias}.category LIKE ? OR ${alias}.notes LIKE ? OR CAST(${alias}.amount AS TEXT) LIKE ? OR ${alias}.currency LIKE ? OR strftime('%m', ${alias}.date) LIKE ? OR strftime('%B', ${alias}.date) LIKE ?)`, q, q, q, q, q, q);
    }
  };
};


/**
 * Get transactions (with optional filters). Each row includes `icon` from `categories` when matched.
 */
export const getRecentTransactions = (limit = 8) => {
  return getTransactions({ limit });
};

export const getTransactions = (filters = {}) => {
  const { limit = 100, currency, type, startDate, endDate, search } = filters;
  const db = getDb();

  let income = [];
  let expenses = [];
  let investments = [];


  if (!type || type === 'income') {
    const b = appendTransactionFilters('i');
    b.withCurrency(currency);
    b.withStartDate(startDate);
    b.withEndDate(endDate);
    b.withSearch(search);

    const incomeQuery =
      `SELECT i.id, i.amount, i.currency, i.date, i.category, i.notes, 'income' as type, ` +
      `COALESCE(NULLIF(TRIM(c.icon), ''), 'ellipse-outline') as icon ` +
      `FROM income i ` +
      `LEFT JOIN categories c ON i.category = c.name AND c.type = 'income' ` +
      `WHERE 1=1${b.clause()}`;
    income = db.getAllSync(incomeQuery, b.paramList());
  }

  if (!type || type === 'expense') {
    const b = appendTransactionFilters('e');
    b.withCurrency(currency);
    b.withStartDate(startDate);
    b.withEndDate(endDate);
    b.withSearch(search);

    const expenseQuery =
      `SELECT e.id, e.amount, e.currency, e.date, e.category, e.notes, 'expense' as type, ` +
      `COALESCE(NULLIF(TRIM(c.icon), ''), 'ellipse-outline') as icon ` +
      `FROM expenses e ` +
      `LEFT JOIN categories c ON e.category = c.name AND c.type = 'expense' ` +
      `WHERE 1=1${b.clause()}`;
    expenses = db.getAllSync(expenseQuery, b.paramList());
  }

  if (!type || type === 'investment') {
    const b = appendTransactionFilters('inv');
    b.withCurrency(currency);
    b.withStartDate(startDate);
    b.withEndDate(endDate);
    b.withSearch(search);

    const invQuery =
      `SELECT inv.id, inv.amount, inv.currency, inv.date, inv.category, inv.notes, 'investment' as type, ` +
      `COALESCE(NULLIF(TRIM(c.icon), ''), 'briefcase-outline') as icon ` +
      `FROM investments inv ` +
      `LEFT JOIN categories c ON inv.category = c.name AND c.type = 'investment' ` +
      `WHERE 1=1${b.clause()}`;
    investments = db.getAllSync(invQuery, b.paramList());
  }

  return [...income, ...expenses, ...investments]

    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit);
};

/**
 * Calculate Dashboard Balances — separately for AED and INR
 */
export const getDashboardBalances = () => {
  const db = getDb();

  const getByCode = (code) => {
    const incomeRes = db.getFirstSync(`SELECT SUM(amount) as total FROM income WHERE currency = ?`, [code]);
    const totalIncome = incomeRes?.total || 0;

    const expenseRes = db.getFirstSync(`SELECT SUM(amount) as total FROM expenses WHERE currency = ?`, [code]);
    const totalExpense = expenseRes?.total || 0;

    const invRes = db.getFirstSync(`SELECT SUM(amount) as total FROM investments WHERE currency = ?`, [code]);
    const totalInvestment = invRes?.total || 0;

    return { 
      income: totalIncome, 
      expense: totalExpense, 
      investment: totalInvestment, 
      balance: totalIncome - totalExpense - totalInvestment 
    };
  };

  return {
    AED: getByCode('AED'),
    INR: getByCode('INR'),
  };
};


/**
 * Get categories by type — returns { name, icon }
 */
export const getCategories = (type) => {
  const db = getDb();
  return db.getAllSync('SELECT id, name, icon FROM categories WHERE type = ? ORDER BY is_custom ASC, name ASC', [type]);
};

/**
 * Add a new custom category with an icon
 */
export const addCategory = (name, type, icon = 'ellipse-outline') => {
  const db = getDb();
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Category name cannot be empty');

  const existing = db.getFirstSync('SELECT id FROM categories WHERE name = ? AND type = ?', [trimmed, type]);
  if (existing) throw new Error(`Category "${trimmed}" already exists`);

  db.runSync('INSERT INTO categories (name, type, icon, is_custom) VALUES (?, ?, ?, 1)', [trimmed, type, icon]);
};

/**
 * Get category usage — returns count and total sum of transactions
 */
export const getCategoryUsage = (name, type) => {
  const db = getDb();
  const table = type === 'income' ? 'income' : 'expenses';
  
  // If 'investment' or other future types, we don't have tables yet
  if (type !== 'income' && type !== 'expense') return { count: 0, total: 0 };

  const res = db.getFirstSync(
    `SELECT COUNT(*) as count, SUM(amount) as total FROM ${table} WHERE category = ?`,
    [name]
  );
  return { count: res?.count || 0, total: res?.total || 0 };
};

/**
 * Get all transactions for a specific category
 */
export const getCategoryTransactions = (name, type) => {
  const db = getDb();
  const table = type === 'income' ? 'income' : 'expenses';
  
  if (type !== 'income' && type !== 'expense') return [];

  return db.getAllSync(
    `SELECT *, '${type}' as type FROM ${table} WHERE category = ? ORDER BY date DESC`,
    [name]
  );
};

/**
 * Reassign a single transaction to a new category
 */
export const reassignTransactionCategory = (type, transactionId, newCategory) => {
  const db = getDb();
  const table = type === 'income' ? 'income' : 'expenses';
  db.runSync(`UPDATE ${table} SET category = ? WHERE id = ?`, [newCategory, transactionId]);
};

/**
 * Bulk reassign all transactions from one category to another
 */
export const bulkReassignCategory = (type, oldCategory, newCategory) => {
  const db = getDb();
  const table = type === 'income' ? 'income' : 'expenses';
  db.runSync(`UPDATE ${table} SET category = ? WHERE category = ?`, [newCategory, oldCategory]);
};

/**
 * Safely delete a category by its ID
 */
export const safeDeleteCategory = (id) => {
  const db = getDb();
  db.runSync('DELETE FROM categories WHERE id = ?', [id]);
};

/**
 * Update category name and icon. 
 * If name changes, it updates all linked transactions to maintain history.
 */
export const updateCategory = (id, oldName, newName, type, icon) => {
  const db = getDb();
  const trimmedNew = newName.trim();
  if (!trimmedNew) throw new Error('Category name cannot be empty');

  // Check for duplicate names (excluding itself)
  const existing = db.getFirstSync(
    'SELECT id FROM categories WHERE name = ? AND type = ? AND id != ?',
    [trimmedNew, type, id]
  );
  if (existing) throw new Error(`Category "${trimmedNew}" already exists`);

  // Update category table
  db.runSync(
    'UPDATE categories SET name = ?, icon = ? WHERE id = ?',
    [trimmedNew, icon, id]
  );

  // If name changed, update transaction tables
  if (trimmedNew !== oldName) {
    if (type === 'income') {
      db.runSync('UPDATE income SET category = ? WHERE category = ?', [trimmedNew, oldName]);
    } else if (type === 'expense') {
      db.runSync('UPDATE expenses SET category = ? WHERE category = ?', [trimmedNew, oldName]);
    }
  }
};

/**
 * Get report data (Totals and Category Breakdown) for a specific currency and date range
 */
export const getReportData = (currency, startDate, endDate, search) => {
  const db = getDb();
  const baseParams = [currency, startDate, endDate];
  let searchClause = '';
  let searchParams = [];
  
  if (search) {
    const q = `%${search}%`;
    searchClause = ` AND (category LIKE ? OR notes LIKE ? OR CAST(amount AS TEXT) LIKE ? OR currency LIKE ? OR strftime('%m', date) LIKE ? OR strftime('%B', date) LIKE ?)`;
    searchParams = [q, q, q, q, q, q];
  }


  // Get total income
  const incomeRes = db.getFirstSync(
    `SELECT SUM(amount) as total FROM income WHERE currency = ? AND date >= ? AND date <= ?${searchClause}`, 
    [...baseParams, ...searchParams]
  );

  const totalIncome = incomeRes?.total || 0;

  // Get total expense
  const expenseRes = db.getFirstSync(
    `SELECT SUM(amount) as total FROM expenses WHERE currency = ? AND date >= ? AND date <= ?${searchClause}`, 
    [...baseParams, ...searchParams]
  );

  const totalExpense = expenseRes?.total || 0;

  // Get expense breakdown by category, joined with categories table for icons
  const breakdown = db.getAllSync(`
    SELECT e.category, SUM(e.amount) as total, c.icon 
    FROM expenses e
    LEFT JOIN categories c ON e.category = c.name AND c.type = 'expense'
    WHERE e.currency = ? AND e.date >= ? AND e.date <= ?${searchClause.replace(/category/g, 'e.category').replace(/notes/g, 'e.notes').replace(/amount/g, 'e.amount').replace(/currency/g, 'e.currency').replace(/date/g, 'e.date')}
    GROUP BY e.category
    ORDER BY total DESC
  `, [...baseParams, ...searchParams]);


  return {
    totalIncome,
    totalExpense,
    savings: totalIncome - totalExpense,
    breakdown: breakdown.map(b => ({
      ...b,
      percentage: totalExpense > 0 ? (b.total / totalExpense) * 100 : 0
    }))
  };
};

/**
 * Get category spending trends over the last 6 months
 */
export const getCategoryTrends = (currency) => {
  const db = getDb();
  // We use strftime('%Y-%m') to group by month
  const rows = db.getAllSync(`
    SELECT 
      e.category, 
      strftime('%Y-%m', e.date) as month,
      SUM(e.amount) as total,
      c.icon
    FROM expenses e
    LEFT JOIN categories c ON e.category = c.name AND c.type = 'expense'
    WHERE e.currency = ? AND e.date >= date('now', 'start of month', '-5 months')
    GROUP BY e.category, month
    ORDER BY month DESC, total DESC
  `, [currency]);

  // Transform rows into { month1: [{ category, total, icon }], month2: ... }
  // or a pivot structure.
  const trends = {};
  rows.forEach(row => {
    if (!trends[row.month]) trends[row.month] = [];
    trends[row.month].push({ category: row.category, total: row.total, icon: row.icon });
  });

  return trends;
};

/**
 * Get savings trends (Income - Expenses) across currencies for the last 6 months
 */
export const getSavingsTrends = () => {
  const db = getDb();
  // Union income and expenses
  const rows = db.getAllSync(`
    SELECT 
      strftime('%Y-%m', date) as month,
      currency,
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as totalIncome,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as totalExpense
    FROM (
      SELECT amount, currency, date, 'income' as type FROM income
      UNION ALL
      SELECT amount, currency, date, 'expense' as type FROM expenses
    )
    WHERE date >= date('now', 'start of month', '-5 months')
    GROUP BY month, currency
    ORDER BY month DESC
  `);

  const trends = {};
  rows.forEach(row => {
    if (!trends[row.month]) trends[row.month] = { AED: { savings: 0 }, INR: { savings: 0 } };
    trends[row.month][row.currency] = {
      savings: row.totalIncome - row.totalExpense,
      income: row.totalIncome,
      expense: row.totalExpense
    };
  });

  return trends;
};

/**
 * Get investment analytics (Monthly Trends and Category Breakdown)
 */
export const getInvestmentAnalytics = (currency) => {
  const db = getDb();
  const params = [currency];

  // Total Invested
  const totalRes = db.getFirstSync(`SELECT SUM(amount) as total FROM investments WHERE currency = ?`, params);
  const totalInvested = totalRes?.total || 0;

  // Category Breakdown
  const breakdown = db.getAllSync(`
    SELECT category, SUM(amount) as total 
    FROM investments 
    WHERE currency = ? 
    GROUP BY category 
    ORDER BY total DESC
  `, params);

  // Monthly Trend (Last 12 months)
  const monthlyTrend = db.getAllSync(`
    SELECT strftime('%Y-%m', date) as month, SUM(amount) as total
    FROM investments
    WHERE currency = ?
    GROUP BY month
    ORDER BY month DESC
    LIMIT 12
  `, params);

  return {
    totalInvested,
    breakdown,
    monthlyTrend: monthlyTrend.reverse(),
  };
};

