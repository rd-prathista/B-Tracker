import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { getDb } from '../database/db';

const HAS_REGISTERED_KEY = 'btracker_has_registered';

// Helper to hash passwords and PINs
const hashString = async (string) => {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    string
  );
};

export const hasRegistered = async () => {
  try {
    const db = getDb();
    const result = db.getFirstSync('SELECT COUNT(*) as count FROM users');
    return result.count > 0;
  } catch (e) {
    return false;
  }
};

export const devResetApp = async () => {
  const db = getDb();
  db.execSync('DELETE FROM users;');
  db.execSync('DELETE FROM income;');
  db.execSync('DELETE FROM expenses;');
  await SecureStore.deleteItemAsync(HAS_REGISTERED_KEY);
  await SecureStore.deleteItemAsync('auth_type');
  await SecureStore.deleteItemAsync('user_email');
};

export const registerEmail = async (email, password) => {
  const hashedPassword = await hashString(password);
  const normalizedEmail = email.toLowerCase().trim();
  
  const db = getDb();
  db.runSync('INSERT INTO users (email, password_hash) VALUES (?, ?)', [normalizedEmail, hashedPassword]);
  
  await SecureStore.setItemAsync(HAS_REGISTERED_KEY, 'true');
  await SecureStore.setItemAsync('auth_type', 'email');
  await SecureStore.setItemAsync('user_email', normalizedEmail);
};

export const registerPIN = async (pin) => {
  const hashedPin = await hashString(pin);
  
  const db = getDb();
  // We update the existing user's PIN
  db.runSync('UPDATE users SET pin_hash = ?', [hashedPin]);
  
  await SecureStore.setItemAsync('auth_type', 'pin');
};

export const setAppCurrency = (currency) => {
  const db = getDb();
  db.runSync('UPDATE app_settings SET currency = ?', [currency]);
};

export const loginEmail = async (email, password) => {
  const hashedPassword = await hashString(password);
  const normalizedEmail = email.toLowerCase().trim();
  
  const db = getDb();
  const user = db.getFirstSync('SELECT * FROM users WHERE email = ? AND password_hash = ?', [normalizedEmail, hashedPassword]);
  
  return !!user;
};

/**
 * Update the user's PIN
 */
export const updatePIN = async (newPin) => {
  const hashedPin = await hashString(newPin);
  const db = getDb();
  db.runSync('UPDATE users SET pin_hash = ?', [hashedPin]);
};

/**
 * Update the user's Password
 */
export const updatePassword = async (newPassword) => {
  const hashedPassword = await hashString(newPassword);
  const db = getDb();
  db.runSync('UPDATE users SET password_hash = ?', [hashedPassword]);
};

export const loginPIN = async (pin) => {
  const hashedPin = await hashString(pin);
  
  const db = getDb();
  const user = db.getFirstSync('SELECT * FROM users WHERE pin_hash = ?', [hashedPin]);
  
  return !!user;
};

export const getAuthType = async () => {
  return await SecureStore.getItemAsync('auth_type');
};
