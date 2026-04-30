import { db as firebaseDb, auth as firebaseAuth } from './firebase'
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  limit, 
  addDoc, 
  getDoc 
} from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

/**
 * Client-side Espeezy DBAL
 */
class ClientQueryBuilder {
  private _collection: string
  private _where: any[] = []
  private _limit: number | null = null

  constructor(collectionName: string) {
    this._collection = collectionName
  }

  select(columns: string = '*') { return this }
  
  eq(field: string, value: any) {
    this._where.push({ field, op: '==', value })
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

  // Support direct await on the builder
  then(resolve: any, reject?: any) {
    return this.get().then(resolve, reject)
  }

  async get() {
    try {
      let q = query(collection(firebaseDb, this._collection))
      for (const w of this._where) {
        q = query(q, where(w.field, w.op, w.value))
      }
      if (this._limit) {
        q = query(q, limit(this._limit))
      }
      const snapshot = await getDocs(q)
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      return { data, error: null }
    } catch (error: any) {
      return { data: null, error }
    }
  }

  async single() {
    const { data, error } = await this.limit(1).get()
    return { data: data && data.length > 0 ? data[0] : null, error }
  }

  async maybeSingle() { return this.single() }

  async insert(values: any | any[]) {
    const docs = Array.isArray(values) ? values : [values]
    try {
      const results = await Promise.all(docs.map(d => addDoc(collection(firebaseDb, this._collection), d)))
      return { data: results.map(r => ({ id: r.id })), error: null }
    } catch (error: any) {
      return { data: null, error }
    }
  }

  async update(values: any) {
    return {
      eq: async (field: string, value: any) => {
        // Implementation for update
        return { error: null }
      }
    }
  }
}

export const db = {
  from: (table: string) => new ClientQueryBuilder(table) as any,
  rpc: async (name: string, args?: any) => {
    console.log(`Firestore Client RPC Shim [${name}]:`, args)
    return { data: null, error: null }
  },
  auth: {
    getUser: async () => {
      const user = firebaseAuth.currentUser
      return { data: { user: user as any }, error: null }
    },
    getSession: async () => {
      const user = firebaseAuth.currentUser
      return { data: { session: user ? { user: user as any } : null as any }, error: null }
    },
    signInWithOAuth: async (options: any) => {
      return { data: { url: null }, error: null as any }
    },
    signInWithPassword: async (credentials: any) => {
      return { data: { user: null }, error: null as any }
    },
    signInWithOtp: async (options: any) => {
      return { error: null as any }
    },
    verifyOtp: async (options: any) => {
      return { data: { user: null }, error: null as any }
    },
    signUp: async (credentials: any) => {
      return { data: { user: null }, error: null as any }
    },
    resetPasswordForEmail: async (email: string, options: any) => {
      return { data: null, error: null as any }
    },
    updateUser: async (attributes: any) => {
      return { data: { user: null }, error: null as any }
    },
    signOut: async () => {
      await firebaseAuth.signOut()
      return { error: null }
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
  },
  channel: (name: string) => ({
    on: (type: string, filter: any, callback: any) => ({
      subscribe: () => ({
        unsubscribe: () => {}
      })
    }),
    subscribe: () => ({
      unsubscribe: () => {}
    })
  }),
  removeChannel: async (channel: any) => {},
  removeAllChannels: async () => {}
}

export const createBrowserSupabaseClient = () => db
export const createClient = () => db

