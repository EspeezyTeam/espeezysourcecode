import { db as firebaseDb, auth as firebaseAuth } from './firebase'
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore'
import { onAuthStateChanged, User } from 'firebase/auth'




// 1. Handle Auth properly with promises to avoid race conditions
export const getCurrentUser = (): Promise<User | null> => {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      unsubscribe(); // Clean up listener once resolved
      resolve(user);
    });
  });
};

// 2. Build domain-specific repositories, not generic query builders
export class UserRepository {
  private static usersRef = collection(firebaseDb, 'users');

  static async getActiveUsersByRole(role: string) {
    try {
      const q = query(this.usersRef, where('role', '==', role), where('status', '==', 'active'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Failed to fetch users:", error);
      throw new Error("Database query failed."); // Fail loudly, not silently
    }
  }

  static async createUser(userData: any) {
    try {
      const docRef = await addDoc(this.usersRef, userData);
      return docRef.id;
    } catch (error) {
      throw new Error("Failed to create user.");
    }
  }
}
