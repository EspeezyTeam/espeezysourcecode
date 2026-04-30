import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: 'espeezylearning.firebaseapp.com',
  projectId: 'espeezylearning',
  storageBucket: 'espeezylearning.firebasestorage.app',
  messagingSenderId: '521867130243',
  appId: '1:521867130243:web:eb09572762faeccee832b6',
  measurementId: 'G-PHDNYXBXH8',
}

// Prevent re-initialisation during Next.js hot-reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export default app
