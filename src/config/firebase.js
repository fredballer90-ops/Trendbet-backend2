// backend/src/config/firebase.js
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let firebaseAdmin = null;

try {
  let serviceAccount = null;

  // 1) Local file first (development)
  if (process.env.NODE_ENV !== 'production') {
    try {
      const serviceAccountPath = join(__dirname, '../../serviceAccount.json');
      serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
      console.log('🔑 Using local serviceAccount.json');
    } catch (err) {
      console.log('⚠️  No local serviceAccount.json found, trying env vars...');
    }
  }

  // 2) Full Base64-encoded service account JSON (preferred for Render / single-line env var)
  // Env name: FIREBASE_SERVICE_ACCOUNT_BASE64 (or FIREBASE_SERVICE_ACCOUNT for non-base64 single-line)
  if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    try {
      const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
      serviceAccount = JSON.parse(decoded);
      console.log('🔑 Using full service account JSON from FIREBASE_SERVICE_ACCOUNT_BASE64');
    } catch (err) {
      console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_BASE64:', err.message);
      throw err;
    }
  }

  // 2b) If someone put the full JSON as a single-line (not base64) env var
  if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      console.log('🔑 Using full service account JSON from FIREBASE_SERVICE_ACCOUNT');
    } catch (err) {
      console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', err.message);
      throw err;
    }
  }

  // 3) Fallback to constructing the service account from individual env vars
  if (!serviceAccount) {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY || null;

    if (process.env.FIREBASE_PRIVATE_KEY_BASE64) {
      // Some setups encode only the private_key portion
      privateKey = Buffer.from(process.env.FIREBASE_PRIVATE_KEY_BASE64, 'base64').toString('utf8');
      console.log('🔑 Using base64-encoded private key from FIREBASE_PRIVATE_KEY_BASE64');
    } else if (privateKey) {
      // Replace escaped newlines if someone pasted the key directly into env var
      privateKey = privateKey.replace(/\\n/g, '\n');
      console.log('🔑 Using regular private key from FIREBASE_PRIVATE_KEY');
    }

    serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID || "trendbet-c2793",
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: privateKey,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
      universe_domain: "googleapis.com"
    };

    console.log('🔑 Constructed service account from individual env variables (partial)');
  }

  // Validate credentials
  const missingFields = [];
  if (!serviceAccount || !serviceAccount.private_key) missingFields.push('private_key');
  if (!serviceAccount || !serviceAccount.client_email) missingFields.push('client_email');
  if (!serviceAccount || !serviceAccount.project_id) missingFields.push('project_id');

  if (missingFields.length > 0) {
    console.error('❌ Missing Firebase credentials:', missingFields.join(', '));
    throw new Error(`Missing required Firebase credentials: ${missingFields.join(', ')}`);
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL || "https://trendbet-c2793-default-rtdb.firebaseio.com"
  });

  firebaseAdmin = admin;
  console.log('✅ Firebase Admin initialized successfully');
  console.log('📧 Service Account:', serviceAccount.client_email);

} catch (error) {
  console.error('❌ Firebase initialization failed:', error.message);
  throw error;
}

export default firebaseAdmin;
