# B Tracker Local Setup & Build Guide

This guide helps you set up a local development workspace, configure credentials, connect cloud sync, and compile production-ready APKs.

---

## 1. Local Workspace Setup

### 1.1 Prerequisites
Make sure you have node, git, and Expo CLI tools configured on your machine:
* **Node.js**: `v18.x` or `v20.x` recommended.
* **Git**: CLI configured.
* **Expo Go**: Download the mobile app on your Android or iOS device to test in real-time.

### 1.2 Checkout & Install
1. Clone the project repository and enter the directory:
   ```bash
   git clone <repo-url>
   cd b-tracker
   ```
2. Install the clean, optimized dependency tree:
   ```bash
   npm install
   ```

---

## 2. Environment Variables Configuration

B Tracker separates development tokens using Expo's secure environment system. Create a `.env` file in the root directory (based on `.env.example`):

```ini
# Firebase REST Endpoint configuration
EXPO_PUBLIC_FIREBASE_API_KEY=your_google_firebase_api_key_here
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id_here
```

> [!IMPORTANT]
> Make sure `.env` is listed inside your `.gitignore` to avoid exposing API keys in public repositories.

---

## 3. Firebase Cloud Configuration

To support manual email/password logins and cloud backups, set up a Firebase project:

1. **Create Firebase Project**: Navigate to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
2. **Enable Email/Password Provider**:
   * Open the **Authentication** tab.
   * Go to **Sign-in Method** and enable the **Email/Password** provider.
3. **Configure Firestore Database**:
   * Open the **Cloud Firestore** tab and click **Create Database**.
   * Choose **Production Mode** or **Test Mode**.
   * Define the following security rules to protect user backups:
     ```javascript
     rules_version = '2';
     service cloud.firestore {
       match /databases/{database}/documents {
         match /backups/{userId} {
           allow read, write: if request.auth != null && request.auth.uid == userId;
         }
       }
     }
     ```
4. **Copy API Keys**: Get your project's **API Key** and **Project ID** from project settings and paste them into your local `.env`.

---

## 4. Local Development Workflow

Run the Metro bundler server to test changes on your physical device:

```bash
# Start Expo development server
npm run start
```

* **Testing on Phone**: Scan the QR code displayed in the terminal using the Expo Go app. Ensure both your computer and phone are connected to the same local Wi-Fi network.
* **Clear Metro Cache**: If you make modifications to asset loaders or package configs, restart the bundler with cache clearing:
   ```bash
   npx expo start -c
   ```

---

## 5. Backup & Restore Operations

### 5.1 Local Backups (Offline)
* Open B Tracker **Settings**.
* Click **Backup to File**.
* The app converts all your database transactions into a JSON document and launches your phone's native sharing dialog (allowing you to email the backup, save it to files, or send it via messaging apps).
* Click **Restore from File** to select your saved JSON and reload your workspace.

### 5.2 Cloud Backups (Connected)
* Register a sync account in the Settings panel under "Cloud Sync".
* Click **Backup to Cloud** to securely upload your SQLite data via Firebase Firestore REST PATCH queries.
* Log into the same cloud account on any other device and click **Restore from Cloud** to instantly download your snapshot document.

---

## 6. Build Instructions (APKs & Bundles)

B Tracker utilizes **EAS Build** to build lightweight production packages.

### 6.1 Initialize EAS
1. Install EAS CLI globally:
   ```bash
   npm install -g eas-cli
   ```
2. Log into your Expo account:
   ```bash
   eas login
   ```
3. Initialize the project config:
   ```bash
   eas project:init
   ```

### 6.2 Compile Android APK (Local or Cloud)
* **Cloud Build (Recommended)**: Compile a preview APK hosted on Expo's remote servers:
  ```bash
  eas build --platform android --profile preview
  ```
* **Local Build**: Compiling on your own machine (requires Android SDK and Java JDK installed locally):
  ```bash
  eas build --platform android --profile preview --local
  ```

Once compiled, scan the output QR code to install the optimized 70MB (or less) APK directly on your phone!
