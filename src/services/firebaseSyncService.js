import { getAppDataAsJSON, importBackupData } from './backupService';
import * as SecureStore from 'expo-secure-store';

// Credentials are loaded from .env (never hardcoded)
// See .env.example for the required variable names.
const PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
const FIREBASE_API_KEY = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;

/**
 * Register or Login a user using Email/Password via Firebase REST API
 */
export const firebaseEmailAuth = async (email, password, isRegistering = false) => {
  const url = isRegistering
    ? `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`
    : `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Authentication failed');

  await SecureStore.setItemAsync('firebase_id_token', data.idToken);
  await SecureStore.setItemAsync('firebase_refresh_token', data.refreshToken);
  await SecureStore.setItemAsync('firebase_user_id', data.localId);
  await SecureStore.setItemAsync('firebase_user_email', email);
  return data.idToken;
};

export const refreshFirebaseToken = async () => {
  const refreshToken = await SecureStore.getItemAsync('firebase_refresh_token');
  if (!refreshToken) return null;
  const FIREBASE_API_KEY = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
  const url = `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${refreshToken}`
  });
  const data = await response.json();
  if (!response.ok) {
    await SecureStore.deleteItemAsync('firebase_id_token');
    await SecureStore.deleteItemAsync('firebase_refresh_token');
    return null;
  }
  await SecureStore.setItemAsync('firebase_id_token', data.id_token);
  await SecureStore.setItemAsync('firebase_refresh_token', data.refresh_token);
  return data.id_token;
};


/**
 * Upload local SQLite data to Firebase Firestore
 */
export const uploadToFirebase = async () => {
  const idToken = await refreshFirebaseToken();
  const userId = await SecureStore.getItemAsync('firebase_user_id');
  const email = await SecureStore.getItemAsync('firebase_user_email');

  if (!idToken || !userId) throw new Error('Session expired. Please logout and login again.');


  const appData = getAppDataAsJSON();
  const payload = {
    fields: {
      payload: { stringValue: JSON.stringify(appData) },
      lastSync: { stringValue: new Date().toISOString() },
      email: { stringValue: email }
    }
  };

  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/backups/${userId}`;

  const response = await fetch(firestoreUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error('Upload failed: ' + err);
  }

  await SecureStore.setItemAsync('last_firebase_sync', new Date().toISOString());
  return true;
};

/**
 * Download data from Firebase Firestore
 */
export const downloadFromFirebase = async () => {
  const idToken = await refreshFirebaseToken();
  const userId = await SecureStore.getItemAsync('firebase_user_id');

  if (!idToken || !userId) throw new Error('Session expired. Please logout and login again.');


  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/backups/${userId}`;

  const response = await fetch(firestoreUrl, {
    headers: { Authorization: `Bearer ${idToken}` }
  });

  if (!response.ok) {
    if (response.status === 404) throw new Error('No cloud backup found for this account.');
    throw new Error('Download failed');
  }

  const docData = await response.json();
  const payload = docData.fields.payload.stringValue;

  const jsonData = JSON.parse(payload);
  await importBackupData(jsonData);
  return true;
};

export const getLastFirebaseSyncTimestamp = async () => {
  return await SecureStore.getItemAsync('last_firebase_sync');
};

export const getLoggedInEmail = async () => {
  return await SecureStore.getItemAsync('firebase_user_email');
};

export const firebaseLogout = async () => {
  await SecureStore.deleteItemAsync('firebase_id_token');
  await SecureStore.deleteItemAsync('firebase_refresh_token');
  await SecureStore.deleteItemAsync('firebase_user_id');
  await SecureStore.deleteItemAsync('firebase_user_email');
};

