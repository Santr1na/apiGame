# Firebase Configuration Guide

## 🔑 How to Get Firebase Service Account Configuration

### Step 1: Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Follow the setup wizard

### Step 2: Generate Service Account Key
1. In your Firebase project, go to **Project Settings** (gear icon)
2. Click on **Service Accounts** tab
3. Click **Generate new private key**
4. Download the JSON file
5. Copy the content of the JSON file

### Step 3: Replace Environment Variables
Replace this placeholder:
```env
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"your-project-id","private_key_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}
```

With the actual JSON content (single line):
```env
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"your-actual-project-id","private_key_id":"your-actual-private-key-id","private_key":"-----BEGIN PRIVATE KEY-----\nYourActualPrivateKey\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk@your-project-id.iam.gserviceaccount.com","client_id":"your-actual-client-id","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk%40your-project-id.iam.gserviceaccount.com"}
```

### Step 4: Enable Authentication (Optional)
1. In Firebase Console, go to **Authentication**
2. Choose **Sign-in method** tab
3. Enable the providers you want (Google, Email/Password, etc.)

### 📝 What Each Field Means:
- `project_id`: Your Firebase project identifier
- `private_key_id`: Unique identifier for the private key
- `private_key`: The RSA private key (keep this secret!)
- `client_email`: Service account email address
- `client_id`: Service account client ID

### ⚠️ Security Notes:
1. **Never commit the actual JSON file to git**
2. **Keep the private key secure**
3. **Use environment variables in production**

### 🚀 Alternative: Disable Firebase (Recommended for Testing)
If you don't need user authentication features, simply omit or comment out the Firebase configuration:
```env
# Comment out Firebase - API will work in demo mode
# FIREBASE_SERVICE_ACCOUNT=...
```

When Firebase is disabled:
- Authentication endpoints return "Service unavailable"
- Favorite/status tracking is disabled
- All other API features work normally

### 🎯 Quick Test
After configuration:
```bash
curl http://localhost:3002/api-status
```
Should show: `"firebase": true`

### 📱 Frontend Integration Example
```javascript
// Get Firebase ID token
const token = await firebase.auth().currentUser.getIdToken();

// Use in API calls
const response = await fetch('http://localhost:3002/games/steam_620/favorite', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  method: 'POST'
});