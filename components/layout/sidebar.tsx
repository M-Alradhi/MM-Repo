"use client"

import type React from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { GraduationCap, LogOut } from "lucide-react"
import { signOut } from "@/lib/firebase/auth"
import { useRouter } from "next/navigation"
import { useLanguage } from "@/lib/contexts/language-context"

interface SidebarProps {
  items: {
    title: string
    href: string
    icon: React.ReactNode
  }[]
  userRole: string
  onNavigate?: () => void
}

export function Sidebar({ items, userRole, onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useLanguage()

  const handleSignOut = async () => {
    await signOut()
    router.push("/auth/login")
  }

  return (
    <div className="flex flex-col h-full bg-card border-l border-border animate-in slide-in-from-right duration-500">
      <div className="p-6 border-b border-border animate-in fade-in duration-700 delay-150">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground p-2.5 rounded-xl shadow-lg animate-in zoom-in duration-500 delay-300">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-bold text-lg bg-gradient-to-l from-foreground to-foreground/70 bg-clip-text text-transparent">
              {t("platformTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">{t(userRole)}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {items.map((item, index) => (
          <Link key={item.href} href={item.href} onClick={onNavigate}>
            <Button
              variant={pathname === item.href ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start gap-3 transition-all duration-300 animate-in slide-in-from-right h-12 text-base",
                pathname === item.href
                  ? "bg-primary/10 text-primary hover:bg-primary/20 shadow-sm"
                  : "hover:bg-muted hover:translate-x-[-4px]",
              )}
              style={{ animationDelay: `${(index + 1) * 100}ms` }}
            >
              <div className={cn("transition-transform duration-300", pathname === item.href && "scale-110")}>
                {item.icon}
              </div>
              <span className="font-medium">{t(item.title)}</span>
            </Button>
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-border animate-in fade-in duration-700 delay-500">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10 transition-all duration-300 hover:translate-x-[-4px] h-12 text-base"
          onClick={handleSignOut}
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">{t("logout")}</span>
        </Button>
      </div>
    </div>
  )
}
