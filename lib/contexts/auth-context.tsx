"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState, useCallback } from "react"
import type { User } from "firebase/auth"
import { onAuthChange, getUserData, type UserData } from "@/lib/firebase/auth"
import { isFirebaseConfigured } from "@/lib/firebase/config"

interface AuthContextType {
  user: User | null
  userData: UserData | null
  loading: boolean
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  refreshSession: async () => {},
})

// ─── Session Cookie Helpers ──────────────────────────────────────

function setSessionCookie(role: string) {
  // HttpOnly is not possible from client-side, but we use Secure + SameSite
  const isSecure = window.location.protocol === "https:"
  const cookieValue = encodeURIComponent(role)
  const maxAge = 60 * 60 * 24 // 24 hours
  document.cookie = `session_role=${cookieValue}; path=/; max-age=${maxAge}; SameSite=Strict${isSecure ? "; Secure" : ""}`
}

function clearSessionCookie() {
  document.cookie = "session_role=; path=/; max-age=0; SameSite=Strict"
}

// ─── Idle Timeout ────────────────────────────────────────────────

const IDLE_TIMEOUT = 30 * 60 * 1000 // 30 minutes of inactivity

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)

  // Refresh session - can be called manually
  const refreshSession = useCallback(async () => {
    if (user) {
      const data = await getUserData(user.uid)
      setUserData(data)
      if (data?.role) {
        setSessionCookie(data.role)
      }
    }
  }, [user])

  useEffect(() => {
    // If Firebase is not configured, skip auth and just set loading to false
    if (!isFirebaseConfigured()) {
      console.warn("Firebase is not configured. Auth features are disabled. Set NEXT_PUBLIC_FIREBASE_* environment variables to enable.")
      setLoading(false)
      return
    }

    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        const data = await getUserData(firebaseUser.uid)
        setUserData(data)
        // Sync session cookie with role for server-side middleware
        if (data?.role) {
          setSessionCookie(data.role)
        }
      } else {
        setUserData(null)
        clearSessionCookie()
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  // Idle timeout: auto-logout after inactivity
  useEffect(() => {
    if (!user) return

    let idleTimer: ReturnType<typeof setTimeout>

    const resetIdleTimer = () => {
      clearTimeout(idleTimer)
      idleTimer = setTimeout(async () => {
        // Auto sign-out on idle
        const { signOut } = await import("@/lib/firebase/auth")
        await signOut()
        clearSessionCookie()
        window.location.href = "/auth/login"
      }, IDLE_TIMEOUT)
    }

    const events = ["mousedown", "keydown", "scroll", "touchstart"]
    events.forEach((event) => window.addEventListener(event, resetIdleTimer, { passive: true }))
    resetIdleTimer()

    return () => {
      clearTimeout(idleTimer)
      events.forEach((event) => window.removeEventListener(event, resetIdleTimer))
    }
  }, [user])

  return (
    <AuthContext.Provider value={{ user, userData, loading, refreshSession }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
