import { getDb } from '../database/db';

export const SUPPORTED_CURRENCIES = ['AED', 'INR'];

/**
 * Add a new transaction (income or expense) with its own currency
 */
export const addTransaction = (type, amount, currency, date, category, notes = '') => {
  const db = getDb();
  const table = type === 'income' ? 'income' : 'expenses';

  db.runSync(
    `INSERT INTO ${table} (amount, currency, date, category, notes) VALUES (?, ?, ?, ?, ?)`,
    [parseFloat(amount), currency, date, category, notes]
  );
};

/**
 * Get transactions (with optional filters)
 */
export const getRecentTransactions = (limit = 8) => {
  return getTransactions({ limit });
};

export const getTransactions = (filters = {}) => {
  const { limit = 100, currency, type, startDate, endDate } = filters;
  const db = getDb();

  let incomeQuery = `SELECT id, amount, currency, date, category, notes, 'income' as type FROM income WHERE 1=1`;
  let expenseQuery = `SELECT id, amount, currency, date, category, notes, 'expense' as type FROM expenses WHERE 1=1`;
  let params = [];

  if (currency) {
    incomeQuery += ` AND currency = ?`;
    expenseQuery += ` AND currency = ?`;
    params.push(currency);
  }
  if (startDate) {
    incomeQuery += ` AND date >= ?`;
    expenseQuery += ` AND date >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    incomeQuery += ` AND date <= ?`;
    expenseQuery += ` AND date <= ?`;
    params.push(endDate);
  }

  let income = [];
  let expenses = [];

  if (!type || type === 'income')  income = db.getAllSync(incomeQuery, params);
  if (!type || type === 'expense') expenses = db.getAllSync(expenseQuery, params);

  return [...income, ...expenses]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit);
};

/**
 * Calculate Dashboard Balances — separately for AED and INR
 */
export const getDashboardBalances = () => {
  const db = getDb();

  const getTotal = (table, currency) => {
    const res = db.getFirstSync(`SELECT SUM(amount) as total FROM ${table} WHERE currency = ?`, [currency]);
    return res?.total || 0;
  };

  const aedIncome  = getTotal('income',   'AED');
  const aedExpense = getTotal('expenses', 'AED');
  const inrIncome  = getTotal('income',   'INR');
  const inrExpense = getTotal('expenses', 'INR');

  return {
    AED: { income: aedIncome, expense: aedExpense, balance: aedIncome - aedExpense },
    INR: { income: inrIncome, expense: inrExpense, balance: inrIncome - inrExpense },
  };
};

/**
 * Get categories by type — returns { name, icon }
 */
export const getCategories = (type) => {
  const db = getDb();
  return db.getAllSync('SELECT name, icon FROM categories WHERE type = ? ORDER BY is_custom ASC, name ASC', [type]);
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
 * Get report data (Totals and Category Breakdown) for a specific currency and date range
 */
export const getReportData = (currency, startDate, endDate) => {
  const db = getDb();
  const params = [currency, startDate, endDate];

  // Get total income
  const incomeRes = db.getFirstSync(
    `SELECT SUM(amount) as total FROM income WHERE currency = ? AND date >= ? AND date <= ?`, 
    params
  );
  const totalIncome = incomeRes?.total || 0;

  // Get total expense
  const expenseRes = db.getFirstSync(
    `SELECT SUM(amount) as total FROM expenses WHERE currency = ? AND date >= ? AND date <= ?`, 
    params
  );
  const totalExpense = expenseRes?.total || 0;

  // Get expense breakdown by category, joined with categories table for icons
  const breakdown = db.getAllSync(`
    SELECT e.category, SUM(e.amount) as total, c.icon 
    FROM expenses e
    LEFT JOIN categories c ON e.category = c.name AND c.type = 'expense'
    WHERE e.currency = ? AND e.date >= ? AND e.date <= ?
    GROUP BY e.category
    ORDER BY total DESC
  `, params);

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
