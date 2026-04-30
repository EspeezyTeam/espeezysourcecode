import admin from 'firebase-admin'

function parseServiceAccountKey(rawKey: string) {
  const input = rawKey.trim()

  const parseJson = (value: string) => {
    try {
      return JSON.parse(value) as Record<string, unknown>
    } catch {
      return null
    }
  }

  // Support plain JSON secrets (common in local/dev and some hosts)
  const jsonDirect = parseJson(input)
  if (jsonDirect) return jsonDirect

  // Support base64-encoded JSON secrets
  const decoded = Buffer.from(input, 'base64').toString('utf8').trim()
  const jsonBase64 = parseJson(decoded)
  if (jsonBase64) return jsonBase64

  return null
}

function initAdmin() {
  if (admin.apps.length) return true;
  
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!key) return false;

  try {
    const serviceAccount = parseServiceAccountKey(key)
    if (!serviceAccount) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is neither valid JSON nor valid base64-encoded JSON')
    }

    const privateKey = serviceAccount.private_key
    if (typeof privateKey === 'string') {
      serviceAccount.private_key = privateKey.replace(/\\n/g, '\n')
    }

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
