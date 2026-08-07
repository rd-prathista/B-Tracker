import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getDb } from '../database/db';

/**
 * Export all app data to a JSON structure
 */
export const getAppDataAsJSON = () => {
  const db = getDb();
  
  const income = db.getAllSync('SELECT * FROM income');
  const expenses = db.getAllSync('SELECT * FROM expenses');
  const categories = db.getAllSync('SELECT * FROM categories');
  const users = db.getAllSync('SELECT * FROM users');
  const investments = db.getAllSync('SELECT * FROM investments');
  const contributions = db.getAllSync('SELECT * FROM investment_contributions');
  const reminders = db.getAllSync('SELECT * FROM reminders');
  const loans = db.getAllSync('SELECT * FROM loans');
  const repayments = db.getAllSync('SELECT * FROM loan_repayments');
  const app_settings = db.getAllSync('SELECT * FROM app_settings');

  return {
    version: '1.5',
    timestamp: new Date().toISOString(),
    data: { income, expenses, categories, users, investments, contributions, reminders, loans, repayments, app_settings }
  };
};

/**
 * Save data to a local file and open sharing dialog
 */
export const exportBackup = async () => {
  try {
    const data = getAppDataAsJSON();
    const jsonString = JSON.stringify(data, null, 2);
    const fileName = `B_Tracker_Backup_${new Date().toISOString().split('T')[0]}.json`;
    const fileUri = FileSystem.cacheDirectory + fileName;

    await FileSystem.writeAsStringAsync(fileUri, jsonString);
    
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri);
    } else {
      throw new Error('Sharing is not available on this device');
    }
    return true;
  } catch (error) {
    console.error('Export failed:', error);
    throw error;
  }
};

/**
 * Overwrite local database with provided JSON data
 */
export const importBackupData = async (backupJson) => {
  const db = getDb();
  const { data } = backupJson;

  if (!data || !data.income || !data.expenses) {
    throw new Error('Invalid backup file format');
  }

  // Clear current data
  db.runSync('DELETE FROM income');
  db.runSync('DELETE FROM expenses');
  db.runSync('DELETE FROM categories');
  db.runSync('DELETE FROM investments');
  db.runSync('DELETE FROM investment_contributions');
  db.runSync('DELETE FROM reminders');
  db.runSync('DELETE FROM loans');
  db.runSync('DELETE FROM loan_repayments');

  // Restore Categories
  data.categories.forEach(c => {
    db.runSync('INSERT OR IGNORE INTO categories (name, type, icon, is_custom) VALUES (?, ?, ?, ?)', 
      [c.name, c.type, c.icon, c.is_custom]);
  });

  // Restore Income
  data.income.forEach(i => {
    db.runSync('INSERT INTO income (amount, currency, date, category, notes, attachment_uri, is_archived, income_source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
      [i.amount, i.currency, i.date, i.category, i.notes, i.attachment_uri || null, i.is_archived || 0, i.income_source || 'OTHER']);
  });

  // Restore Expenses
  data.expenses.forEach(e => {
    db.runSync('INSERT INTO expenses (amount, currency, date, category, notes, attachment_uri, is_archived, funded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
      [e.amount, e.currency, e.date, e.category, e.notes, e.attachment_uri || null, e.is_archived || 0, e.funded_by || 'OTHER']);
  });

  // Restore Investments (New Schema)
  if (data.investments) {
    data.investments.forEach(i => {
      db.runSync(`INSERT INTO investments (id, type, name, currency, recurring_amount, tenure_value, tenure_type, target_amount, installments_paid, total_invested, next_due_date, status, start_date, notes, funded_by) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
        [i.id, i.type, i.name, i.currency, i.recurring_amount, i.tenure_value, i.tenure_type, i.target_amount, i.installments_paid, i.total_invested, i.next_due_date, i.status, i.start_date, i.notes, i.funded_by || 'OTHER']);
    });
  }

  // Restore Contributions
  if (data.contributions) {
    data.contributions.forEach(c => {
      db.runSync('INSERT INTO investment_contributions (id, investment_id, amount, currency, contribution_date, notes, attachment_uri, is_archived, funded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 
        [c.id, c.investment_id, c.amount, c.currency, c.contribution_date, c.notes, c.attachment_uri || null, c.is_archived || 0, c.funded_by || 'OTHER']);
    });
  }

  // Restore Reminders
  if (data.reminders) {
    data.reminders.forEach(r => {
      db.runSync('INSERT INTO reminders (id, title, type, amount, currency, due_date, repeat_type, enabled, linked_investment_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
        [r.id, r.title, r.type, r.amount, r.currency, r.due_date, r.repeat_type, r.enabled, r.linked_investment_id, r.created_at]);
    });
  }

  // Restore Loans
  if (data.loans) {
    data.loans.forEach(l => {
      db.runSync('INSERT INTO loans (id, person_name, type, source_type, amount, currency, start_date, expected_return_date, notes, status, is_archived, created_at, funded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
        [l.id, l.person_name, l.type, l.source_type, l.amount, l.currency, l.start_date, l.expected_return_date, l.notes, l.status, l.is_archived || 0, l.created_at, l.funded_by || 'OTHER']);
    });
  }

  // Restore Repayments
  if (data.repayments) {
    data.repayments.forEach(r => {
      db.runSync('INSERT INTO loan_repayments (id, loan_id, amount, date, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)', 
        [r.id, r.loan_id, r.amount, r.date, r.notes, r.created_at]);
    });
  }

  // Restore App Settings
  if (data.app_settings && data.app_settings.length > 0) {
    const s = data.app_settings[0];
    db.runSync('DELETE FROM app_settings');
    db.runSync(
      `INSERT INTO app_settings (id, theme, currency, default_currency_mode, biometrics_enabled, dev_cleared, last_sync_time, active_currencies) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        s.id,
        s.theme || 'dark',
        s.currency || 'AED',
        s.default_currency_mode || 'AED',
        s.biometrics_enabled || 0,
        s.dev_cleared || 0,
        s.last_sync_time || null,
        s.active_currencies || '["AED", "INR"]'
      ]
    );
  }

  return true;
};
