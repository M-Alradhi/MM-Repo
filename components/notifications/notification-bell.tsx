"use client"

import { useEffect, useState, useRef } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAuth } from "@/lib/contexts/auth-context"
import { useLanguage } from "@/lib/contexts/language-context"
import {
  subscribeToNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  type Notification,
} from "@/lib/firebase/notifications"
import { formatDistanceToNow } from "date-fns"
import { ar, enUS } from "date-fns/locale"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

export function NotificationBell() {
  const { user, userData } = useAuth()
  const { t, language } = useLanguage()
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const subscriptionRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!user?.uid) {
      if (subscriptionRef.current) {
        subscriptionRef.current()
        subscriptionRef.current = null
      }
      setNotifications([])
      setUnreadCount(0)
      return
    }

    if (subscriptionRef.current) {
      subscriptionRef.current()
    }

    const unsubscribe = subscribeToNotifications(user.uid, (newNotifications) => {
      setNotifications(newNotifications)
      setUnreadCount(newNotifications.filter((n) => !n.read).length)
    })

    subscriptionRef.current = unsubscribe

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current()
        subscriptionRef.current = null
      }
    }
  }, [user?.uid])

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read && notification.id) {
      await markNotificationAsRead(notification.id)
    }
    if (notification.link) {
      router.push(notification.link)
    }
  }

  const handleMarkAllAsRead = async () => {
    if (user) {
      await markAllNotificationsAsRead(user.uid)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "success":
        return "✓"
      case "warning":
        return "⚠"
      case "error":
        return "✕"
      default:
        return "ℹ"
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "success":
        return "text-green-500"
      case "warning":
        return "text-yellow-500"
      case "error":
        return "text-red-500"
      default:
        return "text-blue-500"
    }
  }

  const getNotificationsRoute = () => {
    if (!userData?.role) return "/student/notifications"
    return `/${userData.role}/notifications`
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{t("notifications")}</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleMarkAllAsRead} className="h-auto p-1 text-xs">
              {t("markAsComplete")}
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mb-2 opacity-20" />
              <p className="text-sm">{t("noContent")}</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={cn(
                  "flex flex-col items-start p-4 cursor-pointer hover:bg-accent",
                  !notification.read && "bg-accent/50",
                )}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start gap-3 w-full">
                  <span className={cn("text-lg", getNotificationColor(notification.type))}>
                    {getNotificationIcon(notification.type)}
                  </span>
                  <div className="flex-1 space-y-1">
                    <p className={cn("text-sm font-medium", !notification.read && "font-bold")}>{notification.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
                    {notification.createdAt && (
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(notification.createdAt.toDate(), {
                          addSuffix: true,
                          locale: language === "ar" ? ar : enUS,
                        })}
                      </p>
                    )}
                  </div>
                  {!notification.read && <div className="w-2 h-2 bg-primary rounded-full" />}
                </div>
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-center justify-center text-primary cursor-pointer"
              onClick={() => router.push(getNotificationsRoute())}
            >
              {t("viewAll")} {t("notifications")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
