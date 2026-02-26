"use client"

import type React from "react"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Home, FolderKanban, Users, Calendar, Megaphone, Plus, Pin, Trash2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/contexts/auth-context"
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
  deleteDoc,
  doc,
  Timestamp,
} from "firebase/firestore"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"

const sidebarItems = [
  { title: "لوحة التحكم", href: "/supervisor/dashboard", icon: <Home className="w-5 h-5" /> },
  { title: "المشاريع", href: "/supervisor/projects", icon: <FolderKanban className="w-5 h-5" /> },
  { title: "الطلاب", href: "/supervisor/students", icon: <Users className="w-5 h-5" /> },
  { title: "الاجتماعات", href: "/supervisor/meetings", icon: <Calendar className="w-5 h-5" /> },
  { title: "الإعلانات", href: "/supervisor/announcements", icon: <Megaphone className="w-5 h-5" /> },
]

interface Announcement {
  id: string
  title: string
  content: string
  authorId: string
  authorName: string
  authorRole: string
  projectId?: string | null
  projectTitle?: string
  isPinned: boolean
  createdAt: Timestamp
}

interface Project {
  id: string
  title: string
}

export default function SupervisorAnnouncements() {
  const { userData, loading: authLoading } = useAuth()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    projectId: "all",
    isPinned: false,
  })

  useEffect(() => {
    fetchData()
  }, [userData, authLoading])

  const fetchData = async () => {
    if (authLoading || !userData) return

    try {
      setLoading(true)
      const db = getFirebaseDb()

      // Fetch supervisor's projects
      const projectsQuery = query(collection(db, "projects"), where("supervisorId", "==", userData.uid))
      const projectsSnapshot = await getDocs(projectsQuery)
      const projectsData = projectsSnapshot.docs.map((doc) => ({
        id: doc.id,
        title: doc.data().title,
      })) as Project[]
      setProjects(projectsData)

      // Fetch announcements created by this supervisor
      const announcementsQuery = query(
        collection(db, "announcements"),
        where("authorId", "==", userData.uid),
        orderBy("createdAt", "desc"),
      )
      const announcementsSnapshot = await getDocs(announcementsQuery)
      const announcementsData = announcementsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Announcement[]

      setAnnouncements(announcementsData)
    } catch (error) {
      console.error("Error fetching data:", error)
      toast.error("حدث خطأ أثناء تحميل البيانات")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error("يرجى ملء جميع الحقول المطلوبة")
      return
    }

    try {
      const db = getFirebaseDb()
      const selectedProject = projects.find((p) => p.id === formData.projectId)

      await addDoc(collection(db, "announcements"), {
        title: formData.title,
        content: formData.content,
        authorId: userData?.uid,
        authorName: userData?.name,
        authorRole: "supervisor",
        projectId: formData.projectId === "all" ? null : formData.projectId,
        projectTitle: selectedProject?.title || null,
        isPinned: formData.isPinned,
        createdAt: Timestamp.now(),
      })

      toast.success("تم نشر الإعلان بنجاح")
      setDialogOpen(false)
      setFormData({ title: "", content: "", projectId: "all", isPinned: false })
      fetchData()
    } catch (error) {
      console.error("Error creating announcement:", error)
      toast.error("حدث خطأ أثناء نشر الإعلان")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا الإعلان؟")) return

    try {
      const db = getFirebaseDb()
      await deleteDoc(doc(db, "announcements", id))
      toast.success("تم حذف الإعلان بنجاح")
      fetchData()
    } catch (error) {
      console.error("Error deleting announcement:", error)
      toast.error("حدث خطأ أثناء حذف الإعلان")
    }
  }

  const togglePin = async (id: string, currentPinned: boolean) => {
    try {
      const db = getFirebaseDb()
      await updateDoc(doc(db, "announcements", id), {
        isPinned: !currentPinned,
      })
      toast.success(currentPinned ? "تم إلغاء التثبيت" : "تم تثبيت الإعلان")
      fetchData()
    } catch (error) {
      console.error("Error toggling pin:", error)
      toast.error("حدث خطأ")
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
    <DashboardLayout sidebarItems={sidebarItems} requiredRole="supervisor">
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Megaphone className="w-8 h-8 text-primary" />
              </div>
              الإعلانات
            </h1>
            <p className="text-muted-foreground mt-2">إدارة ونشر الإعلانات للطلاب</p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                إعلان جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>نشر إعلان جديد</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">عنوان الإعلان *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="أدخل عنوان الإعلان"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">محتوى الإعلان *</Label>
                  <Textarea
                    id="content"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="أدخل محتوى الإعلان"
                    rows={6}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project">المشروع</Label>
                  <Select
                    value={formData.projectId}
                    onValueChange={(value) => setFormData({ ...formData, projectId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر المشروع" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع المشاريع (إعلان عام)</SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-0.5">
                    <Label htmlFor="pinned">تثبيت الإعلان</Label>
                    <p className="text-sm text-muted-foreground">سيظهر الإعلان في أعلى القائمة</p>
                  </div>
                  <Switch
                    id="pinned"
                    checked={formData.isPinned}
                    onCheckedChange={(checked) => setFormData({ ...formData, isPinned: checked })}
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    إلغاء
                  </Button>
                  <Button type="submit">نشر الإعلان</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

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
        ) : announcements.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="p-4 bg-muted rounded-full mb-4">
                <Megaphone className="w-12 h-12 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">لا توجد إعلانات</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
                لم تقم بنشر أي إعلانات بعد. ابدأ بنشر إعلان جديد للطلاب.
              </p>
              <Button onClick={() => setDialogOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                إعلان جديد
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {announcements.map((announcement, index) => (
              <Card
                key={announcement.id}
                className={`animate-in fade-in slide-in-from-bottom duration-500 ${
                  announcement.isPinned ? "border-primary/50 bg-primary/5" : ""
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {announcement.isPinned && (
                          <Badge variant="default" className="gap-1">
                            <Pin className="w-3 h-3" />
                            مثبت
                          </Badge>
                        )}
                        {announcement.projectId ? (
                          <Badge variant="secondary">إعلان المشروع</Badge>
                        ) : (
                          <Badge variant="outline">إعلان عام</Badge>
                        )}
                      </div>
                      <CardTitle className="text-xl">{announcement.title}</CardTitle>
                      <CardDescription>{formatDate(announcement.createdAt)}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => togglePin(announcement.id, announcement.isPinned)}
                        title={announcement.isPinned ? "إلغاء التثبيت" : "تثبيت"}
                      >
                        <Pin className={`w-4 h-4 ${announcement.isPinned ? "fill-current" : ""}`} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(announcement.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{announcement.content}</p>
                  {announcement.projectTitle && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FolderKanban className="w-4 h-4" />
                      <span>{announcement.projectTitle}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
