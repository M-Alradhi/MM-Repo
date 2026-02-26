"use client"

import type React from "react"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { supervisorSidebarItems } from "@/lib/constants/supervisor-sidebar"
import { Users, Calendar, Plus, Clock, MapPin } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/contexts/auth-context"
import { useEffect, useMemo, useState } from "react"
import {
  collection,
  query,
  where,
  getDocs,
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

  const [meetings, setMeetings] = useState<any[]>([])
  const [meetingRequests, setMeetingRequests] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [open, setOpen] = useState(false)

  // ✅ NEW: prevent double submit (schedule meeting)
  const [submittingMeeting, setSubmittingMeeting] = useState(false)

  // ✅ NEW: prevent double click approve/reject
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    studentId: "",
    title: "",
    description: "",
    date: "",
    time: "",
    location: "",
  })

  const validateTime = (time: string) => {
    if (!time) return false
    const [hours] = time.split(":").map(Number)
    return hours >= 8 && hours < 20 // 8 AM to 8 PM
  }

  const fetchData = async () => {
    if (authLoading) return

    if (!userData?.uid) {
      setLoading(false)
      setError("لم يتم العثور على بيانات المستخدم")
      return
    }

    try {
      setLoading(true)
      setError(null)

      const db = getFirebaseDb()
      if (!db) throw new Error("قاعدة البيانات غير متاحة")

      // 1) Meetings
      const meetingsQuery = query(collection(db, "meetings"), where("supervisorId", "==", userData.uid))
      const meetingsSnapshot = await getDocs(meetingsQuery)
      const meetingsData = meetingsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }))

      const sortedMeetings = meetingsData.sort((a: any, b: any) => {
        const dateA = a.date?.seconds || 0
        const dateB = b.date?.seconds || 0
        return dateB - dateA
      })
      setMeetings(sortedMeetings)

      // 2) Meeting Requests
      const requestsQuery = query(collection(db, "meeting_requests"), where("supervisorId", "==", userData.uid))
      const requestsSnapshot = await getDocs(requestsQuery)
      const requestsData = requestsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      const sortedRequests = requestsData.sort(
        (a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0),
      )
      setMeetingRequests(sortedRequests)

      // 3) ✅ Fetch ALL students (leader + members)
      const projectsQuery = query(collection(db, "projects"), where("supervisorId", "==", userData.uid))
      const projectsSnapshot = await getDocs(projectsQuery)

      const studentIdSet = new Set<string>()

      projectsSnapshot.docs.forEach((p) => {
        const project = p.data()

        // leader/main
        if (project.studentId) studentIdSet.add(project.studentId)

        // members array
        if (Array.isArray(project.studentIds)) {
          project.studentIds.forEach((id: string) => {
            if (id) studentIdSet.add(id)
          })
        }
      })

      if (studentIdSet.size > 0) {
        // Fetch all students then filter
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
      console.error("Error fetching data:", err)
      setError("حدث خطأ أثناء تحميل البيانات")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading && userData) {
      fetchData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData, authLoading])

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
        toast.error("تعذر تحديد المشرف. أعد تسجيل الدخول.")
        return
      }

      if (!formData.studentId || !formData.title || !formData.date || !formData.time) {
        toast.error("الرجاء ملء جميع الحقول المطلوبة")
        return
      }

      if (!validateTime(formData.time)) {
        toast.error("يجب أن يكون الاجتماع بين 8 صباحاً و 8 مساءً")
        return
      }

      const db = getFirebaseDb()
      if (!db) throw new Error("قاعدة البيانات غير متاحة")

      const student = students.find((s) => s.id === formData.studentId)
      const meetingDate = new Date(formData.date)

      // ✅ Idempotency: fixed doc id (no duplicates)
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

      toast.success("تم جدولة الاجتماع بنجاح")
      setOpen(false)
      setFormData({ studentId: "", title: "", description: "", date: "", time: "", location: "" })
      fetchData()
    } catch (err) {
      console.error("Error scheduling meeting:", err)
      toast.error("حدث خطأ في جدولة الاجتماع")
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
      if (!db) throw new Error("قاعدة البيانات غير متاحة")

      const meetingDate = new Date(request.date)

      // ✅ Idempotency: same request should not create two meetings
      const meetingId = buildMeetingId({
        supervisorId: userData.uid,
        studentId: request.studentId,
        title: request.title,
        date: request.date, // assuming request.date is "YYYY-MM-DD" or a string date
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
      toast.success("تمت الموافقة على طلب الاجتماع")
      fetchData()
    } catch (err) {
      console.error("Error approving request:", err)
      toast.error("حدث خطأ أثناء الموافقة")
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
      if (!db) throw new Error("قاعدة البيانات غير متاحة")

      await updateDoc(doc(db, "meeting_requests", request.id), { status: "rejected" })
      toast.success("تم رفض طلب الاجتماع")
      fetchData()
    } catch (err) {
      console.error("Error rejecting request:", err)
      toast.error("حدث خطأ أثناء رفض الطلب")
    } finally {
      setProcessingRequestId(null)
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
              الاجتماعات
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">إدارة الاجتماعات مع الطلاب</p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 w-full sm:w-auto">
                <Plus className="w-4 h-4" />
                جدولة اجتماع
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-300">
              <DialogHeader>
                <DialogTitle className="text-xl">جدولة اجتماع جديد</DialogTitle>
                <DialogDescription>حدد موعد اجتماع مع أحد الطلاب</DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="student">الطالب *</Label>
                  <Select value={formData.studentId} onValueChange={(value) => setFormData({ ...formData, studentId: value })}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="اختر الطالب" />
                    </SelectTrigger>
                    <SelectContent>
                      {sortedStudents.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground text-center">لا يوجد طلاب متاحين</div>
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

                <div className="space-y-2">
                  <Label htmlFor="title">عنوان الاجتماع *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="مثال: مناقشة التقدم في المشروع"
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">الوصف</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="أضف تفاصيل الاجتماع..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">التاريخ *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="time">الوقت *</Label>
                    <Input
                      id="time"
                      type="time"
                      min="08:00"
                      max="19:59"
                      value={formData.time}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                      className="h-11"
                    />
                    <p className="text-xs text-muted-foreground">من 8 صباحاً إلى 8 مساءً</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">المكان</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="مثال: مكتب المشرف - الدور الثالث"
                    className="h-11"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-11"
                  disabled={sortedStudents.length === 0 || submittingMeeting}
                >
                  {submittingMeeting ? "جارٍ الجدولة..." : "جدولة الاجتماع"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {!authLoading && !loading && meetingRequests.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">طلبات الاجتماع الواردة</h2>
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
                        <div className="mt-2 text-sm text-muted-foreground">من: {req.studentName}</div>
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
                            ? "قيد المراجعة"
                            : req.status === "approved"
                              ? "تمت الموافقة"
                              : "مرفوض"}
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
                        <p className="text-xs text-muted-foreground">التاريخ</p>
                        <p className="text-sm font-medium">
                          {req.date ? new Date(req.date).toLocaleDateString("ar-EG") : "غير محدد"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">الوقت</p>
                        <p className="text-sm font-medium">{req.time || "غير محدد"}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2">
                      {req.status === "pending" && (
                        <>
                          <Button
                            onClick={() => approveRequest(req)}
                            className="rounded-lg"
                            disabled={processingRequestId === req.id}
                          >
                            {processingRequestId === req.id ? "..." : "الموافقة"}
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => rejectRequest(req)}
                            className="rounded-lg"
                            disabled={processingRequestId === req.id}
                          >
                            {processingRequestId === req.id ? "..." : "رفض"}
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
            <CardContent className="p-8">
              <p className="text-center text-muted-foreground">جاري التحميل...</p>
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="border-destructive/50 animate-in fade-in duration-500">
            <CardContent className="p-6 sm:p-8">
              <div className="text-center space-y-4">
                <div className="text-destructive">
                  <h3 className="text-lg font-semibold">حدث خطأ</h3>
                  <p className="text-sm mt-2">{error}</p>
                </div>
                <Button onClick={fetchData} variant="outline">
                  إعادة المحاولة
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
                  <h3 className="text-lg sm:text-xl font-semibold">لا توجد اجتماعات مجدولة</h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                    {students.length === 0
                      ? "لا يوجد طلاب مرتبطين بك حالياً. يجب أن يكون لديك طلاب لجدولة اجتماعات."
                      : "ابدأ بجدولة اجتماعات مع الطلاب لمتابعة تقدمهم في المشاريع"}
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
                    <p className="text-sm font-medium text-muted-foreground">إجمالي الاجتماعات</p>
                    <p className="text-2xl sm:text-3xl font-bold text-primary mt-1">{meetings.length}</p>
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
                        {meeting.status === "scheduled" ? "مجدول" : meeting.status === "completed" ? "مكتمل" : "ملغي"}
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
                          <p className="text-xs font-medium text-muted-foreground">التاريخ</p>
                          <p className="text-sm font-semibold truncate">
                            {meeting.date?.seconds
                              ? new Date(meeting.date.seconds * 1000).toLocaleDateString("ar-SA", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })
                              : "غير محدد"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 group-hover:bg-muted transition-colors">
                        <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center shadow-sm flex-shrink-0">
                          <Clock className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-muted-foreground">الوقت</p>
                          <p className="text-sm font-semibold truncate">{meeting.time || "غير محدد"}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 group-hover:bg-muted transition-colors">
                        <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center shadow-sm flex-shrink-0">
                          <MapPin className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-muted-foreground">المكان</p>
                          <p className="text-sm font-semibold truncate">{meeting.location || "غير محدد"}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
