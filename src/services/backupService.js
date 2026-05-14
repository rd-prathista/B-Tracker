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
  // We exclude the user table for security/re-auth purposes, 
  // or include it if we want full backup. Let's include everything for full restore.
  const users = db.getAllSync('SELECT * FROM users');
  const investments = db.getAllSync('SELECT * FROM investments');
  const goals = db.getAllSync('SELECT * FROM goals');

  return {
    version: '1.1',
    timestamp: new Date().toISOString(),
    data: { income, expenses, categories, users, investments, goals }
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

  // Clear current data (SKIPPING users table to keep local PIN)
  db.runSync('DELETE FROM income');
  db.runSync('DELETE FROM expenses');
  db.runSync('DELETE FROM categories');
  db.runSync('DELETE FROM investments');
  db.runSync('DELETE FROM goals');


  // Restore Categories
  data.categories.forEach(c => {
    db.runSync('INSERT OR IGNORE INTO categories (name, type, icon, is_custom) VALUES (?, ?, ?, ?)', 
      [c.name, c.type, c.icon, c.is_custom]);
  });

  // Restore Income
  data.income.forEach(i => {
    db.runSync('INSERT INTO income (amount, currency, date, category, notes) VALUES (?, ?, ?, ?, ?)', 
      [i.amount, i.currency, i.date, i.category, i.notes]);
  });

  // Restore Expenses
  data.expenses.forEach(e => {
    db.runSync('INSERT INTO expenses (amount, currency, date, category, notes) VALUES (?, ?, ?, ?, ?)', 
      [e.amount, e.currency, e.date, e.category, e.notes]);
  });

  // Restore Investments
  if (data.investments) {
    data.investments.forEach(i => {
      db.runSync('INSERT INTO investments (amount, currency, date, category, notes) VALUES (?, ?, ?, ?, ?)', 
        [i.amount, i.currency, i.date, i.category, i.notes]);
    });
  }

  // Restore Goals
  if (data.goals) {
    data.goals.forEach(g => {
      db.runSync('INSERT INTO goals (title, target_amount, current_amount, currency, target_date) VALUES (?, ?, ?, ?, ?)', 
        [g.title, g.target_amount, g.current_amount, g.currency, g.target_date]);
    });
  }


  return true;
};
