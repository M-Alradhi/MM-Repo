"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Home, FolderKanban, Users, Star, Calendar, ArrowRight, Mail, Phone } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useEffect, useState } from "react"
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase/config"
import { useParams } from "next/navigation"
import Link from "next/link"

const sidebarItems = [
  { title: "لوحة التحكم", href: "/supervisor/dashboard", icon: <Home className="w-5 h-5" /> },
  { title: "المشاريع", href: "/supervisor/projects", icon: <FolderKanban className="w-5 h-5" /> },
  { title: "الطلاب", href: "/supervisor/students", icon: <Users className="w-5 h-5" /> },
  { title: "الاجتماعات", href: "/supervisor/meetings", icon: <Calendar className="w-5 h-5" /> },
]

export default function StudentDetails() {
  const params = useParams()
  const [student, setStudent] = useState<any>(null)
  const [project, setProject] = useState<any>(null)
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStudentData = async () => {
      try {
        // Fetch student
        const studentDoc = await getDoc(doc(db, "users", params.id as string))
        if (studentDoc.exists()) {
          const studentData = { id: studentDoc.id, ...studentDoc.data() }
          setStudent(studentData)

          // Fetch project
          if (studentData.projectId) {
            const projectDoc = await getDoc(doc(db, "projects", studentData.projectId))
            if (projectDoc.exists()) {
              setProject({ id: projectDoc.id, ...projectDoc.data() })
            }
          }

          // Fetch tasks
          const tasksQuery = query(collection(db, "tasks"), where("studentId", "==", params.id))
          const tasksSnapshot = await getDocs(tasksQuery)
          const tasksData = tasksSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
          setTasks(tasksData)
        }
      } catch (error) {
        console.error("Error fetching student:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchStudentData()
  }, [params.id])

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

  if (!student) {
    return (
      <DashboardLayout sidebarItems={sidebarItems} requiredRole="supervisor">
        <div className="p-8">
          <Card>
            <CardContent className="p-8">
              <p className="text-center text-muted-foreground">الطالب غير موجود</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  const completedTasks = tasks.filter((t) => t.status === "completed").length
  const totalTasks = tasks.length

  return (
    <DashboardLayout sidebarItems={sidebarItems} requiredRole="supervisor">
      <div className="p-8 space-y-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/supervisor/students" className="hover:text-foreground">
            الطلاب
          </Link>
          <ArrowRight className="w-4 h-4 rotate-180" />
          <span className="text-foreground">{student.name}</span>
        </div>

        <div>
          <h1 className="text-3xl font-bold">{student.name}</h1>
          <p className="text-muted-foreground mt-2">{student.department}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">معلومات الاتصال</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="truncate">{student.email}</span>
              </div>
              {student.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{student.phone}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">الرقم الجامعي</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{student.studentId}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">إنجاز المهام</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {completedTasks}/{totalTasks}
              </p>
              <p className="text-sm text-muted-foreground">مهمة مكتملة</p>
            </CardContent>
          </Card>
        </div>

        {project && (
          <Card>
            <CardHeader>
              <CardTitle>المشروع</CardTitle>
              <CardDescription>{project.title}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{project.description}</p>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">التقدم</span>
                  <span className="text-sm text-muted-foreground">{project.progress || 0}%</span>
                </div>
                <Progress value={project.progress || 0} />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={project.status === "active" ? "default" : "secondary"}>
                  {project.status === "active" ? "نشط" : project.status === "completed" ? "مكتمل" : "معلق"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>المهام</CardTitle>
            <CardDescription>قائمة مهام الطالب</CardDescription>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">لا توجد مهام</p>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div key={task.id} className="flex items-start justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium">{task.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
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
