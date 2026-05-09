import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import { Alert } from 'react-native';
import { getAppDataAsJSON, importBackupData } from './backupService';

WebBrowser.maybeCompleteAuthSession();

// --- CONFIGURATION ---
// Credentials are loaded from .env (never hardcoded)
// See .env.example for the required variable names.
const FIREBASE_API_KEY = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
const PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;

/**
 * Get saved access token (we'll use this for our session)
 */
export const getAccessToken = async () => {
  return await SecureStore.getItemAsync('firebase_id_token');
};

/**
 * Save access token
 */
export const saveAccessToken = async (token) => {
  await SecureStore.setItemAsync('firebase_id_token', token);
};

export const getLastSyncTimestamp = async () => {
  return await SecureStore.getItemAsync('last_firebase_sync');
};

/**
 * This is the MAGIC part. Instead of complex Google OAuth, 
 * we use a simple Google Auth flow that Firebase loves.
 */
export const authConfig = {
  // We'll keep this for the UI, but we're changing the logic in SettingsScreen
  clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  scopes: ['email', 'profile', 'openid'],
  useProxy: true,
};
