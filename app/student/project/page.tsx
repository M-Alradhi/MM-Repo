"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import {
  FolderKanban,
  CheckSquare,
  Plus,
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Lightbulb,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/contexts/auth-context"
import { useLanguage } from "@/lib/contexts/language-context"
import { useEffect, useState } from "react"
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase/config"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"
import { studentSidebarItems } from "@/lib/constants/student-sidebar"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function StudentProject() {
  const { userData, loading: authLoading } = useAuth()
  const { t, language } = useLanguage()
  const [project, setProject] = useState<any>(null)
  const [supervisor, setSupervisor] = useState<any>(null)
  const [projectIdeas, setProjectIdeas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProject = async () => {
      if (authLoading) return

      try {
        if (userData?.uid) {
          const myIdeasQuery = query(collection(db, "projectIdeas"), where("studentId", "==", userData.uid))
          const myIdeasSnapshot = await getDocs(myIdeasQuery)
          const myIdeas = myIdeasSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))

          const allIdeasQuery = query(collection(db, "projectIdeas"), where("isTeamProject", "==", true))
          const allIdeasSnapshot = await getDocs(allIdeasQuery)

          const teamIdeas = allIdeasSnapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .filter((idea: any) => {
              const teamMembers = idea.teamMembers || []
              return teamMembers.some((member: any) => member.email === userData.email)
            })

          const allIdeas = [...myIdeas]
          teamIdeas.forEach((teamIdea) => {
            if (!allIdeas.find((idea) => idea.id === teamIdea.id)) {
              allIdeas.push(teamIdea)
            }
          })

          setProjectIdeas(allIdeas)
        }

        if (!userData?.projectId) {
          setLoading(false)
          return
        }

        const projectDoc = await getDoc(doc(db, "projects", userData.projectId))
        if (projectDoc.exists()) {
          const projectData = { id: projectDoc.id, ...projectDoc.data() }
          setProject(projectData)

          if (projectData.supervisorId) {
            const supervisorDoc = await getDoc(doc(db, "users", projectData.supervisorId))
            if (supervisorDoc.exists()) {
              setSupervisor(supervisorDoc.data())
            }
          }
        }
      } catch (error) {
        console.error("Error fetching project:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchProject()
  }, [userData, authLoading])

  const formatDate = (timestamp: any) => {
    if (!timestamp) return t("notSpecified")
    const date = new Date(timestamp.seconds * 1000)
    return date.toLocaleDateString(language === "ar" ? "ar-EG" : "en-US")
  }

  const getStatusText = (status: string) => {
    if (status === "approved") return t("approved")
    if (status === "rejected") return t("rejected")
    return t("underReview")
  }

  const getProjectStatusText = (status: string) => {
    if (status === "active") return t("active")
    if (status === "completed") return t("completed")
    return t("pending")
  }

  const canSubmitNewIdea = () => {
    if (projectIdeas.length === 0) return true

    const allRejected = projectIdeas.every((idea) => idea.status === "rejected")
    const hasActiveIdea = projectIdeas.some((idea) => idea.status === "pending" || idea.status === "approved")

    return allRejected && !hasActiveIdea && !project
  }

  if (authLoading || loading) {
    return (
      <DashboardLayout sidebarItems={studentSidebarItems} requiredRole="student">
        <div className="p-8">
          <Card>
            <CardContent className="p-8">
              <p className="text-center text-muted-foreground">{t("loading")}</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout sidebarItems={studentSidebarItems} requiredRole="student">
      <div className="p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t("myProject")}</h1>
            <p className="text-muted-foreground mt-2">{t("projectDetails")}</p>
          </div>
          {!project && canSubmitNewIdea() && (
            <div className="flex gap-2">
              <Link href="/student/project/browse-ideas">
                <Button variant="outline" className="rounded-lg bg-transparent">
                  <Lightbulb className="w-4 h-4 ml-2" />
                  {t("browseProjectIdeas")}
                </Button>
              </Link>
              <Link href="/student/project/submit">
                <Button>
                  <Plus className="w-4 h-4 ml-2" />
                  {t("submitProjectIdea")}
                </Button>
              </Link>
            </div>
          )}
        </div>

        {!project &&
          !canSubmitNewIdea() &&
          projectIdeas.some((idea) => idea.status === "pending" || idea.status === "approved") && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{t("cannotSubmitNewIdea")}</AlertDescription>
            </Alert>
          )}

        {projectIdeas.length > 0 && !project && (
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                {t("submittedProjectIdeas")}
              </CardTitle>
              <CardDescription>{t("projectIdeasStatus")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {projectIdeas.map((idea) => (
                <div key={idea.id} className="p-4 bg-background rounded-lg border">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{idea.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{idea.description}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {t("submissionDate")}: {formatDate(idea.submittedAt)}
                      </p>

                      {idea.status === "rejected" && idea.rejectionReason && (
                        <Alert variant="destructive" className="mt-3">
                          <XCircle className="h-4 w-4" />
                          <AlertDescription>
                            <p className="font-semibold text-sm mb-1">{t("rejectionReasonLabel")}</p>
                            <p className="text-sm">{idea.rejectionReason}</p>
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge
                        variant={
                          idea.status === "approved"
                            ? "default"
                            : idea.status === "rejected"
                              ? "destructive"
                              : "secondary"
                        }
                        className="flex items-center gap-1"
                      >
                        {idea.status === "approved" ? (
                          <>
                            <CheckCircle className="w-3 h-3" />
                            {getStatusText("approved")}
                          </>
                        ) : idea.status === "rejected" ? (
                          <>
                            <XCircle className="w-3 h-3" />
                            {getStatusText("rejected")}
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3" />
                            {getStatusText("pending")}
                          </>
                        )}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {!project ? (
          <Card>
            <CardContent className="p-8">
              <div className="text-center space-y-4">
                <FolderKanban className="w-16 h-16 mx-auto text-muted-foreground" />
                <div>
                  <h3 className="text-lg font-semibold">{t("noProjectAssigned")}</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    {projectIdeas.length > 0 ? t("projectSubmittedUnderReview") : t("submitOrWait")}
                  </p>
                  {canSubmitNewIdea() && (
                    <Link href="/student/project/submit">
                      <Button className="mt-4">
                        <Plus className="w-4 h-4 ml-2" />
                        {t("submitProjectIdea")}
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-2xl">{project.title}</CardTitle>
                    <CardDescription className="mt-2">{project.description}</CardDescription>
                  </div>
                  <Badge variant={project.status === "active" ? "default" : "secondary"}>
                    {getProjectStatusText(project.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{t("projectProgress")}</span>
                    <span className="text-sm text-muted-foreground">{project.progress || 0}%</span>
                  </div>
                  <Progress value={project.progress || 0} />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t("startDate")}</p>
                    <p className="text-sm mt-1">{formatDate(project.startDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t("expectedDeliveryDate")}</p>
                    <p className="text-sm mt-1">{formatDate(project.endDate)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-3">
              <Link href="/student/tasks">
                <Card className="hover:bg-accent transition-colors cursor-pointer hover:shadow-lg">
                  <CardContent className="p-6 flex items-center gap-4">
                    <CheckSquare className="w-8 h-8 text-primary" />
                    <div>
                      <p className="font-semibold">{t("tasks")}</p>
                      <p className="text-sm text-muted-foreground">{t("tasksAndAssignments")}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/student/discussions">
                <Card className="hover:bg-accent transition-colors cursor-pointer hover:shadow-lg">
                  <CardContent className="p-6 flex items-center gap-4">
                    <MessageSquare className="w-8 h-8 text-primary" />
                    <div>
                      <p className="font-semibold">{t("discussions")}</p>
                      <p className="text-sm text-muted-foreground">{t("discussionForum")}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>

              {/* Removed "الملفات" link */}
            </div>

            {supervisor && (
              <Card>
                <CardHeader>
                  <CardTitle>{t("supervisor")}</CardTitle>
                  <CardDescription>{t("supervisorInfo")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">{supervisor.name}</p>
                      <p className="text-sm text-muted-foreground">{supervisor.email}</p>
                      <p className="text-sm text-muted-foreground">{supervisor.department}</p>
                    </div>
                    <Link href="/student/messages">
                      <Button>{t("contactSupervisor")}</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>{t("projectObjectives")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {project.objectives?.map((objective: string, index: number) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span className="text-sm">{objective}</span>
                    </li>
                  )) || <p className="text-sm text-muted-foreground">{t("noObjectivesYet")}</p>}
                </ul>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
