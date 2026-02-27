"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { FolderKanban, Check, X, Eye, Plus, Edit, Trash2, Pause, ArchiveIcon, Users } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { collection, getDocs, doc, updateDoc, addDoc, Timestamp, query, where, getDoc } from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase/config"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { coordinatorSidebarItems } from "@/lib/constants/coordinator-sidebar"
import { useSearchParams } from "next/navigation"
import { AdvancedSearch, type SearchFilters } from "@/components/search/advanced-search"
import { filterProjects } from "@/lib/utils/search-utils"
import { getDepartments, type Department } from "@/lib/utils/department-helper"
import { calculateProjectProgress } from "@/lib/utils/grading"
import { useLanguage } from "@/lib/contexts/language-context"

const db = getFirebaseDb()

export default function CoordinatorProjects() {
  const { t, language } = useLanguage()

  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState<any>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<any>(null)
  const [isTeamManagementOpen, setIsTeamManagementOpen] = useState(false)
  const [projectTeamMembers, setProjectTeamMembers] = useState<any[]>([])
  const [selectedStudentToAdd, setSelectedStudentToAdd] = useState("")
  const [supervisors, setSupervisors] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({ searchText: "" })
  const [departments, setDepartments] = useState<Department[]>([])
  const [isUpdating, setIsUpdating] = useState(false)
  const [newProject, setNewProject] = useState({
    title: "",
    description: "",
    supervisorId: "",
    studentId: "",
    department: "",
    startDate: "",
    endDate: "",
  })

  const searchParams = useSearchParams()
  const createFromIdeaId = searchParams.get("createFrom")

  const fetchProjects = async () => {
    try {
      const projectsSnapshot = await getDocs(collection(db, "projects"))
      const projectsData = projectsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))

      const updatedProjects = await Promise.all(
        projectsData.map(async (project: any) => {
          try {
            const tasksQuery = query(collection(db, "tasks"), where("projectId", "==", project.id))
            const tasksSnapshot = await getDocs(tasksQuery)
            const tasks = tasksSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }))

            const progress = calculateProjectProgress(tasks as any[])

            if (progress !== project.progress) {
              await updateDoc(doc(db, "projects", project.id), { progress })
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
      toast.error(t("errorLoadingProjectsMsg"))
    } finally {
      setLoading(false)
    }
  }

  const fetchSupervisorsAndStudents = async () => {
    try {
      const supervisorsQuery = query(collection(db, "users"), where("role", "==", "supervisor"))
      const supervisorsSnapshot = await getDocs(supervisorsQuery)
      setSupervisors(supervisorsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() })))

      const studentsQuery = query(collection(db, "users"), where("role", "==", "student"))
      const studentsSnapshot = await getDocs(studentsQuery)
      setStudents(studentsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
    } catch (error) {
      console.error("Error fetching users:", error)
    }
  }

  const fetchDepartments = async () => {
    const depts = await getDepartments()
    setDepartments(depts)
  }

  const loadProjectTeamMembers = async (projectId: string) => {
    try {
      const studentsQuery = query(
        collection(db, "users"),
        where("projectId", "==", projectId),
        where("role", "==", "student"),
      )
      const studentsSnapshot = await getDocs(studentsQuery)
      const members = studentsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      setProjectTeamMembers(members)
    } catch (error) {
      console.error("Error loading team members:", error)
      toast.error(t("errorLoadingTeamMembersMsg"))
    }
  }

  const handleAddStudentToProject = async () => {
    if (!selectedStudentToAdd || !selectedProject) {
      toast.error(t("pleaseSelectStudentMsg"))
      return
    }

    try {
      const student = students.find((s) => s.id === selectedStudentToAdd)

      if (student?.projectId) {
        toast.error(t("studentAlreadyHasProjectMsg"))
        return
      }

      await updateDoc(doc(db, "users", selectedStudentToAdd), {
        projectId: selectedProject.id,
        supervisorId: selectedProject.supervisorId,
      })

      const currentMembers = selectedProject.teamMembers || []
      await updateDoc(doc(db, "projects", selectedProject.id), {
        teamMembers: [...currentMembers, selectedStudentToAdd],
        isTeamProject: true,
      })

      toast.success(t("studentAddedToProjectSuccess"))
      setSelectedStudentToAdd("")
      loadProjectTeamMembers(selectedProject.id)
      fetchProjects()
    } catch (error) {
      console.error("Error adding student to project:", error)
      toast.error(t("errorAddingStudentMsg"))
    }
  }

  const handleRemoveStudentFromProject = async (studentId: string) => {
    if (!selectedProject) return

    try {
      await updateDoc(doc(db, "users", studentId), {
        projectId: null,
        supervisorId: null,
      })

      const currentMembers = selectedProject.teamMembers || []
      const updatedMembers = currentMembers.filter((id: string) => id !== studentId)

      await updateDoc(doc(db, "projects", selectedProject.id), {
        teamMembers: updatedMembers,
        isTeamProject: updatedMembers.length > 1,
      })

      toast.success(t("studentRemovedFromProject"))
      loadProjectTeamMembers(selectedProject.id)
      fetchProjects()
    } catch (error) {
      console.error("Error removing student from project:", error)
      toast.error(t("errorRemovingStudentMsg"))
    }
  }

  useEffect(() => {
    const loadApprovedIdea = async () => {
      if (createFromIdeaId) {
        try {
          const ideaDoc = await getDoc(doc(db, "projectIdeas", createFromIdeaId))
          if (ideaDoc.exists()) {
            const ideaData: any = ideaDoc.data()
            setNewProject({
              title: ideaData.title || "",
              description: ideaData.description || "",
              supervisorId: "",
              studentId: ideaData.studentId || "",
              department: ideaData.department || "",
              startDate: "",
              endDate: "",
            })
            setIsAddDialogOpen(true)
            toast.info(t("ideaDataLoadedMsg"))
          }
        } catch (error) {
          console.error("Error loading approved idea:", error)
          toast.error(t("errorLoadingIdeaDataMsg"))
        }
      }
    }

    fetchProjects()
    fetchSupervisorsAndStudents()
    fetchDepartments()
    loadApprovedIdea()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createFromIdeaId])

  const handleAddProject = async () => {
    if (!newProject.title || !newProject.description || !newProject.supervisorId || !newProject.department || !newProject.startDate) {
      toast.error(t("fillRequiredFields"))
      return
    }

    try {
      const supervisor = supervisors.find((s) => s.id === newProject.supervisorId)
      const student = students.find((s) => s.id === newProject.studentId)

      const projectData: any = {
        title: newProject.title,
        description: newProject.description,
        supervisorId: newProject.supervisorId,
        supervisorName: supervisor?.name || "",
        studentId: newProject.studentId || null,
        studentName: student?.name || "",
        department: newProject.department,
        status: "active",
        progress: 0,
        createdAt: Timestamp.now(),
        startDate: Timestamp.fromDate(new Date(newProject.startDate)),
      }

      if (newProject.endDate) {
        projectData.endDate = Timestamp.fromDate(new Date(newProject.endDate))
      }

      const projectRef = await addDoc(collection(db, "projects"), projectData)

      if (newProject.studentId) {
        await updateDoc(doc(db, "users", newProject.studentId), {
          supervisorId: newProject.supervisorId,
          projectId: projectRef.id,
        })
      }

      if (createFromIdeaId) {
        await updateDoc(doc(db, "projectIdeas", createFromIdeaId), {
          supervisorId: newProject.supervisorId,
          projectId: projectRef.id,
        })
      }

      toast.success(t("projectAddedSuccess"))
      setIsAddDialogOpen(false)
      setNewProject({
        title: "",
        description: "",
        supervisorId: "",
        studentId: "",
        department: "",
        startDate: "",
        endDate: "",
      })

      if (createFromIdeaId) {
        window.history.pushState({}, "", "/coordinator/projects")
      }

      fetchProjects()
    } catch (error) {
      console.error("Error adding project:", error)
      toast.error(t("errorAddingProjectMsg"))
    }
  }

  const handleApproveProject = async (projectId: string) => {
    try {
      await updateDoc(doc(db, "projects", projectId), {
        status: "active",
        approvedAt: new Date(),
      })
      toast.success(t("projectAcceptedSuccess"))
      fetchProjects()
    } catch (error) {
      console.error("Error approving project:", error)
      toast.error(t("errorAcceptingProject"))
    }
  }

  const handleRejectProject = async (projectId: string) => {
    try {
      await updateDoc(doc(db, "projects", projectId), {
        status: "rejected",
        rejectedAt: new Date(),
      })
      toast.success(t("projectRejectedMsg"))
      fetchProjects()
    } catch (error) {
      console.error("Error rejecting project:", error)
      toast.error(t("errorRejectingProjectMsg"))
    }
  }

  const handleSuspendProject = async (projectId: string) => {
    try {
      await updateDoc(doc(db, "projects", projectId), {
        status: "suspended",
        suspendedAt: Timestamp.now(),
      })
      toast.success(t("projectStoppedMsg"))
      fetchProjects()
    } catch (error) {
      console.error("Error suspending project:", error)
      toast.error(t("errorStoppingProject"))
    }
  }

  const handleArchiveProject = async (projectId: string) => {
    try {
      await updateDoc(doc(db, "projects", projectId), {
        status: "archived",
        archivedAt: Timestamp.now(),
      })
      toast.success(t("projectArchivedMsg"))
      fetchProjects()
    } catch (error) {
      console.error("Error archiving project:", error)
      toast.error(t("errorArchivingProjectMsg"))
    }
  }

  const handleUpdateProject = async () => {
    if (!selectedProject || !selectedProject.title || !selectedProject.description) {
      toast.error(t("fillRequiredFields"))
      return
    }

    if (isUpdating) return
    setIsUpdating(true)

    try {
      const supervisor = supervisors.find((s) => s.id === selectedProject.supervisorId)
      const student = students.find((s) => s.id === selectedProject.studentId)

      const updateData: any = {
        title: selectedProject.title,
        description: selectedProject.description,
        supervisorId: selectedProject.supervisorId,
        supervisorName: supervisor?.name || "",
        studentId: selectedProject.studentId || null,
        studentName: student?.name || "",
        department: selectedProject.department,
        updatedAt: Timestamp.now(),
      }

      if (selectedProject.startDate && typeof selectedProject.startDate === "string") {
        updateData.startDate = Timestamp.fromDate(new Date(selectedProject.startDate))
      }

      if (selectedProject.endDate && typeof selectedProject.endDate === "string") {
        updateData.endDate = Timestamp.fromDate(new Date(selectedProject.endDate))
      }

      await updateDoc(doc(db, "projects", selectedProject.id), updateData)

      const teamMembers = selectedProject.teamMembers || []
      const allStudentIds = new Set<string>()

      if (selectedProject.studentId && selectedProject.studentId !== "none") {
        allStudentIds.add(selectedProject.studentId)
      }
      teamMembers.forEach((memberId: string) => {
        if (memberId) allStudentIds.add(memberId)
      })

      if (allStudentIds.size > 0 && selectedProject.supervisorId) {
        const updatePromises = Array.from(allStudentIds).map((studentId: string) =>
          updateDoc(doc(db, "users", studentId), {
            supervisorId: selectedProject.supervisorId,
            projectId: selectedProject.id,
          }),
        )
        await Promise.all(updatePromises)
      }

      toast.success(t("projectUpdatedSuccess"))
      setIsEditDialogOpen(false)
      setSelectedProject(null)
      fetchProjects()
    } catch (error) {
      console.error("Error updating project:", error)
      toast.error(t("errorUpdatingProjectMsg"))
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeleteProject = async () => {
    if (!projectToDelete) return

    try {
      const projectRef = doc(db, "projects", projectToDelete.id)

      // ✅ مسح projectId من جميع الطلاب المرتبطين بالمشروع
      const projectSnap = await getDoc(projectRef)
      if (projectSnap.exists()) {
        const projectData = projectSnap.data()

        // جمع UIDs الطلاب (فردي أو فريق)
        const studentUids: string[] = []
        if (projectData.studentId) studentUids.push(projectData.studentId)
        if (Array.isArray(projectData.studentIds)) studentUids.push(...projectData.studentIds)

        // مسح projectId من كل طالب
        if (studentUids.length > 0) {
          await Promise.all(
            [...new Set(studentUids)].map((uid) =>
              updateDoc(doc(db, "users", uid), {
                projectId: null,
                updatedAt: Timestamp.now(),
              }).catch(() => {}) // تجاهل لو الطالب مش موجود
            )
          )
        }
      }

      await updateDoc(projectRef, {
        status: "deleted",
        deletedAt: Timestamp.now(),
      })

      toast.success(t("projectDeletedMsg"))
      setIsDeleteDialogOpen(false)
      setProjectToDelete(null)
      fetchProjects()
    } catch (error) {
      console.error("Error deleting project:", error)
      toast.error(t("errorDeletingProjectMsg"))
    }
  }

  const filteredProjects = filterProjects(projects, searchFilters)
  const activeProjects = filteredProjects.filter((p) => p.status === "active")
  const completedProjects = filteredProjects.filter((p) => p.status === "completed")
  const pendingProjects = filteredProjects.filter((p) => p.status === "pending")
  const rejectedProjects = filteredProjects.filter((p) => p.status === "rejected")
  const suspendedProjects = filteredProjects.filter((p) => p.status === "suspended")
  const archivedProjects = filteredProjects.filter((p) => p.status === "archived")

  const getDepartmentName = (deptValue: any) => {
    if (!deptValue) return t("notAssigned")

    const legacyMap: Record<string, { ar: string; en: string }> = {
      cs: { ar: "علوم الحاسب", en: "Computer Science" },
      it: { ar: "تقنية المعلومات", en: "Information Technology" },
      is: { ar: "نظم المعلومات", en: "Information Systems" },
    }
    if (typeof deptValue === "string" && legacyMap[deptValue.toLowerCase()]) {
      return language === "ar" ? legacyMap[deptValue.toLowerCase()].ar : legacyMap[deptValue.toLowerCase()].en
    }

    const byId = departments.find((d) => d.id === deptValue)
    if (byId) return language === "ar" ? (byId.nameAr || byId.nameEn || byId.code || t("notAssigned")) : (byId.nameEn || byId.nameAr || byId.code || t("notAssigned"))

    if (typeof deptValue === "string") {
      const normalized = deptValue.trim().toLowerCase()
      const byCode = departments.find((d) => (d.code || "").trim().toLowerCase() === normalized)
      if (byCode) return language === "ar" ? (byCode.nameAr || byCode.nameEn || byCode.code || t("notAssigned")) : (byCode.nameEn || byCode.nameAr || byCode.code || t("notAssigned"))
      if (deptValue.trim().length > 0) return deptValue
    }

    return t("notAssigned")
  }

  const ProjectCard = ({ project }: { project: any }) => (
    <Card className="rounded-xl relative">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{project.title || t("noTitle")}</CardTitle>
            <CardDescription className="mt-2 line-clamp-2">{project.description || t("noDescription")}</CardDescription>
          </div>

          <Badge
            variant={
              project.status === "active"
                ? "default"
                : project.status === "completed"
                  ? "secondary"
                  : project.status === "rejected"
                    ? "destructive"
                    : project.status === "suspended"
                      ? "outline"
                      : project.status === "archived"
                        ? "secondary"
                        : "outline"
            }
            className="rounded-lg"
          >
            {project.status === "active"
              ? t("active")
              : project.status === "completed"
                ? t("completed")
                : project.status === "rejected"
                  ? t("rejected")
                  : project.status === "pending"
                    ? t("awaitingApproval")
                    : project.status === "suspended"
                      ? t("stopped")
                      : project.status === "archived"
                        ? t("archived")
                        : t("unknown")}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{t("progressLabel")}</span>
            <span className="text-sm text-muted-foreground">{project.progress || 0}%</span>
          </div>
          <Progress value={project.progress || 0} />
        </div>

        <div className="grid gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("startDateLabel")}</span>
            <span>
              {project.startDate
                ? new Date(project.startDate.seconds * 1000).toLocaleDateString(language === "ar" ? "ar-EG" : "en-US")
                : t("notAssigned")}
            </span>
          </div>

          {project.endDate && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("endDateLabel")}</span>
              <span>
                {new Date(project.endDate.seconds * 1000).toLocaleDateString(language === "ar" ? "ar-EG" : "en-US")}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("supervisorLabel")}</span>
            <span>{project.supervisorName || t("notAssigned")}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("departmentLabel")}</span>
            <span>{getDepartmentName(project.department)}</span>
          </div>

          {project.studentName && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("studentLabel")}</span>
              <span>{project.studentName}</span>
            </div>
          )}
        </div>

        {project.status === "pending" && (
          <div className="flex gap-2 pt-4 border-t">
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 bg-transparent rounded-lg"
                  onClick={() => setSelectedProject(project)}
                >
                  <Eye className="w-4 h-4 ml-2" />
                  {t("viewDetails")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl rounded-xl">
                <DialogHeader>
                  <DialogTitle>{selectedProject?.title}</DialogTitle>
                  <DialogDescription>{t("projectProposalDetails")}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">{language === "ar" ? "الوصف:" : "Description:"}</h4>
                    <p className="text-sm text-muted-foreground">{selectedProject?.description}</p>
                  </div>

                  {selectedProject?.objectives && (
                    <div>
                      <h4 className="font-semibold mb-2">{t("objectives")}:</h4>
                      <p className="text-sm text-muted-foreground">{selectedProject.objectives}</p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-4">
                    <Button onClick={() => handleApproveProject(selectedProject?.id)} className="flex-1 rounded-lg">
                      <Check className="w-4 h-4 ml-2" />
                      {t("acceptProject")}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleRejectProject(selectedProject?.id)}
                      className="flex-1 rounded-lg"
                    >
                      <X className="w-4 h-4 ml-2" />
                      {t("rejectProject")}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Button size="sm" onClick={() => handleApproveProject(project.id)} className="flex-1 rounded-lg">
              <Check className="w-4 h-4 ml-2" />
              {t("acceptProject")}
            </Button>

            <Button
              variant="destructive"
              size="sm"
              className="rounded-lg"
              onClick={() => handleRejectProject(project.id)}
            >
              <X className="w-4 h-4 ml-2" />
              {t("rejectProject")}
            </Button>
          </div>
        )}

        {(project.status === "active" || project.status === "suspended") && (
          <div className="flex flex-wrap gap-2 pt-4 border-t justify-center">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 rounded-lg bg-transparent"
              onClick={() => {
                setSelectedProject(project)
                setIsEditDialogOpen(true)
              }}
            >
              <Edit className="w-4 h-4 ml-2" />
              {t("editProject")}
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="flex-1 rounded-lg bg-transparent"
              onClick={() => {
                setSelectedProject(project)
                loadProjectTeamMembers(project.id)
                setIsTeamManagementOpen(true)
              }}
            >
              <Users className="w-4 h-4 ml-2" />
              {t("teamManagement")}
            </Button>

            {project.status === "active" && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 rounded-lg bg-transparent"
                onClick={() => handleSuspendProject(project.id)}
              >
                <Pause className="w-4 h-4 ml-2" />
                {language === "ar" ? t("TemporarySuspension") : "Suspend"}
              </Button>
            )}

            {project.status === "suspended" && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 rounded-lg bg-transparent"
                onClick={() => handleApproveProject(project.id)}
              >
                <Check className="w-4 h-4 ml-2" />
                {language === "ar" ? t("activateProject") : "Activate"}
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              className="flex-1 rounded-lg bg-transparent"
              onClick={() => handleArchiveProject(project.id)}
            >
              <ArchiveIcon className="w-4 h-4 ml-2" />
              {t("archiveProject")}
            </Button>

            <Button
              variant="destructive"
              size="sm"
              className="absolute -top-2 -right-2 rounded-full w-8 h-8 p-0 flex items-center justify-center shadow-lg"
              onClick={() => {
                setProjectToDelete(project)
                setIsDeleteDialogOpen(true)
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )

  return (
    <DashboardLayout sidebarItems={coordinatorSidebarItems} requiredRole="coordinator">
      <div className="p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t("allProjects")}</h1>
            <p className="text-muted-foreground mt-2">{t("projectsManagement")}</p>
          </div>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-lg">
                <Plus className="w-4 h-4 ml-2" />
                {t("addProject")}
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-2xl rounded-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{language === "ar" ? t("addNewProject") : "Add New Project"}</DialogTitle>
                <DialogDescription>
                  {language === "ar" ? t("enterProjectDetailsAndAssignSupervisorAndStudent") : "Enter project details and assign supervisor and student"}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">{t("projectTitle")} *</Label>
                  <Input
                    id="title"
                    value={newProject.title}
                    onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                    placeholder={language === "ar" ? t("enterProjectTitle") : "Enter project title"}
                    className="rounded-lg"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">{t("projectDescription")} *</Label>
                  <Textarea
                    id="description"
                    value={newProject.description}
                    onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                    placeholder={language === "ar" ? t("enterProjectDescription") : "Enter project description"}
                    rows={4}
                    className="rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">{language === "ar" ? t("projectStartDate") : "Project Start Date *"}</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={newProject.startDate}
                      onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })}
                      className="rounded-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">{language === "ar" ? t("projectEndDate") : "Project End Date (Optional)"}</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={newProject.endDate}
                      onChange={(e) => setNewProject({ ...newProject, endDate: e.target.value })}
                      className="rounded-lg"
                      min={newProject.startDate}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="supervisor">{t("supervisors")} *</Label>
                    <Select value={newProject.supervisorId} onValueChange={(value) => setNewProject({ ...newProject, supervisorId: value })}>
                      <SelectTrigger className="rounded-lg">
                        <SelectValue placeholder={language === "ar" ? t("selectSupervisor") : "Select supervisor"} />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg">
                        {supervisors.map((supervisor) => (
                          <SelectItem key={supervisor.id} value={supervisor.id}>
                            {supervisor.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="student">{language === "ar" ? t("stu") : "Student (Optional)"}</Label>
                    <Select value={newProject.studentId} onValueChange={(value) => setNewProject({ ...newProject, studentId: value })}>
                      <SelectTrigger className="rounded-lg">
                        <SelectValue placeholder={language === "ar" ? t("selectStudent") : "Select student"} />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg">
                        <SelectItem value="none">{language === "ar" ? t("noStudent") : "No student"}</SelectItem>
                        {students.map((student) => (
                          <SelectItem key={student.id} value={student.id}>
                            {student.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department">{t("department")} *</Label>
                  <Select value={newProject.department} onValueChange={(value) => setNewProject({ ...newProject, department: value })}>
                    <SelectTrigger className="rounded-lg">
                      <SelectValue placeholder={language === "ar" ? t("selectDepartment") : "Select department"} />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg">
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.code}>
                          {language === "ar" ? dept.nameAr : dept.nameEn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="rounded-lg">
                  {t("cancel")}
                </Button>
                <Button onClick={handleAddProject} className="rounded-lg">
                  {language === "ar" ? t("addProj") : "Add Project"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <AdvancedSearch
          filters={searchFilters}
          onFiltersChange={setSearchFilters}
          showStatusFilter
          showDepartmentFilter
          showSupervisorFilter
          showStudentFilter
          showDateFilter
          supervisors={supervisors.map((s) => ({ id: s.id, name: s.name }))}
          students={students.map((s) => ({ id: s.id, name: s.name }))}
          departments={departments.map((dept) => (language === "ar" ? dept.nameAr : dept.nameEn))}
          statusOptions={[
            { value: "active", label: t("active") },
            { value: "pending", label: t("awaitingApproval") },
            { value: "completed", label: t("completed") },
            { value: "rejected", label: t("rejected") },
            { value: "suspended", label: t("stopped") },
            { value: "archived", label: t("archived") },
          ]}
          placeholder={language === "ar" ? t("searchProjects") : "Search projects..."}
        />

        {loading ? (
          <Card className="rounded-xl">
            <CardContent className="p-8">
              <p className="text-center text-muted-foreground">{t("loading")}</p>
            </CardContent>
          </Card>
        ) : filteredProjects.length === 0 ? (
          <Card className="rounded-xl">
            <CardContent className="p-8">
              <div className="text-center space-y-4">
                <FolderKanban className="w-16 h-16 mx-auto text-muted-foreground" />
                <div>
                  <h3 className="text-lg font-semibold">
                    {projects.length === 0 ? t("noProjectsCurrently") : (language === "ar" ? t("noMatchingResults") : "No matching results")}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    {projects.length === 0 ? (language === "ar" ? t("startAddingProjects") : "Start by adding new projects") : (language === "ar" ? "جرب تعديل معايير البحث" : "Try adjusting search filters")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="all" className="space-y-6">
            <TabsList className="rounded-lg">
              <TabsTrigger value="all" className="rounded-lg">
                {language === "ar" ? `الكل (${filteredProjects.length})` : `All (${filteredProjects.length})`}
              </TabsTrigger>

              <TabsTrigger value="pending" className="rounded-lg">
                {language === "ar"
                  ? `بانتظار الموافقة (${pendingProjects.length})`
                  : `Awaiting Approval (${pendingProjects.length})`}
                {pendingProjects.length > 0 && (
                  <Badge variant="destructive" className="mr-2 h-5 w-5 rounded-full p-0 text-xs">
                    {pendingProjects.length}
                  </Badge>
                )}
              </TabsTrigger>

              <TabsTrigger value="active" className="rounded-lg">
                {language === "ar" ? `نشطة (${activeProjects.length})` : `Active (${activeProjects.length})`}
              </TabsTrigger>

              <TabsTrigger value="completed" className="rounded-lg">
                {language === "ar" ? `مكتملة (${completedProjects.length})` : `Completed (${completedProjects.length})`}
              </TabsTrigger>

              <TabsTrigger value="rejected" className="rounded-lg">
                {language === "ar" ? `مرفوضة (${rejectedProjects.length})` : `Rejected (${rejectedProjects.length})`}
              </TabsTrigger>

              <TabsTrigger value="suspended" className="rounded-lg">
                {language === "ar" ? `موقوفة (${suspendedProjects.length})` : `Stopped (${suspendedProjects.length})`}
              </TabsTrigger>

              <TabsTrigger value="archived" className="rounded-lg">
                {language === "ar" ? `مؤرشفة (${archivedProjects.length})` : `Archived (${archivedProjects.length})`}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="grid gap-6 md:grid-cols-2">
              {filteredProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </TabsContent>

            <TabsContent value="pending" className="grid gap-6 md:grid-cols-2">
              {pendingProjects.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 col-span-2">
                  {language === "ar" ? "لا توجد مشاريع بانتظار الموافقة" : "No projects awaiting approval"}
                </p>
              ) : (
                pendingProjects.map((project) => <ProjectCard key={project.id} project={project} />)
              )}
            </TabsContent>

            <TabsContent value="active" className="grid gap-6 md:grid-cols-2">
              {activeProjects.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 col-span-2">
                  {language === "ar" ? "لا توجد مشاريع نشطة" : "No active projects"}
                </p>
              ) : (
                activeProjects.map((project) => <ProjectCard key={project.id} project={project} />)
              )}
            </TabsContent>

            <TabsContent value="completed" className="grid gap-6 md:grid-cols-2">
              {completedProjects.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 col-span-2">
                  {language === "ar" ? "لا توجد مشاريع مكتملة" : "No completed projects"}
                </p>
              ) : (
                completedProjects.map((project) => <ProjectCard key={project.id} project={project} />)
              )}
            </TabsContent>

            <TabsContent value="rejected" className="grid gap-6 md:grid-cols-2">
              {rejectedProjects.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 col-span-2">
                  {language === "ar" ? "لا توجد مشاريع مرفوضة" : "No rejected projects"}
                </p>
              ) : (
                rejectedProjects.map((project) => <ProjectCard key={project.id} project={project} />)
              )}
            </TabsContent>

            <TabsContent value="suspended" className="grid gap-6 md:grid-cols-2">
              {suspendedProjects.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 col-span-2">
                  {language === "ar" ? "لا توجد مشاريع موقوفة" : "No stopped projects"}
                </p>
              ) : (
                suspendedProjects.map((project) => <ProjectCard key={project.id} project={project} />)
              )}
            </TabsContent>

            <TabsContent value="archived" className="grid gap-6 md:grid-cols-2">
              {archivedProjects.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 col-span-2">
                  {language === "ar" ? "لا توجد مشاريع مؤرشفة" : "No archived projects"}
                </p>
              ) : (
                archivedProjects.map((project) => <ProjectCard key={project.id} project={project} />)
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Team Management Dialog */}
        <Dialog open={isTeamManagementOpen} onOpenChange={setIsTeamManagementOpen}>
          <DialogContent className="max-w-2xl rounded-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{language === "ar" ? "إدارة فريق المشروع" : "Project Team Management"}</DialogTitle>
              <DialogDescription>
                {language === "ar"
                  ? `إضافة أو حذف طلاب من المشروع: ${selectedProject?.title || ""}`
                  : `Add or remove students from: ${selectedProject?.title || ""}`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="space-y-4">
                <h4 className="font-semibold">{language === "ar" ? "إضافة طالب جديد" : "Add New Student"}</h4>
                <div className="flex gap-2">
                  <Select value={selectedStudentToAdd} onValueChange={setSelectedStudentToAdd}>
                    <SelectTrigger className="flex-1 rounded-lg">
                      <SelectValue placeholder={language === "ar" ? "اختر طالباً" : "Select a student"} />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg">
                      {students
                        .filter((student) => !student.projectId)
                        .map((student) => (
                          <SelectItem key={student.id} value={student.id}>
                            {student.name} ({student.email})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleAddStudentToProject} className="rounded-lg">
                    <Plus className="w-4 h-4 ml-2" />
                    {t("add")}
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold">
                  {language === "ar" ? `أعضاء الفريق الحاليون (${projectTeamMembers.length})` : `Current Team Members (${projectTeamMembers.length})`}
                </h4>
                {projectTeamMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {language === "ar" ? "لا يوجد طلاب في هذا المشروع" : "No students in this project"}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {projectTeamMembers.map((member) => (
                      <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium">{member.name}</p>
                          <p className="text-sm text-muted-foreground">{member.email}</p>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemoveStudentFromProject(member.id)}
                          className="rounded-lg"
                        >
                          <Trash2 className="w-4 h-4 ml-2" />
                          {t("removeStudent")}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsTeamManagementOpen(false)} className="rounded-lg">
                {t("close")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl rounded-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("editProject")}</DialogTitle>
              <DialogDescription>{language === "ar" ? "قم بتحديث بيانات المشروع" : "Update project information"}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">{t("projectTitle")} *</Label>
                <Input
                  id="edit-title"
                  value={selectedProject?.title || ""}
                  onChange={(e) => setSelectedProject({ ...selectedProject, title: e.target.value })}
                  placeholder={language === "ar" ? "أدخل عنوان المشروع" : "Enter project title"}
                  className="rounded-lg"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">{t("projectDescription")} *</Label>
                <Textarea
                  id="edit-description"
                  value={selectedProject?.description || ""}
                  onChange={(e) => setSelectedProject({ ...selectedProject, description: e.target.value })}
                  placeholder={language === "ar" ? "أدخل وصف المشروع" : "Enter project description"}
                  rows={4}
                  className="rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-startDate">{language === "ar" ? "تاريخ بداية المشروع" : "Start Date"}</Label>
                  <Input
                    id="edit-startDate"
                    type="date"
                    value={
                      selectedProject?.startDate
                        ? typeof selectedProject.startDate === "string"
                          ? selectedProject.startDate
                          : new Date(selectedProject.startDate.seconds * 1000).toISOString().split("T")[0]
                        : ""
                    }
                    onChange={(e) => setSelectedProject({ ...selectedProject, startDate: e.target.value })}
                    className="rounded-lg"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-endDate">{language === "ar" ? "تاريخ انتهاء المشروع" : "End Date"}</Label>
                  <Input
                    id="edit-endDate"
                    type="date"
                    value={
                      selectedProject?.endDate
                        ? typeof selectedProject.endDate === "string"
                          ? selectedProject.endDate
                          : new Date(selectedProject.endDate.seconds * 1000).toISOString().split("T")[0]
                        : ""
                    }
                    onChange={(e) => setSelectedProject({ ...selectedProject, endDate: e.target.value })}
                    className="rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-supervisor">{t("supervisors")} *</Label>
                  <Select
                    value={selectedProject?.supervisorId || ""}
                    onValueChange={(value) => setSelectedProject({ ...selectedProject, supervisorId: value })}
                  >
                    <SelectTrigger className="rounded-lg">
                      <SelectValue placeholder={language === "ar" ? "اختر المشرف" : "Select supervisor"} />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg">
                      {supervisors.map((supervisor) => (
                        <SelectItem key={supervisor.id} value={supervisor.id}>
                          {supervisor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-student">{language === "ar" ? "الطالب (اختياري)" : "Student (Optional)"}</Label>
                  <Select
                    value={selectedProject?.studentId || "none"}
                    onValueChange={(value) => setSelectedProject({ ...selectedProject, studentId: value })}
                  >
                    <SelectTrigger className="rounded-lg">
                      <SelectValue placeholder={language === "ar" ? "اختر الطالب" : "Select student"} />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg">
                      <SelectItem value="none">{language === "ar" ? "بدون طالب" : "No student"}</SelectItem>
                      {students.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-department">{t("department")} *</Label>
                <Select
                  value={selectedProject?.department || ""}
                  onValueChange={(value) => setSelectedProject({ ...selectedProject, department: value })}
                >
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder={language === "ar" ? "اختر القسم" : "Select department"} />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.code}>
                        {language === "ar" ? dept.nameAr : dept.nameEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="rounded-lg">
                {t("cancel")}
              </Button>
              <Button onClick={handleUpdateProject} className="rounded-lg" disabled={isUpdating}>
                {isUpdating ? t("loading") : (language === "ar" ? "حفظ التغييرات" : "Save Changes")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="rounded-xl">
            <DialogHeader>
              <DialogTitle>{t("confirmDelete")}</DialogTitle>
              <DialogDescription>
                {language === "ar"
                  ? `هل أنت متأكد من حذف المشروع "${projectToDelete?.title}"؟ هذا الإجراء لا يمكن التراجع عنه.`
                  : `Are you sure you want to delete "${projectToDelete?.title}"? This action cannot be undone.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="rounded-lg">
                {t("cancel")}
              </Button>
              <Button variant="destructive" onClick={handleDeleteProject} className="rounded-lg">
                {language === "ar" ? "حذف المشروع" : "Delete Project"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
