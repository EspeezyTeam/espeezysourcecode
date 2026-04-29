import { initializeApp, getApps, cert, type ServiceAccount } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0]

  // In production, set FIREBASE_SERVICE_ACCOUNT_KEY as a JSON string env var
  // In dev, you can use a local file path via GOOGLE_APPLICATION_CREDENTIALS
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY

  if (serviceAccountJson) {
    const serviceAccount: ServiceAccount = JSON.parse(serviceAccountJson)
    return initializeApp({ credential: cert(serviceAccount) })
  }

  // Fallback: uses GOOGLE_APPLICATION_CREDENTIALS env var or default credentials
  return initializeApp()
}

const adminApp = getAdminApp()
export const adminDb = getFirestore(adminApp)
