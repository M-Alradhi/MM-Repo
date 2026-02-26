"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { supervisorSidebarItems } from "@/lib/constants/supervisor-sidebar"
import { FolderKanban } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/contexts/auth-context"
import { useEffect, useState } from "react"
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase/config"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"
import { calculateProjectProgress } from "@/lib/utils/grading"

export default function SupervisorProjects() {
  const { userData } = useAuth()
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProjects = async () => {
      if (!userData?.uid) return

      try {
        const projectsQuery = query(collection(db, "projects"), where("supervisorId", "==", userData.uid))
        const projectsSnapshot = await getDocs(projectsQuery)
        const projectsData = projectsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))

        const updatedProjects = await Promise.all(
          projectsData.map(async (project) => {
            try {
              // Fetch tasks for this project
              const tasksQuery = query(collection(db, "tasks"), where("projectId", "==", project.id))
              const tasksSnapshot = await getDocs(tasksQuery)
              const tasks = tasksSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))

              // Calculate progress
              const progress = calculateProjectProgress(tasks as any[])

              // Update project progress in database
              if (progress !== project.progress) {
                const projectRef = doc(db, "projects", project.id)
                await updateDoc(projectRef, { progress })
              }

              return { ...project, progress }
            } catch (error) {
              console.error(`Error calculating progress for project ${project.id}:`, error)
              return project
            }
          }),
        )

        setProjects(updatedProjects)
      } catch (error) {
        console.error("Error fetching projects:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchProjects()
  }, [userData])

  return (
    <DashboardLayout sidebarItems={supervisorSidebarItems} requiredRole="supervisor">
      <div className="p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">المشاريع</h1>
            <p className="text-muted-foreground mt-2">إدارة ومتابعة المشاريع</p>
          </div>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-8">
              <p className="text-center text-muted-foreground">جاري التحميل...</p>
            </CardContent>
          </Card>
        ) : projects.length === 0 ? (
          <Card>
            <CardContent className="p-8">
              <div className="text-center space-y-4">
                <FolderKanban className="w-16 h-16 mx-auto text-muted-foreground" />
                <div>
                  <h3 className="text-lg font-semibold">لا توجد مشاريع حالياً</h3>
                  <p className="text-sm text-muted-foreground mt-2">سيتم تعيين المشاريع من قبل المنسق الأكاديمي</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {projects.map((project) => (
              <Card key={project.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{project.title}</CardTitle>
                      <CardDescription className="mt-2">{project.description}</CardDescription>
                    </div>
                    <Badge variant={project.status === "active" ? "default" : "secondary"}>
                      {project.status === "active" ? "نشط" : project.status === "completed" ? "مكتمل" : "معلق"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">التقدم</span>
                      <span className="text-sm text-muted-foreground">{project.progress || 0}%</span>
                    </div>
                    <Progress value={project.progress || 0} />
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      تاريخ البدء:{" "}
                      {project.startDate
                        ? new Date(project.startDate.seconds * 1000).toLocaleDateString("ar-EG")
                        : "غير محدد"}
                    </div>
                    <Link href="/supervisor/tasks">
                      <Button size="sm">عرض التفاصيل</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
