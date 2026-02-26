import type React from "react"
import type { Metadata } from "next"
import { Tajawal } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/lib/contexts/auth-context"
import { LanguageProvider } from "@/lib/contexts/language-context"
import { Toaster } from "@/components/ui/sonner"
import { AIChatbot } from "@/components/ai-chatbot"

const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["400", "500", "700"],
  variable: "--font-tajawal",
})

export const metadata: Metadata = {
  title: "منصة مشاريع التخرج | Graduation Projects Platform",
  description:
    "منصة إلكترونية لمتابعة وإدارة مشاريع التخرج | Electronic platform for tracking and managing graduation projects",

}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html suppressHydrationWarning lang="ar" dir="rtl">
      <body className={tajawal.variable}>
        <LanguageProvider>
          <AuthProvider>
            {children}
            <AIChatbot />
          </AuthProvider>
          <Toaster />
        </LanguageProvider>
      </body>
    </html>
  )
}
