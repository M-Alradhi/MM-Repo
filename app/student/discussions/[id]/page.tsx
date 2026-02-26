"use client"

import type React from "react"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import {
  Home,
  FolderKanban,
  CheckSquare,
  Calendar,
  Bell,
  User,
  MessageCircle,
  ArrowLeft,
  ThumbsUp,
  Send,
  Pin,
  Lock,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAuth } from "@/lib/contexts/auth-context"
import { useLanguage } from "@/lib/contexts/language-context"
import { useEffect, useState } from "react"
import { getFirebaseDb } from "@/lib/firebase/config"
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  getDoc,
  doc,
  Timestamp,
  increment,
  updateDoc,
} from "firebase/firestore"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import Link from "next/link"
import { useParams } from "next/navigation"

const sidebarItems = [
  { title: "لوحة التحكم", href: "/student/dashboard", icon: <Home className="w-5 h-5" /> },
  { title: "الملف الشخصي", href: "/student/profile", icon: <User className="w-5 h-5" /> },
  { title: "مشروعي", href: "/student/project", icon: <FolderKanban className="w-5 h-5" /> },
  { title: "المهام", href: "/student/tasks", icon: <CheckSquare className="w-5 h-5" /> },
  { title: "الاجتماعات", href: "/student/meetings", icon: <Calendar className="w-5 h-5" /> },
  { title: "النقاشات", href: "/student/discussions", icon: <MessageCircle className="w-5 h-5" /> },
  { title: "الإشعارات", href: "/student/notifications", icon: <Bell className="w-5 h-5" /> },
]

interface Discussion {
  id: string
  title: string
  content: string
  authorId: string
  authorName: string
  authorRole: string
  isPinned: boolean
  isClosed: boolean
  tags: string[]
  likesCount: number
  repliesCount: number
  createdAt: Timestamp
}

interface Reply {
  id: string
  discussionId: string
  content: string
  authorId: string
  authorName: string
  authorRole: string
  likesCount: number
  createdAt: Timestamp
}

export default function DiscussionDetail() {
  const params = useParams()
  const discussionId = params.id as string
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
  const [discussion, setDiscussion] = useState<Discussion | null>(null)
  const [replies, setReplies] = useState<Reply[]>([])
  const [loading, setLoading] = useState(true)
  const [replyContent, setReplyContent] = useState("")
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!authLoading && userData) {
      fetchDiscussionAndReplies()
    }
  }, [userData, authLoading, discussionId])

  const fetchDiscussionAndReplies = async () => {
    try {
      setLoading(true)
      const db = getFirebaseDb()

      // Fetch discussion
      const discussionDoc = await getDoc(doc(db, "discussions", discussionId))
      if (discussionDoc.exists()) {
        setDiscussion({ id: discussionDoc.id, ...discussionDoc.data() } as Discussion)
      }

      // Fetch replies
      const repliesQuery = query(
        collection(db, "discussionReplies"),
        where("discussionId", "==", discussionId),
        orderBy("createdAt", "asc"),
      )
      const repliesSnapshot = await getDocs(repliesQuery)
      const repliesData = repliesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Reply[]
      setReplies(repliesData)
    } catch (error) {
      console.error("Error fetching discussion:", error)
      toast.error(t("errorLoadingDiscussion"))
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!replyContent.trim() || !userData) return

    if (discussion?.isClosed) {
      toast.error(t("thisDiscussionIsClosedCannotReply"))
      return
    }

    try {
      setSending(true)
      const db = getFirebaseDb()

      const discussionRef = doc(db, "discussions", discussionId)
      const discussionSnap = await getDoc(discussionRef)

      if (!discussionSnap.exists()) {
        toast.error(t("discussionNotFound"))
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

      // Update replies count
      await updateDoc(discussionRef, {
        repliesCount: increment(1),
        updatedAt: Timestamp.now(),
      })

      setReplyContent("")
      toast.success(t("addedReplySuccessfully"))
      fetchDiscussionAndReplies()
    } catch (error) {
      console.error("Error submitting reply:", error)
      toast.error(t("errorAddDiscussion"))
    } finally {
      setSending(false)
    }
  }

  const handleLikeDiscussion = async () => {
    try {
      const db = getFirebaseDb()
      const discussionRef = doc(db, "discussions", discussionId)
      const discussionSnap = await getDoc(discussionRef)

      if (!discussionSnap.exists()) {
        toast.error(t("discussionNotFound"))
        fetchDiscussionAndReplies()
        return
      }

      await updateDoc(discussionRef, {
        likesCount: increment(1),
      })
      fetchDiscussionAndReplies()
    } catch (error) {
      console.error("Error liking discussion:", error)
      toast.error(t("anErrorOccurred"))
    }
  }

  const handleLikeReply = async (replyId: string) => {
    try {
      const db = getFirebaseDb()
      const replyRef = doc(db, "discussionReplies", replyId)
      const replySnap = await getDoc(replyRef)

      if (!replySnap.exists()) {
        toast.error(t("replyNotFound"))
        fetchDiscussionAndReplies()
        return
      }

      await updateDoc(replyRef, {
        likesCount: increment(1),
      })
      fetchDiscussionAndReplies()
    } catch (error) {
      console.error("Error liking reply:", error)
      toast.error(t("anErrorOccurred"))
    }
  }

  const formatDate = (timestamp: Timestamp) => {
    return timestamp.toDate().toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <DashboardLayout sidebarItems={sidebarItems} requiredRole="student">
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center gap-3">
          <Link href="/student/discussions">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold"> {t("discussionDetails")}</h1>
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
              <p className="text-muted-foreground">{t("discussionNotFound")}</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Discussion Card */}
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
                      {discussion.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <CardTitle className="text-2xl">{discussion.title}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <span className="font-medium">{discussion.authorName}</span>
                      <span>•</span>
                      <span>
                        {discussion.authorRole === "supervisor"
                          ? "المشرف"
                          : discussion.authorRole === "student"
                            ? "طالب"
                            : ""}
                      </span>
                      <span>•</span>
                      <span>{formatDate(discussion.createdAt)}</span>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{discussion.content}</p>

                <div className="flex items-center gap-4 pt-4 border-t">
                  <Button variant="ghost" size="sm" onClick={handleLikeDiscussion} className="gap-2">
                    <ThumbsUp className="w-4 h-4" />
                    <span>{discussion.likesCount}</span>
                  </Button>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MessageCircle className="w-4 h-4" />
                    <span>{discussion.repliesCount} رد</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Replies Section */}
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
                    <p className="text-sm text-muted-foreground">لا توجد ردود بعد. كن أول من يرد!</p>
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
                            <span className="text-muted-foreground">
                              {reply.authorRole === "supervisor"
                                ? "المشرف"
                                : reply.authorRole === "student"
                                  ? "طالب"
                                  : ""}
                            </span>
                            <span className="text-muted-foreground">•</span>
                            <span className="text-muted-foreground">{formatDate(reply.createdAt)}</span>
                          </div>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{reply.content}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleLikeReply(reply.id)}
                            className="gap-2 h-8"
                          >
                            <ThumbsUp className="w-3 h-3" />
                            <span>{reply.likesCount}</span>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply Form */}
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

                {discussion.isClosed && (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    <Lock className="w-8 h-8 mx-auto mb-2" />
                    <p>هذا النقاش مغلق ولا يمكن إضافة ردود جديدة</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
