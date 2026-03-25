"use client"

import type React from "react"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { supervisorSidebarItems } from "@/lib/constants/supervisor-sidebar"
import { Users, Calendar, Plus, Clock, MapPin, XCircle, Edit2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/contexts/auth-context"
import { useLanguage } from "@/lib/contexts/language-context"
import { useEffect, useMemo, useState } from "react"
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  Timestamp,
  updateDoc,
  doc,
  setDoc,
} from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase/config"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

function normalizeKeyPart(v: unknown) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\- ]+/g, "")
    .replace(/\s/g, "_")
}

export default function SupervisorMeetings() {
  const { userData, loading: authLoading } = useAuth()
  const { t, language } = useLanguage()
    const [stats, setStats] = useState({
      totalProjects: 0,
      activeProjects: 0,
      completedProjects: 0,
      totalSupervisors: 0,
      totalStudents: 0,
      averageProgress: 0,
      projectsNeedingAttention: 0,
    })

  const [meetings, setMeetings] = useState<any[]>([])
  const [meetingRequests, setMeetingRequests] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [open, setOpen] = useState(false)

  // ✅ NEW: prevent double submit (schedule meeting)
  const [submittingMeeting, setSubmittingMeeting] = useState(false)

  // ✅ NEW: prevent double click approve/reject
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null)

  // Cancel meeting dialog
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelMeetingId, setCancelMeetingId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [isCancelling, setIsCancelling] = useState(false)

  // Reschedule meeting dialog
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false)
  const [rescheduleMeeting, setRescheduleMeeting] = useState<any>(null)
  const [newDate, setNewDate] = useState("")
  const [newTime, setNewTime] = useState("")
  const [isRescheduling, setIsRescheduling] = useState(false)

  const [formData, setFormData] = useState({
    assignType: "student" as "student" | "project",
    studentId: "",
    projectId: "",
    title: "",
    description: "",
    date: "",
    time: "",
    location: "",
  })

  const formatTime = (time?: string) => {
    if (!time || !time.includes(":")) return time || "غير محدد"
    const [h, m] = time.split(":").map(Number)
    if (isNaN(h) || isNaN(m)) return time
    const period = h >= 12 ? (language === "ar" ? "م" : "PM") : (language === "ar" ? "ص" : "AM")
    const hour12 = h % 12 === 0 ? 12 : h % 12
    return `${hour12}:${String(m).padStart(2, "0")} ${period}`
  }

  const validateTime = (time: string) => {
    if (!time) return false
    const [hours] = time.split(":").map(Number)
    return hours >= 8 && hours < 20 // 8 AM to 8 PM
  }

  const getTodayDate = () => {
    const today = new Date()
    return today.toISOString().split("T")[0] // "YYYY-MM-DD"
  }

  const validateDate = (date: string) => {
    if (!date) return false
    const selected = new Date(date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return selected >= today
  }

  const fetchProjectsAndStudents = async () => {
    if (!userData?.uid) return
    try {
      const db = getFirebaseDb()
      if (!db) return
      const projectsQueryPrimary = query(collection(db, "projects"), where("supervisorId", "==", userData.uid))
      const projectsQuerySecondary = query(collection(db, "projects"), where("coSupervisorId", "==", userData.uid))
      const [projSnap1, projSnap2] = await Promise.all([getDocs(projectsQueryPrimary), getDocs(projectsQuerySecondary)])
      const projIds = new Set<string>()
      const allProjDocs = [...projSnap1.docs, ...projSnap2.docs].filter((d) => {
        if (projIds.has(d.id)) return false
        projIds.add(d.id)
        return true
      })
      const projectsList = allProjDocs.map((p) => ({ id: p.id, ...p.data() }))
      setProjects(projectsList)

      const studentIdSet = new Set<string>()
      allProjDocs.forEach((p) => {
        const project = p.data()
        if (project.studentId) studentIdSet.add(project.studentId)
        if (Array.isArray(project.teamMembers)) {
          project.teamMembers.forEach((id: string) => { if (id) studentIdSet.add(id) })
        }
        if (Array.isArray(project.studentIds)) {
          project.studentIds.forEach((id: string) => { if (id) studentIdSet.add(id) })
        }
      })

      if (studentIdSet.size > 0) {
        const studentsQuery = query(collection(db, "users"), where("role", "==", "student"))
        const studentsSnapshot = await getDocs(studentsQuery)
        const studentsData = studentsSnapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((s: any) => studentIdSet.has(s.id))
        setStudents(studentsData)
      } else {
        setStudents([])
      }
    } catch (err) {
      console.error("Error fetching projects/students:", err)
    }
  }

  useEffect(() => {
    if (authLoading || !userData?.uid) return

    const db = getFirebaseDb()
    if (!db) return

    setLoading(true)
    setError(null)

    // Real-time: meetings
    let meetSnap1: any[] = []
    let meetSnap2: any[] = []
    const mergeMeetings = () => {
      const seen = new Set<string>()
      const merged = [...meetSnap1, ...meetSnap2].filter((d) => {
        if (seen.has(d.id)) return false
        seen.add(d.id)
        return true
      })
      setMeetings(merged.sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0)))
    }
    const unsubM1 = onSnapshot(
      query(collection(db, "meetings"), where("supervisorId", "==", userData.uid)),
      (snap) => { meetSnap1 = snap.docs.map((d) => ({ id: d.id, ...d.data() })); mergeMeetings(); setLoading(false) }
    )
    const unsubM2 = onSnapshot(
      query(collection(db, "meetings"), where("coSupervisorId", "==", userData.uid)),
      (snap) => { meetSnap2 = snap.docs.map((d) => ({ id: d.id, ...d.data() })); mergeMeetings() }
    )

    // Real-time: meeting requests
    let reqSnap1: any[] = []
    let reqSnap2: any[] = []
    const mergeRequests = () => {
      const seen = new Set<string>()
      const merged = [...reqSnap1, ...reqSnap2].filter((d) => {
        if (seen.has(d.id)) return false
        seen.add(d.id)
        return true
      })
      setMeetingRequests(merged.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)))
    }
    const unsubR1 = onSnapshot(
      query(collection(db, "meeting_requests"), where("supervisorId", "==", userData.uid)),
      (snap) => { reqSnap1 = snap.docs.map((d) => ({ id: d.id, ...d.data() })); mergeRequests() }
    )
    const unsubR2 = onSnapshot(
      query(collection(db, "meeting_requests"), where("coSupervisorId", "==", userData.uid)),
      (snap) => { reqSnap2 = snap.docs.map((d) => ({ id: d.id, ...d.data() })); mergeRequests() }
    )

    fetchProjectsAndStudents()

    // Also listen to meetings of projects where this supervisor is co-supervisor (via projectId)
    fetchProjectsAndStudents().then(() => {
      getDocs(query(collection(db, "projects"), where("coSupervisorId", "==", userData.uid))).then((projSnap) => {
        const projIds = projSnap.docs.map((d) => d.id).filter(Boolean)
        if (projIds.length === 0) return
        const chunks: string[][] = []
        for (let i = 0; i < projIds.length; i += 10) chunks.push(projIds.slice(i, i + 10))
        chunks.forEach((chunk) => {
          onSnapshot(
            query(collection(db, "meetings"), where("projectId", "in", chunk)),
            (snap) => {
              const newMeetings = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
              meetSnap2 = [
                ...meetSnap2.filter((m) => !newMeetings.find((nm) => nm.id === m.id)),
                ...newMeetings,
              ]
              mergeMeetings()
            }
          )
        })
      }).catch(() => {})
    })

    return () => { unsubM1(); unsubM2(); unsubR1(); unsubR2() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData?.uid, authLoading])

  // ✅ Create deterministic meeting ID so it cannot duplicate
  const buildMeetingId = (args: {
    supervisorId: string
    studentId: string
    title: string
    date: string // "YYYY-MM-DD"
    time: string // "HH:mm"
  }) => {
    return [
      "meeting",
      normalizeKeyPart(args.supervisorId),
      normalizeKeyPart(args.studentId),
      normalizeKeyPart(args.title),
      normalizeKeyPart(args.date),
      normalizeKeyPart(args.time),
    ].join("__")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // ✅ Prevent double submit
    if (submittingMeeting) return
    setSubmittingMeeting(true)

    try {
      if (!userData?.uid) {
        toast.error(t("cannotIdentifySupervisor"))
        return
      }

      const isProjectMeeting = formData.assignType === "project"
      if (isProjectMeeting && !formData.projectId) {
        toast.error(t("pleaseSelectProject"))
        return
      }
      if (!isProjectMeeting && !formData.studentId) {
        toast.error(t("pleaseSelectStuden"))
        return
      }
      if (!formData.title || !formData.date || !formData.time) {
        toast.error(t("pleaseFillRequiredFields"))
        return
      }

      if (!validateTime(formData.time)) {
        toast.error(t("invalidMeetingTime"))
        return
      }

      if (!validateDate(formData.date)) {
        toast.error(language === "ar" ? t("cannotScheduleInPast") : "Cannot schedule a meeting in the past")
        return
      }

      const db = getFirebaseDb()
      if (!db) throw new Error(t("databaseUnavailable"))

      // Fix: parse date as local time (not UTC) to avoid timezone shift
      const [year, month, day] = formData.date.split("-").map(Number)
      const meetingDate = new Date(year, month - 1, day, 12, 0, 0)

      if (isProjectMeeting) {
        // Create one meeting per student in the project
        const project = projects.find((p) => p.id === formData.projectId)
        const candidateIds: string[] = Array.from(new Set([
          ...(project?.studentIds || []),
          ...(project?.teamMembers || []),
          ...(project?.studentId ? [project.studentId] : []),
        ]))

        // تحقق من users أن الطالب لا يزال مرتبطاً بهذا المشروع
        const verifiedIds = await Promise.all(
          candidateIds.map(async (sid) => {
            try {
              const userSnap = await getDocs(query(collection(db, "users"), where("__name__", "==", sid)))
              if (userSnap.empty) return null
              const userData2 = userSnap.docs[0].data()
              return userData2.projectId === formData.projectId ? sid : null
            } catch { return null }
          })
        )
        const projectStudentIds: string[] = verifiedIds.filter(Boolean) as string[]

        if (projectStudentIds.length === 0) {
          toast.error(t("noStudentsInProject"))
          return
        }

        await Promise.all(projectStudentIds.map((sid) => {
          const student = students.find((s) => s.id === sid)
          const meetingId = buildMeetingId({
            supervisorId: userData.uid,
            studentId: sid,
            title: formData.title,
            date: formData.date,
            time: formData.time,
          })
          return setDoc(doc(db, "meetings", meetingId), {
            studentId: sid,
            studentName: student?.name || "",
            projectId: formData.projectId,
            projectTitle: project?.title || "",
            supervisorId: userData.uid,
            supervisorName: userData?.name || "",
            title: formData.title,
            description: formData.description,
            date: Timestamp.fromDate(meetingDate),
            time: formData.time,
            location: formData.location,
            status: "scheduled",
            createdAt: Timestamp.now(),
          })
        }))

        toast.success(`${t("meetingScheduledForAllProjectMembers")}(${projectStudentIds.length} ${t("students")})`)
      } else {
        // Single student meeting
        const student = students.find((s) => s.id === formData.studentId)
        const meetingId = buildMeetingId({
          supervisorId: userData.uid,
          studentId: formData.studentId,
          title: formData.title,
          date: formData.date,
          time: formData.time,
        })
        await setDoc(doc(db, "meetings", meetingId), {
          studentId: formData.studentId,
          studentName: student?.name || "",
          supervisorId: userData.uid,
          supervisorName: userData?.name || "",
          title: formData.title,
          description: formData.description,
          date: Timestamp.fromDate(meetingDate),
          time: formData.time,
          location: formData.location,
          status: "scheduled",
          createdAt: Timestamp.now(),
        })
        toast.success(t("meetingScheduledSuccessfully"))
      }

      setOpen(false)
      setFormData({ assignType: "student", studentId: "", projectId: "", title: "", description: "", date: "", time: "", location: "" })
      fetchProjectsAndStudents()
    } catch (err) {
      console.error("Error scheduling meeting:", err)
      toast.error(t("errorSchedulingMeeting"))
    } finally {
      setSubmittingMeeting(false)
    }
  }

  const approveRequest = async (request: any) => {
    if (!userData?.uid) return

    // ✅ Prevent double click approve on same request
    if (processingRequestId === request.id) return
    setProcessingRequestId(request.id)

    try {
      const db = getFirebaseDb()
      if (!db) throw new Error(t("databaseUnavailable"))

      // ✅ Fix: request.date is a Firestore Timestamp - convert correctly
      let meetingDate: Date

      if (request.date?.seconds) {
        // Firestore Timestamp
        meetingDate = new Date(request.date.seconds * 1000)
      } else if (request.date?.toDate) {
        // Firestore Timestamp with toDate method
        meetingDate = request.date.toDate()
      } else if (request.date) {
        // String or number
        meetingDate = new Date(request.date)
      } else {
        // No date provided - use current date
        meetingDate = new Date()
      }

      // Validate the date is valid
      if (isNaN(meetingDate.getTime())) {
        toast.error(t("invalidMeetingDate"))
        setProcessingRequestId(null)
        return
      }

      const dateStr = `${meetingDate.getFullYear()}-${String(meetingDate.getMonth()+1).padStart(2,'0')}-${String(meetingDate.getDate()).padStart(2,'0')}`

      // ✅ Idempotency: same request should not create two meetings
      const meetingId = buildMeetingId({
        supervisorId: userData.uid,
        studentId: request.studentId,
        title: request.title,
        date: dateStr,
        time: request.time || "",
      })

      await setDoc(doc(db, "meetings", meetingId), {
        studentId: request.studentId,
        studentName: request.studentName || "",
        supervisorId: userData.uid,
        supervisorName: userData.name || "",
        title: request.title,
        description: request.notes || request.description || "",
        date: Timestamp.fromDate(meetingDate),
        time: request.time || "",
        location: request.location || "",
        status: "scheduled",
        createdAt: Timestamp.now(),
      })

      await updateDoc(doc(db, "meeting_requests", request.id), { status: "approved" })
      toast.success(t("meetingRequestApproved"))
      fetchProjectsAndStudents()
    } catch (err) {
      console.error("Error approving request:", err)
      toast.error(t("errorApprovingRequest"))
    } finally {
      setProcessingRequestId(null)
    }
  }

  const rejectRequest = async (request: any) => {
    if (!userData?.uid) return

    if (processingRequestId === request.id) return
    setProcessingRequestId(request.id)

    try {
      const db = getFirebaseDb()
      if (!db) throw new Error(t("databaseUnavailable"))

      await updateDoc(doc(db, "meeting_requests", request.id), { status: "rejected" })
      toast.success(t("meetingRequestRejected"))
      fetchProjectsAndStudents()
    } catch (err) {
      console.error("Error rejecting request:", err)
      toast.error(t("errorRejectingRequest"))
    } finally {
      setProcessingRequestId(null)
    }
  }

  const handleCancelMeeting = async () => {
    if (!cancelMeetingId || !cancelReason.trim()) return
    setIsCancelling(true)
    try {
      const db = getFirebaseDb()
      if (!db) throw new Error("DB unavailable")
      const isRequest = cancelMeetingId.endsWith("::request")
      const actualId = isRequest ? cancelMeetingId.replace("::request", "") : cancelMeetingId
      const collectionName = isRequest ? "meeting_requests" : "meetings"
      await updateDoc(doc(db, collectionName, actualId), {
        status: "cancelled",
        cancelReason: cancelReason.trim(),
        cancelledAt: Timestamp.now(),
      })
      toast.success(language === "ar" ? t("meetingCancelled") : "Meeting cancelled")
      setCancelDialogOpen(false)
      setCancelMeetingId(null)
      setCancelReason("")
      fetchProjectsAndStudents()
    } catch (err) {
      console.error(err)
      toast.error(language === "ar" ? t("errorCancellingMeeting") : "Error cancelling meeting")
    } finally {
      setIsCancelling(false)
    }
  }

  const handleRescheduleMeeting = async () => {
    if (!rescheduleMeeting || !newDate || !newTime) return
    if (!validateDate(newDate)) {
      toast.error(language === "ar" ? t("cannotScheduleInPast") : "Cannot schedule in the past")
      return
    }
    if (!validateTime(newTime)) {
      toast.error(language === "ar" ?  t("timeMustBeBetween8") : "Time must be between 8AM and 8PM")
      return
    }
    setIsRescheduling(true)
    try {
      const db = getFirebaseDb()
      if (!db) throw new Error("DB unavailable")
      const [rd1, rm1, rday1] = newDate.split("-").map(Number)
      const meetingDate = new Date(rd1, rm1 - 1, rday1, 12, 0, 0)
      const isRequest = rescheduleMeeting.isRequest === true
      const collectionName = isRequest ? "meeting_requests" : "meetings"
      await updateDoc(doc(db, collectionName, rescheduleMeeting.id), {
        date: Timestamp.fromDate(meetingDate),
        time: newTime,
        status: isRequest ? "approved" : "scheduled",
        rescheduledAt: Timestamp.now(),
      })
      toast.success(language === "ar" ? t("meetingRescheduled")  : "Meeting rescheduled")
      setRescheduleDialogOpen(false)
      setRescheduleMeeting(null)
      setNewDate("")
      setNewTime("")
      fetchProjectsAndStudents()
    } catch (err) {
      console.error(err)
      toast.error(language === "ar" ? t("errorReschedulingMeeting") : "Error rescheduling meeting")
    } finally {
      setIsRescheduling(false)
    }
  }

  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), "ar"))
  }, [students])

  return (
    <DashboardLayout sidebarItems={supervisorSidebarItems} requiredRole="supervisor">
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in slide-in-from-top duration-700">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-l from-primary to-primary/60 bg-clip-text text-transparent">
              {t("meetings")}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">{t("manageMeetingsWithStudents")}</p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 w-full sm:w-auto">
                <Plus className="w-4 h-4" />
                {t("scheduleMeeting")}
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-300">
              <DialogHeader>
                <DialogTitle className="text-xl">{t("scheduleNewMeeting")}</DialogTitle>
                <DialogDescription>{t("scheduleMeetingDescription")}</DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* نوع الاجتماع */}
                <div className="space-y-2">
                  <Label>{t("meetingType")} *</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, assignType: "student", projectId: "" })}
                      className={`h-10 rounded-lg border-2 text-sm font-medium transition-all ${formData.assignType === "student" ? "border-primary bg-primary/10 text-primary" : "border-border bg-background"}`}
                    >
                     {t("specifiedStudent")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, assignType: "project", studentId: "" })}
                      className={`h-10 rounded-lg border-2 text-sm font-medium transition-all ${formData.assignType === "project" ? "border-primary bg-primary/10 text-primary" : "border-border bg-background"}`}
                    >
                     {t("completeProjectTeam")}
                    </button>
                  </div>
                </div>

                {/* اختيار الطالب أو المشروع */}
                {formData.assignType === "student" ? (
                  <div className="space-y-2">
                    <Label htmlFor="student">{t("student")} *</Label>
                    <Select value={formData.studentId} onValueChange={(value) => setFormData({ ...formData, studentId: value })}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder={t("selectStudent")} />
                      </SelectTrigger>
                      <SelectContent>
                        {sortedStudents.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground text-center">{t("noAvailableStudent")}</div>
                        ) : (
                          sortedStudents.map((student) => (
                            <SelectItem key={student.id} value={student.id}>
                              {student.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="project">{t("project")} *</Label>
                    <Select value={formData.projectId} onValueChange={(value) => setFormData({ ...formData, projectId: value })}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder={t("selectProject")} />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground text-center">{t("noAvailableProjects")}</div>
                        ) : (
                          projects.map((project: any) => {
                            const memberCount = new Set([
                              ...(project.studentIds || []),
                              ...(project.studentId ? [project.studentId] : []),
                            ]).size
                            return (
                              <SelectItem key={project.id} value={project.id}>
                                {project.title} ({memberCount} طلاب)
                              </SelectItem>
                            )
                          })
                        )}
                      </SelectContent>
                    </Select>
                    {formData.projectId && (
                      <p className="text-xs text-muted-foreground">{t("meetingInviteToTeam")}</p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="title">{t("meetingTitle")} *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder={t("exampleMeetingTitle")}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">{t("description")}</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={t("meetingDescriptionPlaceholder")}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">{t("date")} *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      min={getTodayDate()}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="time">{t("time")} *</Label>
                    <Input
                      id="time"
                      type="time"
                      min="08:00"
                      max="19:59"
                      value={formData.time}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                      className="h-11"
                    />
                    <p className="text-xs text-muted-foreground">{t("timePerio")}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">{t("location")}</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder={t("exampleLocation")}
                    className="h-11"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-11"
                  disabled={submittingMeeting || (formData.assignType === "student" && sortedStudents.length === 0) || (formData.assignType === "project" && projects.length === 0)}
                >
                  {submittingMeeting ? t("schedulingMeeting") : t("scheduleMeeting")}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {!authLoading && !loading && meetingRequests.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">{t("meetingRequest")}</h2>
            <div className="grid gap-4">
              {meetingRequests.map((req, idx) => (
                <Card
                  key={req.id}
                  className="hover:shadow-lg transition-all duration-300 rounded-xl"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{req.title}</CardTitle>
                        {req.notes && <CardDescription className="mt-2">{req.notes}</CardDescription>}
                        <div className="mt-2 text-sm text-muted-foreground">{t("from")}: {req.studentName}</div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge
                          variant={
                            req.status === "pending"
                              ? "secondary"
                              : req.status === "approved"
                                ? "default"
                                : "destructive"
                          }
                          className="rounded-lg"
                        >
                          {req.status === "pending"
                            ? t("pending")
                            : req.status === "approved"
                              ? t("approved")
                              : t("rejected")}
                        </Badge>
                        <div className="text-xs text-muted-foreground">
                          {req.createdAt?.seconds
                            ? new Date(req.createdAt.seconds * 1000).toLocaleDateString("ar-EG")
                            : ""}
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-muted-foreground">{t("date")}</p>
                        <p className="text-sm font-medium">
                          {req.date?.seconds
                            ? new Date(req.date.seconds * 1000).toLocaleDateString("ar-EG")
                            : req.date?.toDate
                              ? req.date.toDate().toLocaleDateString("ar-EG")
                              : req.date
                                ? new Date(req.date).toLocaleDateString("ar-EG")
                                : t("notSpecified")}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{t("time")}</p>
                        <p className="text-sm font-medium">{req.time || t("notSpecified")}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {req.status === "pending" && (
                        <>
                          <Button
                            onClick={() => approveRequest(req)}
                            className="rounded-lg"
                            disabled={processingRequestId === req.id}
                          >
                            {processingRequestId === req.id ? "..." : t("approv")}
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => rejectRequest(req)}
                            className="rounded-lg"
                            disabled={processingRequestId === req.id}
                          >
                            {processingRequestId === req.id ? "..." : t("rejectt")}
                          </Button>
                        </>
                      )}
                      {req.status !== "rejected" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 rounded-lg"
                            onClick={() => {
                              const dateStr = req.date?.seconds
                                ? new Date(req.date.seconds * 1000).toISOString().split("T")[0]
                                : ""
                              setRescheduleMeeting({ ...req, isRequest: true })
                              setNewDate(dateStr)
                              setNewTime(req.time || "")
                              setRescheduleDialogOpen(true)
                            }}
                          >
                            <Edit2 className="w-4 h-4" />
                            {language === "ar" ? t("rescheduleLabel") : "Reschedule"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 rounded-lg"
                            onClick={() => {
                              setCancelMeetingId(req.id + "::request")
                              setCancelReason("")
                              setCancelDialogOpen(true)
                            }}
                          >
                            <XCircle className="w-4 h-4" />
                            {language === "ar" ? t("cancel") : "Cancel"}
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {authLoading || loading ? (
          <Card className="animate-pulse">
            <CardContent className="p-4 lg:p-8">
              <p className="text-center text-muted-foreground">{t("loading")}</p>
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="border-destructive/50 animate-in fade-in duration-500">
            <CardContent className="p-6 sm:p-8">
              <div className="text-center space-y-4">
                <div className="text-destructive">
                  <h3 className="text-lg font-semibold">{t("errorHave")}</h3>
                  <p className="text-sm mt-2">{error}</p>
                </div>
                <Button onClick={fetchProjectsAndStudents} variant="outline">
                 {t("retry")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : meetings.length === 0 ? (
          <Card className="border-dashed animate-in fade-in zoom-in duration-500">
            <CardContent className="p-8 sm:p-12">
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/10 flex items-center justify-center animate-in zoom-in duration-700 delay-150">
                  <Calendar className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
                </div>
                <div className="animate-in slide-in-from-bottom duration-700 delay-300">
                  <h3 className="text-lg sm:text-xl font-semibold">{t("noScheduledMeetings")}</h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                    {students.length === 0
                      ? t("noStudentsLinked")
                      : t("startSchedulingMeetings")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            <Card className="bg-gradient-to-l from-primary/10 to-primary/5 border-primary/20 animate-in slide-in-from-right duration-500">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t("totalMeetings")}</p>
                    <p className="text-2xl sm:text-3xl font-bold text-primary mt-1">{meetings.filter((m) => m.status !== "cancelled").length}</p>
                  </div>
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary/20 flex items-center justify-center">
                    <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4">
              {meetings.map((meeting, index) => (
                <Card
                  key={meeting.id}
                  className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.01] sm:hover:scale-[1.02] hover:border-primary/50 animate-in fade-in slide-in-from-bottom duration-500"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <CardHeader className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4">
                      <div className="flex-1 w-full">
                        <CardTitle className="text-lg sm:text-xl group-hover:text-primary transition-colors">
                          {meeting.title}
                        </CardTitle>
                        {meeting.description && (
                          <CardDescription className="mt-2 line-clamp-2 text-sm">{meeting.description}</CardDescription>
                        )}
                        <div className="flex items-center gap-2 mt-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Users className="w-4 h-4 text-primary" />
                          </div>
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">{meeting.studentName}</span>
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          meeting.status === "scheduled"
                            ? "default"
                            : meeting.status === "completed"
                              ? "secondary"
                              : "destructive"
                        }
                        className="shadow-sm self-start"
                      >
                        {meeting.status === "scheduled" ? t("scheduled") : meeting.status === "completed" ? t("completed") : t("canceled")}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 sm:p-6 pt-0">
                    <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 group-hover:bg-muted transition-colors">
                        <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center shadow-sm flex-shrink-0">
                          <Calendar className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-muted-foreground">{t("date")}</p>
                          <p className="text-sm font-semibold truncate">
                            {meeting.date?.seconds
                              ? new Date(meeting.date.seconds * 1000).toLocaleDateString("ar-SA", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })
                              : t("notSpecifiedText")}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 group-hover:bg-muted transition-colors">
                        <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center shadow-sm flex-shrink-0">
                          <Clock className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-muted-foreground">{t("time")}</p>
                          <p className="text-sm font-semibold truncate">{formatTime(meeting.time)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 group-hover:bg-muted transition-colors">
                        <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center shadow-sm flex-shrink-0">
                          <MapPin className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-muted-foreground">{t("location")}</p>
                          <p className="text-sm font-semibold truncate">{meeting.location || t("notSpecifiedText")}</p>
                        </div>
                      </div>
                    </div>
                    {meeting.status !== "cancelled" && (
                      <div className="flex gap-2 mt-4 pt-4 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                          onClick={() => {
                            setRescheduleMeeting(meeting)
                            setNewDate(meeting.date?.seconds ? new Date(meeting.date.seconds * 1000).toISOString().split("T")[0] : "")
                            setNewTime(meeting.time || "")
                            setRescheduleDialogOpen(true)
                          }}
                        >
                          <Edit2 className="w-4 h-4" />
                          {language === "ar" ? t("rescheduleLabel") : "Reschedule"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() => {
                            setCancelMeetingId(meeting.id)
                            setCancelReason("")
                            setCancelDialogOpen(true)
                          }}
                        >
                          <XCircle className="w-4 h-4" />
                          {language === "ar" ? t("cancelMeetingLabel") : "Cancel Meeting"}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Cancel Meeting Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle>{language === "ar" ? t("cancelMeetingLabel") : "Cancel Meeting"}</DialogTitle>
            <DialogDescription>{language === "ar" ? t("provideReasonForCancellation") : "Please provide a reason for cancellation"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{language === "ar" ? t("cancellationReasonRequired") : "Cancellation Reason *"}</Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder={language === "ar" ? t("writeCancelReasonHere") : "Write the reason here..."}
                rows={3}
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setCancelDialogOpen(false)} className="flex-1 rounded-lg">
                {t("cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancelMeeting}
                className="flex-1 rounded-lg"
                disabled={isCancelling || !cancelReason.trim()}
              >
                {isCancelling ? "..." : language === "ar" ? t("confirmCancel") : "Confirm Cancel"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reschedule Meeting Dialog */}
      <Dialog open={rescheduleDialogOpen} onOpenChange={setRescheduleDialogOpen}>
        <DialogContent className="max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle>{language === "ar" ? t("rescheduleMeeting") : "Reschedule Meeting"}</DialogTitle>
            <DialogDescription>{rescheduleMeeting?.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === "ar" ? t("newDateRequired") : "New Date *"}</Label>
                <Input type="date" value={newDate} min={getTodayDate()} onChange={(e) => setNewDate(e.target.value)} className="h-11" />
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? t("newTimeRequired") : "New Time *"}</Label>
                <Input type="time" min="08:00" max="19:59" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="h-11" />
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setRescheduleDialogOpen(false)} className="flex-1 rounded-lg">
                {t("cancel")}
              </Button>
              <Button
                onClick={handleRescheduleMeeting}
                className="flex-1 rounded-lg"
                disabled={isRescheduling || !newDate || !newTime}
              >
                {isRescheduling ? "..." : language === "ar" ? t("confirmChange") : "Confirm"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  )
}
