import { getAppDataAsJSON, importBackupData } from './backupService';
import * as SecureStore from 'expo-secure-store';

const PROJECT_ID = 'b-tracker-28';
const FIREBASE_API_KEY = 'AIzaSyCgu5ASIVjSWKJmOEXP5b1uHI8D1_sdNQo';

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
  await SecureStore.setItemAsync('firebase_user_id', data.localId);
  await SecureStore.setItemAsync('firebase_user_email', email);
  return data.idToken;
};

/**
 * Upload local SQLite data to Firebase Firestore
 */
export const uploadToFirebase = async () => {
  const idToken = await SecureStore.getItemAsync('firebase_id_token');
  const userId = await SecureStore.getItemAsync('firebase_user_id');
  const email = await SecureStore.getItemAsync('firebase_user_email');

  if (!idToken || !userId) throw new Error('You must be logged in to sync.');

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
  const idToken = await SecureStore.getItemAsync('firebase_id_token');
  const userId = await SecureStore.getItemAsync('firebase_user_id');

  if (!idToken || !userId) throw new Error('You must be logged in to restore.');

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
  await SecureStore.deleteItemAsync('firebase_user_id');
  await SecureStore.deleteItemAsync('firebase_user_email');
};
