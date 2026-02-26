"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { studentSidebarItems } from "@/lib/constants/student-sidebar"
import { Lightbulb, Eye, Check } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useEffect, useMemo, useState } from "react"
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  where,
  Timestamp,
  deleteField,
} from "firebase/firestore"
import { db } from "@/lib/firebase/config"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useAuth } from "@/lib/contexts/auth-context"
import { useLanguage } from "@/lib/contexts/language-context"
import { getDepartments, getDepartmentName, type Department } from "@/lib/utils/department-helper"

type Idea = {
  id: string
  title: string
  description: string
  objectives?: string[]
  technologies?: string[]
  projectType?: "one-course" | "two-courses"
  department?: string
  supervisorName?: string
  supervisorEmail?: string
  submittedAt?: Timestamp
  status?: "available" | "taken" | string
  selectedBy?: Array<{
    studentId: string
    studentName: string
    studentEmail: string
    selectedAt: string
  }>
  selectedById?: string
}

export default function BrowseProjectIdeas() {
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

  const [availableIdeas, setAvailableIdeas] = useState<Idea[]>([])
  const [mySelectedIdea, setMySelectedIdea] = useState<Idea | null>(null)

  const [loading, setLoading] = useState(true)
  const [myIdeaLoading, setMyIdeaLoading] = useState(true)

  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isSelecting, setIsSelecting] = useState(false)

  const [departments, setDepartments] = useState<Department[]>([])

  const fetchDepartments = async () => {
    const depts = await getDepartments()
    setDepartments(depts)
  }

  const fetchAvailableIdeas = async () => {
    try {
      setLoading(true)
      const ideasQuery = query(collection(db, "projectIdeas"), where("status", "==", "available"))
      const ideasSnapshot = await getDocs(ideasQuery)
      const ideasData = ideasSnapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Idea[]
      setAvailableIdeas(ideasData)
    } catch (error) {
      console.error("Error fetching available ideas:", error)
      toast.error(t("errorLoadingIdeas"))
    } finally {
      setLoading(false)
    }
  }

  const fetchMySelectedIdea = async () => {
    if (!userData?.uid) return

    try {
      setMyIdeaLoading(true)

      const userRef = doc(db, "users", userData.uid)
      const userSnap = await getDoc(userRef)

      if (!userSnap.exists()) {
        setMySelectedIdea(null)
        return
      }

      const user = userSnap.data() as any
      const selectedIdeaId = user.selectedIdeaId

      if (!selectedIdeaId) {
        setMySelectedIdea(null)
        return
      }

      const ideaRef = doc(db, "projectIdeas", selectedIdeaId)
      const ideaSnap = await getDoc(ideaRef)

      if (!ideaSnap.exists()) {
        await runTransaction(db, async (tx) => {
          tx.update(userRef, {
            selectedIdeaId: deleteField(),
            selectedIdeaTitle: deleteField(),
            selectedIdeaAt: deleteField(),
          })
        })
        setMySelectedIdea(null)
        return
      }

      const ideaData = ideaSnap.data() as any
      const selectedById = ideaData.selectedById
      const selectedByArr = Array.isArray(ideaData.selectedBy) ? ideaData.selectedBy : []
      const selectedByMe =
        selectedById === userData.uid || selectedByArr.some((s: any) => s?.studentId === userData.uid)

      if (!selectedByMe) {
        await runTransaction(db, async (tx) => {
          tx.update(userRef, {
            selectedIdeaId: deleteField(),
            selectedIdeaTitle: deleteField(),
            selectedIdeaAt: deleteField(),
          })
        })
        setMySelectedIdea(null)
        return
      }

      setMySelectedIdea({ id: ideaSnap.id, ...(ideaData as any) })
    } catch (e) {
      console.error("fetchMySelectedIdea error:", e)
      setMySelectedIdea(null)
    } finally {
      setMyIdeaLoading(false)
    }
  }

  useEffect(() => {
    fetchDepartments()
  }, [])

  useEffect(() => {
    if (!userData?.uid) return
    fetchAvailableIdeas()
    fetchMySelectedIdea()
  }, [userData?.uid])

  const handleViewIdea = async (idea: Idea) => {
    try {
      const ideaRef = doc(db, "projectIdeas", idea.id)
      const snap = await getDoc(ideaRef)
      if (!snap.exists()) {
        toast.error(t("notFoundIdea"))
        return
      }
      setSelectedIdea({ id: snap.id, ...(snap.data() as any) })
      setIsViewDialogOpen(true)
    } catch (e) {
      console.error(e)
      toast.error(t("errorLoadingIdeasInfo"))
    }
  }

  const checkIfIdeaSelected = (idea: Idea | null) => {
    if (!idea || !userData) return { selected: false, byMe: false, message: "" }
    if (idea.status === "available") return { selected: false, byMe: false, message: "" }

    const selectedBy = idea.selectedBy || []
    const mySelection = selectedBy.find((sel) => sel.studentId === userData.uid)
    const hasOtherSelection = selectedBy.length > 0 && !mySelection

    if (mySelection) return { selected: true, byMe: true, message: t("ideaSelectedByMe") }
    if (hasOtherSelection) return { selected: true, byMe: false, message: t("ideaTakenByOtherStudent") }
    return { selected: false, byMe: false, message: "" }
  }

  const canPickAnotherIdea = !mySelectedIdea

  const handleSelectIdea = async () => {
    if (!selectedIdea || !userData?.uid) return

    if (!canPickAnotherIdea) {
      toast.error(t("youCannotPickAnotherIdea"))
      return
    }

    try {
      setIsSelecting(true)

      await runTransaction(db, async (tx) => {
        const userRef = doc(db, "users", userData.uid)
        const ideaRef = doc(db, "projectIdeas", selectedIdea.id)

        const userSnap = await tx.get(userRef)
        if (!userSnap.exists()) throw new Error("USER_NOT_FOUND")

        const user = userSnap.data() as any
        if (user.selectedIdeaId) throw new Error("ALREADY_HAVE_IDEA")

        const ideaSnap = await tx.get(ideaRef)
        if (!ideaSnap.exists()) throw new Error("IDEA_NOT_FOUND")

        const idea = ideaSnap.data() as any
        if (idea.status !== "available") throw new Error("NOT_AVAILABLE")

        tx.update(ideaRef, {
          status: "taken",
          selectedBy: [
            {
              studentId: userData.uid,
              studentName: userData.name || "",
              studentEmail: userData.email || "",
              selectedAt: new Date().toISOString(),
            },
          ],
          selectedById: userData.uid,
          selectedByName: userData.name || "",
          selectedByEmail: userData.email || "",
          takenAt: Timestamp.now(),
        })

        tx.update(userRef, {
          selectedIdeaId: selectedIdea.id,
          selectedIdeaTitle: selectedIdea.title || "",
          selectedIdeaAt: Timestamp.now(),
        })
      })

      toast.success(t("ideaSelectedSuccessfully"))
      setIsViewDialogOpen(false)
      setSelectedIdea(null)

      await Promise.all([fetchAvailableIdeas(), fetchMySelectedIdea()])
    } catch (err: any) {
      console.error("Error selecting idea:", err)
      const msg = String(err?.message || "")

      if (msg.includes("NOT_AVAILABLE")) {
        toast.error(t("ideaTakenByOtherStudent"))
      } else if (msg.includes("ALREADY_HAVE_IDEA")) {
        toast.error(t("youCannotPickAnotherIdea"))
      } else if (msg.includes("IDEA_NOT_FOUND")) {
        toast.error(t("ideaNotFound"))
      } else if (msg.includes("USER_NOT_FOUND")) {
        toast.error(t("userNotFoundInDatabase"))
      } else {
        toast.error(t("errorSelectingIdea"))
      }

      await Promise.all([fetchAvailableIdeas(), fetchMySelectedIdea()])
    } finally {
      setIsSelecting(false)
    }
  }

  const IdeaCard = ({ idea }: { idea: Idea }) => {
    const ideaStatus = checkIfIdeaSelected(idea)

    return (
      <Card className="rounded-xl hover:shadow-lg transition-all duration-300">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-500" />
                {idea.title}
              </CardTitle>
              <CardDescription className="mt-2 line-clamp-2">{idea.description}</CardDescription>
            </div>

            <Badge
              variant={ideaStatus.selected ? (ideaStatus.byMe ? "default" : "secondary") : "outline"}
              className="rounded-lg"
            >
              {ideaStatus.selected ? (ideaStatus.byMe ? t("selected") : t("takenByOtherStudent")) : t("available") }
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("supervisor")}:</span>
              <span className="font-medium">{idea.supervisorName || t("notSpecified")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">القسم:</span>
              <span className="font-medium">{getDepartmentName(idea.department, departments)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("projectOption")}:</span>
              <span className="font-medium">{idea.projectType === "one-course" ? t("oneCourse") : t("twoCourses")}</span>
            </div>
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" size="sm" className="flex-1 bg-transparent rounded-lg" onClick={() => handleViewIdea(idea)}>
              <Eye className="w-4 h-4 ml-2" />
              {t("viewDetails")}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const myIdeaBadgeText = useMemo(() => {
    if (myIdeaLoading) return "..."
    if (!mySelectedIdea) return t("noIdeaSelected")
    return t("selected")
  }, [myIdeaLoading, mySelectedIdea])

  return (
    <DashboardLayout sidebarItems={studentSidebarItems} requiredRole="student">
      <div className="p-8 space-y-8 animate-in fade-in duration-500">
        <div className="animate-in slide-in-from-top duration-700">
          <h1 className="text-4xl font-bold bg-gradient-to-l from-primary to-primary/60 bg-clip-text text-transparent">
            {t("projectIdeas")}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t("browseAndSelectProjectIdeasDescription")}
          </p>
        </div>

        <Card className="rounded-xl border-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg"> {t("mySelectedIdea")}</CardTitle>
              <CardDescription>{t("mySelectedIdeaDescription")}</CardDescription>
            </div>
            <Badge className="rounded-lg" variant={mySelectedIdea ? "default" : "outline"}>
              {myIdeaBadgeText}
            </Badge>
          </CardHeader>
          <CardContent>
            {myIdeaLoading ? (
              <p className="text-sm text-muted-foreground">{t("loading")}</p>
            ) : !mySelectedIdea ? (
              <p className="text-sm text-muted-foreground">{t("noIdeaSelected")}</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{mySelectedIdea.title}</p>
                  <Badge className="rounded-lg" variant="secondary">
                    {t("selected")}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{mySelectedIdea.description}</p>

                <div className="grid md:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">المشرف:</span>
                    <span className="font-medium">{mySelectedIdea.supervisorName || t("notSpecified")}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">القسم:</span>
                    <span className="font-medium">{getDepartmentName(mySelectedIdea.department, departments)}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
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
            <div className="grid gap-6 md:grid-cols-1 max-w-md">
              <Card className="border-2 border-blue-200 dark:border-blue-900 bg-gradient-to-br from-blue-50/50 to-background dark:from-blue-950/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    {t("availableIdeas")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">{availableIdeas.length}</div>
                  <p className="text-sm text-muted-foreground mt-1">{t("availableIdeasDescription")}</p>
                  {!canPickAnotherIdea && (
                    <p className="text-xs text-destructive mt-2">
                      {t("youCannotPickAnotherIdea")}     
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {availableIdeas.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Lightbulb className="w-16 h-16 text-muted-foreground/50 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">{t("noAvailableIdeasCurrently")}</h3>
                  <p className="text-sm text-muted-foreground">{t("noAvailableIdeasDescription")}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {availableIdeas.map((idea, index) => (
                  <div
                    key={idea.id}
                    className="animate-in fade-in slide-in-from-bottom duration-500"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <IdeaCard idea={idea} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl rounded-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <Lightbulb className="w-6 h-6 text-amber-500" />
              {selectedIdea?.title}
            </DialogTitle>
            <DialogDescription>{t("ideaDetails")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div>
              <h4 className="font-semibold mb-2 text-lg">{t("description")}</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{selectedIdea?.description}</p>
            </div>

            {selectedIdea?.objectives && selectedIdea.objectives.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 text-lg">{t("objectives")}</h4>
                <ul className="space-y-2">
                  {selectedIdea.objectives.map((objective: string, index: number) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span className="text-sm text-muted-foreground">{objective}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selectedIdea?.technologies && selectedIdea.technologies.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 text-lg">{t("technologiesUsed")}</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedIdea.technologies.map((tech: string, index: number) => (
                    <Badge key={index} variant="secondary" className="rounded-lg">
                      {tech}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">{t("supervisor")}</p>
                <p className="font-semibold">{selectedIdea?.supervisorName || t("notSpecified")}</p>
                <p className="text-xs text-muted-foreground mt-1">{selectedIdea?.supervisorEmail}</p>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">{t("department")}</p>
                <p className="font-semibold">{getDepartmentName(selectedIdea?.department, departments)}</p>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">{t("projectOption")}</p>
                <p className="font-semibold">{selectedIdea?.projectType === "one-course" ? t("oneCourse") : t("twoCourses")}</p>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">{t("submissionDate")}</p>
                <p className="font-semibold">
                  {selectedIdea?.submittedAt
                    ? new Date(selectedIdea.submittedAt.seconds * 1000).toLocaleDateString("ar-EG")
                    : t("notSpecified")}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)} className="rounded-lg">
              {t("cancel")}
            </Button>

            {(() => {
              const disabled = isSelecting || !!mySelectedIdea || !selectedIdea || selectedIdea.status !== "available"

              const label = isSelecting
                ? t("selecting")
                : mySelectedIdea
                ? t("youHaveAlreadySelectedAnIdea")
                : selectedIdea?.status !== "available"
                ? t("ideaNotAvailable")
                : t("selectThisIdea")

              return (
                <Button onClick={handleSelectIdea} disabled={disabled} className="rounded-lg">
                  <Check className="w-4 h-4 ml-2" />
                  {label}
                </Button>
              )
            })()}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
