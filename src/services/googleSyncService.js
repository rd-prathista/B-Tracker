import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import { Alert } from 'react-native';
import { getAppDataAsJSON, importBackupData } from './backupService';

WebBrowser.maybeCompleteAuthSession();

// --- CONFIGURATION ---
// We will use the Firebase Auth REST API directly
const FIREBASE_API_KEY = 'AIzaSyCgu5ASIVjSWKJmOEXP5b1uHI8D1_sdNQo';
const PROJECT_ID = 'b-tracker-28';

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
  clientId: '734993274471-8cms386s2iqg7qth6oc2ig9forbi4lbf.apps.googleusercontent.com',
  scopes: ['email', 'profile', 'openid'],
  useProxy: true,
};
