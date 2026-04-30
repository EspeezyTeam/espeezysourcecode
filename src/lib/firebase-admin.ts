import admin from 'firebase-admin'

function initAdmin() {
  if (admin.apps.length) return true;
  
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!key) return false;

  try {
    const serviceAccount = JSON.parse(Buffer.from(key, 'base64').toString());
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: 'https://espeezylearning.firebaseio.com'
    });
    return true;
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
    return false;
  }
}

export const getAdminDb = () => {
  if (!initAdmin()) return null
  return admin.firestore()
}

export const getAdminAuth = () => {
  if (!initAdmin()) return null
  return admin.auth()
}

export const getAdminStorage = () => {
  if (!initAdmin()) return null
  return admin.storage()
}

export default admin
