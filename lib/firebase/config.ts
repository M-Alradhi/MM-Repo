import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app"
import { getAuth, type Auth } from "firebase/auth"
import { getFirestore, type Firestore } from "firebase/firestore"
import { getStorage, type FirebaseStorage } from "firebase/storage"
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBDFGlos0b-sVhkKE2WufA4sbC0YW0jOyU",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "grpro-f9d30.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "grpro-f9d30",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "grpro-f9d30.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "954213992043",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:954213992043:web:c5214c85814afca699d32e",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-X2BW438SKJ",
}

// Validate that required Firebase config is present
function validateFirebaseConfig() {
  const required = ["apiKey", "authDomain", "projectId", "appId"] as const
  const missing = required.filter((key) => !firebaseConfig[key])
  if (missing.length > 0) {
    console.error(
      `Firebase configuration incomplete. Missing: ${missing.join(", ")}. ` +
      `Set the corresponding NEXT_PUBLIC_FIREBASE_* environment variables.`
    )
    return false
  }
  return true
}

let app: FirebaseApp | undefined
let auth: Auth | undefined
let db: Firestore | undefined
let storage: FirebaseStorage | undefined
let analytics: Analytics | null = null

if (typeof window !== "undefined" && validateFirebaseConfig()) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
    auth = getAuth(app)
    db = getFirestore(app)
    storage = getStorage(app)

    // Initialize analytics in production
    if (process.env.NODE_ENV === "production") {
      isSupported().then((yes) => {
        if (yes && app) {
          analytics = getAnalytics(app)
        }
      })
    }
  } catch (error) {
    console.error("Error initializing Firebase:", error)
  }
}

// Check if Firebase is properly configured
export function isFirebaseConfigured(): boolean {
  return !!app && !!auth && !!db
}

// Helper functions with proper error handling
export function getFirebaseApp(): FirebaseApp {
  if (typeof window === "undefined") {
    throw new Error("Firebase can only be used on the client side")
  }
  if (!app) {
    throw new Error("Firebase app not initialized. Please set the NEXT_PUBLIC_FIREBASE_* environment variables.")
  }
  return app
}

export function getFirebaseAuth(): Auth {
  if (typeof window === "undefined") {
    throw new Error("Firebase Auth can only be used on the client side")
  }
  if (!auth) {
    throw new Error("Firebase Auth not initialized. Please set the NEXT_PUBLIC_FIREBASE_* environment variables.")
  }
  return auth
}

export function getFirebaseDb(): Firestore {
  if (typeof window === "undefined") {
    throw new Error("Firestore can only be used on the client side")
  }
  if (!db) {
    throw new Error("Firestore not initialized. Please set the NEXT_PUBLIC_FIREBASE_* environment variables.")
  }
  return db
}

export function getFirebaseStorage(): FirebaseStorage {
  if (typeof window === "undefined") {
    throw new Error("Firebase Storage can only be used on the client side")
  }
  if (!storage) {
    throw new Error("Firebase Storage not initialized. Please set the NEXT_PUBLIC_FIREBASE_* environment variables.")
  }
  return storage
}

export function getFirebaseAnalytics(): Analytics | null {
  return analytics
}

export { app, auth, db, storage, analytics }

// Alias exports for convenience
export const getAuthInstance = () => getFirebaseAuth()
export const getDbInstance = () => getFirebaseDb()
export const getStorageInstance = () => getFirebaseStorage()
