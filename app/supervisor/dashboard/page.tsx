"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { supervisorSidebarItems } from "@/lib/constants/supervisor-sidebar"
import { FolderKanban, Users, Calendar, Award, CheckCircle2, Clock, Upload } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/lib/contexts/auth-context"
import { useLanguage } from "@/lib/contexts/language-context"
import { useEffect, useState } from "react"
import { getFirebaseDb } from "@/lib/firebase/config"
import { collection, query, where, getDocs } from "firebase/firestore"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export default function SupervisorDashboard() {
  const { userData, loading: authLoading } = useAuth()
  const { t } = useLanguage()
  const [stats, setStats] = useState({
    totalProjects: 0,
    activeProjects: 0,
    totalStudents: 0,
    upcomingMeetings: 0,
    totalTasks: 0,
    pendingTasks: 0,
    submittedTasks: 0,
    gradedTasks: 0,
  })
  const [projects, setProjects] = useState<any[]>([])
  const [recentStudents, setRecentStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      if (authLoading || !userData?.uid) return

      try {
        setLoading(true)
        const db = getFirebaseDb()

        const [projectsData, studentsData, meetingsData, tasksData] = await Promise.all([
          getDocs(query(collection(db, "projects"), where("supervisorId", "==", userData.uid))),
          getDocs(query(collection(db, "users"), where("supervisorId", "==", userData.uid))),
          getDocs(
            query(
              collection(db, "meetings"),
              where("supervisorId", "==", userData.uid),
              where("status", "==", "scheduled"),
            ),
          ),
          getDocs(query(collection(db, "tasks"), where("supervisorId", "==", userData.uid))),
        ])

        const projects = projectsData.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        const tasks = tasksData.docs.map((doc) => ({ id: doc.id, ...doc.data() }))

        setStats({
          totalProjects: projects.length,
          activeProjects: projects.filter((p: any) => p.status === "active").length,
          totalStudents: studentsData.size,
          upcomingMeetings: meetingsData.size,
          totalTasks: tasks.length,
          pendingTasks: tasks.filter((t: any) => t.status === "pending").length,
          submittedTasks: tasks.filter((t: any) => t.status === "submitted").length,
          gradedTasks: tasks.filter((t: any) => t.status === "graded").length,
        })

        setProjects(projects.slice(0, 4))
        setRecentStudents(studentsData.docs.map((doc) => ({ id: doc.id, ...doc.data() })).slice(0, 5))
      } catch (error) {
        console.error("Error fetching data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [userData, authLoading])

  return (
    <DashboardLayout sidebarItems={supervisorSidebarItems} requiredRole="supervisor">
      <div className="p-8 space-y-8 animate-in fade-in duration-500">
        <div className="animate-in slide-in-from-top duration-700">
          <h1 className="text-4xl font-bold bg-gradient-to-l from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
            {t("welcome")}, {userData?.name}
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">{t("supervisorOverview")}</p>
        </div>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-muted rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Link href="/supervisor/projects">
                <Card className="group hover:shadow-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer border-2 hover:border-primary/30 animate-in fade-in slide-in-from-bottom duration-500 delay-100">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t("projects")}</CardTitle>
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <FolderKanban className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{stats.totalProjects}</div>
                    <p className="text-xs text-muted-foreground mt-1">{t("total")}</p>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/supervisor/students">
                <Card className="group hover:shadow-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer border-2 hover:border-primary/30 animate-in fade-in slide-in-from-bottom duration-500 delay-200">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t("students")}</CardTitle>
                    <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">{stats.totalStudents}</div>
                    <p className="text-xs text-muted-foreground mt-1">{t("total")}</p>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/supervisor/meetings">
                <Card className="group hover:shadow-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer border-2 hover:border-primary/30 animate-in fade-in slide-in-from-bottom duration-500 delay-300">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t("upcomingMeetings")}</CardTitle>
                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Calendar className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                      {stats.upcomingMeetings}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{t("scheduled")}</p>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/supervisor/tasks">
                <Card className="group hover:shadow-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer border-2 hover:border-primary/30 bg-gradient-to-br from-primary/10 to-background animate-in fade-in slide-in-from-bottom duration-500 delay-[400ms]">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t("totalTasks")}</CardTitle>
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Award className="h-5 w-5 text-primary" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-primary">{stats.totalTasks}</div>
                    <p className="text-xs text-muted-foreground mt-1">{t("tasks")}</p>
                  </CardContent>
                </Card>
              </Link>
            </div>

            <Card className="border-2 bg-gradient-to-br from-amber-50/50 via-blue-50/50 to-green-50/50 dark:from-amber-950/10 dark:via-blue-950/10 dark:to-green-950/10 animate-in fade-in slide-in-from-bottom duration-500 delay-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" />
                  {t("taskStatus")}
                </CardTitle>
                <CardDescription>{t("tasksAndAssignments")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-amber-100 dark:bg-amber-950/30 rounded-lg border-2 border-amber-200 dark:border-amber-900">
                    <Clock className="w-8 h-8 mx-auto text-amber-600 mb-2" />
                    <div className="text-3xl font-bold text-amber-600">{stats.pendingTasks}</div>
                    <div className="text-sm text-muted-foreground mt-1">{t("pending")}</div>
                  </div>
                  <div className="text-center p-4 bg-blue-100 dark:bg-blue-950/30 rounded-lg border-2 border-blue-200 dark:border-blue-900">
                    <Upload className="w-8 h-8 mx-auto text-blue-600 mb-2" />
                    <div className="text-3xl font-bold text-blue-600">{stats.submittedTasks}</div>
                    <div className="text-sm text-muted-foreground mt-1">{t("taskSubmitted")}</div>
                  </div>
                  <div className="text-center p-4 bg-green-100 dark:bg-green-950/30 rounded-lg border-2 border-green-200 dark:border-green-900">
                    <CheckCircle2 className="w-8 h-8 mx-auto text-green-600 mb-2" />
                    <div className="text-3xl font-bold text-green-600">{stats.gradedTasks}</div>
                    <div className="text-sm text-muted-foreground mt-1">{t("taskGraded")}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card className="animate-in fade-in slide-in-from-right duration-700 delay-600 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FolderKanban className="w-5 h-5 text-primary" />
                    {t("activeProjects")}
                  </CardTitle>
                  <CardDescription>{t("inProgress")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {projects.length === 0 ? (
                    <div className="text-center py-8">
                      <FolderKanban className="w-12 h-12 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground">{t("noContent")}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-6">
                      {projects.map((project, index) => (
                        <Link key={project.id} href={`/supervisor/projects/${project.id}`}>
                          <div
                            className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer animate-in fade-in slide-in-from-left duration-500"
                            style={{ animationDelay: `${(index + 7) * 100}ms` }}
                          >
                            <div className="flex-1 space-y-2">
                              <p className="text-sm font-semibold line-clamp-1">{project.title}</p>
                              <div className="flex items-center gap-2">
                                <Progress value={project.progress || 0} className="flex-1 h-2" />
                                <span className="text-xs text-muted-foreground min-w-[40px]">
                                  {project.progress || 0}%
                                </span>
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="animate-in fade-in slide-in-from-left duration-700 delay-600 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    {t("students")}
                  </CardTitle>
                  <CardDescription>{t("totalStudents")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {recentStudents.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground">{t("noStudentsYet")}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-6">
                      {recentStudents.map((student, index) => (
                        <Link key={student.id} href={`/supervisor/students/${student.id}`}>
                          <div
                            className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer animate-in fade-in slide-in-from-right duration-500"
                            style={{ animationDelay: `${(index + 7) * 100}ms` }}
                          >
                            <Avatar className="w-10 h-10 border-2">
                              <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                {student.name?.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <p className="text-sm font-semibold">{student.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {student.studentId}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
