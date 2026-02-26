import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  type User,
} from "firebase/auth"
import { doc, setDoc, getDoc } from "firebase/firestore"
import { getFirebaseAuth, getFirebaseDb } from "./config"
import { createNotification } from "./notifications"

export type UserRole = "student" | "supervisor" | "coordinator"

export interface UserData {
  uid: string
  email: string
  name: string
  role: UserRole
  createdAt: Date
  studentId?: string
  department?: string
  projectId?: string
  supervisorId?: string
  emailVerified?: boolean
}

export async function signUp(
  email: string,
  password: string,
  name: string,
  role: UserRole,
  additionalData?: Partial<UserData>,
) {
  try {
    const auth = getFirebaseAuth()
    const db = getFirebaseDb()

    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    const user = userCredential.user

    // Send email verification
    await sendEmailVerification(user)

    const userData: UserData = {
      uid: user.uid,
      email: user.email!,
      name,
      role,
      createdAt: new Date(),
      emailVerified: false,
      ...additionalData,
    }

    await setDoc(doc(db, "users", user.uid), userData)

    // Create welcome notification
    await createNotification(
      user.uid,
      "مرحباً بك في منصة مشاريع التخرج",
      "تم إنشاء حسابك بنجاح. يرجى التحقق من بريدك الإلكتروني لتفعيل الحساب.",
      "info",
    )

    return { user, userData }
  } catch (error: any) {
    throw new Error(error.message)
  }
}

export async function signIn(email: string, password: string) {
  try {
    const auth = getFirebaseAuth()
    const db = getFirebaseDb()

    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    const user = userCredential.user

    const userDoc = await getDoc(doc(db, "users", user.uid))
    const userData = userDoc.data() as UserData

    return { user, userData }
  } catch (error: any) {
    throw new Error(error.message)
  }
}

export async function signOut() {
  try {
    const auth = getFirebaseAuth()
    await firebaseSignOut(auth)
  } catch (error: any) {
    throw new Error(error.message)
  }
}

export async function getUserData(uid: string): Promise<UserData | null> {
  try {
    const db = getFirebaseDb()
    const userDoc = await getDoc(doc(db, "users", uid))
    if (userDoc.exists()) {
      return userDoc.data() as UserData
    }
    return null
  } catch (error) {
    console.error("Error getting user data:", error)
    return null
  }
}

export function onAuthChange(callback: (user: User | null) => void) {
  const auth = getFirebaseAuth()
  return onAuthStateChanged(auth, callback)
}

export async function resendVerificationEmail() {
  try {
    const auth = getFirebaseAuth()
    const user = auth.currentUser

    if (!user) {
      throw new Error("لا يوجد مستخدم مسجل دخول")
    }

    await sendEmailVerification(user)
  } catch (error: any) {
    throw new Error(error.message)
  }
}

export async function resetPassword(email: string) {
  try {
    const auth = getFirebaseAuth()
    await sendPasswordResetEmail(auth, email)
  } catch (error: any) {
    throw new Error(error.message)
  }
}

export async function updateEmailVerificationStatus(uid: string, verified: boolean) {
  try {
    const db = getFirebaseDb()
    await setDoc(doc(db, "users", uid), { emailVerified: verified }, { merge: true })
  } catch (error: any) {
    throw new Error(error.message)
  }
}
