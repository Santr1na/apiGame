# 🔥 Firebase Service Account Setup - Step by Step

## 📋 **Prerequisites**
- Google account
- Firebase Console access

## 🚀 **Step 1: Create Firebase Project**

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. **Click "Create a project"**
3. **Fill in project details**:
   ```
   Project name: games-api-project
   Google Analytics: Choose your preference
   ```
4. **Click "Create project"**

## 🔑 **Step 2: Generate Service Account Key**

### 2.1 Access Project Settings
1. In Firebase Console, click **gear icon** (⚙️) next to "Project Overview"
2. Select **"Project settings"**

### 2.2 Go to Service Accounts
1. In left sidebar, click **"Service Accounts"**
2. Click **"Generate new private key"** button

### 2.3 Download JSON
1. Firebase will download a JSON file (e.g., `games-api-project-firebase-adminsdk-xxxxx-xxxxx.json`)
2. **Open this file** in a text editor

## 📝 **Step 3: Copy Service Account Configuration**

### 3.1 Format the JSON
The downloaded file looks like this:
```json
{
  "type": "service_account",
  "project_id": "games-api-project",
  "private_key_id": "1a2b3c4d5e6f7g8h9i0j",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@games-api-project.iam.gserviceaccount.com",
  "client_id": "12345678901234567890",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40games-api-project.iam.gserviceaccount.com"
}
```

### 3.2 Convert to Single Line (for .env file)
**Remove all line breaks and escape quotes properly:**

```env
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"games-api-project","private_key_id":"1a2b3c4d5e6f7g8h9i0j","private_key":"-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xxxxx@games-api-project.iam.gserviceaccount.com","client_id":"12345678901234567890","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40games-api-project.iam.gserviceaccount.com"}
```

## 🔧 **Step 4: Set Up in Your .env File**

1. **Copy the formatted JSON string**
2. **Paste it in your .env file**:
```env
# Firebase Configuration
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"your-actual-project-id","private_key_id":"your-actual-private-key-id","private_key":"-----BEGIN PRIVATE KEY-----\nYourActualPrivateKey\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk@your-project-id.iam.gserviceaccount.com","client_id":"your-actual-client-id","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk%40your-project-id.iam.gserviceaccount.com"}
```

## 🛡️ **Step 5: Security Best Practices**

### 5.1 Add to .gitignore
```bash
echo "*.json" >> .gitignore
echo ".env" >> .gitignore
```

### 5.2 Environment Protection
```bash
# Make .env readable only by owner
chmod 600 .env
```

## ✅ **Step 6: Test Configuration**

### 6.1 Check API Status
```bash
curl http://localhost:3002/api-status
```

**Expected response**:
```json
{
  "RAWG": false,
  "GiantBomb": false,
  "TheGamesDB": false,
  "Steam": true,
  "firebase": true
}
```

### 6.2 Test Authentication
```bash
# This should now work instead of returning "Service unavailable"
curl http://localhost:3002/games/steam_620/favorite
```

## 🔐 **Optional: Enable Authentication**

### Enable Email/Password Auth
1. In Firebase Console, go to **"Authentication"**
2. Click **"Get started"**
3. Select **"Email/Password"** provider
4. Enable it

### Frontend Integration Example
```javascript
// Initialize Firebase
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
  // Your web app's Firebase configuration
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Login
await signInWithEmailAndPassword(auth, 'user@example.com', 'password');

// Get ID token
const token = await auth.currentUser.getIdToken();

// Use in API
const response = await fetch('http://localhost:3002/games/steam_620/favorite', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

## 🚨 **Troubleshooting**

### Error: "Service account object must contain a string 'project_id' property"
**Solution**: Make sure your JSON is properly formatted as a single line string

### Error: "Invalid private key"
**Solution**: Check that `\n` characters are properly escaped in the private_key field

### Error: "Authentication service unavailable"
**Solution**: Verify your FIREBASE_SERVICE_ACCOUNT environment variable is set correctly

## 💡 **Quick Setup Command**
```bash
# If you have the JSON file locally:
cat firebase-admin-key.json | jq -c . >> .env
echo "FIREBASE_SERVICE_ACCOUNT=" >> .env && cat firebase-admin-key.json | jq -c . >> .env
```

That's it! Your Firebase service account is now configured and ready to use! 🎉