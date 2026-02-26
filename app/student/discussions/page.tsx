"use client"

import type React from "react"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { MessageCircle, Plus, ThumbsUp, MessageSquare, Pin, Lock, Unlock } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  updateDoc,
  doc,
  Timestamp,
  increment,
  getDoc,
} from "firebase/firestore"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { studentSidebarItems } from "@/lib/constants/student-sidebar"

interface Discussion {
  id: string
  title: string
  content: string
  authorId: string
  authorName: string
  authorRole: string
  projectId: string
  isPinned: boolean
  isClosed: boolean
  tags: string[]
  repliesCount: number
  likesCount: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

export default function StudentDiscussions() {
  const { userData, loading: authLoading } = useAuth()
  const { t, language } = useLanguage()

  const [discussions, setDiscussions] = useState<Discussion[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("all")

  // ✅ projectId الحقيقي الذي سنستخدمه للفلترة
  const [projectId, setProjectId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    tags: "",
  })

  useEffect(() => {
    if (!authLoading && userData?.uid) {
      init()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData, authLoading])

  const init = async () => {
    try {
      setLoading(true)

      const pid = await resolveStudentProjectId()
      setProjectId(pid)

      if (!pid) {
        setDiscussions([])
        return
      }

      await fetchDiscussions(pid)
    } finally {
      setLoading(false)
    }
  }

  // ✅ يجيب projectId الحقيقي للطالب من جدول projects
  const resolveStudentProjectId = async (): Promise<string | null> => {
    if (!userData?.uid) return null
    const db = getFirebaseDb()

    // 1) مشروع فريق: studentIds array-contains uid
    const teamQ = query(collection(db, "projects"), where("studentIds", "array-contains", userData.uid))
    const teamSnap = await getDocs(teamQ)
    if (!teamSnap.empty) return teamSnap.docs[0].id

    // 2) مشروع فردي: studentId == uid
    const soloQ = query(collection(db, "projects"), where("studentId", "==", userData.uid))
    const soloSnap = await getDocs(soloQ)
    if (!soloSnap.empty) return soloSnap.docs[0].id

    // 3) fallback (لو عندك userData.projectId صحيح)
    if (userData.projectId) return userData.projectId

    return null
  }

  const fetchDiscussions = async (pid: string) => {
    try {
      const db = getFirebaseDb()

      const discussionsQuery = query(
        collection(db, "discussions"),
        where("projectId", "==", pid),
        orderBy("createdAt", "desc"),
      )

      const discussionsSnapshot = await getDocs(discussionsQuery)
      const discussionsData = discussionsSnapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Discussion[]

      // ✅ pinned first
      discussionsData.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1
        if (!a.isPinned && b.isPinned) return 1
        return b.createdAt.seconds - a.createdAt.seconds
      })

      setDiscussions(discussionsData)
    } catch (error) {
      console.error("Error fetching discussions:", error)
      toast.error(t("errorFetchingDiscussions"))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error(t("fillAllRequiredFields"))
      return
    }

    if (!userData?.uid) {
      toast.error(t("error"))
      return
    }

    // ✅ لازم يكون عندنا projectId حقيقي
    if (!projectId) {
      toast.error(t("mustBeInProjectToCreateDiscussion"))
      return
    }

    try {
      const db = getFirebaseDb()
      const tags = formData.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)

      await addDoc(collection(db, "discussions"), {
        title: formData.title,
        content: formData.content,
        authorId: userData.uid,
        authorName: userData.name,
        authorRole: userData.role,
        projectId, // ✅ هنا أهم إصلاح: projectId الصحيح
        isPinned: false,
        isClosed: false,
        tags,
        repliesCount: 0,
        likesCount: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })

      toast.success(t("discussionCreatedSuccessfully"))
      setDialogOpen(false)
      setFormData({ title: "", content: "", tags: "" })
      await fetchDiscussions(projectId)
    } catch (error) {
      console.error("Error creating discussion:", error)
      toast.error(t("errorCreatingDiscussion"))
    }
  }

  const handleLike = async (discussionId: string) => {
    try {
      const db = getFirebaseDb()
      const discussionRef = doc(db, "discussions", discussionId)
      const discussionSnap = await getDoc(discussionRef)

      if (!discussionSnap.exists()) {
        toast.error(t("discussionNotFound"))
        if (projectId) await fetchDiscussions(projectId)
        return
      }

      await updateDoc(discussionRef, {
        likesCount: increment(1),
      })

      // refresh (بدون ما تعتمد على projectId من userData)
      if (projectId) await fetchDiscussions(projectId)
    } catch (error) {
      console.error("Error liking discussion:", error)
      toast.error(t("error"))
    }
  }

  const formatDate = (timestamp: Timestamp) => {
    const date = timestamp.toDate()
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 1) return t("fewMinutesAgo")
    if (diffInHours < 24) return `${t("hoursAgo").replace("{hours}", Math.floor(diffInHours).toString())}`
    if (diffInHours < 48) return t("oneDayAgo")

    return date.toLocaleDateString(language === "ar" ? "ar-EG" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const filteredDiscussions = discussions.filter((discussion) => {
    if (activeTab === "all") return true
    if (activeTab === "open") return !discussion.isClosed
    if (activeTab === "closed") return discussion.isClosed
    return true
  })

  // ✅ إذا ما عنده مشروع فعلي
  if (!authLoading && !loading && !projectId) {
    return (
      <DashboardLayout sidebarItems={studentSidebarItems} requiredRole="student">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <MessageCircle className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t("noProject")}</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">{t("mustBeInProjectForDiscussions")}</p>
          </CardContent>
        </Card>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout sidebarItems={studentSidebarItems} requiredRole="student">
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <MessageCircle className="w-8 h-8 text-primary" />
              </div>
              {t("discussionForum")}
            </h1>
            <p className="text-muted-foreground mt-2">{t("shareIdeasWithTeam")}</p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" disabled={!projectId}>
                <Plus className="w-4 h-4" />
                {t("newDiscussion")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{t("createNewDiscussion")}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">{t("discussionTitle")} *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder={t("enterDiscussionTitle")}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">{t("discussionContent")} *</Label>
                  <Textarea
                    id="content"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder={t("explainDiscussionInDetail")}
                    rows={6}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tags">
                    {t("tags")} ({t("optional")})
                  </Label>
                  <Input
                    id="tags"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    placeholder={t("tagsExample")}
                  />
                  <p className="text-xs text-muted-foreground">{t("separateTagsWithComma")}</p>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    {t("cancel")}
                  </Button>
                  <Button type="submit">{t("createDiscussion")}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="all">
              {t("all")} ({discussions.length})
            </TabsTrigger>
            <TabsTrigger value="open">
              {t("open")} ({discussions.filter((d) => !d.isClosed).length})
            </TabsTrigger>
            <TabsTrigger value="closed">
              {t("closed")} ({discussions.filter((d) => d.isClosed).length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-1/2 mt-2" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-20 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredDiscussions.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="p-4 bg-muted rounded-full mb-4">
                    <MessageCircle className="w-12 h-12 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{t("noDiscussions")}</h3>
                  <p className="text-sm text-muted-foreground text-center max-w-md mb-4">{t("noDiscussionsYet")}</p>
                  <Button onClick={() => setDialogOpen(true)} className="gap-2" disabled={!projectId}>
                    <Plus className="w-4 h-4" />
                    {t("newDiscussion")}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div>
                {filteredDiscussions.map((discussion, index) => (
                  <Link key={discussion.id} href={`/student/discussions/${discussion.id}`} className="block mb-6">
                    <Card
                      className={`animate-in fade-in slide-in-from-bottom duration-500 hover:shadow-lg transition-all cursor-pointer ${
                        discussion.isPinned ? "border-primary/50 bg-primary/5" : ""
                      }`}
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex gap-3 flex-1">
                            <Avatar className="w-10 h-10">
                              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                {discussion.authorName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                {discussion.isPinned && (
                                  <Badge variant="default" className="gap-1">
                                    <Pin className="w-3 h-3" />
                                    {t("pinned")}
                                  </Badge>
                                )}
                                {discussion.isClosed ? (
                                  <Badge variant="secondary" className="gap-1">
                                    <Lock className="w-3 h-3" />
                                    {t("closed")}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="gap-1">
                                    <Unlock className="w-3 h-3" />
                                    {t("open")}
                                  </Badge>
                                )}
                                {discussion.tags.map((tag) => (
                                  <Badge key={tag} variant="secondary">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                              <CardTitle className="text-xl hover:text-primary transition-colors">
                                {discussion.title}
                              </CardTitle>
                              <CardDescription className="flex items-center gap-2 text-sm">
                                <span className="font-medium">{discussion.authorName}</span>
                                <span>•</span>
                                <span>
                                  {discussion.authorRole === "supervisor"
                                    ? t("supervisor")
                                    : discussion.authorRole === "student"
                                      ? t("student")
                                      : ""}
                                </span>
                                <span>•</span>
                                <span>{formatDate(discussion.createdAt)}</span>
                              </CardDescription>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-sm leading-relaxed line-clamp-2">{discussion.content}</p>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              handleLike(discussion.id)
                            }}
                            className="flex items-center gap-1 hover:text-primary transition-colors"
                          >
                            <ThumbsUp className="w-4 h-4" />
                            <span>{discussion.likesCount}</span>
                          </button>
                          <div className="flex items-center gap-1">
                            <MessageSquare className="w-4 h-4" />
                            <span>
                              {discussion.repliesCount} {t("reply")}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
