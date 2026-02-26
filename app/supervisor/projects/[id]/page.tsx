"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Home, FolderKanban, Users, Calendar, ArrowRight, Plus } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useEffect, useState } from "react"
import { doc, getDoc, collection, query, where, getDocs, addDoc, Timestamp } from "firebase/firestore"
import { db } from "@/lib/firebase/config"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { createNotification } from "@/lib/firebase/notifications"

const sidebarItems = [
  { title: "لوحة التحكم", href: "/supervisor/dashboard", icon: <Home className="w-5 h-5" /> },
  { title: "المشاريع", href: "/supervisor/projects", icon: <FolderKanban className="w-5 h-5" /> },
  { title: "الطلاب", href: "/supervisor/students", icon: <Users className="w-5 h-5" /> },
  { title: "الاجتماعات", href: "/supervisor/meetings", icon: <Calendar className="w-5 h-5" /> },
]

export default function ProjectDetails() {
  const params = useParams()
  const router = useRouter()
  const [project, setProject] = useState<any>(null)
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium",
    dueDate: "",
  })

  const fetchProjectData = async () => {
    try {
      const projectDoc = await getDoc(doc(db, "projects", params.id as string))
      if (projectDoc.exists()) {
        setProject({ id: projectDoc.id, ...projectDoc.data() })

        // Fetch tasks
        const tasksQuery = query(collection(db, "tasks"), where("projectId", "==", params.id))
        const tasksSnapshot = await getDocs(tasksQuery)
        const tasksData = tasksSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        setTasks(tasksData)
      }
    } catch (error) {
      console.error("Error fetching project:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProjectData()
  }, [params.id])

  const handleAddTask = async () => {
    if (!newTask.title || !newTask.description) {
      toast.error("يرجى ملء جميع الحقول المطلوبة")
      return
    }

    setIsAddingTask(true)
    try {
      // Get all team members from the project
      const teamMembers = project.teamMembers || []

      if (teamMembers.length === 0) {
        toast.error("لا يوجد أعضاء في الفريق")
        setIsAddingTask(false)
        return
      }

      // Create task for each team member
      const taskPromises = teamMembers.map((studentId: string) =>
        addDoc(collection(db, "tasks"), {
          title: newTask.title,
          description: newTask.description,
          priority: newTask.priority,
          projectId: params.id,
          studentId: studentId,
          status: "pending",
          createdAt: Timestamp.now(),
          dueDate: newTask.dueDate ? Timestamp.fromDate(new Date(newTask.dueDate)) : null,
        }),
      )

      await Promise.all(taskPromises)

      // Send notification to all team members
      const notificationPromises = teamMembers.map((studentId: string) =>
        createNotification({
          userId: studentId,
          title: "مهمة جديدة",
          message: `تم إضافة مهمة جديدة: ${newTask.title}`,
          type: "task",
        }),
      )

      await Promise.all(notificationPromises)

      toast.success(`تم إضافة المهمة لجميع أعضاء الفريق (${teamMembers.length} طالب)`)
      setNewTask({ title: "", description: "", priority: "medium", dueDate: "" })
      fetchProjectData()
    } catch (error) {
      console.error("Error adding task:", error)
      toast.error("حدث خطأ أثناء إضافة المهمة")
    } finally {
      setIsAddingTask(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout sidebarItems={sidebarItems} requiredRole="supervisor">
        <div className="p-8">
          <Card>
            <CardContent className="p-8">
              <p className="text-center text-muted-foreground">جاري التحميل...</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  if (!project) {
    return (
      <DashboardLayout sidebarItems={sidebarItems} requiredRole="supervisor">
        <div className="p-8">
          <Card>
            <CardContent className="p-8">
              <p className="text-center text-muted-foreground">المشروع غير موجود</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout sidebarItems={sidebarItems} requiredRole="supervisor">
      <div className="p-8 space-y-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/supervisor/projects" className="hover:text-foreground">
            المشاريع
          </Link>
          <ArrowRight className="w-4 h-4 rotate-180" />
          <span className="text-foreground">{project.title}</span>
        </div>

        <div>
          <h1 className="text-3xl font-bold">{project.title}</h1>
          <p className="text-muted-foreground mt-2">{project.description}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">الحالة</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={project.status === "active" ? "default" : "secondary"}>
                {project.status === "active" ? "نشط" : project.status === "completed" ? "مكتمل" : "معلق"}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">التقدم</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Progress value={project.progress || 0} />
                <p className="text-2xl font-bold">{project.progress || 0}%</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">المهام</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{tasks.length}</p>
              <p className="text-sm text-muted-foreground">
                {tasks.filter((t) => t.status === "completed").length} مكتملة
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>المهام</CardTitle>
                <CardDescription>إدارة مهام المشروع</CardDescription>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 ml-2" />
                    إضافة مهمة
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>إضافة مهمة جديدة</DialogTitle>
                    <DialogDescription>أضف مهمة جديدة للطالب</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">عنوان المهمة</Label>
                      <Input
                        id="title"
                        value={newTask.title}
                        onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                        placeholder="مثال: إعداد الفصل الأول"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">الوصف</Label>
                      <Textarea
                        id="description"
                        value={newTask.description}
                        onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                        placeholder="وصف تفصيلي للمهمة..."
                        rows={4}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="priority">الأولوية</Label>
                      <Select
                        value={newTask.priority}
                        onValueChange={(value) => setNewTask({ ...newTask, priority: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">منخفضة</SelectItem>
                          <SelectItem value="medium">متوسطة</SelectItem>
                          <SelectItem value="high">عالية</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dueDate">تاريخ الاستحقاق</Label>
                      <Input
                        id="dueDate"
                        type="date"
                        value={newTask.dueDate}
                        onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                      />
                    </div>
                    <Button onClick={handleAddTask} disabled={isAddingTask} className="w-full">
                      {isAddingTask ? "جاري الإضافة..." : "إضافة المهمة"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">لا توجد مهام حالياً</p>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div key={task.id} className="flex items-start justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{task.title}</h4>
                        <Badge
                          variant={
                            task.priority === "high"
                              ? "destructive"
                              : task.priority === "medium"
                                ? "default"
                                : "secondary"
                          }
                        >
                          {task.priority === "high" ? "عالية" : task.priority === "medium" ? "متوسطة" : "منخفضة"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                      {task.dueDate && (
                        <p className="text-xs text-muted-foreground mt-2">
                          الموعد النهائي: {new Date(task.dueDate.seconds * 1000).toLocaleDateString("ar-EG")}
                        </p>
                      )}
                    </div>
                    <Badge variant={task.status === "completed" ? "secondary" : "outline"}>
                      {task.status === "completed" ? "مكتملة" : task.status === "in-progress" ? "قيد التنفيذ" : "معلقة"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
