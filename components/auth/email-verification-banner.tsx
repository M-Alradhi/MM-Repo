"use client"

import { useState, useEffect } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Mail, X } from "lucide-react"
import { useAuth } from "@/lib/contexts/auth-context"
import { resendVerificationEmail, updateEmailVerificationStatus } from "@/lib/firebase/auth"
import { getFirebaseAuth } from "@/lib/firebase/config"

export function EmailVerificationBanner() {
  const { user, userData } = useAuth()
  const [dismissed, setDismissed] = useState(false)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    // Check if email is verified in Firebase Auth
    const auth = getFirebaseAuth()
    const currentUser = auth.currentUser

    if (currentUser && currentUser.emailVerified && userData && !userData.emailVerified) {
      // Update Firestore if email is verified but not reflected in userData
      updateEmailVerificationStatus(currentUser.uid, true)
    }
  }, [user, userData])

  const handleResendEmail = async () => {
    setSending(true)
    setMessage("")
    try {
      await resendVerificationEmail()
      setMessage("تم إرسال رسالة التحقق بنجاح. يرجى التحقق من بريدك الإلكتروني.")
    } catch (error: any) {
      setMessage(error.message || "حدث خطأ أثناء إرسال رسالة التحقق")
    } finally {
      setSending(false)
    }
  }

  // Don't show banner if email is verified or dismissed
  if (!user || userData?.emailVerified || dismissed) {
    return null
  }

  return (
    <Alert className="mb-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
      <div className="flex items-start gap-3">
        <Mail className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
        <div className="flex-1 space-y-2">
          <AlertDescription className="text-yellow-800 dark:text-yellow-200">
            يرجى التحقق من بريدك الإلكتروني لتفعيل حسابك. لم تستلم الرسالة؟
          </AlertDescription>
          {message && <p className="text-sm text-yellow-700 dark:text-yellow-300">{message}</p>}
          <Button
            variant="outline"
            size="sm"
            onClick={handleResendEmail}
            disabled={sending}
            className="border-yellow-600 text-yellow-700 hover:bg-yellow-100 dark:border-yellow-500 dark:text-yellow-400 dark:hover:bg-yellow-950 bg-transparent"
          >
            {sending ? "جاري الإرسال..." : "إعادة إرسال رسالة التحقق"}
          </Button>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setDismissed(true)} className="h-6 w-6">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Alert>
  )
}
