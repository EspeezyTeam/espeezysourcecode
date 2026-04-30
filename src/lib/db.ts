import { getAdminDb, getAdminAuth } from './firebase-admin'

/**
 * Espeezy Database Abstraction Layer (DBAL)
 * 
 * Provides a familiar query interface over Firebase Firestore.
 * This ensures the application remains database-agnostic and simplifies the 
 * migration from Supabase while maintaining high performance.
 */

class FirestoreQueryBuilder {
  private _collection: string
  private _where: any[] = []
  private _limit: number | null = null
  private _order: { field: string, direction: 'asc' | 'desc' } | null = null

  constructor(collection: string) {
    this._collection = collection
  }

  select(columns: string = '*') {
    return this
  }

  eq(field: string, value: any) {
    this._where.push({ field, op: '==', value })
    return this
  }

  neq(field: string, value: any) {
    this._where.push({ field, op: '!=', value })
    return this
  }

  gt(field: string, value: any) {
    this._where.push({ field, op: '>', value })
    return this
  }

  lt(field: string, value: any) {
    this._where.push({ field, op: '<', value })
    return this
  }

  limit(count: number) {
    this._limit = count
    return this
  }

  order(field: string, { ascending = true } = {}) {
    this._order = { field, direction: ascending ? 'asc' : 'desc' }
    return this
  }

  async get() {
    const db = getAdminDb()
    if (!db) return { data: null, error: new Error('Database connection failed') }

    try {
      let q: any = db.collection(this._collection)
      for (const w of this._where) {
        q = q.where(w.field, w.op, w.value)
      }
      if (this._order) {
        q = q.orderBy(this._order.field, this._order.direction)
      }
      if (this._limit) {
        q = q.limit(this._limit)
      }

      const snapshot = await q.get()
      const data = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      }))
      return { data, error: null }
    } catch (error: any) {
      console.error(`Firestore GET error [${this._collection}]:`, error)
      return { data: null, error }
    }
  }

  async single() {
    const { data, error } = await this.limit(1).get()
    return { data: data && data.length > 0 ? data[0] : null, error }
  }

  async maybeSingle() {
    return this.single()
  }

  async insert(values: any | any[]) {
    const db = getAdminDb()
    if (!db) return { data: null, error: new Error('Database connection failed') }

    const docs = Array.isArray(values) ? values : [values]
    try {
      const results = await Promise.all(docs.map(doc => db.collection(this._collection).add({
        ...doc,
        created_at: doc.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      })))
      return { data: results.map(r => ({ id: r.id })), error: null }
    } catch (error: any) {
      return { data: null, error }
    }
  }

  async update(values: any) {
    const db = getAdminDb()
    if (!db) return { error: new Error('Database connection failed') }

    try {
      return {
        eq: async (field: string, value: any) => {
          if (field === 'id') {
            await db.collection(this._collection).doc(value).update({
              ...values,
              updated_at: new Date().toISOString()
            })
            return { error: null }
          }
          const q = await db.collection(this._collection).where(field, '==', value).get()
          const batch = db.batch()
          q.docs.forEach((doc: any) => {
            batch.update(doc.ref, { ...values, updated_at: new Date().toISOString() })
          })
          await batch.commit()
          return { error: null }
        }
      }
    } catch (error: any) {
      return { error }
    }
  }

  async delete() {
    const db = getAdminDb()
    if (!db) return { error: new Error('Database connection failed') }

    return {
      eq: async (field: string, value: any) => {
        try {
          if (field === 'id') {
            await db.collection(this._collection).doc(value).delete()
            return { error: null }
          }
          const q = await db.collection(this._collection).where(field, '==', value).get()
          const batch = db.batch()
          q.docs.forEach((doc: any) => batch.delete(doc.ref))
          await batch.commit()
          return { error: null }
        } catch (error: any) {
          return { error }
        }
      }
    }
  }
}

export const db = {
  from: (table: string) => new FirestoreQueryBuilder(table),
  auth: {
    getUser: async () => {
      // In a real app, you'd get the user from the session/cookie
      // For now, we return a mock or actual if available
      return { data: { user: null }, error: null }
    }
  }
}

export const createAdminClient = async () => db
export const createServerSupabaseClient = async () => db

