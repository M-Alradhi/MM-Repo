"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { FolderKanban, Check, X, Eye, Plus, Edit, Trash2, Pause, ArchiveIcon, Users } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { collection, getDocs, onSnapshot, doc, updateDoc, addDoc, deleteDoc, Timestamp, query, where, getDoc } from "firebase/firestore"
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
import { createNotification } from "@/lib/firebase/notifications"

export default function CoordinatorProjects() {
  const { t, language } = useLanguage()

  // ✅ Firestore DB must be initialized on client only
  const [db, setDb] = useState<any>(null)

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
  const [isRemoveStudentDialogOpen, setIsRemoveStudentDialogOpen] = useState(false)
  const [studentToRemove, setStudentToRemove] = useState<any>(null)
  const [isRemovingStudent, setIsRemovingStudent] = useState(false)
  const [supervisors, setSupervisors] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({ searchText: "" })
  const [departments, setDepartments] = useState<Department[]>([])
  const [isUpdating, setIsUpdating] = useState(false)
  const [isSupervisorDialogOpen, setIsSupervisorDialogOpen] = useState(false)
  const [supervisorProject, setSupervisorProject] = useState<any>(null)
  const [newSupervisorId, setNewSupervisorId] = useState("")
  const [newCoSupervisorId, setNewCoSupervisorId] = useState("")
  const [isUpdatingSupervisors, setIsUpdatingSupervisors] = useState(false)
  const [newProject, setNewProject] = useState({
    title: "",
    description: "",
    supervisorId: "",
    studentId: "",
    department: "",
    startDate: "",
    endDate: "",
    duration: "one_semester",
    projectType: "system",
    coSupervisorId: "",
  })

  const searchParams = useSearchParams()
  const createFromIdeaId = searchParams.get("createFrom")

  useEffect(() => {
    setDb(getFirebaseDb())
  }, [])

  const fetchProjects = async () => {
    if (!db) return
    try {
      const projectsSnapshot = await getDocs(collection(db, "projects"))
      const projectsData = projectsSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))

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
    if (!db) return
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
    if (!db) return
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
    if (!db) return
    if (!selectedStudentToAdd || !selectedProject) {
      toast.error(t("pleaseSelectStudentMsg"))
      return
    }

    try {
      // ✅ Fix: Fetch fresh student data from Firestore to avoid stale local state
      const freshStudentSnap = await getDoc(doc(db, "users", selectedStudentToAdd))
      const freshStudent = freshStudentSnap.exists() ? freshStudentSnap.data() : null

      if (freshStudent?.projectId) {
        toast.error(t("studentAlreadyHasProjectMsg"))
        return
      }

      await updateDoc(doc(db, "users", selectedStudentToAdd), {
        projectId: selectedProject.id,
        supervisorId: selectedProject.supervisorId || null,
        coSupervisorId: selectedProject.coSupervisorId || null,
        supervisorIds: [
          selectedProject.supervisorId,
          selectedProject.coSupervisorId,
        ].filter(Boolean),
        updatedAt: Timestamp.now(),
      })

      // نضيف الطالب كـ object مثل باقي الأعضاء في الداتا بيس
      const newMemberObject = {
        uid: selectedStudentToAdd,
        userId: selectedStudentToAdd,
        email: freshStudent?.email || "",
        name: freshStudent?.name || "",
        fullName: freshStudent?.name || "",
        role: "member",
        approved: true,
        approvedAt: Timestamp.now(),
      }

      // نجيب fresh data من المشروع
      const freshProjectForAdd = await getDoc(doc(db, "projects", selectedProject.id))
      const freshProjectDataForAdd: any = freshProjectForAdd.exists() ? freshProjectForAdd.data() : {}
      const currentMembers: any[] = freshProjectDataForAdd.teamMembers || []
      const currentStudentIds: any[] = freshProjectDataForAdd.studentIds || []

      // نتأكد إن الطالب مو موجود أصلاً
      const alreadyInMembers = currentMembers.some((m: any) =>
        m === selectedStudentToAdd || m?.uid === selectedStudentToAdd || m?.email === freshStudent?.email
      )

      await updateDoc(doc(db, "projects", selectedProject.id), {
        teamMembers: alreadyInMembers ? currentMembers : [...currentMembers, newMemberObject],
        studentIds: currentStudentIds.includes(selectedStudentToAdd) ? currentStudentIds : [...currentStudentIds, selectedStudentToAdd],
        isTeamProject: true,
        // إذا المشروع ما عنده studentId رئيسي، نحط الجديد
        ...(!freshProjectDataForAdd.studentId && {
          studentId: selectedStudentToAdd,
          studentName: freshStudent?.name || "",
        }),
        updatedAt: Timestamp.now(),
      })

      // نسخ المهام الموجودة للطالب الجديد (حتى يشوفها في صفحة المهام)
      try {
        const existingTasksSnap = await getDocs(
          query(collection(db, "tasks"), where("projectId", "==", selectedProject.id))
        )
        // نجيب المهام الفريدة (بدون تكرار لنفس الطالب الجديد)
        const existingStudentIds = new Set(existingTasksSnap.docs.map((d) => d.data().studentId))
        const templateTasks = existingTasksSnap.docs.filter((d) => {
          const data = d.data()
          return data.studentId !== selectedStudentToAdd && existingStudentIds.size > 0
        })
        // خذ مهمة واحدة من كل عنوان كـ template
        const seenTitles = new Set<string>()
        const uniqueTemplateTasks = templateTasks.filter((d) => {
          const title = d.data().title
          if (seenTitles.has(title)) return false
          seenTitles.add(title)
          return true
        })

        const taskCopyPromises = uniqueTemplateTasks.map((taskDoc) => {
          const taskData = taskDoc.data()
          return addDoc(collection(db, "tasks"), {
            studentId: selectedStudentToAdd,
            studentName: freshStudent?.name || "",
            projectId: selectedProject.id,
            supervisorId: taskData.supervisorId || selectedProject.supervisorId || "",
            supervisorIds: taskData.supervisorIds || [selectedProject.supervisorId].filter(Boolean),
            title: taskData.title,
            description: taskData.description || "",
            maxGrade: taskData.maxGrade,
            weight: taskData.weight,
            dueDate: taskData.dueDate,
            status: "pending",
            createdAt: Timestamp.now(),
            supervisorFiles: taskData.supervisorFiles || [],
          })
        })

        if (taskCopyPromises.length > 0) {
          await Promise.all(taskCopyPromises)
          // إشعار للطالب بالمهام الجديدة
          await createNotification({
            userId: selectedStudentToAdd,
            title: "تمت إضافتك لمشروع",
            message: `تمت إضافتك للمشروع "${selectedProject.title}" وتم تعيين ${taskCopyPromises.length} مهمة لك`,
            type: "project",
            link: "/student/tasks",
          })
        } else {
          // إشعار بدون مهام
          await createNotification({
            userId: selectedStudentToAdd,
            title: "تمت إضافتك لمشروع",
            message: `تمت إضافتك للمشروع "${selectedProject.title}"`,
            type: "project",
            link: "/student/project",
          })
        }
      } catch (taskError) {
        console.error("Error copying tasks to new student:", taskError)
        // لا نوقف العملية — الطالب تمت إضافته للمشروع
      }

      toast.success(t("studentAddedToProjectSuccess"))
      setSelectedStudentToAdd("")
      loadProjectTeamMembers(selectedProject.id)
      fetchSupervisorsAndStudents()
      fetchProjects()
    } catch (error) {
      console.error("Error adding student to project:", error)
      toast.error(t("errorAddingStudentMsg"))
    }
  }

  const handleRemoveStudentFromProject = async () => {
    if (!db || !selectedProject || !studentToRemove) return

    const studentId = studentToRemove.id
    setIsRemovingStudent(true)

    try {
      // 1) مسح كل بيانات المشروع من حساب الطالب بشكل كامل
      await updateDoc(doc(db, "users", studentId), {
        projectId: null,
        supervisorId: null,
        coSupervisorId: null,
        supervisorIds: [],
        updatedAt: Timestamp.now(),
      })

      // 2) إزالة الطالب من teamMembers و studentIds في المشروع (fetch fresh data)
      const freshProjectSnap = await getDoc(doc(db, "projects", selectedProject.id))
      const freshProjectData: any = freshProjectSnap.exists() ? freshProjectSnap.data() : {}
      const studentEmail = studentToRemove.email

      // teamMembers ممكن تكون strings أو objects - نتعامل مع الحالتين
      const currentMembers = (freshProjectData.teamMembers || []).filter((m: any) => {
        if (typeof m === "string") return m !== studentId
        return m.uid !== studentId && m.userId !== studentId && m.email !== studentEmail
      })
      const currentStudentIds = (freshProjectData.studentIds || []).filter((m: any) => {
        if (typeof m === "string") return m !== studentId
        return m.uid !== studentId && m.userId !== studentId && m.email !== studentEmail
      })

      await updateDoc(doc(db, "projects", selectedProject.id), {
        teamMembers: currentMembers,
        studentIds: currentStudentIds,
        isTeamProject: currentMembers.length > 1,
        studentId: freshProjectData.studentId === studentId ? null : freshProjectData.studentId,
        studentName: freshProjectData.studentId === studentId ? "" : freshProjectData.studentName,
        updatedAt: Timestamp.now(),
      })

      // 3) حذف كل مهام الطالب المرتبطة بهذا المشروع
      const tasksSnap = await getDocs(
        query(collection(db, "tasks"), where("studentId", "==", studentId), where("projectId", "==", selectedProject.id))
      )
      await Promise.all(tasksSnap.docs.map((d) => deleteDoc(doc(db, "tasks", d.id))))

      // 4) حذف كل اجتماعات الطالب المرتبطة بهذا المشروع
      const meetingsSnap = await getDocs(
        query(collection(db, "meetings"), where("studentId", "==", studentId), where("projectId", "==", selectedProject.id))
      )
      await Promise.all(meetingsSnap.docs.map((d) => deleteDoc(doc(db, "meetings", d.id))))

      // 5) حذف كل طلبات الاجتماعات المرتبطة بالطالب والمشروع
      const meetReqSnap = await getDocs(
        query(collection(db, "meeting_requests"), where("studentId", "==", studentId), where("projectId", "==", selectedProject.id))
      )
      await Promise.all(meetReqSnap.docs.map((d) => deleteDoc(doc(db, "meeting_requests", d.id))))

      // 6) حذف إشعارات الطالب المرتبطة بهذا المشروع
      const notifSnap = await getDocs(
        query(collection(db, "notifications"), where("userId", "==", studentId), where("projectId", "==", selectedProject.id))
      )
      await Promise.all(notifSnap.docs.map((d) => deleteDoc(doc(db, "notifications", d.id))))

      // 7) حذف projectIdeas الخاصة بالطالب (كـ owner)
      const ideasSnap = await getDocs(
        query(collection(db, "projectIdeas"), where("studentId", "==", studentId))
      )
      await Promise.all(ideasSnap.docs.map((d) => deleteDoc(doc(db, "projectIdeas", d.id))))

      // 8) إزالة الطالب من teamMembers في أي projectIdea فريق
      const teamIdeasSnap = await getDocs(
        query(collection(db, "projectIdeas"), where("isTeamProject", "==", true))
      )
      await Promise.all(
        teamIdeasSnap.docs.map(async (ideaDoc) => {
          const ideaData: any = ideaDoc.data()
          const members: any[] = ideaData.teamMembers || []
          const filtered = members.filter(
            (m: any) => m.uid !== studentId && m.email !== studentToRemove.email
          )
          if (filtered.length !== members.length) {
            await updateDoc(doc(db, "projectIdeas", ideaDoc.id), {
              teamMembers: filtered,
              updatedAt: Timestamp.now(),
            })
          }
        })
      )

      toast.success(language === "ar" ? `تم حذف الطالب "${studentToRemove.name}" من المشروع بنجاح` : `Student "${studentToRemove.name}" removed successfully`)
      setIsRemoveStudentDialogOpen(false)
      setStudentToRemove(null)
      loadProjectTeamMembers(selectedProject.id)
      fetchSupervisorsAndStudents()
      fetchProjects()
    } catch (error) {
      console.error("Error removing student from project:", error)
      toast.error(t("errorRemovingStudentMsg"))
    } finally {
      setIsRemovingStudent(false)
    }
  }

  useEffect(() => {
    if (!db) return

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

    // Real-time projects listener
    const unsubscribe = onSnapshot(collection(db, "projects"), async (snapshot) => {
      try {
        const projectsData = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
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
              return project
            }
          })
        )
        setProjects(updatedProjects)
      } catch (error) {
        console.error("Error in projects listener:", error)
      } finally {
        setLoading(false)
      }
    })

    fetchSupervisorsAndStudents()
    fetchDepartments()
    loadApprovedIdea()

    return () => unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, createFromIdeaId])

  const handleAddProject = async () => {
    if (!db) return
    if (!newProject.title || !newProject.description || !newProject.supervisorId || !newProject.department || !newProject.startDate) {
      toast.error(t("fillRequiredFields"))
      return
    }

    try {
      const supervisor = supervisors.find((s) => s.id === newProject.supervisorId)
      const student = students.find((s) => s.id === newProject.studentId)

      const normalizedStudentId =
        newProject.studentId && newProject.studentId !== "none" ? newProject.studentId : null

      const projectData: any = {
        title: newProject.title,
        description: newProject.description,
        supervisorId: newProject.supervisorId,
        coSupervisorId: newProject.coSupervisorId || null,
        coSupervisorName: newProject.coSupervisorId ? (supervisors.find((s) => s.id === newProject.coSupervisorId)?.name || "") : "",
        coSupervisorEmail: newProject.coSupervisorId ? (supervisors.find((s) => s.id === newProject.coSupervisorId)?.email || "") : "",
        supervisorName: supervisor?.name || "",
        studentId: normalizedStudentId,
        studentName: normalizedStudentId ? (student?.name || "") : "",
        department: newProject.department,
        status: "active",
        progress: 0,
        createdAt: Timestamp.now(),
        startDate: Timestamp.fromDate(new Date(newProject.startDate)),
        duration: newProject.duration || "one_semester",
        projectType: newProject.projectType || "system",
      }

      if (newProject.endDate) {
        projectData.endDate = Timestamp.fromDate(new Date(newProject.endDate))
      }

      const projectRef = await addDoc(collection(db, "projects"), projectData)

      if (normalizedStudentId) {
        await updateDoc(doc(db, "users", normalizedStudentId), {
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
    if (!db) return
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
    if (!db) return
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
    if (!db) return
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
    if (!db) return
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

  const handleCompleteProject = async (projectId: string) => {
    if (!db) return
    try {
      await updateDoc(doc(db, "projects", projectId), {
        status: "completed",
        completedAt: Timestamp.now(),
      })
      toast.success(language === "ar" ? t("projectMarkedCompleted") : "Project marked as completed")
      fetchProjects()
    } catch (error) {
      console.error("Error completing project:", error)
      toast.error(language === "ar" ? t("errorCompletingProject") : "Error completing project")
    }
  }

  // ✅ Bug fix: restore archived project back to active
  const handleRestoreProject = async (projectId: string) => {
    if (!db) return
    try {
      await updateDoc(doc(db, "projects", projectId), {
        status: "active",
        archivedAt: null,
      })
      toast.success(language === "ar" ? t("projectRestoredSuccess") : "Project restored successfully")
      fetchProjects()
    } catch (error) {
      console.error("Error restoring project:", error)
      toast.error(language === "ar" ? t("errorRestoringProjec") : "Error restoring project")
    }
  }

  const handleUpdateSupervisors = async () => {
    if (!db || !supervisorProject) return
    if (!newSupervisorId) {
      toast.error(language === "ar" ? t("pleaseSelectPrimarySupervisor") : "Please select a primary supervisor")
      return
    }
    setIsUpdatingSupervisors(true)
    try {
      const primarySup = supervisors.find((s) => s.id === newSupervisorId)
      const coSup = newCoSupervisorId && newCoSupervisorId !== "none"
        ? supervisors.find((s) => s.id === newCoSupervisorId)
        : null

      await updateDoc(doc(db, "projects", supervisorProject.id), {
        supervisorId: newSupervisorId,
        supervisorName: primarySup?.name || "",
        coSupervisorId: coSup?.id || null,
        coSupervisorName: coSup?.name || "",
        coSupervisorEmail: coSup?.email || "",
        updatedAt: Timestamp.now(),
      })

      const freshSnap = await getDoc(doc(db, "projects", supervisorProject.id))
      const freshData: any = freshSnap.exists() ? freshSnap.data() : {}
      const studentIds: string[] = []
      if (freshData.studentId) studentIds.push(freshData.studentId)
      if (Array.isArray(freshData.studentIds)) {
        freshData.studentIds.forEach((sid: string) => { if (!studentIds.includes(sid)) studentIds.push(sid) })
      }
      if (Array.isArray(freshData.teamMembers)) {
        freshData.teamMembers.forEach((m: any) => {
          const uid = typeof m === "string" ? m : m?.uid || m?.userId
          if (uid && !studentIds.includes(uid)) studentIds.push(uid)
        })
      }

      await Promise.all(
        studentIds.filter(Boolean).map(async (uid) => {
          try {
            await updateDoc(doc(db, "users", uid), {
              supervisorId: newSupervisorId,
              coSupervisorId: coSup?.id || null,
            })
          } catch {}
        })
      )

      toast.success(language === "ar" ? t("supervisorsUpdatedSuccess") : "Supervisors updated successfully")
      setIsSupervisorDialogOpen(false)
      setSupervisorProject(null)
    } catch (error) {
      console.error("Error updating supervisors:", error)
      toast.error(language === "ar" ? t("errorUpdatingSupervisors") : "Error updating supervisors")
    } finally {
      setIsUpdatingSupervisors(false)
    }
  }

  const handleUpdateProject = async () => {
    if (!db) return
    if (!selectedProject || !selectedProject.title) {
      toast.error(t("fillRequiredFields"))
      return
    }

    if (isUpdating) return
    setIsUpdating(true)

    try {
      const supervisor = supervisors.find((s) => s.id === selectedProject.supervisorId)
      const student = students.find((s) => s.id === selectedProject.studentId)

      const normalizedStudentId =
        selectedProject.studentId && selectedProject.studentId !== "none" ? selectedProject.studentId : null

      const updateData: any = {
        title: selectedProject.title,
        description: selectedProject.description || selectedProject.problemStatement || "",
        problemStatement: selectedProject.description || selectedProject.problemStatement || "",
        supervisorId: selectedProject.supervisorId,
        coSupervisorId: selectedProject.coSupervisorId || null,
        coSupervisorName: selectedProject.coSupervisorId ? (supervisors.find((s) => s.id === selectedProject.coSupervisorId)?.name || "") : "",
        coSupervisorEmail: selectedProject.coSupervisorId ? (supervisors.find((s) => s.id === selectedProject.coSupervisorId)?.email || "") : "",
        duration: selectedProject.duration || "one_semester",
        supervisorName: supervisor?.name || "",
        studentId: normalizedStudentId,
        studentName: normalizedStudentId ? (student?.name || "") : "",
        department: selectedProject.department,
        updatedAt: Timestamp.now(),
      }

      if (selectedProject.startDate && typeof selectedProject.startDate === "string") {
        updateData.startDate = Timestamp.fromDate(new Date(selectedProject.startDate))
      } else if (selectedProject.startDate && selectedProject.startDate.seconds) {
        updateData.startDate = selectedProject.startDate
      }

      if (selectedProject.endDate && typeof selectedProject.endDate === "string") {
        updateData.endDate = Timestamp.fromDate(new Date(selectedProject.endDate))
      } else if (selectedProject.endDate && selectedProject.endDate.seconds) {
        // ✅ Fix: preserve existing Timestamp endDate if not modified by user
        updateData.endDate = selectedProject.endDate
      } else if (selectedProject.endDate === "" || selectedProject.endDate === null) {
        // ✅ Allow clearing the end date
        updateData.endDate = null
      }

      await updateDoc(doc(db, "projects", selectedProject.id), updateData)

      const rawTeamMembers = selectedProject.teamMembers || selectedProject.studentIds || []
      const teamMemberIds = (Array.isArray(rawTeamMembers) ? rawTeamMembers : [])
        .map((m: any) => (typeof m === "string" ? m : m?.id || m?.uid || m?.studentId))
        .filter((id: any) => typeof id === "string" && id.trim().length > 0 && id !== "none")

      const allStudentIds = new Set<string>()
      if (normalizedStudentId) allStudentIds.add(normalizedStudentId)
      teamMemberIds.forEach((id: string) => allStudentIds.add(id))

      if (allStudentIds.size > 0 && selectedProject.supervisorId) {
        await Promise.all(
          Array.from(allStudentIds).map(async (sid) => {
            try {
              const userSnap = await getDoc(doc(db, "users", sid))
              if (userSnap.exists()) {
                await updateDoc(doc(db, "users", sid), {
                  supervisorId: selectedProject.supervisorId,
                  projectId: selectedProject.id,
                })
              }
            } catch (err) {
              console.warn(`Skipping user ${sid}: not found in Firestore`)
            }
          }),
        )
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
    if (!db) return
    if (!projectToDelete) return

    try {
      const projectRef = doc(db, "projects", projectToDelete.id)
      const projectId = projectToDelete.id

      const projectSnap = await getDoc(projectRef)
      if (projectSnap.exists()) {
        const projectData: any = projectSnap.data()
        const studentUids: string[] = []
        if (projectData.studentId) studentUids.push(projectData.studentId)
        if (Array.isArray(projectData.studentIds)) studentUids.push(...projectData.studentIds)
        if (Array.isArray(projectData.teamMembers)) studentUids.push(...projectData.teamMembers)

        const normalizedUids = studentUids
          .map((m: any) => (typeof m === "string" ? m : m?.id || m?.uid || m?.studentId))
          .filter((id: any) => typeof id === "string" && id.trim().length > 0 && id !== "none")

        if (normalizedUids.length > 0) {
          await Promise.all(
            [...new Set(normalizedUids)].map((uid) =>
              updateDoc(doc(db, "users", uid), {
                projectId: null,
                supervisorId: null,
                coSupervisorId: null,
                updatedAt: Timestamp.now(),
              }).catch(() => {}),
            ),
          )
        }
      }

      // حذف جميع المهام المرتبطة بالمشروع
      const tasksQuery = query(collection(db, "tasks"), where("projectId", "==", projectId))
      const tasksSnapshot = await getDocs(tasksQuery)
      await Promise.all(tasksSnapshot.docs.map((d) => deleteDoc(doc(db, "tasks", d.id))))

      // حذف جميع الاجتماعات المرتبطة بالمشرو��
      const meetingsQuery = query(collection(db, "meetings"), where("projectId", "==", projectId))
      const meetingsSnapshot = await getDocs(meetingsQuery)
      await Promise.all(meetingsSnapshot.docs.map((d) => deleteDoc(doc(db, "meetings", d.id))))

      // حذف جميع طلبات الاجتماعات المرتبطة بالمشروع
      const meetingRequestsQuery = query(collection(db, "meeting_requests"), where("projectId", "==", projectId))
      const meetingRequestsSnapshot = await getDocs(meetingRequestsQuery)
      await Promise.all(meetingRequestsSnapshot.docs.map((d) => deleteDoc(doc(db, "meeting_requests", d.id))))

      // حذف جميع الإشعارات المرتبطة بالمشروع
      const notificationsQuery = query(collection(db, "notifications"), where("projectId", "==", projectId))
      const notificationsSnapshot = await getDocs(notificationsQuery)
      await Promise.all(notificationsSnapshot.docs.map((d) => deleteDoc(doc(db, "notifications", d.id))))

      // حذف أفكار المشاريع المرتبطة بالطلاب
      if (projectSnap.exists()) {
        const projectData: any = projectSnap.data()
        const studentUids: string[] = []
        if (projectData.studentId) studentUids.push(projectData.studentId)
        if (Array.isArray(projectData.studentIds)) studentUids.push(...projectData.studentIds)
        if (Array.isArray(projectData.teamMembers)) studentUids.push(...projectData.teamMembers)

        const normalizedUids = studentUids
          .map((m: any) => (typeof m === "string" ? m : m?.id || m?.uid || m?.studentId))
          .filter((id: any) => typeof id === "string" && id.trim().length > 0 && id !== "none")

        for (const uid of [...new Set(normalizedUids)]) {
          const ideasQuery = query(collection(db, "projectIdeas"), where("studentId", "==", uid))
          const ideasSnapshot = await getDocs(ideasQuery)
          await Promise.all(ideasSnapshot.docs.map((d) => deleteDoc(doc(db, "projectIdeas", d.id))))
        }

        // حذف أفكار المشاريع المرتبطة بالمشروع مباشرة
        const projectIdeasQuery = query(collection(db, "projectIdeas"), where("projectId", "==", projectId))
        const projectIdeasSnapshot = await getDocs(projectIdeasQuery)
        await Promise.all(projectIdeasSnapshot.docs.map((d) => deleteDoc(doc(db, "projectIdeas", d.id))))
      }

      // حذف المشروع نهائياً من قاعدة البيانات
      await deleteDoc(projectRef)

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
    if (byId)
      return language === "ar"
        ? byId.nameAr || byId.nameEn || byId.code || t("notAssigned")
        : byId.nameEn || byId.nameAr || byId.code || t("notAssigned")

    if (typeof deptValue === "string") {
      const normalized = deptValue.trim().toLowerCase()
      const byCode = departments.find((d) => (d.code || "").trim().toLowerCase() === normalized)
      if (byCode)
        return language === "ar"
          ? byCode.nameAr || byCode.nameEn || byCode.code || t("notAssigned")
          : byCode.nameEn || byCode.nameAr || byCode.code || t("notAssigned")
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
            <CardDescription className="mt-2 line-clamp-3">{project.description || t("noDescription")}</CardDescription>
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

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{language === "ar" ? t("durationLabel") : "Duration"}</span>
            <span className="font-medium">
              {(project.duration === "two_semesters" || project.duration === "two-courses")
                ? (language === "ar" ? t("twoSemestersLabel") : "Two Semesters")
                : (project.duration === "one_semester" || project.duration === "one-course")
                ? (language === "ar" ? t("oneSemesterLabel") : "One Semester")
                : project.duration || (language === "ar" ? t("notSetLabel") : "Not set")}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{language === "ar" ? t("projectTypeLabel") : "Project Type"}</span>
            <span className="font-medium">
              {project.projectType === "system" || !project.projectType ? (language === "ar" ? t("systemLabel") : "System")
                : project.projectType === "research" ? (language === "ar" ? t("researchLabel") : "Research")
                : project.projectType === "cybersecurity" ? (language === "ar" ? t("cybersecurityLabel") : "Cybersecurity")
                : project.projectType === "entrepreneurship" ? (language === "ar" ? t("entrepreneurshipLabel") : "Entrepreneurship")
                : (language === "ar" ? t("systemLabel") : "System")}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("supervisorLabel")}</span>
            <span>{project.supervisorName || t("notAssigned")}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{language === "ar" ? t("coSupervisorColon") : "Co-Supervisor:"}</span>
            <span>{
              project.coSupervisorName ||
              (project.supervisors?.find((s: any) => s.role === "secondary")?.name) ||
              (project.supervisorIds?.length > 1 ? project.supervisors?.[1]?.name : null) ||
              (language === "ar" ? t("noneLabel") : "None")
            }</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("departmentLabel")}</span>
            <span>{getDepartmentName(project.department)}</span>
          </div>

          {project.studentName && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{language === "ar" ? t("leaderColon") : "Leader:"}</span>
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
                    <h4 className="font-semibold mb-2">{language === "ar" ? t("descriptionColon") : "Description:"}</h4>
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

            <Button variant="destructive" size="sm" className="rounded-lg" onClick={() => handleRejectProject(project.id)}>
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


            <Button
              variant="outline"
              size="sm"
              className="flex-1 rounded-lg bg-transparent"
              onClick={() => {
                setSupervisorProject(project)
                setNewSupervisorId(project.supervisorId || "")
                setNewCoSupervisorId(project.coSupervisorId || "none")
                setIsSupervisorDialogOpen(true)
              }}
            >
              <Edit className="w-4 h-4 ml-2" />
              {language === "ar" ? t("changeSupervisors") : "Change Supervisors"}
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

            {project.status === "active" && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 rounded-lg bg-transparent text-green-600 border-green-300 hover:bg-green-50"
                onClick={() => handleCompleteProject(project.id)}
              >
                <Check className="w-4 h-4 ml-2" />
                {language === "ar" ? t("markComplete") : "Mark Complete"}
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

            {project.status === "archived" && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 rounded-lg bg-transparent"
                onClick={() => handleRestoreProject(project.id)}
              >
                <ArchiveIcon className="w-4 h-4 ml-2" />
                {language === "ar" ? t("restoreLabel") : "Restore"}
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
      <div className="p-4 lg:p-8 space-y-6 lg:space-y-8">
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
                  {language === "ar"
                    ? t("enterProjectDetailsAndAssignSupervisorAndStudent")
                    : "Enter project details and assign supervisor and student"}
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">
                      {language === "ar" ? t("projectStartDate") : "Project Start Date *"}
                    </Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={newProject.startDate}
                      onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })}
                      className="rounded-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">
                      {language === "ar" ? t("projectEndDate") : "Project End Date (Optional)"}
                    </Label>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="supervisor">{t("supervisors")} *</Label>
                    <Select
                      value={newProject.supervisorId}
                      onValueChange={(value) => setNewProject({ ...newProject, supervisorId: value })}
                    >
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
                    <Select
                      value={newProject.studentId}
                      onValueChange={(value) => setNewProject({ ...newProject, studentId: value })}
                    >
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
                  <Label>{language === "ar" ? t("coSupervisorOptional") : "Co-Supervisor (Optional)"}</Label>
                  <Select
                    value={newProject.coSupervisorId || "none"}
                    onValueChange={(value) => setNewProject({ ...newProject, coSupervisorId: value === "none" ? "" : value })}
                  >
                    <SelectTrigger className="rounded-lg">
                      <SelectValue placeholder={language === "ar" ? t("selectCoSupervisor") : "Select co-supervisor"} />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg">
                      <SelectItem value="none">{language === "ar" ? t("noCoSupervisor") : "No co-supervisor"}</SelectItem>
                      {supervisors
                        .filter((s) => s.id !== newProject.supervisorId)
                        .map((supervisor) => (
                          <SelectItem key={supervisor.id} value={supervisor.id}>
                            {supervisor.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department">{t("department")} *</Label>
                  <Select
                    value={newProject.department}
                    onValueChange={(value) => setNewProject({ ...newProject, department: value })}
                  >
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

              <div className="space-y-2">
                <Label>{language === "ar" ? t("projectDurationRequired") : "Project Duration *"}</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewProject({ ...newProject, duration: "one_semester" })}
                    className={`h-12 rounded-lg border-2 text-sm font-medium transition-all flex flex-col items-center justify-center gap-0.5 ${newProject.duration === "one_semester" || !newProject.duration ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:border-primary/50"}`}
                  >
                    <span>{language === "ar" ? t("oneSemester") : "One Semester"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewProject({ ...newProject, duration: "two_semesters" })}
                    className={`h-12 rounded-lg border-2 text-sm font-medium transition-all flex flex-col items-center justify-center gap-0.5 ${newProject.duration === "two_semesters" ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:border-primary/50"}`}
                  >
                    <span>{language === "ar" ? t("twoSemesters") : "Two Semesters"}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{language === "ar" ? t("projectTypeRequired") : "Project Type *"}</Label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: "system", labelAr: t("systemLabel"), labelEn: "System" },
                    { value: "research", labelAr: t("researchLabel"), labelEn: "Research" },
                    { value: "cybersecurity", labelAr: t("cybersecurityLabel"), labelEn: "Cybersecurity" },
                    { value: "entrepreneurship", labelAr: t("entrepreneurshipLabel"), labelEn: "Entrepreneurship" },
                  ].map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setNewProject({ ...newProject, projectType: type.value })}
                      className={`h-12 rounded-lg border-2 text-sm font-medium transition-all flex items-center justify-center ${newProject.projectType === type.value ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:border-primary/50"}`}
                    >
                      {language === "ar" ? type.labelAr : type.labelEn}
                    </button>
                  ))}
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
          supervisors={supervisors.map((s) => ({ id: s.id, name: s.name }))}
          students={students.map((s) => ({ id: s.id, name: s.name }))}
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
            <CardContent className="p-4 lg:p-8">
              <p className="text-center text-muted-foreground">{t("loading")}</p>
            </CardContent>
          </Card>
        ) : filteredProjects.length === 0 ? (
          <Card className="rounded-xl">
            <CardContent className="p-4 lg:p-8">
              <div className="text-center space-y-4">
                <FolderKanban className="w-16 h-16 mx-auto text-muted-foreground" />
                <div>
                  <h3 className="text-lg font-semibold">
                    {projects.length === 0
                      ? t("noProjectsCurrently")
                      : language === "ar"
                        ? t("noMatchingResults")
                        : "No matching results"}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    {projects.length === 0
                      ? language === "ar"
                        ? t("startAddingProjects")
                        : "Start by adding new projects"
                      : language === "ar"
                        ? "جرب تعديل معايير البحث"
                        : "Try adjusting search filters"}
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
                  {language === "ar" ? t("noPendingProjects") : "No projects awaiting approval"}
                </p>
              ) : (
                pendingProjects.map((project) => <ProjectCard key={project.id} project={project} />)
              )}
            </TabsContent>

            <TabsContent value="active" className="grid gap-6 md:grid-cols-2">
              {activeProjects.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 col-span-2">
                  {language === "ar" ? t("noActiveProjects") : "No active projects"}
                </p>
              ) : (
                activeProjects.map((project) => <ProjectCard key={project.id} project={project} />)
              )}
            </TabsContent>

            <TabsContent value="completed" className="grid gap-6 md:grid-cols-2">
              {completedProjects.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 col-span-2">
                  {language === "ar" ? t("noCompletedProjects") : "No completed projects"}
                </p>
              ) : (
                completedProjects.map((project) => <ProjectCard key={project.id} project={project} />)
              )}
            </TabsContent>

            <TabsContent value="rejected" className="grid gap-6 md:grid-cols-2">
              {rejectedProjects.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 col-span-2">
                  {language === "ar" ? t("noRejectedProjects") : "No rejected projects"}
                </p>
              ) : (
                rejectedProjects.map((project) => <ProjectCard key={project.id} project={project} />)
              )}
            </TabsContent>

            <TabsContent value="suspended" className="grid gap-6 md:grid-cols-2">
              {suspendedProjects.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 col-span-2">
                  {language === "ar" ? t("noStoppedProjects") : "No stopped projects"}
                </p>
              ) : (
                suspendedProjects.map((project) => <ProjectCard key={project.id} project={project} />)
              )}
            </TabsContent>

            <TabsContent value="archived" className="grid gap-6 md:grid-cols-2">
              {archivedProjects.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 col-span-2">
                  {language === "ar" ? t("noArchivedProjects") : "No archived projects"}
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
              <DialogTitle>{language === "ar" ? t("projectTeamManagement") : "Project Team Management"}</DialogTitle>
              <DialogDescription>
                {language === "ar"
                  ? `إضافة أو حذف طلاب من المشروع: ${selectedProject?.title || ""}`
                  : `Add or remove students from: ${selectedProject?.title || ""}`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="space-y-4">
                <h4 className="font-semibold">{language === "ar" ? t("addNewStudentLabel") : "Add New Student"}</h4>
                <div className="flex gap-2">
                  <Select value={selectedStudentToAdd} onValueChange={setSelectedStudentToAdd}>
                    <SelectTrigger className="flex-1 rounded-lg">
                      <SelectValue placeholder={language === "ar" ? t("selectAStudent") : "Select a student"} />
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
                  {language === "ar"
                    ? `أعضاء الفريق الحاليون (${projectTeamMembers.length})`
                    : `Current Team Members (${projectTeamMembers.length})`}
                </h4>
                {projectTeamMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {language === "ar" ? t("noStudentsInProject") : "No students in this project"}
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
                          onClick={() => {
                            setStudentToRemove(member)
                            setIsRemoveStudentDialogOpen(true)
                          }}
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
              <DialogDescription>{language === "ar" ? t("updateProjectInfo") : "Update project information"}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">{t("projectTitle")} *</Label>
                <Input
                  id="edit-title"
                  value={selectedProject?.title || ""}
                  onChange={(e) => setSelectedProject({ ...selectedProject, title: e.target.value })}
                  placeholder={language === "ar" ? t("enterProjectTitlePlaceholder") : "Enter project title"}
                  className="rounded-lg"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">{t("projectDescription")} *</Label>
                <Textarea
                  id="edit-description"
                  value={selectedProject?.description || selectedProject?.problemStatement || ""}
                  onChange={(e) => setSelectedProject({ ...selectedProject, description: e.target.value })}
                  placeholder={language === "ar" ? t("enterProjectDescPlaceholder") : "Enter project description"}
                  rows={4}
                  className="rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-startDate">{language === "ar" ? t("projectStartDateLabel") : "Start Date"}</Label>
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
                  <Label htmlFor="edit-endDate">{language === "ar" ? t("projectEndDateLabel") : "End Date"}</Label>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-supervisor">{t("supervisors")} *</Label>
                  <Select
                    value={selectedProject?.supervisorId || ""}
                    onValueChange={(value) => setSelectedProject({ ...selectedProject, supervisorId: value })}
                  >
                    <SelectTrigger className="rounded-lg">
                      <SelectValue placeholder={language === "ar" ? t("selectSupervisorLabel") : "Select supervisor"} />
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
                  <Label htmlFor="edit-student">{language === "ar" ? t("studentOptional") : "Student (Optional)"}</Label>
                  <Select
                    value={selectedProject?.studentId || "none"}
                    onValueChange={(value) => setSelectedProject({ ...selectedProject, studentId: value })}
                  >
                    <SelectTrigger className="rounded-lg">
                      <SelectValue placeholder={language === "ar" ? t("selectStudentLabel") : "Select student"} />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg">
                      <SelectItem value="none">{language === "ar" ? t("noStudentLabel") : "No student"}</SelectItem>
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
                <Label>{language === "ar" ? t("coSupervisorOptional") : "Co-Supervisor (Optional)"}</Label>
                <Select
                  value={selectedProject?.coSupervisorId || "none"}
                  onValueChange={(value) => setSelectedProject({ ...selectedProject, coSupervisorId: value === "none" ? null : value })}
                >
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder={language === "ar" ? t("selectCoSupervisor") : "Select co-supervisor"} />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    <SelectItem value="none">{language === "ar" ? t("noCoSupervisor") : "No co-supervisor"}</SelectItem>
                    {supervisors
                      .filter((s) => s.id !== selectedProject?.supervisorId)
                      .map((supervisor) => (
                        <SelectItem key={supervisor.id} value={supervisor.id}>
                          {supervisor.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-department">{t("department")} *</Label>
                <Select
                  value={selectedProject?.department || ""}
                  onValueChange={(value) => setSelectedProject({ ...selectedProject, department: value })}
                >
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder={language === "ar" ? t("selectDepartmentLabel") : "Select department"} />
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

              <div className="space-y-2">
                <Label>{language === "ar" ? t("projectDurationRequired") : "Project Duration *"}</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedProject({ ...selectedProject, duration: "one_semester" })}
                    className={`h-12 rounded-lg border-2 text-sm font-medium transition-all flex flex-col items-center justify-center gap-0.5 ${!selectedProject?.duration || selectedProject?.duration === "one_semester" ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:border-primary/50"}`}
                  >
                    <span>{language === "ar" ? t("oneSemesterLabel") : "One Semester"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedProject({ ...selectedProject, duration: "two_semesters" })}
                    className={`h-12 rounded-lg border-2 text-sm font-medium transition-all flex flex-col items-center justify-center gap-0.5 ${selectedProject?.duration === "two_semesters" ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:border-primary/50"}`}
                  >
                    <span>{language === "ar" ? t("twoSemestersLabel") : "Two Semesters"}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
                <Label>{language === "ar" ? t("projectTypeRequired") : "Project Type *"}</Label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: "system", labelAr: t("systemLabel"), labelEn: "System" },
                    { value: "research", labelAr: t("researchLabel"), labelEn: "Research" },
                    { value: "cybersecurity", labelAr: t("cybersecurityLabel"), labelEn: "Cybersecurity" },
                    { value: "entrepreneurship", labelAr: t("entrepreneurshipLabel"), labelEn: "Entrepreneurship" },
                  ].map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setSelectedProject({ ...selectedProject, projectType: type.value })}
                      className={`h-12 rounded-lg border-2 text-sm font-medium transition-all flex items-center justify-center ${(selectedProject?.projectType || "system") === type.value ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:border-primary/50"}`}
                    >
                      {language === "ar" ? type.labelAr : type.labelEn}
                    </button>
                  ))}
                </div>
              </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="rounded-lg">
                {t("cancel")}
              </Button>
              <Button onClick={handleUpdateProject} className="rounded-lg" disabled={isUpdating}>
                {isUpdating ? t("loading") : language === "ar" ? t("saveChangesLabel") : "Save Changes"}
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
                {language === "ar" ? t("deleteProjectLabel") : "Delete Project"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Supervisor Management Dialog */}
        <Dialog open={isSupervisorDialogOpen} onOpenChange={(open) => {
          if (!isUpdatingSupervisors) {
            setIsSupervisorDialogOpen(open)
            if (!open) setSupervisorProject(null)
          }
        }}>
          <DialogContent className="max-w-lg rounded-xl">
            <DialogHeader>
              <DialogTitle>{language === "ar" ? t("changeSupervisors") : "Change Supervisors"}</DialogTitle>
              <DialogDescription>
                {language === "ar"
                  ? `تغيير مشرفي المشروع: ${supervisorProject?.title || ""}`
                  : `Update supervisors for: ${supervisorProject?.title || ""}`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{language === "ar" ? t("primarySupervisorRequired") : "Primary Supervisor *"}</Label>
                <Select value={newSupervisorId} onValueChange={setNewSupervisorId}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder={language === "ar" ? t("selectPrimarySupervisor") : "Select primary supervisor"} />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    {supervisors.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{language === "ar" ? t("coSupervisorOptional") : "Co-Supervisor (Optional)"}</Label>
                <Select value={newCoSupervisorId || "none"} onValueChange={setNewCoSupervisorId}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder={language === "ar" ? t("selectCoSupervisor") : "Select co-supervisor"} />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    <SelectItem value="none">{language === "ar" ? t("noCoSupervisor") : "No co-supervisor"}</SelectItem>
                    {supervisors
                      .filter((s) => s.id !== newSupervisorId)
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => { setIsSupervisorDialogOpen(false); setSupervisorProject(null) }}
                disabled={isUpdatingSupervisors}
                className="rounded-lg"
              >
                {language === "ar" ? t("cancel") : "Cancel"}
              </Button>
              <Button
                onClick={handleUpdateSupervisors}
                disabled={isUpdatingSupervisors}
                className="rounded-lg"
              >
                {isUpdatingSupervisors
                  ? (language === "ar" ? t("savingLabel") : "Saving...")
                  : (language === "ar" ? t("saveChangesLabel") : "Save Changes")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Remove Student Confirmation Dialog */}
        <Dialog open={isRemoveStudentDialogOpen} onOpenChange={(open) => {
          if (!isRemovingStudent) {
            setIsRemoveStudentDialogOpen(open)
            if (!open) setStudentToRemove(null)
          }
        }}>
          <DialogContent className="rounded-xl max-w-md">
            <DialogHeader>
              <DialogTitle className="text-destructive">
                {language === "ar" ? t("confirmRemoveStudent") : "⚠️ Confirm Remove Student"}
              </DialogTitle>
              <DialogDescription className="text-base pt-2">
                {language === "ar"
                  ? `هل أنت متأكد من حذف الطالب "${studentToRemove?.name}" من المشروع؟`
                  : `Are you sure you want to remove "${studentToRemove?.name}" from the project?`}
              </DialogDescription>
            </DialogHeader>
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive space-y-1">
              <p className="font-semibold">{language === "ar" ? t("permanentlyDeleted") : "The following will be permanently deleted:"}</p>
              <ul className="list-disc list-inside space-y-0.5 text-destructive/80">
                <li>{language === "ar" ? t("allStudentTasks") : "All student tasks in this project"}</li>
                <li>{language === "ar" ? t("allStudentMeetings") : "All meetings related to the student"}</li>
                <li>{language === "ar" ? t("allMeetingRequests") : "All meeting requests"}</li>
                <li>{language === "ar" ? t("allStudentNotifications") : "All student notifications"}</li>
              </ul>
              <p className="font-semibold pt-1">{language === "ar" ? t("cannotBeUndone") : "This action cannot be undone!"}</p>
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => { setIsRemoveStudentDialogOpen(false); setStudentToRemove(null) }}
                disabled={isRemovingStudent}
                className="rounded-lg"
              >
                {language === "ar" ? t("cancel") : "Cancel"}
              </Button>
              <Button
                variant="destructive"
                onClick={handleRemoveStudentFromProject}
                disabled={isRemovingStudent}
                className="rounded-lg"
              >
                {isRemovingStudent
                  ? (language === "ar" ? t("removingLabel") : "Removing...")
                  : (language === "ar" ? t("yesRemoveStudent") : "Yes, Remove Student")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
