"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { GraduationCap, Loader2, Mail, ArrowRight, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { sendPasswordResetEmail } from "firebase/auth"
import { getFirebaseAuth } from "@/lib/firebase/config"
import { useLanguage } from "@/lib/contexts/language-context"
import { LanguageSwitcher } from "@/components/language-switcher"
import { checkClientRateLimit, sanitizeInput } from "@/lib/utils/security"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const { t } = useLanguage()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess(false)

    // Rate limit password reset requests
    const rateCheck = checkClientRateLimit("password_reset", 3, 5 * 60 * 1000) // 3 attempts per 5 minutes
    if (!rateCheck.allowed) {
      const minutes = Math.ceil(rateCheck.retryAfterMs / 60000)
      setError(
        t("language") === "ar"
          ? `تم تجاوز حد الطلبات. حاول بعد ${minutes} دقيقة.`
          : `Too many requests. Try again in ${minutes} minute(s).`
      )
      return
    }

    setLoading(true)
    const cleanEmail = sanitizeInput(email).trim().toLowerCase()

    try {
      const auth = getFirebaseAuth()
      await sendPasswordResetEmail(auth, cleanEmail)
      setSuccess(true)
      setEmail("")
    } catch (err: unknown) {
      // Always show success to prevent email enumeration attacks
      setSuccess(true)
      setEmail("")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900/20 dark:to-purple-900/20 p-4 animate-gradient">
      {/* زر تبديل اللغة في الزاوية العليا */}
      <div className="absolute top-4 left-4">
        <LanguageSwitcher />
      </div>

      <Card className="w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-700 hover:shadow-3xl transition-shadow">
        <CardHeader className="text-center space-y-4 pb-8">
          <div className="flex justify-center mb-2">
            <div className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground p-4 rounded-2xl shadow-lg animate-float">
              <GraduationCap className="w-10 h-10" />
            </div>
          </div>
          <div className="space-y-2 animate-in slide-in-from-top duration-700 delay-150">
            <CardTitle className="text-3xl font-bold bg-gradient-to-l from-primary to-primary/60 bg-clip-text text-transparent">
              {t("resetPassword")}
            </CardTitle>
            <CardDescription className="text-base">
              {t("language") === "ar"
                ? "أدخل بريدك الإلكتروني لإرسال رابط إعادة تعيين كلمة المرور"
                : "Enter your email to receive a password reset link"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="animate-in slide-in-from-bottom duration-700 delay-300">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <Alert variant="destructive" className="animate-in shake duration-500">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="bg-green-50 text-green-900 border-green-200 dark:bg-green-900/20 dark:text-green-100 dark:border-green-800 animate-in slide-in-from-top duration-500">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  {t("language") === "ar"
                    ? "تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني. يرجى التحقق من صندوق الوارد."
                    : "Password reset link has been sent to your email. Please check your inbox."}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                {t("email")}
              </Label>
              <div className="relative">
                <Mail className="absolute right-3 top-3 h-5 w-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="example@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="pr-10 h-11 transition-all focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-base font-medium shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                  {t("loading")}
                </>
              ) : (
                <>
                  {t("language") === "ar" ? "إرسال رابط الاستعادة" : "Send Reset Link"}
                  <ArrowRight className="mr-2 h-5 w-5" />
                </>
              )}
            </Button>

            <div className="text-center text-sm text-muted-foreground pt-2 space-y-2">
              <Link href="/auth/login" className="text-primary hover:underline font-medium transition-colors block">
                {t("language") === "ar" ? "العودة إلى تسجيل الدخول" : "Back to Login"}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
