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

  in(field: string, values: any[]) {
    this._where.push({ field, op: 'in', value: values })
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

  // Support direct await on the builder
  then(resolve: any, reject?: any) {
    return this.get().then(resolve, reject)
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
      return { data, error: null as any }
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

  insert(values: any | any[]) {
    const builder = this
    const executor = async () => {
      const db = getAdminDb()
      if (!db) return { data: null, error: new Error('Database connection failed') }

      const docs = Array.isArray(values) ? values : [values]
      try {
        const results = await Promise.all(docs.map(doc => db.collection(builder._collection).add({
          ...doc,
          created_at: doc.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        })))
        return { data: results.map(r => ({ id: r.id, ...values })), error: null as any }
      } catch (error: any) {
        return { data: null, error }
      }
    }

    const promise = executor() as any
    promise.select = () => ({
      single: async () => {
        const { data, error } = await executor()
        return { data: data && data.length > 0 ? data[0] : null, error }
      },
      maybeSingle: async () => {
        const { data, error } = await executor()
        return { data: data && data.length > 0 ? data[0] : null, error }
      }
    })
    return promise
  }

  update(values: any) {
    const builder = this
    return {
      eq: (field: string, value: any) => {
        const executor = async () => {
          const db = getAdminDb()
          if (!db) return { data: null, error: new Error('Database connection failed') }
          try {
            if (field === 'id') {
              await db.collection(builder._collection).doc(value).update({
                ...values,
                updated_at: new Date().toISOString()
              })
              return { data: [values], error: null as any }
            }
            const q = await db.collection(builder._collection).where(field, '==', value).get()
            const batch = db.batch()
            q.docs.forEach((doc: any) => {
              batch.update(doc.ref, { ...values, updated_at: new Date().toISOString() })
            })
            await batch.commit()
            return { data: q.docs.map(d => d.data()), error: null as any }
          } catch (error: any) {
            return { data: null, error }
          }
        }

        const promise = executor() as any
        promise.select = () => ({
          single: async () => {
            const { data, error } = await executor()
            return { data: data && data.length > 0 ? data[0] : null, error }
          },
          maybeSingle: async () => {
            const { data, error } = await executor()
            return { data: data && data.length > 0 ? data[0] : null, error }
          }
        })
        return promise
      }
    }
  }

  delete() {
    const builder = this
    return {
      eq: (field: string, value: any) => {
        const executor = async () => {
          const db = getAdminDb()
          if (!db) return { error: new Error('Database connection failed') }
          try {
            if (field === 'id') {
              await db.collection(builder._collection).doc(value).delete()
              return { error: null as any }
            }
            const q = await db.collection(builder._collection).where(field, '==', value).get()
            const batch = db.batch()
            q.docs.forEach((doc: any) => batch.delete(doc.ref))
            await batch.commit()
            return { error: null as any }
          } catch (error: any) {
            return { error }
          }
        }
        return executor()
      }
    }
  }
}

export const db = {
  from: (table: string) => new FirestoreQueryBuilder(table) as any,
  rpc: async (name: string, args?: any) => {
    // Firestore doesn't support RPCs. This is a shim for legacy code.
    console.log(`Firestore RPC Shim [${name}]:`, args)
    return { data: null, error: null as any }
  },
  auth: {
    getUser: async () => {
      // Compatibility shim for auth.getUser()
      // In production, this should integrate with Firebase Admin Auth and Session Cookies
      return { data: { user: null as any }, error: null as any }
    },
    admin: {
      deleteUser: async (uid: string) => {
        const auth = getAdminAuth()
        if (!auth) return { error: new Error('Auth connection failed') }
        try {
          await auth.deleteUser(uid)
          return { error: null as any }
        } catch (error: any) {
          return { error }
        }
      },
      listUsers: async () => {
        const auth = getAdminAuth()
        if (!auth) return { data: { users: [] }, error: new Error('Auth connection failed') }
        try {
          const list = await auth.listUsers()
          return { data: { users: list.users }, error: null as any }
        } catch (error: any) {
          return { data: { users: [] }, error }
        }
      }
    },
    exchangeCodeForSession: async (code: string) => {
      // Mock for Supabase auth flow
      return { data: { session: null }, error: null as any as any }
    },
    signOut: async () => {
      return { error: null as any }
    }
  },
  storage: {
    from: (bucket: string) => ({
      getPublicUrl: (path: string) => {
        return { data: { publicUrl: path } }
      },
      upload: async (path: string, file: any) => {
        return { data: { path }, error: null as any }
      }
    })
  }
}

export const createAdminClient = async () => db
export const createServerSupabaseClient = async () => db

