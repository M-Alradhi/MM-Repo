"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { studentSidebarItems } from "@/lib/constants/student-sidebar"
import { MessageSquare, Send, Search } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAuth } from "@/lib/contexts/auth-context"
import { useLanguage } from "@/lib/contexts/language-context"
import { useEffect, useState, useRef } from "react"
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

export default function StudentMessages() {
  const { userData, loading: authLoading } = useAuth()
  const { t, language } = useLanguage()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const sendingLockRef = useRef(false) // ✅ يمنع إرسال مزدوج
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    if (!authLoading && userData) {
      fetchConversations()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData, authLoading])

  useEffect(() => {
    if (selectedConversation && userData) {
      const unsubscribe = subscribeToMessages(selectedConversation.userId)
      // mark read for messages that are received by me
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

      // ✅ للطالب: عادةً يتكلم مع supervisor + coordinator
      const usersQuery = query(
        collection(db, "users"),
        or(where("role", "==", "supervisor"), where("role", "==", "coordinator")),
      )
      const usersSnapshot = await getDocs(usersQuery)
      const users = usersSnapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))

      // ✅ رسائل الطالب فقط
      const messagesQuery = query(
        collection(db, "messages"),
        or(where("senderId", "==", userData.uid), where("receiverId", "==", userData.uid)),
        orderBy("createdAt", "desc"),
      )
      const messagesSnapshot = await getDocs(messagesQuery)
      const allMessages = messagesSnapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Message[]

      const conversationsMap = new Map<string, Conversation>()

      // أضف كل المستخدمين (supervisors/coordinators) كبداية
      users.forEach((u: any) => {
        if (u.id !== userData.uid) {
          conversationsMap.set(u.id, {
            userId: u.id,
            userName: u.name || t("userFallbackName"),
            userEmail: u.email || "",
            userRole: u.role || "unknown",
            lastMessage: t("noMessagesYet"),
            lastMessageTime: Timestamp.fromDate(new Date(0)),
            unreadCount: 0,
          })
        }
      })

      // حدث بيانات آخر رسالة + unread
      allMessages.forEach((msg) => {
        const partnerId = msg.senderId === userData.uid ? msg.receiverId : msg.senderId
        const partnerName = msg.senderId === userData.uid ? msg.receiverName : msg.senderName

        if (conversationsMap.has(partnerId)) {
          const conv = conversationsMap.get(partnerId)!
          if (!conv.lastMessageTime || msg.createdAt.seconds > conv.lastMessageTime.seconds) {
            conv.lastMessage = msg.content
            conv.lastMessageTime = msg.createdAt
            // اسم الطرف من الرسائل لو لزم
            if (partnerName && (!conv.userName || conv.userName === t("userFallbackName"))) conv.userName = partnerName
          }
          if (msg.receiverId === userData.uid && !msg.read) {
            conv.unreadCount++
          }
        }
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
      toast.error(t("errorLoadingDataMsg"))
    } finally {
      setLoading(false)
    }
  }

  const subscribeToMessages = (partnerId: string) => {
    if (!userData) return () => {}

    const db = getFirebaseDb()
    const qy = query(
      collection(db, "messages"),
      or(
        and(where("senderId", "==", userData.uid), where("receiverId", "==", partnerId)),
        and(where("senderId", "==", partnerId), where("receiverId", "==", userData.uid)),
      ),
      orderBy("createdAt", "asc"),
    )

    return onSnapshot(qy, (snapshot) => {
      const msgs = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Message[]
      setMessages(msgs)
    })
  }

  // ✅ تعليم الرسائل كمقروءة (اختياري لكن مفيد)
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

    // تحديث العدّاد في القائمة بدون انتظار refetch
    setConversations((prev) => prev.map((c) => (c.userId === partnerId ? { ...c, unreadCount: 0 } : c)))
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !userData) return
    if (sendingLockRef.current) return // ✅ يمنع تكرار ضغطات/Enter

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
      toast.error(t("errorSendingMessageMsg"))
    } finally {
      setSending(false)
      // فك القفل بعد لحظة بسيطة (يحمي من Enter مرتين سريع)
      setTimeout(() => {
        sendingLockRef.current = false
      }, 250)
    }
  }

  const formatTime = (timestamp: Timestamp) => {
    const date = timestamp.toDate()
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 1) return t("now")
    if (diffInHours < 24) return date.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })
    return date.toLocaleDateString("ar-EG", { month: "short", day: "numeric" })
  }

  const filteredConversations = conversations.filter((conv) =>
    (conv.userName || "").toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "supervisor":
        return t("supervisor")
      case "coordinator":
        return t("coordinator")
      default:
        return ""
    }
  }

  return (
    <DashboardLayout sidebarItems={studentSidebarItems} requiredRole="student">
      <div className="h-[calc(100vh-8rem)] flex gap-4 animate-in fade-in duration-500">
        {/* Conversations List */}
        <Card className="w-80 h-full flex flex-col overflow-hidden">
          <div className="p-4 border-b flex-shrink-0">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              {t("conversations")}
            </h2>

            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="h-full">
              {loading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-muted" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">{t("noConversations")}</p>
                </div>
              ) : (
                <div className="p-2">
                  {filteredConversations.map((conv) => (
                    <button
                      key={conv.userId}
                      onClick={() => setSelectedConversation(conv)}
                      className={`w-full p-3 rounded-lg flex items-center gap-3 hover:bg-muted transition-colors relative ${
                        selectedConversation?.userId === conv.userId ? "bg-muted" : ""
                      }`}
                    >
                      {conv.unreadCount > 0 && (
                        <div className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-primary rounded-full animate-pulse" />
                      )}
                      <Avatar className="w-12 h-12">
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {conv.userName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 text-right overflow-hidden">
                        <div className="flex items-center justify-between mb-1">
                          <p className={`font-semibold text-sm truncate ${conv.unreadCount > 0 ? "text-primary" : ""}`}>
                            {conv.userName}
                          </p>
                          {conv.unreadCount > 0 && (
                            <span className="bg-primary text-primary-foreground text-xs rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center font-semibold">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {conv.userEmail} • {getRoleLabel(conv.userRole)}
                        </p>
                        <p
                          className={`text-xs truncate mt-0.5 ${conv.unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}
                        >
                          {conv.lastMessage}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </Card>

        {/* Messages Area */}
        <Card className="flex-1 h-full flex flex-col overflow-hidden">
          {selectedConversation ? (
            <>
              <div className="p-4 border-b flex items-center gap-3 flex-shrink-0">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {selectedConversation.userName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold">{selectedConversation.userName}</h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedConversation.userEmail} • {getRoleLabel(selectedConversation.userRole)}
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 min-h-0">
                <div className="space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center py-12">
                      <MessageSquare className="w-16 h-16 mx-auto text-muted-foreground mb-3" />
                      <p className="text-muted-foreground">{t("noMessagesYet")}</p>
                      <p className="text-sm text-muted-foreground mt-1">{t("startConversation")}</p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isOwn = msg.senderId === userData?.uid
                      return (
                        <div key={msg.id} className={`flex ${isOwn ? "justify-start" : "justify-end"}`}>
                          <div
                            className={`max-w-[70%] rounded-lg p-3 ${
                              isOwn ? "bg-primary text-primary-foreground" : "bg-muted"
                            }`}
                            style={{
                              wordWrap: "break-word",
                              overflowWrap: "break-word",
                              wordBreak: "break-word",
                              hyphens: "auto",
                            }}
                          >
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                            <p
                              className={`text-xs mt-1 ${isOwn ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                            >
                              {formatTime(msg.createdAt)}
                            </p>
                          </div>
                        </div>
                      )
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              <div className="p-4 border-t flex-shrink-0">
                <div className="flex gap-2">
                  <Textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={t("writeYourMessage")}
                    className="resize-none"
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="icon"
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sending}
                    className="h-auto"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-20 h-20 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">{t("selectConversation")}</h3>
                <p className="text-sm text-muted-foreground">{t("selectConversationInstructions")}</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  )
}
