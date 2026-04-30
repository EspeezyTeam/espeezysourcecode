import { db } from '@/lib/firebase' // Import your actual Firebase initialized instance
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'

export const logEvent = async (eventData: any) => {
  try {
    const logsRef = collection(db, 'system_logs')
    await addDoc(logsRef, {
      ...eventData,
      createdAt: serverTimestamp() // Use Firebase's native timestamp, do not trust client clocks
    })
  } catch (error) {
    console.error("Critical failure writing to Firestore:", error)
  }
}
