"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/contexts/auth-context"

export default function Home() {
  const router = useRouter()
  const { user, userData, loading } = useAuth()

  useEffect(() => {
    if (!loading) {
      if (user && userData) {
        // Redirect based on role
        if (userData.role === "student") {
          router.push("/student/dashboard")
        } else if (userData.role === "supervisor") {
          router.push("/supervisor/dashboard")
        } else if (userData.role === "coordinator") {
          router.push("/coordinator/dashboard")
        }
      } else {
        router.push("/auth/login")
      }
    }
  }, [user, userData, loading, router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  )
}
