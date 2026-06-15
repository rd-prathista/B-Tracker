import { getDb, getActiveCurrencies } from '../database/db';

export const getReminders = () => {
  const db = getDb();
  const activeCurs = getActiveCurrencies();
  if (activeCurs.length === 0) return [];
  const placeholders = activeCurs.map(() => '?').join(', ');
  return db.getAllSync(`SELECT * FROM reminders WHERE currency IS NULL OR currency IN (${placeholders}) ORDER BY due_date ASC`, activeCurs);
};

export const getUpcomingReminders = () => {
  const db = getDb();
  const activeCurs = getActiveCurrencies();
  if (activeCurs.length === 0) return [];
  const placeholders = activeCurs.map(() => '?').join(', ');
  return db.getAllSync(`SELECT * FROM reminders WHERE enabled = 1 AND (currency IS NULL OR currency IN (${placeholders})) ORDER BY due_date ASC LIMIT 10`, activeCurs);
};

export const addReminder = (data) => {
  const db = getDb();
  
  // Support both camelCase and snake_case properties
  const title = data.title;
  const type = data.type;
  const amount = data.amount;
  const currency = data.currency;
  const dueDate = data.dueDate || data.due_date;
  const repeatType = data.repeatType || data.repeat_frequency || 'One Time';
  const linkedInvestmentId = data.linkedInvestmentId || data.linked_investment_id || null;

  db.runSync(
    'INSERT INTO reminders (title, type, amount, currency, due_date, repeat_type, enabled, linked_investment_id) VALUES (?, ?, ?, ?, ?, ?, 1, ?)',
    [title, type, parseFloat(amount) || null, currency || null, dueDate, repeatType, linkedInvestmentId]
  );
};

export const updateReminder = (id, data) => {
  const db = getDb();
  
  // Support both camelCase and snake_case properties
  const title = data.title;
  const type = data.type;
  const amount = data.amount;
  const currency = data.currency;
  const dueDate = data.dueDate || data.due_date;
  const repeatType = data.repeatType || data.repeat_frequency || 'One Time';
  const enabled = data.enabled !== undefined ? data.enabled : 1;
  const linkedInvestmentId = data.linkedInvestmentId || data.linked_investment_id || null;

  db.runSync(
    'UPDATE reminders SET title = ?, type = ?, amount = ?, currency = ?, due_date = ?, repeat_type = ?, enabled = ?, linked_investment_id = ? WHERE id = ?',
    [title, type, parseFloat(amount) || null, currency || null, dueDate, repeatType, enabled ? 1 : 0, linkedInvestmentId, id]
  );
};

export const deleteReminder = (id) => {
  const db = getDb();
  db.runSync('DELETE FROM reminders WHERE id = ?', [id]);
};

export const toggleReminder = (id, enabled) => {
  const db = getDb();
  db.runSync('UPDATE reminders SET enabled = ? WHERE id = ?', [enabled ? 1 : 0, id]);
};

// Standardized UI aliases
export const toggleReminderActive = toggleReminder;

// Mock notification permission/setup
export const setupNotifications = async () => {
  // Purely dashboard-only notifications, no background complexity or alerts required
  return Promise.resolve(true);
};
