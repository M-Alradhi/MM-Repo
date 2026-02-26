"use client"

import type React from "react"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { coordinatorSidebarItems } from "@/lib/constants/coordinator-sidebar"
import { MessageSquare, Send, Search } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAuth } from "@/lib/contexts/auth-context"
import { useLanguage } from "@/lib/contexts/language-context"
import { useEffect, useMemo, useRef, useState } from "react"
import { getFirebaseDb } from "@/lib/firebase/config"
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  onSnapshot,
  Timestamp,
  or,
  and,
  updateDoc,
  doc,
} from "firebase/firestore"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { ScrollArea } from "@/components/ui/scroll-area"

interface Message {
  id: string
  senderId: string
  senderName: string
  receiverId: string
  receiverName: string
  content: string
  createdAt: Timestamp
  read: boolean
}

interface Conversation {
  userId: string
  userName: string
  userEmail: string
  userRole: string
  lastMessage: string
  lastMessageTime: Timestamp
  unreadCount: number
}

export default function CoordinatorMessages() {
  const { userData, loading: authLoading } = useAuth()
  const { t } = useLanguage()
  const [stats, setStats] = useState({
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    totalSupervisors: 0,
    totalStudents: 0,
    averageProgress: 0,
    projectsNeedingAttention: 0,
  })
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const sendingLockRef = useRef(false)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    if (!authLoading && userData) fetchConversations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData, authLoading])

  useEffect(() => {
    if (selectedConversation && userData) {
      const unsubscribe = subscribeToMessages(selectedConversation.userId)
      markConversationAsRead(selectedConversation.userId).catch(() => {})
      return () => unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation, userData])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const fetchConversations = async () => {
    if (!userData) return

    try {
      setLoading(true)
      const db = getFirebaseDb()

      // Get all supervisors and students
      const usersQuery = query(
        collection(db, "users"),
        or(where("role", "==", "supervisor"), where("role", "==", "student")),
      )
      const usersSnapshot = await getDocs(usersQuery)
      const users = usersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))

      // Fetch all messages involving this coordinator
      const messagesQuery = query(
        collection(db, "messages"),
        or(where("senderId", "==", userData.uid), where("receiverId", "==", userData.uid)),
        orderBy("createdAt", "desc"),
      )

      const messagesSnapshot = await getDocs(messagesQuery)
      const allMessages = messagesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[]

      const conversationsMap = new Map<string, Conversation>()

      // Add all users first
      users.forEach((u: any) => {
        if (u.id !== userData.uid) {
          conversationsMap.set(u.id, {
            userId: u.id,
            userName: u.name || t("user"),
            userEmail: u.email || "",
            userRole: u.role || "unknown",
            lastMessage: t("NoMessagesYet"),
            lastMessageTime: Timestamp.fromDate(new Date(0)),
            unreadCount: 0,
          })
        }
      })

      // Update with message stats
      allMessages.forEach((msg) => {
        const partnerId = msg.senderId === userData.uid ? msg.receiverId : msg.senderId
        if (!conversationsMap.has(partnerId)) return

        const conv = conversationsMap.get(partnerId)!
        if (!conv.lastMessageTime || msg.createdAt.seconds > conv.lastMessageTime.seconds) {
          conv.lastMessage = msg.content
          conv.lastMessageTime = msg.createdAt
        }
        if (msg.receiverId === userData.uid && !msg.read) conv.unreadCount++
      })

      const conversationsArray = Array.from(conversationsMap.values()).sort((a, b) => {
        const aHas = a.lastMessageTime.seconds > 0
        const bHas = b.lastMessageTime.seconds > 0
        if (aHas && !bHas) return -1
        if (!aHas && bHas) return 1
        return b.lastMessageTime.seconds - a.lastMessageTime.seconds
      })

      setConversations(conversationsArray)
    } catch (error) {
      console.error("Error fetching conversations:", error)
      toast.error(t("errorLoadingConversations"))
    } finally {
      setLoading(false)
    }
  }

  const subscribeToMessages = (partnerId: string) => {
    if (!userData) return () => {}

    const db = getFirebaseDb()
    const messagesQuery = query(
      collection(db, "messages"),
      or(
        and(where("senderId", "==", userData.uid), where("receiverId", "==", partnerId)),
        and(where("senderId", "==", partnerId), where("receiverId", "==", userData.uid)),
      ),
      orderBy("createdAt", "asc"),
    )

    return onSnapshot(messagesQuery, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[]
      setMessages(msgs)
    })
  }

  const markConversationAsRead = async (partnerId: string) => {
    if (!userData) return
    const db = getFirebaseDb()

    const unreadQuery = query(
      collection(db, "messages"),
      where("senderId", "==", partnerId),
      where("receiverId", "==", userData.uid),
      where("read", "==", false),
    )

    const snap = await getDocs(unreadQuery)
    const updates = snap.docs.map((m) => updateDoc(doc(db, "messages", m.id), { read: true }))
    await Promise.all(updates)

    setConversations((prev) => prev.map((c) => (c.userId === partnerId ? { ...c, unreadCount: 0 } : c)))
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newMessage.trim() || !selectedConversation || !userData) return
    if (sendingLockRef.current) return

    try {
      sendingLockRef.current = true
      setSending(true)
      const db = getFirebaseDb()

      await addDoc(collection(db, "messages"), {
        senderId: userData.uid,
        senderName: userData.name,
        receiverId: selectedConversation.userId,
        receiverName: selectedConversation.userName,
        content: newMessage.trim(),
        createdAt: Timestamp.now(),
        read: false,
      })

      setNewMessage("")
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    } catch (error) {
      console.error("Error sending message:", error)
      toast.error(t("errorSendingMessage"))
    } finally {
      setSending(false)
      setTimeout(() => {
        sendingLockRef.current = false
      }, 250)
    }
  }

  const formatTime = (timestamp: Timestamp) => {
    const date = timestamp.toDate()
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 1) return "الآن"
    if (diffInHours < 24) return date.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })
    return date.toLocaleDateString("ar-EG", { month: "short", day: "numeric" })
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "supervisor":
        return t("supervisor")
      case "student":
        return t("student")
      default:
        return ""
    }
  }

  const filteredConversations = useMemo(
    () => conversations.filter((c) => c.userName.toLowerCase().includes(searchTerm.toLowerCase())),
    [conversations, searchTerm],
  )

  return (
    <DashboardLayout sidebarItems={coordinatorSidebarItems} requiredRole="coordinator">
      <div className="h-[calc(100vh-8rem)] grid grid-cols-12 gap-4">
        {/* LEFT: Conversations */}
        <Card className="col-span-12 lg:col-span-4 h-full flex flex-col overflow-hidden rounded-2xl">
          <div className="p-4 border-b bg-background">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                {t("messagesm")}
              </h2>
              <span className="text-xs text-muted-foreground">{filteredConversations.length}</span>
            </div>

            <div className="relative mt-3">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("searchByName")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10 rounded-xl"
              />
            </div>
          </div>

          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              {loading ? (
                <div className="p-4 space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="w-12 h-12 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-10 text-center">
                  <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">{t("noConversations")}</p>
                </div>
              ) : (
                <div className="p-2 space-y-2">
                  {filteredConversations.map((conv) => {
                    const active = selectedConversation?.userId === conv.userId

                    return (
                      <button
                        key={conv.userId}
                        onClick={() => setSelectedConversation(conv)}
                        className={[
                          "w-full text-right p-3 rounded-2xl transition border relative",
                          active
                            ? "bg-primary/10 border-primary/20"
                            : "bg-background hover:bg-muted/50 border-transparent",
                        ].join(" ")}
                      >
                        {conv.unreadCount > 0 && (
                          <div className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-primary rounded-full animate-pulse" />
                        )}
                        <div className="flex items-start gap-3">
                          <Avatar className="w-12 h-12 shrink-0">
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                              {conv.userName?.charAt(0) || "U"}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p
                                className={`font-semibold text-sm truncate ${conv.unreadCount > 0 ? "text-primary" : ""}`}
                              >
                                {conv.userName}
                              </p>
                              <span className="text-[11px] text-muted-foreground shrink-0">
                                {conv.lastMessageTime?.seconds ? formatTime(conv.lastMessageTime) : ""}
                              </span>
                            </div>

                            <div className="mt-1 flex items-center gap-2 min-w-0">
                              <p className="text-xs text-muted-foreground truncate">{conv.userEmail}</p>
                              <span className="text-xs text-muted-foreground shrink-0">•</span>
                              <span className="text-xs text-muted-foreground shrink-0">
                                {getRoleLabel(conv.userRole)}
                              </span>
                            </div>

                            <div className="mt-1 flex items-center justify-between gap-2">
                              <p
                                className={`text-xs truncate ${conv.unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}
                              >
                                {conv.lastMessage}
                              </p>

                              {conv.unreadCount > 0 && (
                                <span className="shrink-0 bg-primary text-primary-foreground text-[11px] rounded-full px-2 py-0.5 font-semibold">
                                  {conv.unreadCount}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </Card>

        {/* RIGHT: Chat */}
        <Card className="col-span-12 lg:col-span-8 h-full flex flex-col overflow-hidden rounded-2xl">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b bg-background flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {selectedConversation.userName?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{selectedConversation.userName}</h3>
                    <p className="text-xs text-muted-foreground truncate">
                      {selectedConversation.userEmail} • {getRoleLabel(selectedConversation.userRole)}
                    </p>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  {messages.length > 0 ? `${messages.length} ${t("message")}` : t("NoMessages")}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 min-h-0 bg-muted/20">
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-3">
                    {messages.length === 0 ? (
                      <div className="text-center py-20">
                        <MessageSquare className="w-16 h-16 mx-auto text-muted-foreground mb-3" />
                        <p className="text-muted-foreground">{t("NoMessagesYet")}</p>
                        <p className="text-sm text-muted-foreground mt-1">{t("startConversation")}</p>
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const isOwn = msg.senderId === userData?.uid

                        return (
                          <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                            <div
                              className={[
                                "max-w-[78%] rounded-2xl px-4 py-3 border shadow-sm",
                                isOwn
                                  ? "bg-primary text-primary-foreground border-primary/10"
                                  : "bg-background border-muted",
                              ].join(" ")}
                              style={{
                                wordWrap: "break-word",
                                overflowWrap: "break-word",
                                wordBreak: "break-word",
                              }}
                            >
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                              <div
                                className={[
                                  "mt-2 text-[11px]",
                                  isOwn ? "text-primary-foreground/70 text-left" : "text-muted-foreground text-right",
                                ].join(" ")}
                              >
                                {formatTime(msg.createdAt)}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              </div>

              {/* Message Input */}
              <form onSubmit={handleSendMessage} className="p-4 border-t bg-background">
                <div className="flex items-end gap-2">
                  <Textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={t("writeYourMessage")}
                    className="resize-none min-h-[52px] max-h-40 bg-background rounded-2xl"
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage(e)
                      }
                    }}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    className="h-[52px] w-[52px] rounded-2xl"
                    disabled={!newMessage.trim() || sending}
                  >
                    <Send className="w-5 h-5" />
                  </Button>
                </div>

                <p className="text-[11px] text-muted-foreground mt-2">Enter {t("forSending")} • Shift+Enter  {t("forNewLine")}</p>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-muted/10">
              <div className="text-center p-8">
                <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <MessageSquare className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{t("chooseConversation")}</h3>
                <p className="text-sm text-muted-foreground">{t("chooseConversationDescription")}</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  )
}
