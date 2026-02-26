"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { CheckSquare, Calendar, TrendingUp, Target, Users } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/contexts/auth-context"
import { useLanguage } from "@/lib/contexts/language-context"
import { useEffect, useState } from "react"
import { getFirebaseDb } from "@/lib/firebase/config"
import { collection, query, where, getDocs } from "firebase/firestore"
import Link from "next/link"
import { calculateProjectProgress } from "@/lib/utils/grading"
import { studentSidebarItems } from "@/lib/constants/student-sidebar"

export default function StudentDashboard() {
  const { userData, loading: authLoading } = useAuth()
  const { t } = useLanguage()
  const [stats, setStats] = useState({
    totalGrade: 0,
    totalTasks: 0,
    pendingTasks: 0,
    submittedTasks: 0,
    gradedTasks: 0,
    upcomingMeetings: 0,
    projectProgress: 0,
  })
  const [recentTasks, setRecentTasks] = useState<any[]>([])
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      if (authLoading || !userData?.uid) return

      try {
        setLoading(true)
        const db = getFirebaseDb()

        const tasksQuery = query(
          collection(db, "tasks"),
          where("studentId", "==", userData.uid),
        )
        const tasksSnapshot = await getDocs(tasksQuery)
        const tasks = tasksSnapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .sort((a: any, b: any) => {
            const aTime = a.createdAt?.seconds || 0
            const bTime = b.createdAt?.seconds || 0
            return bTime - aTime
          })

        const pendingTasks = tasks.filter((t: any) => t.status === "pending")
        const submittedTasks = tasks.filter((t: any) => t.status === "submitted")
        const gradedTasks = tasks.filter((t: any) => t.status === "graded")

        const totalGrade = gradedTasks.reduce((sum: number, t: any) => {
          const taskPercentage = ((t.grade || 0) / t.maxGrade) * 100
          return sum + taskPercentage * (t.weight / 100)
        }, 0)

        const projectProgress = calculateProjectProgress(tasks as any[])

        const meetingsQuery = query(
          collection(db, "meetings"),
          where("studentId", "==", userData.uid),
          where("status", "==", "scheduled"),
        )
        const meetingsSnapshot = await getDocs(meetingsQuery)

        setStats({
          totalGrade: Math.round(totalGrade),
          totalTasks: tasks.length,
          pendingTasks: pendingTasks.length,
          submittedTasks: submittedTasks.length,
          gradedTasks: gradedTasks.length,
          upcomingMeetings: meetingsSnapshot.size,
          projectProgress,
        })

        setRecentTasks(tasks.slice(0, 5))


        const ideasQuery = query(collection(db, "projectIdeas"), where("isTeamProject", "==", true))
        const ideasSnapshot = await getDocs(ideasQuery)

        let invitesCount = 0
        ideasSnapshot.docs.forEach((doc) => {
          const data = doc.data()
          const teamMembers = data.teamMembers || []
          const myInvite = teamMembers.find(
            (member: any) => member.email === userData.email && member.approved === false,
          )
          if (myInvite) invitesCount++
        })

        setPendingInvitesCount(invitesCount)
      } catch (error) {
        console.error("Error fetching data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [userData, authLoading])

  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
      case "submitted":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
      case "graded":
        return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
      default:
        return "bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400"
    }
  }

  const getTaskStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return t("taskPending")
      case "submitted":
        return t("taskSubmitted")
      case "graded":
        return t("taskGraded")
      default:
        return status
    }
  }

  const getGradeColor = (grade: number, maxGrade: number) => {
    const percentage = (grade / maxGrade) * 100
    if (percentage >= 85) {
      return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-500"
    } else if (percentage >= 70) {
      return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-500"
    } else if (percentage >= 50) {
      return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-500"
    } else {
      return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-500"
    }
  }

  return (
    <DashboardLayout sidebarItems={studentSidebarItems} requiredRole="student">
      <div className="p-8 space-y-8 animate-in fade-in duration-500">
        <div className="relative animate-in slide-in-from-top duration-700">
          <h1 className="text-4xl font-bold bg-gradient-to-l from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
            {t("welcome")}, {userData?.name}
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">{t("overviewText")}</p>
        </div>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
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
            {pendingInvitesCount > 0 && (
              <Link href="/student/project/team-approval">
                <Card className="border-2 border-amber-500 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20 hover:shadow-lg transition-all cursor-pointer animate-in fade-in slide-in-from-top duration-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500 text-white rounded-lg">
                        <Users className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg text-amber-900 dark:text-amber-100">
                          {pendingInvitesCount} {pendingInvitesCount === 1 ? t("pendingInvite") : t("pendingInvites")}
                        </CardTitle>
                        <CardDescription className="text-amber-700 dark:text-amber-300">
                          {t("teamApprovalPending")}
                        </CardDescription>
                      </div>
                      <Badge variant="secondary" className="bg-amber-500 text-white">
                        {t("new")}
                      </Badge>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            )}

            <Card className="border-2 bg-gradient-to-br from-primary/10 via-primary/5 to-background animate-in fade-in slide-in-from-bottom duration-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <div className="p-2 bg-primary/20 rounded-lg">
                    <Target className="w-6 h-6 text-primary" />
                  </div>
                  {t("totalGrade")} {t("total")} 100
                </CardTitle>
                <CardDescription>{t("noGradesYet")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-6xl font-bold text-primary">{stats.totalGrade}</span>
                      <span className="text-3xl text-muted-foreground">/100</span>
                    </div>
                    <Progress value={stats.totalGrade} className="h-3" />
                    <p className="text-sm text-muted-foreground">
                      {stats.gradedTasks} {t("total")} {stats.totalTasks} {t("taskGraded")}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 mr-8">
                    <div className="text-center p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
                      <div className="text-2xl font-bold text-amber-600">{stats.pendingTasks}</div>
                      <div className="text-xs text-muted-foreground">{t("taskPending")}</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
                      <div className="text-2xl font-bold text-blue-600">{stats.submittedTasks}</div>
                      <div className="text-xs text-muted-foreground">{t("taskSubmitted")}</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
                      <div className="text-2xl font-bold text-green-600">{stats.gradedTasks}</div>
                      <div className="text-xs text-muted-foreground">{t("taskGraded")}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-3">
              <Link href="/student/tasks">
                <Card className="group hover:shadow-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer border-2 hover:border-primary/30 animate-in fade-in slide-in-from-bottom duration-500 delay-100">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t("totalTasks")}</CardTitle>
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <CheckSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{stats.totalTasks}</div>
                    <p className="text-xs text-muted-foreground mt-1">{t("tasks")}</p>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/student/meetings">
                <Card className="group hover:shadow-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer border-2 hover:border-primary/30 animate-in fade-in slide-in-from-bottom duration-500 delay-200">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t("upcomingMeetings")}</CardTitle>
                    <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                      {stats.upcomingMeetings}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{t("scheduled")}</p>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/student/project">
                <Card className="group hover:shadow-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer border-2 hover:border-primary/30 animate-in fade-in slide-in-from-bottom duration-500 delay-300">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t("projectProgress")}</CardTitle>
                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                      {stats.projectProgress}%
                    </div>
                    <Progress value={stats.projectProgress} className="mt-2 h-2" />
                    <p className="text-xs text-muted-foreground mt-2">{t("completionRate")}</p>
                  </CardContent>
                </Card>
              </Link>
            </div>

            <Card className="animate-in fade-in slide-in-from-right duration-700 delay-400 hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-primary" />
                  {t("recentTasks")}
                </CardTitle>
                <CardDescription>{t("latestUpdates")}</CardDescription>
              </CardHeader>
              <CardContent>
                {recentTasks.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckSquare className="w-16 h-16 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">{t("noTasksYet")}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t("startByAddingProject")}</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-6">
                    {recentTasks.map((task, index) => (
                      <Link key={task.id} href="/student/tasks">
                        <div
                          className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer animate-in fade-in slide-in-from-left duration-500"
                          style={{ animationDelay: `${(index + 5) * 100}ms` }}

                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div
                              className={`w-2 h-12 rounded-full ${task.status === "pending" ? "bg-amber-500" : task.status === "submitted" ? "bg-blue-500" : "bg-green-500"}`}
                            ></div>
                            <div className="space-y-1 flex-1">
                              <p className="text-sm font-semibold">{task.title}</p>
                              <p className="text-xs text-muted-foreground line-clamp-1">{task.description}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>
                                  {t("grade")}: {task.maxGrade}
                                </span>
                                <span>•</span>
                                <span>
                                  {t("weight")}: {task.weight}%
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {task.status === "graded" && (
                              <div
                                className={`text-center px-3 py-1 rounded-lg ${getGradeColor(task.grade, task.maxGrade)}`}

                              >
                                <div className="text-xl font-bold">{task.grade}</div>
                                <div className="text-xs text-muted-foreground">/{task.maxGrade}</div>
                              </div>
                            )}
                            <Badge
                              className={getTaskStatusColor(task.status)}
                              variant={task.status === "graded" ? "default" : "secondary"}
                            >
                              {getTaskStatusText(task.status)}
                            </Badge>
                          </div>
                        </div>
                      </Link>
                    ))}
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