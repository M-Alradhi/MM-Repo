"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { coordinatorSidebarItems } from "@/lib/constants/coordinator-sidebar"
import { useAuth } from "@/lib/contexts/auth-context"
import { useLanguage } from "@/lib/contexts/language-context"
import { useEffect, useState } from "react"
import { getFirebaseDb } from "@/lib/firebase/config"
import {
  collection,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  addDoc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
  Timestamp,
} from "firebase/firestore"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Lightbulb, CheckCircle2, XCircle, Eye, Loader2, AlertCircle, UsersIcon, UserPlus, X } from "lucide-react"
import { notifyProjectApproved, notifyProjectRejected } from "@/lib/utils/notification-helper"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function ApproveProjects() {
  const [projectIdeas, setProjectIdeas] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([]) // ✅ NEW
  const [loading, setLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState<any>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false)
  const [isCreateProjectDialogOpen, setIsCreateProjectDialogOpen] = useState(false)
  const [isTeamFormationDialogOpen, setIsTeamFormationDialogOpen] = useState(false)
  const [supervisors, setSupervisors] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [newProject, setNewProject] = useState({
    supervisorIds: [] as string[],
    startDate: "",
    endDate: "",
  })
  const [rejectionReason, setRejectionReason] = useState("")
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [isSavingTeam, setIsSavingTeam] = useState(false)
  const { userData } = useAuth()
  const { t, language } = useLanguage()

  // ✅ Convert stored department value => name (based on current language)
  const getDepartmentName = (deptValue: any) => {
    if (!deptValue) return t("notSpecified")

    // Legacy support: cs / it / is
    const legacyMapAr: Record<string, string> = {
      cs: "علوم الحاسب",
      it: "تقنية المعلومات",
      is: "نظم المعلومات",
    }
    const legacyMapEn: Record<string, string> = {
      cs: "Computer Science",
      it: "Information Technology",
      is: "Information Systems",
    }

    if (typeof deptValue === "string") {
      const k = deptValue.toLowerCase()
      if (legacyMapAr[k] || legacyMapEn[k]) {
        return language === "ar" ? legacyMapAr[k] : legacyMapEn[k]
      }
    }

    const byId = departments.find((d) => d.id === deptValue)
    if (byId) {
      return (language === "ar" ? byId.nameAr : byId.nameEn) || byId.nameEn || byId.nameAr || byId.code || t("notSpecified")
    }

    if (typeof deptValue === "string") {
      const normalized = deptValue.trim().toLowerCase()
      const byCode = departments.find((d) => (d.code || "").trim().toLowerCase() === normalized)
      if (byCode) {
        return (language === "ar" ? byCode.nameAr : byCode.nameEn) || byCode.nameEn || byCode.nameAr || byCode.code || t("notSpecified")
      }
      if (deptValue.trim().length > 0) return deptValue
    }

    return t("notSpecified")
  }

  const fetchProjects = async () => {
    try {
      setLoading(true)
      const ideasSnapshot = await getDocs(collection(getFirebaseDb(), "projectIdeas"))
      const ideasData = ideasSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      setProjectIdeas(ideasData)
    } catch (error) {
      console.error("Error fetching project ideas:", error)
      toast.error(t("errorLoadingProjectIdeasMsg"))
    } finally {
      setLoading(false)
    }
  }

  const fetchDepartments = async () => {
    try {
      const db = getFirebaseDb()
      const qDepts = query(collection(db, "departments"), where("isActive", "==", true))
      const snap = await getDocs(qDepts)
      setDepartments(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    } catch (e) {
      console.error("Error fetching departments:", e)
    }
  }

  const fetchSupervisors = async () => {
    try {
      const supervisorsQuery = query(collection(getFirebaseDb(), "users"), where("role", "==", "supervisor"))
      const supervisorsSnapshot = await getDocs(supervisorsQuery)
      setSupervisors(supervisorsSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })))
    } catch (error) {
      console.error("Error fetching supervisors:", error)
    }
  }

  const fetchStudents = async () => {
    try {
      const studentsQuery = query(collection(getFirebaseDb(), "users"), where("role", "==", "student"))
      const studentsSnapshot = await getDocs(studentsQuery)
      const studentsData = studentsSnapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .filter((student) => (student as any).name)
      setStudents(studentsData)
    } catch (error) {
      console.error("Error fetching students:", error)
    }
  }

  useEffect(() => {
    const db = getFirebaseDb()

    fetchDepartments()
    fetchSupervisors()
    fetchStudents()

    // Real-time: project ideas
    const unsubIdeas = onSnapshot(collection(db, "projectIdeas"), (snap) => {
      const ideasData = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setProjectIdeas(ideasData)
      setLoading(false)
    })

    // Real-time: supervisors & students for dropdowns
    const unsubSup = onSnapshot(
      query(collection(db, "users"), where("role", "==", "supervisor")),
      (snap) => setSupervisors(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    )
    const unsubStu = onSnapshot(
      query(collection(db, "users"), where("role", "==", "student")),
      (snap) => setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((s: any) => s.name))
    )

    return () => { unsubIdeas(); unsubSup(); unsubStu() }
  }, [])

  const handleTeamFormationClick = (project: any) => {
    setSelectedProject(project)
    setTeamMembers([
      {
        userId: project.studentId,
        name: project.studentName,
        email: project.studentEmail,
        studentId: project.studentEmail,
        role: "leader",
      },
    ])
    setIsTeamFormationDialogOpen(true)
  }

  const handleAddTeamMember = (studentId: string) => {
    const student = students.find((s) => s.id === studentId)
    if (!student) return

    if (teamMembers.some((m) => m.userId === studentId)) {
      toast.error(t("studentAlreadyInTeamMsg"))
      return
    }

    // ✅ Bug fix: warn but allow - coordinator decides, student may be in old/different project
    if (student.projectId) {
      toast.warning(language === "ar"
        ? `تنبيه: هذا الطالب لديه مشروع آخر (${student.projectId}). سيتم إضافته على مسؤوليتك.`
        : `Warning: This student has another project. Adding anyway.`)
    }

    setTeamMembers([
      ...teamMembers,
      {
        userId: student.id,
        name: student.name,
        email: student.email,
        studentId: student.studentId || student.email,
        role: "member",
      },
    ])
  }

  const handleRemoveTeamMember = (userId: string) => {
    if (teamMembers.find((m) => m.userId === userId)?.role === "leader") {
      toast.error(t("cannotRemoveLeaderMsg"))
      return
    }
    setTeamMembers(teamMembers.filter((m) => m.userId !== userId))
  }

  const handleSaveTeamFormation = async () => {
    if (!selectedProject || teamMembers.length < 2) {
      toast.error(t("teamMustHaveAtLeastTwoMsg"))
      return
    }

    try {
      setIsSavingTeam(true)
      const db = getFirebaseDb()

      const teamMembersData = teamMembers.map((member) => ({
        userId: member.userId,
        name: member.name,
        email: member.email,
        studentId: member.studentId,
        role: member.role,
        approved: member.role === "leader",
        approvedAt: member.role === "leader" ? Timestamp.now() : null,
      }))

      await updateDoc(doc(db, "projectIdeas", selectedProject.id), {
        teamMembers: teamMembersData,
        teamStatus: "pending_approval",
        isTeamProject: true,
        status: "pending_team_approval",
      })

      const { createBatchNotifications } = await import("@/lib/firebase/notifications")

      const memberNotifications = teamMembersData
        .filter((member) => member.role !== "leader")
        .map((member) => ({
          userId: member.userId,
          title: t("teamInviteTitle"),
          message: t("teamInviteMsg").replace("{projectTitle}", selectedProject.title),
          type: "info" as const,
          link: "/student/project/team-approval",
          priority: "high" as const,
          category: "project" as const,
        }))

      if (memberNotifications.length > 0) {
        await createBatchNotifications(memberNotifications)
      }

      toast.success(t("teamFormedSuccessMsg"))
      setIsTeamFormationDialogOpen(false)
      setSelectedProject(null)
      setTeamMembers([])
    } catch (error) {
      console.error("Error saving team formation:", error)
      toast.error(t("errorSavingTeamMsg"))
    } finally {
      setIsSavingTeam(false)
    }
  }

  const handleApproveClick = (project: any) => {
    setSelectedProject(project)
    setNewProject({
      supervisorIds: [],
      startDate: "",
      endDate: "",
    })
    setIsCreateProjectDialogOpen(true)
  }

  const handleCreateProject = async () => {
    if (!selectedProject || newProject.supervisorIds.length === 0 || !newProject.startDate) {
      toast.error(t("fillRequiredFieldsAtLeastOneSupervisorMsg"))
      return
    }

    if (!selectedProject.teamMembers || selectedProject.teamMembers.length < 2) {
      toast.error(t("teamMustBeFormedFirstMsg"))
      return
    }

    const allApproved = selectedProject.teamMembers?.every((member: any) => member.approved)
    if (!allApproved) {
      toast.error(t("cannotApproveUntilAllMembersApproveMsg"))
      return
    }

    try {
      setIsApproving(true)
      const db = getFirebaseDb()

      await updateDoc(doc(db, "projectIdeas", selectedProject.id), {
        status: "approved",
        approvedAt: serverTimestamp(),
        approvedBy: userData?.uid,
      })

      // ✅ Fix: preserve the order of supervisorIds (first = primary, rest = secondary)
      const selectedSupervisors = newProject.supervisorIds
        .map((id: string) => supervisors.find((s) => s.id === id))
        .filter(Boolean)
      const primarySupervisor = selectedSupervisors[0]

      const projectData: any = {
        title: selectedProject.title || t("untitledProject"),
        description: selectedProject.description || selectedProject.problemStatement || "",
        supervisorId: primarySupervisor?.id || "",
        supervisorName: primarySupervisor?.name || "",
        supervisorIds: newProject.supervisorIds || [],
        supervisors: selectedSupervisors.map((sup, index) => ({
          userId: sup.id || "",
          name: sup.name || "",
          email: sup.email || "",
          role: index === 0 ? "primary" : "secondary",
          assignedAt: Timestamp.now(),
        })),
        studentId: selectedProject.studentId || "",
        studentName: selectedProject.studentName || "",
        isTeamProject: true,
        studentIds: [], // ✅ Will be updated after resolving member IDs below
        teamMembers: (selectedProject.teamMembers || []).map((m: any) => ({
          userId: m.userId || "",
          name: m.name || "",
          email: m.email || "",
          studentId: m.studentId || "",
          role: m.role || "member",
          approved: m.approved || false,
          approvedAt: m.approvedAt || null,
        })),
        department: selectedProject.department || "",
        status: "active",
        progress: 0,
        createdAt: Timestamp.now(),
        startDate: Timestamp.fromDate(new Date(newProject.startDate)),
        projectType: selectedProject.projectType || "system",
        duration: selectedProject.duration || "",
        coSupervisorId: newProject.supervisorIds.length > 1 ? newProject.supervisorIds[1] : null,
        coSupervisorName: newProject.supervisorIds.length > 1 ? (supervisors.find((s: any) => s.id === newProject.supervisorIds[1])?.name || selectedProject.coSupervisorName || "") : "",
        coSupervisorEmail: newProject.supervisorIds.length > 1 ? (supervisors.find((s: any) => s.id === newProject.supervisorIds[1])?.email || selectedProject.coSupervisorEmail || "") : "",
      }

      if (newProject.endDate) {
        projectData.endDate = Timestamp.fromDate(new Date(newProject.endDate))
      }

      const projectRef = await addDoc(collection(db, "projects"), projectData)

      // ✅ Resolve userId for each member and assign project + supervisor
      const resolvedMemberIds: { userId: string; name: string }[] = []
      const processedUids = new Set<string>()

      const resolveAndAssign = async (member: any) => {
        let resolvedId: string | null = member.userId || null

        // 1️⃣ Already have userId — verify it exists
        if (resolvedId) {
          try {
            const userSnap = await getDoc(doc(db, "users", resolvedId))
            if (!userSnap.exists()) resolvedId = null
          } catch { resolvedId = null }
        }

        // 2️⃣ Try by email (most reliable for members)
        if (!resolvedId && member.email) {
          const emailSnap = await getDocs(query(
            collection(db, "users"),
            where("email", "==", member.email),
            where("role", "==", "student"),
          ))
          if (!emailSnap.empty) resolvedId = emailSnap.docs[0].id
        }

        // 3️⃣ Try by studentId number
        if (!resolvedId && member.studentId) {
          const sidSnap = await getDocs(query(
            collection(db, "users"),
            where("studentId", "==", member.studentId),
            where("role", "==", "student"),
          ))
          if (!sidSnap.empty) resolvedId = sidSnap.docs[0].id
        }

        if (resolvedId && !processedUids.has(resolvedId)) {
          processedUids.add(resolvedId)
          resolvedMemberIds.push({ userId: resolvedId, name: member.name || member.fullName || "" })
          await updateDoc(doc(db, "users", resolvedId), {
            supervisorId: primarySupervisor.id,
            supervisorIds: newProject.supervisorIds || [primarySupervisor.id],
            projectId: projectRef.id,
          })
        }
      }

      // Process all team members
      for (const member of selectedProject.teamMembers) {
        await resolveAndAssign(member)
      }

      // ✅ Always ensure the leader (idea submitter) is included — use selectedProject.studentId (their Firebase UID)
      if (selectedProject.studentId && !processedUids.has(selectedProject.studentId)) {
        try {
          await updateDoc(doc(db, "users", selectedProject.studentId), {
            supervisorId: primarySupervisor.id,
            supervisorIds: newProject.supervisorIds || [primarySupervisor.id],
            projectId: projectRef.id,
          })
          resolvedMemberIds.push({ userId: selectedProject.studentId, name: selectedProject.studentName || "" })
          processedUids.add(selectedProject.studentId)
        } catch (e) {
          console.warn("Could not update leader user doc:", e)
        }
      }

      // ✅ Now update the project with the resolved studentIds
      await updateDoc(doc(db, "projects", projectRef.id), {
        studentIds: resolvedMemberIds.map((m) => m.userId),
      })

      await updateDoc(doc(db, "projectIdeas", selectedProject.id), {
        supervisorId: primarySupervisor.id,
        supervisorIds: newProject.supervisorIds,
        projectId: projectRef.id,
      })

      for (const { userId } of resolvedMemberIds) {
        await notifyProjectApproved(
          userId,
          selectedProject.title,
          selectedSupervisors.map((s) => s.name).join(", "),
        )
      }

      toast.success(t("projectApprovedCreatedSuccessMsg"))
      setIsCreateProjectDialogOpen(false)
      setSelectedProject(null)
      setNewProject({
        supervisorIds: [],
        startDate: "",
        endDate: "",
      })
    } catch (error) {
      console.error("Error creating project:", error)
      toast.error(t("errorCreatingProjectMsg"))
    } finally {
      setIsApproving(false)
    }
  }

  const handleReject = async () => {
    if (!selectedProject || !rejectionReason.trim()) {
      toast.error(t("enterRejectionReasonMsg"))
      return
    }

    try {
      setIsRejecting(true)
      const db = getFirebaseDb()

      await updateDoc(doc(db, "projectIdeas", selectedProject.id), {
        status: "rejected",
        rejectedAt: serverTimestamp(),
        rejectedBy: userData?.uid,
        rejectionReason: rejectionReason,
      })

      await notifyProjectRejected(selectedProject.studentId, selectedProject.title, rejectionReason)

      toast.success(t("projectIdeaRejectedMsg"))
      setIsRejectDialogOpen(false)
      setSelectedProject(null)
      setRejectionReason("")
    } catch (error) {
      console.error("Error rejecting project:", error)
      toast.error(t("errorRejectingProjectMsg"))
    } finally {
      setIsRejecting(false)
    }
  }

  const pendingProjects = projectIdeas.filter((project) => project.status === "pending")
  const approvedProjects = projectIdeas.filter((project) => project.status === "approved")
  const rejectedProjects = projectIdeas.filter((project) => project.status === "rejected")

  const ProjectCard = ({ project }: { project: any }) => (
    <Card className="rounded-xl hover:shadow-lg transition-all duration-300 h-full flex flex-col">
      <CardHeader className="space-y-3 text-center">

        <div className="flex justify-center">
          <Lightbulb className="w-6 h-6 text-amber-500" />
        </div>

        <CardTitle className="text-lg text-center leading-relaxed">
          {project.title || t("untitledIdea")}
        </CardTitle>

        <div className="flex flex-col items-center gap-1">
          <Badge
            variant={
              project.status === "pending"
                ? "outline"
                : project.status === "approved"
                ? "default"
                : "destructive"
            }
            className="rounded-lg px-3 py-1"
          >
            {project.status === "pending"
              ? t("underReview")
              : project.status === "approved"
              ? t("approved")
              : t("rejected")}
          </Badge>

          <Badge variant="secondary" className="rounded-lg px-3 py-1 flex items-center gap-1">
            <UsersIcon className="w-3 h-3" />
            {t("teamProject")}
          </Badge>
        </div>

        <CardDescription
          className="text-start max-h-12 overflow-y-auto pr-1"
        >
          {project.problemStatement || project.description || t("noDescription")}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
        <div className="grid gap-2 text-sm">
          <div className="space-y-2">
            <span className="text-muted-foreground font-medium">{t("teamStatus")}:</span>
            {project.teamStatus === "pending_formation" ? (
              <Badge variant="outline" className="text-xs">
                {t("waitingTeamFormation")}
              </Badge>
            ) : project.teamMembers && project.teamMembers.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-1">
                  {project.teamMembers.map((member: any, index: number) => (
                    <Badge key={index} variant={member.approved ? "default" : "secondary"} className="text-xs">
                      {member.fullName || member.name || member.email || t("member")}
                      {member.role === "leader" && ` (${t("leader")})`}
                      {!member.approved && ` (${t("notApprovedYet")})`}
                    </Badge>
                  ))}
                </div>
                {!project.teamMembers.every((m: any) => m.approved) && (
                  <div className="flex items-center gap-2 text-amber-600 text-xs">
                    <AlertCircle className="w-3 h-3" />
                    <span>{t("waitingSomeMembersApproval")}</span>
                  </div>
                )}
              </>
            ) : (
              <Badge variant="outline" className="text-xs">
                {t("teamNotFormed")}
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("ideaSubmittedBy")}:</span>
            <span className="font-medium">{project.studentName || t("notAssigned")}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("department")}:</span>
            <span className="font-medium">{getDepartmentName(project.department)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("projectOption")}:</span>
            <span className="font-medium">
            {(project.projectType || project.type) === "system" ? (language === "ar" ? t("systemLabel") : "System") : (project.projectType || project.type) === "research" ? (language === "ar" ?  t("researchLabel") : "Research") : (project.projectType || project.type) === "entrepreneurship" ? t("entrepreneurship") : (project.projectType || project.type) === "cybersecurity" ? t("cybersecurity") : (project.projectType || project.type) === "one-course" ? (language === "ar" ? t("oneSemesterLabel") : "One Semester") : (project.projectType || project.type) === "two-courses" ? (language === "ar" ? t("twoSemestersLabel") : "Two Semesters") : (project.projectType || project.type) || "—"}
            </span>
          </div>

          {project.duration && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{language === "ar" ? t("durationLabel") : "Duration"}:</span>
              <span className="font-medium">
                {project.duration === "one-course" ? (language === "ar" ? t("oneSemesterLabel") : "One Semester")
                  : project.duration === "two-courses" ? (language === "ar" ? t("twoSemestersLabel") : "Two Semesters")
                  : project.duration}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("submittedAt")}:</span>
            <span className="font-medium">
              {project.submittedAt
                ? new Date(project.submittedAt.seconds * 1000).toLocaleDateString(language === "ar" ? "ar-EG" : "en-US")
                : t("notAssigned")}
            </span>
          </div>
        </div>

        {project.status === "pending" && (
          <div className="flex gap-2 pt-4 border-t flex-wrap">
            {project.teamStatus === "pending_formation" && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 rounded-lg bg-transparent"
                onClick={() => handleTeamFormationClick(project)}
              >
                <UserPlus className="w-4 h-4 ml-2" />
                {t("formTeam")}
              </Button>
            )}

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

            <Button
              size="sm"
              onClick={() => handleApproveClick(project)}
              className="flex-1 rounded-lg"
              disabled={isApproving || project.teamStatus === "pending_formation"}
            >
              <CheckCircle2 className="w-4 h-4 ml-2" />
              {t("approve")}
            </Button>

            <Button
              variant="destructive"
              size="sm"
              className="flex-1 rounded-lg"
              onClick={() => {
                setSelectedProject(project)
                setIsRejectDialogOpen(true)
              }}
            >
              <XCircle className="w-4 h-4 ml-2" />
              {t("reject")}
            </Button>
          </div>
        )}

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

  return (
    <DashboardLayout sidebarItems={coordinatorSidebarItems} requiredRole="coordinator">
      <div className="p-4 lg:p-8 space-y-6 lg:space-y-8 animate-in fade-in duration-500">
        <div className="animate-in slide-in-from-top duration-700">
          <h1 className="text-4xl font-bold bg-gradient-to-l from-primary to-primary/60 bg-clip-text text-transparent">
            {t("approveRejectProjectIdeasTitle")}
          </h1>
          <p className="text-muted-foreground mt-2">{t("approveRejectProjectIdeasDesc")}</p>
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
              <Card className="border-2 border-amber-200 dark:border-amber-900 bg-gradient-to-br from-amber-50/50 to-background dark:from-amber-950/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    {t("underReview")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-amber-600 dark:text-amber-400">{pendingProjects.length}</div>
                  <p className="text-sm text-muted-foreground mt-1">{t("ideasWaitingDecision")}</p>
                </CardContent>
              </Card>

              <Card className="border-2 border-green-200 dark:border-green-900 bg-gradient-to-br from-green-50/50 to-background dark:from-green-950/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    {t("approvedPlural")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-green-600 dark:text-green-400">{approvedProjects.length}</div>
                  <p className="text-sm text-muted-foreground mt-1">{t("ideasApproved")}</p>
                </CardContent>
              </Card>

              <Card className="border-2 border-red-200 dark:border-red-900 bg-gradient-to-br from-red-50/50 to-background dark:from-red-950/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    </div>
                    {t("rejectedPlural")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-red-600 dark:text-red-400">{rejectedProjects.length}</div>
                  <p className="text-sm text-muted-foreground mt-1">{t("ideasRejected")}</p>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="pending" className="w-full">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 text-xs sm:text-sm">
                <TabsTrigger value="pending" className="gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {t("underReview")} ({pendingProjects.length})
                </TabsTrigger>
                <TabsTrigger value="approved" className="gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  {t("approvedPlural")} ({approvedProjects.length})
                </TabsTrigger>
                <TabsTrigger value="rejected" className="gap-2">
                  <XCircle className="w-4 h-4" />
                  {t("rejectedPlural")} ({rejectedProjects.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending" className="mt-6">
                {pendingProjects.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                      <Lightbulb className="w-16 h-16 text-muted-foreground/50 mb-4" />
                      <h3 className="text-xl font-semibold mb-2">{t("noIdeasUnderReview")}</h3>
                      <p className="text-sm text-muted-foreground">{t("allIdeasReviewed")}</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {pendingProjects.map((project, index) => (
                      <div
                        key={project.id}
                        className="animate-in fade-in slide-in-from-bottom duration-500"
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <ProjectCard project={project} />
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="approved" className="mt-6">
                {approvedProjects.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                      <CheckCircle2 className="w-16 h-16 text-muted-foreground/50 mb-4" />
                      <h3 className="text-xl font-semibold mb-2">{t("noApprovedIdeas")}</h3>
                      <p className="text-sm text-muted-foreground">{t("noIdeaApprovedYet")}</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {approvedProjects.map((project, index) => (
                      <div
                        key={project.id}
                        className="animate-in fade-in slide-in-from-bottom duration-500"
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <ProjectCard project={project} />
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="rejected" className="mt-6">
                {rejectedProjects.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                      <XCircle className="w-16 h-16 text-muted-foreground/50 mb-4" />
                      <h3 className="text-xl font-semibold mb-2">{t("noRejectedIdeas")}</h3>
                      <p className="text-sm text-muted-foreground">{t("noIdeaRejectedYet")}</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {rejectedProjects.map((project, index) => (
                      <div
                        key={project.id}
                        className="animate-in fade-in slide-in-from-bottom duration-500"
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <ProjectCard project={project} />
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl rounded-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <Lightbulb className="w-6 h-6 text-amber-500" />
              {selectedProject?.title}
            </DialogTitle>
            <DialogDescription>{t("projectIdeaDetailsDesc")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">

            {/* Basic Info Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">{t("department")}</p>
                <p className="font-semibold text-sm">{getDepartmentName(selectedProject?.department)}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">{t("projectOption")}</p>
                <p className="font-semibold text-sm">{
                  (selectedProject?.projectType || selectedProject?.type) === "system" ? (language === "ar" ? t("systemLabel") : "System")
                  : (selectedProject?.projectType || selectedProject?.type) === "research" ? (language === "ar" ? t("researchLabel") : "Research")
                  : (selectedProject?.projectType || selectedProject?.type) === "entrepreneurship" ? t("entrepreneurship")
                  : (selectedProject?.projectType || selectedProject?.type) === "cybersecurity" ? t("cybersecurity")
                  : (selectedProject?.projectType || selectedProject?.type) === "one-course" ? (language === "ar" ? t("oneSemesterLabel") : "One Semester")
                  : (selectedProject?.projectType || selectedProject?.type) === "two-courses" ? (language === "ar" ? t("twoSemestersLabel") : "Two Semesters")
                  : (selectedProject?.projectType || selectedProject?.type) || "—"
                }</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">{language === "ar" ? t("durationLabel") : "Duration"}</p>
                <p className="font-semibold text-sm">{
                  selectedProject?.duration === "one-course" ? (language === "ar" ? t("oneSemesterLabel") : "One Semester")
                  : selectedProject?.duration === "two-courses" ? (language === "ar" ? t("twoSemestersLabel") : "Two Semesters")
                  : selectedProject?.duration || "—"
                }</p>
              </div>
              {selectedProject?.semester && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">{t("semester")}</p>
                  <p className="font-semibold text-sm">
                    {selectedProject.semester === "fall"
                      ? (language === "ar" ? t("firstSemesterLabel") : "First Semester")
                      : selectedProject.semester === "spring"
                      ? (language === "ar" ? t("secondSemesterLabel") : "Second Semester")
                      : selectedProject.semester}
                  </p>
                </div>
              )}
              {selectedProject?.program && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">{language === "ar" ? t("program") : "Program"}</p>
                  <p className="font-semibold text-sm">{selectedProject.program}</p>
                </div>
              )}
              {selectedProject?.academicYear && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">{language === "ar" ? t("academicYear") : "Academic Year"}</p>
                  <p className="font-semibold text-sm">{selectedProject.academicYear}</p>
                </div>
              )}
              {selectedProject?.startDate && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">{language === "ar" ? t("startDateLabe") : "Start Date"}</p>
                  <p className="font-semibold text-sm">
                    {new Date(selectedProject.startDate?.seconds ? selectedProject.startDate.seconds * 1000 : selectedProject.startDate).toLocaleDateString(language === "ar" ? "ar-EG" : "en-US")}
                  </p>
                </div>
              )}
            </div>

            {/* Supervisor */}
            {selectedProject?.supervisorName && (
              <div>
                <h4 className="font-semibold mb-2 text-sm">{language === "ar" ? t("supervisorLabel") : "Supervisor:"}</h4>
                <div className="p-3 bg-muted/50 rounded-lg flex flex-wrap gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">{language === "ar" ? t("name") : "Name"}</p>
                    <p className="text-sm font-medium">{selectedProject.supervisorName}</p>
                  </div>
                  {selectedProject.supervisorEmail && (
                    <div>
                      <p className="text-xs text-muted-foreground">{language === "ar" ? t("emailLabe") : "Email"}</p>
                      <p className="text-sm font-medium">{selectedProject.supervisorEmail}</p>
                    </div>
                  )}
                  {selectedProject.coSupervisorName && (
                    <div>
                      <p className="text-xs text-muted-foreground">{language === "ar" ? t("coSupervisorLabel") : "Co-Supervisor"}</p>
                      <p className="text-sm font-medium">{selectedProject.coSupervisorName}</p>
                    </div>
                  )}
                  {selectedProject.coSupervisorEmail && (
                    <div>
                      <p className="text-xs text-muted-foreground">{language === "ar" ? t("coSupervisorEmailLabel") : "Co-Supervisor Email"}</p>
                      <p className="text-sm font-medium">{selectedProject.coSupervisorEmail}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Problem Statement */}
            <div>
              <h4 className="font-semibold mb-2">{language === "ar" ? t("problemStatementColon") : "Problem Statement:"}</h4>
              <p className="text-sm text-muted-foreground leading-relaxed bg-muted/30 p-3 rounded-lg whitespace-pre-wrap">{selectedProject?.problemStatement || selectedProject?.description || t("noDescription")}</p>
            </div>

            {/* Objectives */}
            {selectedProject?.objectives && (
              <div>
                <h4 className="font-semibold mb-2">{language === "ar" ? t("objectivesColon") : "Objectives:"}</h4>
                {Array.isArray(selectedProject.objectives) ? (
                  <ul className="space-y-1.5 bg-muted/30 p-3 rounded-lg">
                    {selectedProject.objectives.map((obj: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="text-primary font-bold mt-0.5 shrink-0">{i + 1}.</span>
                        <span>{obj}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground leading-relaxed bg-muted/30 p-3 rounded-lg">{selectedProject.objectives}</p>
                )}
              </div>
            )}

            {/* Significance */}
            {selectedProject?.significance && (
              <div>
                <h4 className="font-semibold mb-2">{language === "ar" ? t("significanceColon") : "Significance:"}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed bg-muted/30 p-3 rounded-lg">{selectedProject.significance}</p>
              </div>
            )}

            {/* Literature Review */}
            {selectedProject?.literatureReview && (
              <div>
                <h4 className="font-semibold mb-2">{language === "ar" ? t("literatureReviewColon") : "Literature Review:"}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed bg-muted/30 p-3 rounded-lg whitespace-pre-wrap">{selectedProject.literatureReview}</p>
              </div>
            )}

            {/* References */}
            {selectedProject?.references && (
              <div>
                <h4 className="font-semibold mb-2">{language === "ar" ? t("referencesColon") : "References:"}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed bg-muted/30 p-3 rounded-lg whitespace-pre-wrap">{selectedProject.references}</p>
              </div>
            )}

            {/* Technologies */}
            {(selectedProject?.tools || selectedProject?.technologies) && (
              <div>
                <h4 className="font-semibold mb-2">{language === "ar" ? t("toolsAndTech") : "Tools & Technologies:"}</h4>
                {Array.isArray(selectedProject.technologies) ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedProject.technologies.map((tech: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs rounded-full px-3">{tech}</Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground leading-relaxed">{selectedProject.tools || selectedProject.technologies}</p>
                )}
              </div>
            )}

            {/* Timeline */}
            {selectedProject?.timeline && (
              <div>
                <h4 className="font-semibold mb-2">{language === "ar" ? t("timelineColon") : "Timeline:"}</h4>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="text-right p-2 font-semibold">{language === "ar" ? t("phase") : "Phase"}</th>
                        {["W 1–3","W 4–6","W 7–9","W 10–12","W 13–16","Next Sem","N/A"].map((l) => (
                          <th key={l} className="p-2 text-center font-medium text-muted-foreground whitespace-nowrap">{l}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { key: "requirementCollection", ar: t("requirementCollection"), en: "Requirements" },
                        { key: "literatureReview", ar: t("literatureRevie"), en: "Lit. Review" },
                        { key: "design", ar: t("design"), en: "Design" },
                        { key: "implementation", ar: t("implementation"), en: "Implementation" },
                        { key: "testingAndResults", ar: t("testing"), en: "Testing" },
                        { key: "reportWriting", ar: t("reportWriting"), en: "Report" },
                        { key: "presentation", ar: t("presentatio"), en: "Presentation" },
                      ].map((phase) => (
                        <tr key={phase.key} className="border-b hover:bg-muted/20">
                          <td className="p-2 font-medium">{language === "ar" ? phase.ar : phase.en}</td>
                          {["w1-3","w4-6","w7-9","w10-12","w13-16","next-semester","na"].map((val) => (
                            <td key={val} className="p-2 text-center">
                              {selectedProject.timeline[phase.key] === val
                                ? <span className="inline-flex items-center justify-center w-4 h-4 bg-primary rounded-full text-white text-[10px]">✓</span>
                                : <span className="inline-block w-3 h-3 rounded-full border border-muted-foreground/30" />}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Plagiarism Declaration */}
            {selectedProject?.plagiarismDeclaration !== undefined && (
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${selectedProject.plagiarismDeclaration ? "bg-primary" : "border-2 border-muted-foreground/40"}`}>
                  {selectedProject.plagiarismDeclaration && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                </div>
                <p className="text-sm text-muted-foreground">
                  {language === "ar" ? t("plagiarismDeclared") : "Declared that this work is original and free from plagiarism"}
                </p>
              </div>
            )}

            {/* Team Members */}
            <div>
              <h4 className="font-semibold mb-3">{language === "ar" ? t("teamMembersColon") : "Team Members:"}</h4>
              {selectedProject?.teamMembers && selectedProject.teamMembers.length > 0 ? (
                <div className="space-y-2">
                  {selectedProject.teamMembers.map((member: any, index: number) => (
                    <div key={index} className="p-3 bg-muted/50 rounded-lg border">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="font-medium text-sm">{member.fullName || member.name || t("member")}</p>
                          <p className="text-xs text-muted-foreground">{member.email}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {member.role === "leader" && <Badge variant="default" className="text-xs">{t("leader")}</Badge>}
                          <Badge variant={member.approved ? "default" : "secondary"} className="text-xs">
                            {member.approved ? (language === "ar" ? t("memberApproved") : "Approved") : (language === "ar" ? "لم يوافق بعد" : "Pending")}
                          </Badge>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-muted-foreground">
                        {member.studentId && <span>{language === "ar" ? t("idColon") : "ID:"} {member.studentId}</span>}
                        {member.gpa && <span>GPA: {member.gpa}</span>}
                        {member.phone && <span>{language === "ar" ? t("telColon") : "Tel:"} {member.phone}</span>}
                        {member.department && <span>{language === "ar" ? t("deptColon") : "Dept:"} {member.department}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">{t("student")}</p>
                  <p className="font-semibold">{selectedProject?.studentName || t("notAssigned")}</p>
                  <p className="text-xs text-muted-foreground">{selectedProject?.studentEmail}</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              onClick={() => {
                setIsViewDialogOpen(false)
                handleApproveClick(selectedProject)
              }}
              className="flex-1 rounded-lg"
              disabled={isApproving}
            >
              {isApproving ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 ml-2" />}
              {t("approveIdea")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setIsViewDialogOpen(false)
                setIsRejectDialogOpen(true)
              }}
              className="flex-1 rounded-lg"
            >
              <XCircle className="w-4 h-4 ml-2" />
              {t("rejectIdea")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Project Dialog */}
      <Dialog open={isCreateProjectDialogOpen} onOpenChange={setIsCreateProjectDialogOpen}>
        <DialogContent className="max-w-2xl rounded-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">{t("approveAssignSupervisorsTitle")}</DialogTitle>
            <DialogDescription>
              {t("chooseSupervisorsAndDatesDesc")}
              {selectedProject?.isTeamProject && ` (${t("teamProject")})`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              <h3 className="font-semibold text-lg mb-1">{selectedProject?.title}</h3>

              {/* ✅ Fix: Show full description */}
              {(selectedProject?.problemStatement || selectedProject?.description) && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">{language === "ar" ? t("descriptionColo") : "Description:"}</p>
                  <p className="text-sm leading-relaxed">{selectedProject?.problemStatement || selectedProject?.description}</p>
                </div>
              )}

              {/* ✅ Show objectives */}
              {selectedProject?.objectives && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">{language === "ar" ? t("objectivesColon") : "Objectives:"}</p>
                  <p className="text-sm leading-relaxed">{selectedProject.objectives}</p>
                </div>
              )}

              {/* ✅ Show expected outcomes */}
              {selectedProject?.expectedOutcomes && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">{language === "ar" ? t("expectedOutcomesColon") : "Expected Outcomes:"}</p>
                  <p className="text-sm leading-relaxed">{selectedProject.expectedOutcomes}</p>
                </div>
              )}

              {/* ✅ Show tools */}
              {selectedProject?.tools && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">{language === "ar" ? t("toolsAndTech") : "Tools & Technologies:"}</p>
                  <p className="text-sm leading-relaxed">{selectedProject.tools}</p>
                </div>
              )}

              {selectedProject?.isTeamProject && (
                <div className="space-y-2 pt-2 border-t">
                  <p className="text-sm text-muted-foreground">{t("teamMembers")}:</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedProject?.teamMembers?.map((member: any, index: number) => (
                      <Badge key={index} variant={member.approved ? "default" : "secondary"}>
                        {member.fullName || member.name || member.email}
                        {member.role === "leader" && ` (${t("leader")})`}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label>{t("supervisorsRequiredMulti")}</Label>
              <div className="border rounded-lg p-4 space-y-2 max-h-48 overflow-y-auto">
                {supervisors.map((supervisor) => (
                  <div key={supervisor.id} className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded">
                    <Checkbox
                      id={supervisor.id}
                      checked={newProject.supervisorIds.includes(supervisor.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setNewProject({ ...newProject, supervisorIds: [...newProject.supervisorIds, supervisor.id] })
                        } else {
                          setNewProject({
                            ...newProject,
                            supervisorIds: newProject.supervisorIds.filter((id) => id !== supervisor.id),
                          })
                        }
                      }}
                    />
                    <label htmlFor={supervisor.id} className="flex-1 cursor-pointer">
                      <p className="font-medium">{supervisor.name}</p>
                      <p className="text-xs text-muted-foreground">{supervisor.email}</p>
                    </label>

                    {newProject.supervisorIds.indexOf(supervisor.id) === 0 && (
                      <Badge variant="default" className="text-xs">
                        {t("primarySupervisor")}
                      </Badge>
                    )}
                    {newProject.supervisorIds.indexOf(supervisor.id) > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {t("secondarySupervisor")}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{t("firstSupervisorIsPrimaryHint")}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">{t("startDate")} *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={newProject.startDate}
                  onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })}
                  className="rounded-lg"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">{t("endDateOptional")}</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={newProject.endDate}
                  onChange={(e) => setNewProject({ ...newProject, endDate: e.target.value })}
                  className="rounded-lg"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateProjectDialogOpen(false)}
              disabled={isApproving}
              className="rounded-lg"
            >
              {t("cancel")}
            </Button>
            <Button onClick={handleCreateProject} disabled={isApproving} className="rounded-lg">
              {isApproving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("approving")}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {t("approveAndCreateProject")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-destructive" />
              {t("rejectProjectIdeaTitle")}
            </DialogTitle>
            <DialogDescription>{t("pleaseExplainRejectionReason")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">{t("project")}</p>
              <p className="font-semibold">{selectedProject?.title}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t("student")}: {selectedProject?.studentName}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">{t("rejectionReason")} *</Label>
              <Textarea
                id="reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                className="rounded-lg"
                placeholder={t("writeRejectionReasonPlaceholder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)} className="rounded-lg">
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleReject} className="rounded-lg" disabled={isRejecting}>
              {isRejecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 ml-2" />}
              {t("confirmReject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Team Formation Dialog */}
      <Dialog open={isTeamFormationDialogOpen} onOpenChange={setIsTeamFormationDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              {t("formProjectTeamTitle")}
            </DialogTitle>
            <DialogDescription>{t("formTeamDesc")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>{t("projectTitle")}</Label>
              <p className="text-sm font-medium mt-1">{selectedProject?.title}</p>
            </div>

            <div className="space-y-2">
              <Label>{t("currentTeamMembers")}</Label>
              <div className="flex flex-wrap gap-2 p-3 border rounded-lg min-h-[60px]">
                {teamMembers.map((member, index) => (
                  <Badge key={index} variant={member.role === "leader" ? "default" : "secondary"} className="gap-2">
                    {member.name} {member.role === "leader" && `(${t("leader")})`}
                    {member.role !== "leader" && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTeamMember(member.userId)}
                        className="hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("addStudentToTeam")}</Label>
              <Select onValueChange={handleAddTeamMember}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectStudentt")} />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    const availableStudents = students.filter((s) => {
                      const notInTeam = !teamMembers.some((m) => m.userId === s.id)
                      return notInTeam && s.name
                    })

                    if (availableStudents.length === 0) {
                      return (
                        <SelectItem value="none" disabled>
                          {t("noAvailableStudents")}
                        </SelectItem>
                      )
                    }

                    return availableStudents.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.name} ({student.email})
                      </SelectItem>
                    ))
                  })()}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTeamFormationDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleSaveTeamFormation} disabled={isSavingTeam || teamMembers.length < 2}>
              {isSavingTeam ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  {t("saving")}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 ml-2" />
                  {t("saveTeam")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}