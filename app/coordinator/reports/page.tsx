"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { coordinatorSidebarItems } from "@/lib/constants/coordinator-sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { useLanguage } from "@/lib/contexts/language-context"
import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase/config"
import { Download, Archive } from "lucide-react"
import { useRouter } from "next/navigation"

export default function CoordinatorReports() {
  const router = useRouter()
  const { t } = useLanguage()
  const [stats, setStats] = useState({
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    pendingProjects: 0,
    totalSupervisors: 0,
    totalStudents: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch projects
        const projectsSnapshot = await getDocs(collection(db, "projects"))
        const projects = projectsSnapshot.docs.map((doc) => doc.data())

        // Fetch supervisors
        const supervisorsQuery = query(collection(db, "users"), where("role", "==", "supervisor"))
        const supervisorsSnapshot = await getDocs(supervisorsQuery)

        // Fetch students
        const studentsQuery = query(collection(db, "users"), where("role", "==", "student"))
        const studentsSnapshot = await getDocs(studentsQuery)

        setStats({
          totalProjects: projects.length,
          activeProjects: projects.filter((p) => p.status === "active").length,
          completedProjects: projects.filter((p) => p.status === "completed").length,
          pendingProjects: projects.filter((p) => p.status === "pending").length,
          totalSupervisors: supervisorsSnapshot.size,
          totalStudents: studentsSnapshot.size,
        })
      } catch (error) {
        console.error("Error fetching stats:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  const generateReport = () => {
    const reportData = `
    ${t("graduationProjectsReportTitle")}
    ==========================

    ${t("generalStatistics")}:
    - ${t("totalProjects")}: ${stats.totalProjects}
    - ${t("activeProjects")}: ${stats.activeProjects}
    - ${t("completedProjects")}: ${stats.completedProjects}
    - ${t("pendingProjects")}: ${stats.pendingProjects}
    - ${t("supervisorsNumber")}: ${stats.totalSupervisors}
    - ${t("studentsNumber")}: ${stats.totalStudents}

    ${t("reportDate")}: ${new Date().toLocaleDateString(
      t("locale") 
    )}
`


    const blob = new Blob([reportData], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${t("graduationProjectsReport")}-${new Date().toISOString().split("T")[0]}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <DashboardLayout sidebarItems={coordinatorSidebarItems} requiredRole="coordinator">
      <div className="p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t("reports")}</h1>
            <p className="text-muted-foreground mt-2">{t("reportsDescription")}</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => router.push("/coordinator/archive")}>
              <Archive className="w-4 h-4 ml-2" />
              {t("archive")}
            </Button>
            <Button onClick={generateReport}>
              <Download className="w-4 h-4 ml-2" />
              {t("downloadReport")}
            </Button>
          </div>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-8">
              <p className="text-center text-muted-foreground"> {t("loading")}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("totalProjects")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.totalProjects}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("activeProjects")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-600">{stats.activeProjects}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("completedProjects")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-blue-600">{stats.completedProjects}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("pendingProjects")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-orange-600">{stats.pendingProjects}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("supervisorsNumber")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.totalSupervisors}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("studentsNumber")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.totalStudents}</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle> {t("reportDetails")}</CardTitle>
            <CardDescription>{t("reportDetailsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">{t("completionRate")}</p>
                <p className="text-sm text-muted-foreground">{t("completionRateDescription")}</p>
              </div>
              <p className="text-2xl font-bold">
                {stats.totalProjects > 0 ? Math.round((stats.completedProjects / stats.totalProjects) * 100) : 0}%
              </p>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">{t("projectsPerSupervisor")}</p>
                <p className="text-sm text-muted-foreground">{t("projectsPerSupervisorDescription")}</p>
              </div>
              <p className="text-2xl font-bold">
                {stats.totalSupervisors > 0 ? (stats.totalProjects / stats.totalSupervisors).toFixed(1) : 0}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
