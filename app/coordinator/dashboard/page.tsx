"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { FolderKanban, Users, UserPlus, TrendingUp, Award, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/lib/contexts/auth-context"
import { useLanguage } from "@/lib/contexts/language-context"
import { useEffect, useState } from "react"
import { getDocuments } from "@/lib/firebase/db"
import { where } from "firebase/firestore"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { coordinatorSidebarItems } from "@/lib/constants/coordinator-sidebar"

export default function CoordinatorDashboard() {
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
  const [recentProjects, setRecentProjects] = useState<any[]>([])
  const [topSupervisors, setTopSupervisors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      if (authLoading) return

      try {
        setLoading(true)
        setError(null)

        const [projectsData, supervisorsData, studentsData] = await Promise.all([
          getDocuments("projects"),
          getDocuments("users", [where("role", "==", "supervisor")]),
          getDocuments("users", [where("role", "==", "student")]),
        ])

        const activeProjects = projectsData.filter((project: any) => project.status === "active")
        const completedProjects = projectsData.filter((project: any) => project.status === "completed").length

        const totalProgress = activeProjects.reduce((sum: number, p: any) => sum + (p.progress || 0), 0)
        const averageProgress = activeProjects.length > 0 ? Math.round(totalProgress / activeProjects.length) : 0

        const projectsNeedingAttention = activeProjects.filter((p: any) => (p.progress || 0) < 50).length

        const supervisorProjectCounts = new Map()
        projectsData.forEach((project: any) => {
          if (project.supervisorId) {
            supervisorProjectCounts.set(
              project.supervisorId,
              (supervisorProjectCounts.get(project.supervisorId) || 0) + 1,
            )
          }
        })

        const supervisorsWithCounts = supervisorsData
          .map((sup: any) => ({
            ...sup,
            projectCount: supervisorProjectCounts.get(sup.uid) || 0,
          }))
          .sort((a, b) => b.projectCount - a.projectCount)
          .slice(0, 5)

        setStats({
          totalProjects: projectsData.length,
          activeProjects: activeProjects.length,
          completedProjects,
          totalSupervisors: supervisorsData.length,
          totalStudents: studentsData.length,
          averageProgress,
          projectsNeedingAttention,
        })

        setRecentProjects(projectsData.slice(0, 5))
        setTopSupervisors(supervisorsWithCounts)
      } catch (error) {
        console.error("Error fetching data:", error)
        setError(t("errorLoadingDataMsg"))
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [authLoading])

  return (
    <DashboardLayout sidebarItems={coordinatorSidebarItems} requiredRole="coordinator">
      <div className="p-8 space-y-8 animate-in fade-in duration-500">
        <div className="animate-in slide-in-from-top duration-700">
          <h1 className="text-4xl font-bold bg-gradient-to-l from-primary to-primary/60 bg-clip-text text-transparent">
            {t("welcome")}، {userData?.name}
          </h1>
          <p className="text-muted-foreground mt-2">{t("overviewAllProjects")}</p>
        </div>

        {authLoading || loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-muted rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card className="border-destructive/50 animate-in fade-in duration-500">
            <CardContent className="p-8">
              <div className="text-center text-destructive">
                <h3 className="text-lg font-semibold">{t("errorOccurred")}</h3>
                <p className="text-sm mt-2">{error}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
              <Link href="/coordinator/projects">
                <Card className="group hover:shadow-xl transition-all duration-300 hover:scale-[1.02] animate-in fade-in slide-in-from-bottom duration-500 delay-100 cursor-pointer border-2 hover:border-primary/20">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t("totalProjectsCount")}</CardTitle>
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <FolderKanban className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{stats.totalProjects}</div>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/coordinator/projects">
                <Card className="group hover:shadow-xl transition-all duration-300 hover:scale-[1.02] animate-in fade-in slide-in-from-bottom duration-500 delay-200 cursor-pointer border-2 hover:border-primary/20">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t("activeProjectsCount")}</CardTitle>
                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <FolderKanban className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.activeProjects}</div>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/coordinator/projects">
                <Card className="group hover:shadow-xl transition-all duration-300 hover:scale-[1.02] animate-in fade-in slide-in-from-bottom duration-500 delay-300 cursor-pointer border-2 hover:border-primary/20">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t("completedProjectsCount")}</CardTitle>
                    <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <CheckCircle2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                      {stats.completedProjects}
                    </div>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/coordinator/supervisors">
                <Card className="group hover:shadow-xl transition-all duration-300 hover:scale-[1.02] animate-in fade-in slide-in-from-bottom duration-500 delay-[400ms] cursor-pointer border-2 hover:border-primary/20">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t("supervisorsCount")}</CardTitle>
                    <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Users className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                      {stats.totalSupervisors}
                    </div>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/coordinator/students">
                <Card className="group hover:shadow-xl transition-all duration-300 hover:scale-[1.02] animate-in fade-in slide-in-from-bottom duration-500 delay-500 cursor-pointer border-2 hover:border-primary/20">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t("studentsCount")}</CardTitle>
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <UserPlus className="h-5 w-5 text-primary" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-primary">{stats.totalStudents}</div>
                  </CardContent>
                </Card>
              </Link>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card className="border-2 bg-gradient-to-br from-blue-50/50 to-background dark:from-blue-950/10 animate-in fade-in slide-in-from-bottom duration-500 delay-600">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    {t("averageOverallProgress")}
                  </CardTitle>
                  <CardDescription>{t("averageProgressDescription")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-bold text-blue-600">{stats.averageProgress}</span>
                      <span className="text-2xl text-muted-foreground">%</span>
                    </div>
                    <Progress value={stats.averageProgress} className="h-3" />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{stats.activeProjects} {t("activeProjectsLabel")}</span>
                      {stats.projectsNeedingAttention > 0 && (
                        <Badge variant="secondary" className="gap-1">
                          <Award className="w-3 h-3" />
                          {stats.projectsNeedingAttention} {t("needsFollowUp")}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 bg-gradient-to-br from-green-50/50 to-background dark:from-green-950/10 animate-in fade-in slide-in-from-bottom duration-500 delay-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-green-600" />
                    {t("successRate")}
                  </CardTitle>
                  <CardDescription>{t("successRateDescription")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-bold text-green-600">
                        {stats.totalProjects > 0
                          ? Math.round((stats.completedProjects / stats.totalProjects) * 100)
                          : 0}
                      </span>
                      <span className="text-2xl text-muted-foreground">%</span>
                    </div>
                    <Progress
                      value={stats.totalProjects > 0 ? (stats.completedProjects / stats.totalProjects) * 100 : 0}
                      className="h-3"
                    />
                    <p className="text-sm text-muted-foreground">
                      {stats.completedProjects} {t("outOf")} {stats.totalProjects} {t("project")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card className="animate-in fade-in slide-in-from-right duration-700 delay-800 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FolderKanban className="w-5 h-5 text-primary" />
                    {t("recentProjectsLabel")}
                  </CardTitle>
                  <CardDescription>{t("recentProjectsDescription")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <p className="text-sm text-muted-foreground">{t("loadingText")}</p>
                  ) : recentProjects.length === 0 ? (
                    <div className="text-center py-8">
                      <FolderKanban className="w-12 h-12 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground">{t("noProjectsCurrently")}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {recentProjects.map((project, index) => (
                        <div
                          key={project.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors animate-in fade-in slide-in-from-left duration-500"
                          style={{ animationDelay: `${(index + 9) * 100}ms` }}
                        >
                          <div className="space-y-1 flex-1">
                            <p className="text-sm font-medium">{project.title}</p>
                            <div className="flex items-center gap-2">
                              <Progress value={project.progress || 0} className="w-24" />
                              <span className="text-xs text-muted-foreground">{project.progress || 0}%</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="animate-in fade-in slide-in-from-left duration-700 delay-800 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    {t("mostActiveSupervisors")}
                  </CardTitle>
                  <CardDescription>{t("byProjectsAssigned")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {topSupervisors.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground">{t("noSupervisorsCurrently")}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {topSupervisors.map((supervisor, index) => (
                        <div
                          key={supervisor.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors animate-in fade-in slide-in-from-right duration-500"
                          style={{ animationDelay: `${(index + 9) * 100}ms` }}
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <Badge variant="secondary" className="font-bold">
                              #{index + 1}
                            </Badge>
                            <div>
                              <p className="text-sm font-medium">{supervisor.name}</p>
                              <p className="text-xs text-muted-foreground">{supervisor.department}</p>
                            </div>
                          </div>
                          <Badge variant="default" className="gap-1">
                            <FolderKanban className="w-3 h-3" />
                            {supervisor.projectCount} {t("projectWord")}
                          </Badge>
                        </div>
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
