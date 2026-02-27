"use client"

import type React from "react"

import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { getFirebaseDb } from "@/lib/firebase/config"
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  Timestamp,
  increment,
} from "firebase/firestore"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Home, FolderKanban, Users, Calendar, MessageCircle, ArrowLeft, Send, Pin, Lock } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import { useAuth } from "@/lib/contexts/auth-context"

const sidebarItems = [
  { title: "لوحة التحكم", href: "/supervisor/dashboard", icon: <Home className="w-5 h-5" /> },
  { title: "المشاريع", href: "/supervisor/projects", icon: <FolderKanban className="w-5 h-5" /> },
  { title: "الطلاب", href: "/supervisor/students", icon: <Users className="w-5 h-5" /> },
  { title: "الاجتماعات", href: "/supervisor/meetings", icon: <Calendar className="w-5 h-5" /> },
  { title: "النقاشات", href: "/supervisor/discussions", icon: <MessageCircle className="w-5 h-5" /> },
]

export default function SupervisorDiscussionDetail() {
  const params = useParams()
  const discussionId = params.id as string
  const { userData } = useAuth()
  const [discussion, setDiscussion] = useState<any>(null)
  const [replies, setReplies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [replyContent, setReplyContent] = useState("")
  const [sending, setSending] = useState(false)

  useEffect(() => {
    fetchDiscussionAndReplies()
  }, [discussionId])

  const fetchDiscussionAndReplies = async () => {
    try {
      setLoading(true)
      const db = getFirebaseDb()

      const discussionDoc = await getDoc(doc(db, "discussions", discussionId))
      if (discussionDoc.exists()) {
        setDiscussion({ id: discussionDoc.id, ...discussionDoc.data() })
      }

      try {
        const repliesQuery = query(
          collection(db, "discussionReplies"),
          where("discussionId", "==", discussionId),
        )
        const repliesSnapshot = await getDocs(repliesQuery)
        const repliesData = repliesSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        repliesData.sort((a: any, b: any) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0))
        setReplies(repliesData)
      } catch (repliesError) {
        console.error("Error fetching replies:", repliesError)
        setReplies([])
      }
    } catch (error) {
      console.error("Error fetching discussion:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyContent.trim() || !userData) return

    if (discussion?.isClosed) {
      return
    }

    try {
      setSending(true)
      const db = getFirebaseDb()

      const discussionRef = doc(db, "discussions", discussionId)
      const discussionSnap = await getDoc(discussionRef)

      if (!discussionSnap.exists()) {
        setSending(false)
        return
      }

      await addDoc(collection(db, "discussionReplies"), {
        discussionId,
        content: replyContent.trim(),
        authorId: userData.uid,
        authorName: userData.name,
        authorRole: userData.role,
        likesCount: 0,
        createdAt: Timestamp.now(),
      })

      await updateDoc(discussionRef, {
        repliesCount: increment(1),
        updatedAt: Timestamp.now(),
      })

      setReplyContent("")
      fetchDiscussionAndReplies()
    } catch (error) {
      console.error("Error submitting reply:", error)
    } finally {
      setSending(false)
    }
  }

  const formatDate = (timestamp: any) => {
    return timestamp.toDate().toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <DashboardLayout sidebarItems={sidebarItems} requiredRole="supervisor">
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center gap-3">
          <Link href="/supervisor/discussions">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">تفاصيل النقاش</h1>
        </div>

        {loading ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/2 mt-2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        ) : !discussion ? (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-muted-foreground">لم يتم العثور على النقاش</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <Avatar className="w-12 h-12">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {discussion.authorName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {discussion.isPinned && (
                        <Badge variant="default" className="gap-1">
                          <Pin className="w-3 h-3" />
                          مثبت
                        </Badge>
                      )}
                      {discussion.isClosed && (
                        <Badge variant="secondary" className="gap-1">
                          <Lock className="w-3 h-3" />
                          مغلق
                        </Badge>
                      )}
                      {discussion.tags?.map((tag: string) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <CardTitle className="text-2xl">{discussion.title}</CardTitle>
                    <CardDescription>
                      {discussion.authorName} • {formatDate(discussion.createdAt)}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{discussion.content}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  الردود ({replies.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {replies.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">لا توجد ردود بعد</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {replies.map((reply) => (
                      <div key={reply.id} className="flex gap-3 p-4 rounded-lg bg-muted/50">
                        <Avatar className="w-10 h-10">
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                            {reply.authorName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-semibold">{reply.authorName}</span>
                            <span className="text-muted-foreground">•</span>
                            <span className="text-muted-foreground">{formatDate(reply.createdAt)}</span>
                          </div>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{reply.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!discussion.isClosed && (
                  <form onSubmit={handleSubmitReply} className="space-y-3 pt-4 border-t">
                    <Textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder="اكتب ردك هنا..."
                      rows={4}
                      disabled={sending}
                    />
                    <div className="flex justify-end">
                      <Button type="submit" disabled={!replyContent.trim() || sending} className="gap-2">
                        <Send className="w-4 h-4" />
                        إرسال الرد
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
