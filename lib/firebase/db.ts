import { getFirebaseDb } from "./config"
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  type QueryConstraint,
  serverTimestamp,
} from "firebase/firestore"

const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
const MAX_CACHE_SIZE = 100 // Maximum number of cached items

function getCacheKey(collectionName: string, docId?: string, constraints?: QueryConstraint[]): string {
  if (docId) {
    return `${collectionName}:${docId}`
  }
  return `${collectionName}:${JSON.stringify(constraints || [])}`
}

function getFromCache(key: string): any | null {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data
  }
  cache.delete(key)
  return null
}

function setCache(key: string, data: any): void {
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value
    if (firstKey) {
      cache.delete(firstKey)
    }
  }
  cache.set(key, { data, timestamp: Date.now() })
}

export function clearCache(collectionName?: string): void {
  if (collectionName) {
    for (const key of cache.keys()) {
      if (key.startsWith(collectionName)) {
        cache.delete(key)
      }
    }
  } else {
    cache.clear()
  }
}

export async function getDocument(collectionName: string, docId: string, useCache = true) {
  try {
    const cacheKey = getCacheKey(collectionName, docId)

    if (useCache) {
      const cached = getFromCache(cacheKey)
      if (cached) {
        return cached
      }
    }

    const db = getFirebaseDb()
    const docRef = doc(db, collectionName, docId)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      const data = { id: docSnap.id, ...docSnap.data() }
      if (useCache) setCache(cacheKey, data)
      return data
    }
    return null
  } catch (error) {
    console.error(`Error getting document from ${collectionName}:`, error)
    throw error
  }
}

export async function getDocuments(collectionName: string, constraints: QueryConstraint[] = [], useCache = true) {
  try {
    const cacheKey = getCacheKey(collectionName, undefined, constraints)

    if (useCache) {
      const cached = getFromCache(cacheKey)
      if (cached) {
        return cached
      }
    }

    const db = getFirebaseDb()
    const q = query(collection(db, collectionName), ...constraints)
    const querySnapshot = await getDocs(q)

    const data = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))

    if (useCache) setCache(cacheKey, data)
    return data
  } catch (error) {
    console.error(`Error getting documents from ${collectionName}:`, error)
    throw error
  }
}

export async function createDocument(collectionName: string, data: any) {
  try {
    const db = getFirebaseDb()
    const docRef = await addDoc(collection(db, collectionName), {
      ...data,
      createdAt: serverTimestamp(),
    })
    clearCache(collectionName)
    return docRef.id
  } catch (error) {
    console.error(`Error creating document in ${collectionName}:`, error)
    throw error
  }
}

export async function updateDocument(collectionName: string, docId: string, data: any) {
  try {
    const db = getFirebaseDb()
    const docRef = doc(db, collectionName, docId)

    const docSnap = await getDoc(docRef)
    if (!docSnap.exists()) {
      console.warn(`Document ${docId} does not exist in ${collectionName}, skipping update`)
      return
    }

    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    })
    clearCache(collectionName)
  } catch (error) {
    console.error(`Error updating document in ${collectionName}:`, error)
    throw error
  }
}

export async function deleteDocument(collectionName: string, docId: string) {
  try {
    const db = getFirebaseDb()
    const docRef = doc(db, collectionName, docId)
    await deleteDoc(docRef)
    clearCache(collectionName)
  } catch (error) {
    console.error(`Error deleting document from ${collectionName}:`, error)
    throw error
  }
}

export async function setDocument(collectionName: string, docId: string, data: any) {
  try {
    const db = getFirebaseDb()
    const docRef = doc(db, collectionName, docId)
    await setDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    })
    clearCache(collectionName)
  } catch (error) {
    console.error(`Error setting document in ${collectionName}:`, error)
    throw error
  }
}

export async function batchGetDocuments(collectionName: string, docIds: string[], useCache = true) {
  try {
    const results = await Promise.all(docIds.map((id) => getDocument(collectionName, id, useCache)))
    return results.filter((doc) => doc !== null)
  } catch (error) {
    console.error(`Error batch getting documents from ${collectionName}:`, error)
    throw error
  }
}
