"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { supervisorSidebarItems } from "@/lib/constants/supervisor-sidebar"
import { Lightbulb, Eye, AlertCircle, Plus, Trash2, Pencil } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useEffect, useMemo, useState } from "react"
import { collection, getDocs, onSnapshot, query, where, addDoc, Timestamp, orderBy, deleteDoc, updateDoc, doc } from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase/config"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useAuth } from "@/lib/contexts/auth-context"
import { useLanguage } from "@/lib/contexts/language-context"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type AnyDoc = Record<string, any>

export default function SupervisorProjectIdeas() {
  const [allMyIdeas, setAllMyIdeas] = useState<AnyDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState<AnyDoc | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<AnyDoc | null>(null)
  const [deletingProject, setDeletingProject] = useState<AnyDoc | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [editFormData, setEditFormData] = useState({
    title: "",
    description: "",
    objectives: "",
    technologies: "",
    projectType: "",
    departmentId: "",
  })
  const { userData } = useAuth()
  const { t, language } = useLanguage()

  const [departments, setDepartments] = useState<AnyDoc[]>([])

  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    objectives: "",
    technologies: "",
    projectType: "",
    departmentId: "", 
  })

  const fetchDepartments = async () => {
    try {
      const departmentsQuery = query(collection(getFirebaseDb(), "departments"), where("isActive", "==", true))
      const departmentsSnapshot = await getDocs(departmentsQuery)
      const departmentsData = departmentsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      setDepartments(departmentsData)
    } catch (error) {
      console.error("Error fetching departments:", error)
      toast.error(t("errorLoadingDepartments"))
    }
  }

  const fetchProjectIdeas = async () => {
    if (!userData?.uid) return
    try {
      setLoading(true)

      const ideasQuery = query(
        collection(getFirebaseDb(), "projectIdeas"),
        where("proposedBySupervisor", "==", userData.uid),
        orderBy("submittedAt", "desc"),
      )

      const ideasSnapshot = await getDocs(ideasQuery)
      const ideasData = ideasSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      setAllMyIdeas(ideasData)
    } catch (error) {
      console.error("Error fetching project ideas:", error)
      toast.error(t("errorLoadingProjectIdeas"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!userData?.uid) return
    fetchProjectIdeas()
    fetchDepartments()

    const db2 = getFirebaseDb()
    const unsubIdeas = onSnapshot(
      query(collection(db2, "projectIdeas"), where("supervisorId", "==", userData.uid)),
      () => fetchProjectIdeas()
    )
    return () => { unsubIdeas() }
  }, [userData?.uid])

  const handleSubmitIdea = async () => {
    if (!formData.title || !formData.description || !formData.objectives || !formData.technologies || !formData.projectType || !formData.departmentId) {
      toast.error(t("pleaseFillAllFields"))
      return
    }

    const dep = departments.find((d) => d.id === formData.departmentId)
    if (!dep) {
      toast.error(t("pleaseChooseValidDepartment"))
      return
    }

    try {
      setIsSubmitting(true)

      const objectivesArray = formData.objectives.split("\n").map((x) => x.trim()).filter(Boolean)
      const technologiesArray = formData.technologies.split(",").map((x) => x.trim()).filter(Boolean)

  
      await addDoc(collection(getFirebaseDb(), "projectIdeas"), {
        title: formData.title,
        description: formData.description,
        objectives: objectivesArray,
        technologies: technologiesArray,
        projectType: formData.projectType,

        departmentId: dep.id,
        departmentCode: dep.code ?? dep.departmentCode ?? "",
        departmentNameAr: dep.nameAr ?? dep.name ?? "",
        departmentNameEn: dep.nameEn ?? "",

        proposedBySupervisor: userData?.uid,
        supervisorId: userData?.uid,
        supervisorName: userData?.name,
        supervisorEmail: userData?.email,

        status: "available",
        submittedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })

      toast.success(t("projectIdeaSubmittedSuccessfull"))
      setIsAddDialogOpen(false)
      setFormData({
        title: "",
        description: "",
        objectives: "",
        technologies: "",
        projectType: "",
        departmentId: "",
      })

    } catch (error) {
      console.error("Error submitting project idea:", error)
      toast.error(t("errorSubmittingProjectIdea"))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteIdea = async () => {
    if (!deletingProject) return
    setIsDeleting(true)
    try {
      await deleteDoc(doc(getFirebaseDb(), "projectIdeas", deletingProject.id))
      toast.success(language === "ar" ? t("ideaDeleted") : "Idea deleted")
      setIsDeleteDialogOpen(false)
      setDeletingProject(null)
    } catch (err) {
      console.error(err)
      toast.error(language === "ar" ? t("errorDeletingIdea") : "Error deleting idea")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleEditIdea = async () => {
    if (!editingProject || !editFormData.title || !editFormData.description || !editFormData.projectType || !editFormData.departmentId) {
      toast.error(t("pleaseFillAllFields"))
      return
    }
    const dep = departments.find((d) => d.id === editFormData.departmentId)
    if (!dep) { toast.error(t("pleaseChooseValidDepartment")); return }
    setIsUpdating(true)
    try {
      const objectivesArray = editFormData.objectives.split("\n").map((x) => x.trim()).filter(Boolean)
      const technologiesArray = editFormData.technologies.split(",").map((x) => x.trim()).filter(Boolean)
      await updateDoc(doc(getFirebaseDb(), "projectIdeas", editingProject.id), {
        title: editFormData.title,
        description: editFormData.description,
        objectives: objectivesArray,
        technologies: technologiesArray,
        projectType: editFormData.projectType,
        departmentId: dep.id,
        departmentCode: dep.code ?? dep.departmentCode ?? "",
        departmentNameAr: dep.nameAr ?? dep.name ?? "",
        departmentNameEn: dep.nameEn ?? "",
        updatedAt: Timestamp.now(),
      })
      toast.success(language === "ar" ? t("ideaUpdated") : "Idea updated")
      setIsEditDialogOpen(false)
      setEditingProject(null)
    } catch (err) {
      console.error(err)
      toast.error(language === "ar" ? t("errorUpdatingIdea") : "Error updating idea")
    } finally {
      setIsUpdating(false)
    }
  }

  const stats = useMemo(() => {
    const total = allMyIdeas.length
    const available = allMyIdeas.filter((i) => i.status === "available").length
    const taken = allMyIdeas.filter((i) => i.status === "taken").length
    const approved = allMyIdeas.filter((i) => i.status === "approved").length
    const pending = allMyIdeas.filter((i) => i.status === "pending").length
    const rejected = allMyIdeas.filter((i) => i.status === "rejected").length
    return { total, available, taken, approved, pending, rejected }
  }, [allMyIdeas])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return { variant: "outline" as const, label: t("pending") }
      case "approved":
        return { variant: "default" as const, label: t("approved") }
      case "available":
        return { variant: "secondary" as const, label: t("available") }
      case "taken":
        return { variant: "destructive" as const, label: t("taken") }
      case "rejected":
      default:
        return { variant: "destructive" as const, label: t("rejected") }
    }
  }

  const getTakenInfo = (project: AnyDoc) => {
    if (project.takenById || project.takenByName || project.takenByEmail) {
      return {
        name: project.takenByName || t("unknown"),
        email: project.takenByEmail || "",
        at: project.takenAt?.toDate?.() ? project.takenAt.toDate() : null,
      }
    }
    if (Array.isArray(project.selectedBy) && project.selectedBy.length > 0) {
      const first = project.selectedBy[0]
      return {
        name: first.studentName || t("unknown"),
        email: first.studentEmail || "",
        at: first.selectedAt?.toDate?.() ? first.selectedAt.toDate() : null,
      }
    }
    if (project.studentName || project.studentEmail) {
      return { name: project.studentName || t("unknown"), email: project.studentEmail || "", at: null }
    }
    return null
  }

  const formatDate = (ts: any) => {
    try {
      if (!ts) return t("notSet")
      const d = ts?.toDate?.() ? ts.toDate() : new Date(ts)
      return d.toLocaleDateString("ar-EG")
    } catch {
      return t("notSet")
    }
  }

  const getDepartmentLabel = (project: AnyDoc) => {
    
    if (project.departmentNameAr || project.departmentNameEn) return project.departmentNameAr || project.departmentNameEn

    
    const depId = project.departmentId || project.department
    const dep = departments.find((d) => d.id === depId)
    if (dep) return dep.nameAr || dep.name || dep.nameEn

    
    const depCode = project.departmentCode || project.department
    const dep2 = departments.find((d) => d.code === depCode || d.departmentCode === depCode)
    if (dep2) return dep2.nameAr || dep2.name || dep2.nameEn

    return t("notSet")
  }

  const ProjectCard = ({ project }: { project: AnyDoc }) => {
    const badge = getStatusBadge(project.status)
    const takenInfo = getTakenInfo(project)

    return (
      <Card className="rounded-xl hover:shadow-lg transition-all duration-300 h-full flex flex-col">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-xl flex items-start gap-2 w-full min-w-0">
                <Lightbulb className="w-5 h-5 text-amber-500 shrink-0" />
                <span className="block break-words whitespace-normal">
                  {project.title}
                </span>
              </CardTitle>
              <CardDescription className="mt-2 break-words max-h-28 overflow-y-auto pr-1">
                {project.description}
              </CardDescription>
            </div>
            <Badge variant={badge.variant} className="rounded-lg shrink-0">
              {badge.label}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 flex-1 flex flex-col">
          <div className="grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("department")}:</span>
              <span className="font-medium">{getDepartmentLabel(project)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("projectType")}:</span>
              <span className="font-medium">
                {project.projectType === "system" ? t("systemLabel")
                  : project.projectType === "research" ? t("researchLabel")
                  : project.projectType === "entrepreneurship" ? t("business")
                  : project.projectType === "cybersecurity" ? t("dataSecurity")
                  : project.projectType === "one-course" ? t("oneSemesterLabel")
                  : project.projectType === "two-courses" ? t("twoSemestersLabel")
                  : project.projectType || "—"}
              </span>
            </div>

            {project.duration && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("durationLabel")}:</span>
                <span className="font-medium">
                  {project.duration === "one-course" || project.duration === "one_semester" ? "كورس واحد"
                    : project.duration === "two-courses" || project.duration === "two_semesters" ? "كورسين"
                    : project.duration}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("submittedA")}:</span>
              <span className="font-medium">{formatDate(project.submittedAt)}</span>
            </div>

            {project.status === "taken" && takenInfo && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("takenBy")}:</span>
                  <span className="font-medium">{takenInfo.name}</span>
                </div>
                {takenInfo.email && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("email")}:</span>
                    <span className="font-medium text-xs">{takenInfo.email}</span>
                  </div>
                )}
                {takenInfo.at && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("selectionDate")}:</span>
                    <span className="font-medium">{takenInfo.at.toLocaleDateString("ar-EG")}</span>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex gap-2 pt-4 border-t mt-auto">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 bg-transparent rounded-lg"
              onClick={() => {
                setSelectedProject(project)
                setIsViewDialogOpen(true)
              }}
            >
              <Eye className="w-4 h-4 ml-2" />
              {t("viewDetails")}
            </Button>
            {project.status !== "taken" && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-blue-600 border-blue-200 hover:bg-blue-50 rounded-lg"
                onClick={() => {
                  setEditingProject(project)
                  setEditFormData({
                    title: project.title || "",
                    description: project.description || "",
                    objectives: Array.isArray(project.objectives) ? project.objectives.join("\n") : project.objectives || "",
                    technologies: Array.isArray(project.technologies) ? project.technologies.join(", ") : project.technologies || "",
                    projectType: project.projectType || "",
                    departmentId: project.departmentId || "",
                  })
                  setIsEditDialogOpen(true)
                }}
              >
                <Pencil className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10 rounded-lg"
              onClick={() => {
                setDeletingProject(project)
                setIsDeleteDialogOpen(true)
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>

          {project.status === "rejected" && project.rejectionReason && (
            <div className="pt-4 border-t">
              <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg">
                <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-destructive">{t("rejectionReason")}:</p>
                  <p className="text-sm text-muted-foreground mt-1">{project.rejectionReason}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <DashboardLayout sidebarItems={supervisorSidebarItems} requiredRole="supervisor">
      <div className="p-8 space-y-8 animate-in fade-in duration-500">
        <div className="animate-in slide-in-from-top duration-700 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-l from-primary to-primary/60 bg-clip-text text-transparent">
             {t("projectIdeas")}
            </h1>
            <p className="text-muted-foreground mt-2">{t("manageYourProjectIdeas")}</p>
          </div>

          <Button onClick={() => setIsAddDialogOpen(true)} className="rounded-lg">
            <Plus className="w-4 h-4 ml-2" />
              {t("submitProjectIdea")}
          </Button>
        </div>

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
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="border-2 border-blue-200 dark:border-blue-900 bg-gradient-to-br from-blue-50/50 to-background dark:from-blue-950/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                      {t("allProjectIdeas")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">{stats.total}</div>
                  <p className="text-sm text-muted-foreground mt-1">{t("idea")}</p>
                </CardContent>
              </Card>

              <Card className="border-2 border-green-200 dark:border-green-900 bg-gradient-to-br from-green-50/50 to-background dark:from-green-950/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <Lightbulb className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                   {t("availableForStudents")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-green-600 dark:text-green-400">{stats.available}</div>
                  <p className="text-sm text-muted-foreground mt-1">{t("idea")}</p>
                </CardContent>
              </Card>

              <Card className="border-2 border-orange-200 dark:border-orange-900 bg-gradient-to-br from-orange-50/50 to-background dark:from-orange-950/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                      <Lightbulb className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    {t("taken")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-orange-600 dark:text-orange-400">{stats.taken}</div>
                  <p className="text-sm text-muted-foreground mt-1">{t("idea")}</p>
                </CardContent>
              </Card>
            </div>

            {allMyIdeas.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Lightbulb className="w-16 h-16 text-muted-foreground/50 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">{t("noProjectIdeasYet")}</h3>
                  <p className="text-sm text-muted-foreground">{t("LetSubmitNewProjectIdea")}</p>
                </CardContent>
              </Card>
            ) : (
              <div>
                <h2 className="text-2xl font-bold mb-4">{t("myProjectIdeas")}</h2>
                <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
                  {allMyIdeas.map((project, index) => (
                    <div key={project.id} className="animate-in fade-in slide-in-from-bottom duration-500" style={{ animationDelay: `${index * 80}ms` }}>
                      <ProjectCard project={project} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-3xl rounded-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <Lightbulb className="w-6 h-6 text-amber-500" />
              {t("submitNewProjectIdeaa")}
            </DialogTitle>
            <DialogDescription>{t("submitNewProjectIdeaaDescription")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title"> {t("projectTitle")} *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="rounded-lg"
                placeholder={t("projectTitlePlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description"> {t("projectDescription")} *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={5}
                className="rounded-lg"
                placeholder={t("projectDescriptionPlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="objectives"> {t("projectObjectives")} *</Label>
              <Textarea
                id="objectives"
                value={formData.objectives}
                onChange={(e) => setFormData({ ...formData, objectives: e.target.value })}
                rows={4}
                className="rounded-lg"
                placeholder={t("projectObjectivesPlaceholder")}
              />
              <p className="text-xs text-muted-foreground">{t("projectObjectivesDescription")}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="technologies"> {t("projectTechnologies")} *</Label>
              <Input
                id="technologies"
                value={formData.technologies}
                onChange={(e) => setFormData({ ...formData, technologies: e.target.value })}
                className="rounded-lg"
                placeholder={t("projectTechnologiesPlaceholder")}
              />
              <p className="text-xs text-muted-foreground">{t("projectTechnologiesDescription")}</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label> {t("projectType")} *</Label>
                <Select value={formData.projectType} onValueChange={(v) => setFormData({ ...formData, projectType: v })}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder={t("projectTypePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="research">Research</SelectItem>
                    <SelectItem value="entrepreneurship">Entrepreneurship</SelectItem>
                    <SelectItem value="cybersecurity">Cybersecurity</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label> {t("department")} *</Label>
                <Select value={formData.departmentId} onValueChange={(v) => setFormData({ ...formData, departmentId: v })}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder={t("pleaseChooseValidDepartment")} />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    {departments.map((dep) => (
                      <SelectItem key={dep.id} value={dep.id}>
                        {dep.nameAr || dep.name || dep.nameEn} {dep.code ? `(${dep.code})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="rounded-lg">
              {t("cancel")}
            </Button>
            <Button onClick={handleSubmitIdea} disabled={isSubmitting} className="rounded-lg">
              {isSubmitting ? t("submitting") : t("submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl rounded-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              {language === "ar" ? t("editIdea") : "Edit Idea"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("projectTitle")} *</Label>
              <Input value={editFormData.title} onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })} className="rounded-lg" />
            </div>
            <div className="space-y-2">
              <Label>{t("projectDescription")} *</Label>
              <Textarea value={editFormData.description} onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })} rows={4} className="rounded-lg" />
            </div>
            <div className="space-y-2">
              <Label>{t("projectObjectives")} *</Label>
              <Textarea value={editFormData.objectives} onChange={(e) => setEditFormData({ ...editFormData, objectives: e.target.value })} rows={3} className="rounded-lg" />
              <p className="text-xs text-muted-foreground">{t("projectObjectivesDescription")}</p>
            </div>
            <div className="space-y-2">
              <Label>{t("projectTechnologies")} *</Label>
              <Input value={editFormData.technologies} onChange={(e) => setEditFormData({ ...editFormData, technologies: e.target.value })} className="rounded-lg" />
              <p className="text-xs text-muted-foreground">{t("projectTechnologiesDescription")}</p>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("projectType")} *</Label>
                <Select value={editFormData.projectType} onValueChange={(v) => setEditFormData({ ...editFormData, projectType: v })}>
                  <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="research">Research</SelectItem>
                    <SelectItem value="entrepreneurship">Entrepreneurship</SelectItem>
                    <SelectItem value="cybersecurity">Cybersecurity</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("department")} *</Label>
                <Select value={editFormData.departmentId} onValueChange={(v) => setEditFormData({ ...editFormData, departmentId: v })}>
                  <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {departments.map((dep) => (
                      <SelectItem key={dep.id} value={dep.id}>{dep.nameAr || dep.name || dep.nameEn}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="rounded-lg">{t("cancel")}</Button>
            <Button onClick={handleEditIdea} disabled={isUpdating} className="rounded-lg">
              {isUpdating ? "..." : language === "ar" ? t("saveEdit") : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-xl text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              {language === "ar" ? t("deleteIdea") : "Delete Idea"}
            </DialogTitle>
            <DialogDescription>
              {language === "ar" ? t("confirmDeleteIdea") : "Are you sure you want to delete this idea? This cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm font-medium px-1">{deletingProject?.title}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="rounded-lg">{t("cancel")}</Button>
            <Button variant="destructive" onClick={handleDeleteIdea} disabled={isDeleting} className="rounded-lg">
              {isDeleting ? "..." : language === "ar" ? t("confirmDelet") : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl rounded-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <Lightbulb className="w-6 h-6 text-amber-500" />
              {selectedProject?.title}
            </DialogTitle>
            <DialogDescription>{t("projectIdeaDetails")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div>
              <h4 className="font-semibold mb-2 text-lg">{t("description")}:</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{selectedProject?.description}</p>
            </div>

            {Array.isArray(selectedProject?.objectives) && selectedProject.objectives.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 text-lg">{t("objectives")}:</h4>
                <ul className="space-y-2">
                  {selectedProject.objectives.map((objective: string, index: number) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span className="text-sm text-muted-foreground">{objective}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {Array.isArray(selectedProject?.technologies) && selectedProject.technologies.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 text-lg">{t("projectTechnologies")}:</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedProject.technologies.map((tech: string, index: number) => (
                    <Badge key={index} variant="secondary" className="rounded-lg">
                      {tech}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">{t("department")}</p>
                <p className="font-semibold">{selectedProject ? getDepartmentLabel(selectedProject) : t("notSet")}</p>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">{t("projectType")}</p>
                <p className="font-semibold">
                  {selectedProject?.projectType === "system" ? "نظام (System)"
                    : selectedProject?.projectType === "research" ? "بحث (Research)"
                    : selectedProject?.projectType === "entrepreneurship" ? "ريادة أعمال (Entrepreneurship)"
                    : selectedProject?.projectType === "cybersecurity" ? "أمن معلومات (Cybersecurity)"
                    : selectedProject?.projectType === "one-course" ? "كورس واحد"
                    : selectedProject?.projectType === "two-courses" ? "كورسين"
                    : selectedProject?.projectType || "—"}
                </p>
              </div>

              {selectedProject?.duration && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">{t("durationLabel")}</p>
                  <p className="font-semibold">
                    {selectedProject.duration === "one-course" || selectedProject.duration === "one_semester"
                      ? t("oneC")
                      : selectedProject.duration === "two-courses" || selectedProject.duration === "two_semesters"
                      ? t("twoC")
                      : selectedProject.duration}
                  </p>
                </div>
              )}

              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">{t("submittedA")}</p>
                <p className="font-semibold">{formatDate(selectedProject?.submittedAt)}</p>
              </div>
            </div>

            {selectedProject?.status === "rejected" && selectedProject.rejectionReason && (
              <div className="p-4 bg-destructive/10 rounded-lg border-2 border-destructive/20">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-destructive mb-2">{t("rejectionReason")}:</p>
                    <p className="text-sm text-muted-foreground">{selectedProject.rejectionReason}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}