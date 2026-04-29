import { initializeApp, getApps, cert, type ServiceAccount } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0]

  // Option 1: Full JSON string in env var (for production / Vercel / Firebase Hosting)
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  if (serviceAccountJson && serviceAccountJson.startsWith('{')) {
    const serviceAccount: ServiceAccount = JSON.parse(serviceAccountJson)
    return initializeApp({ credential: cert(serviceAccount) })
  }

  // Option 2: Path to a local JSON key file (for local development)
  const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (keyFilePath) {
    const raw = readFileSync(resolve(keyFilePath), 'utf-8')
    const serviceAccount: ServiceAccount = JSON.parse(raw)
    return initializeApp({ credential: cert(serviceAccount) })
  }

  // Option 3: Default credentials (GCP environments)
  return initializeApp()
}

const adminApp = getAdminApp()
export const adminDb = getFirestore(adminApp)
