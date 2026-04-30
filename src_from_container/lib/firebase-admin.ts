import admin from 'firebase-admin'
import { existsSync, readFileSync } from 'fs'

type ServiceAccountShape = {
  project_id: string
  client_email: string
  private_key: string
}

function normalizeSecretInput(value: string) {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

function tryParseJson(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>
  } catch {
    return null
  }
}

function toBase64(value: string) {
  // Accept base64url secrets from CI systems by normalizing to standard base64.
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '')
  const padding = normalized.length % 4
  if (padding === 0) return normalized
  return normalized + '='.repeat(4 - padding)
}

function parseServiceAccountKey(rawKey: string) {
  const input = normalizeSecretInput(rawKey)

  // Support plain JSON secrets (common in local/dev and some hosts).
  const jsonDirect = tryParseJson(input)
  if (jsonDirect) return jsonDirect

  // Support base64/base64url encoded JSON secrets.
  const decoded = Buffer.from(toBase64(input), 'base64').toString('utf8').trim()
  const jsonBase64 = tryParseJson(decoded)
  if (jsonBase64) return jsonBase64

  return null
}

function readServiceAccountFromPath(path: string) {
  try {
    const content = readFileSync(path, 'utf8')
    return tryParseJson(content)
  } catch {
    return null
  }
}

function parseServiceAccountFromEnvOrPath(value: string | undefined) {
  if (!value) return null
  const normalized = normalizeSecretInput(value)

  // Some platforms set GOOGLE_APPLICATION_CREDENTIALS as inline JSON.
  const inline = parseServiceAccountKey(normalized)
  if (inline) return inline

  return readServiceAccountFromPath(normalized)
}

function findDefaultServiceAccount() {
  const candidates = [
    '/app/espeezylearning-firebase-adminsdk-fbsvc-3b02e3eff9.json',
    '/opt/testingcodebase/espeezylearning-firebase-adminsdk-fbsvc-3b02e3eff9.json',
    './espeezylearning-firebase-adminsdk-fbsvc-3b02e3eff9.json',
  ]

  for (const path of candidates) {
    if (!existsSync(path)) continue
    const parsed = readServiceAccountFromPath(path)
    if (parsed) return parsed
  }

  return null
}

function normalizeServiceAccount(value: Record<string, unknown> | null): ServiceAccountShape | null {
  if (!value) return null

  const projectId = value.project_id
  const clientEmail = value.client_email
  const privateKeyRaw = value.private_key

  if (typeof projectId !== 'string' || typeof clientEmail !== 'string' || typeof privateKeyRaw !== 'string') {
    return null
  }

  return {
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKeyRaw.replace(/\\n/g, '\n'),
  }
}

function initAdmin() {
  if (admin.apps.length) return true;

  const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  const explicitPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  const googleCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS

  try {
    const fromKey = rawKey ? parseServiceAccountKey(rawKey) : null
    const fromExplicitPath = parseServiceAccountFromEnvOrPath(explicitPath)
    const fromGoogleCreds = parseServiceAccountFromEnvOrPath(googleCreds)
    const fromDefaultPath = findDefaultServiceAccount()
    const serviceAccount = normalizeServiceAccount(fromKey || fromExplicitPath || fromGoogleCreds || fromDefaultPath)

    if (!serviceAccount) {
      throw new Error('Firebase Admin credentials are invalid. Set FIREBASE_SERVICE_ACCOUNT_KEY (JSON/base64) or FIREBASE_SERVICE_ACCOUNT_PATH/GOOGLE_APPLICATION_CREDENTIALS (file path).')
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
