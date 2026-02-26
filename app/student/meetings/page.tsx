"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { studentSidebarItems } from "@/lib/constants/student-sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/lib/contexts/auth-context"
import { useLanguage } from "@/lib/contexts/language-context"
import { useState, useEffect } from "react"
import { CalendarIcon, Clock, Plus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { getFirebaseDb } from "@/lib/firebase/config"
import { collection, addDoc, query, where, getDocs, Timestamp } from "firebase/firestore"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getDocument } from "@/lib/firebase/db"

export default function MeetingsPage() {
  const { userData } = useAuth()
  const { t, language } = useLanguage()
  const [meetings, setMeetings] = useState<any[]>([])
  const [meetingRequests, setMeetingRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [supervisorName, setSupervisorName] = useState("")
  const [resolvedProjectId, setResolvedProjectId] = useState<string | null>(null)
  const [resolvedSupervisorId, setResolvedSupervisorId] = useState<string | null>(null)
  const [requestData, setRequestData] = useState({
    title: "",
    notes: "",
    date: "",
    time: "",
  })

  const resolveProjectAndSupervisor = async (): Promise<{ pid: string | null; sid: string | null }> => {
    if (!userData?.uid) return { pid: null, sid: null }
    const db = getFirebaseDb()

    // 1) team project
    const teamQ = query(collection(db, "projects"), where("studentIds", "array-contains", userData.uid))
    const teamSnap = await getDocs(teamQ)
    if (!teamSnap.empty) {
      const project = teamSnap.docs[0]
      const data = project.data()
      return { pid: project.id, sid: data.supervisorId || null }
    }

    // 2) solo project
    const soloQ = query(collection(db, "projects"), where("studentId", "==", userData.uid))
    const soloSnap = await getDocs(soloQ)
    if (!soloSnap.empty) {
      const project = soloSnap.docs[0]
      const data = project.data()
      return { pid: project.id, sid: data.supervisorId || null }
    }

    // 3) fallback
    return { pid: userData.projectId || null, sid: userData.supervisorId || null }
  }

  const fetchMeetings = async () => {
    if (!userData?.uid) return

    try {
      const db = getFirebaseDb()

      const meetingsQuery = query(
        collection(db, "meetings"),
        where("studentId", "==", userData.uid)
      )
      const meetingsSnapshot = await getDocs(meetingsQuery)
      const meetingsData = meetingsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      setMeetings(
        meetingsData.sort(
          (a: any, b: any) => b.date?.seconds - a.date?.seconds
        )
      )

      const requestsQuery = query(
        collection(db, "meeting_requests"),
        where("studentId", "==", userData.uid)
      )
      const requestsSnapshot = await getDocs(requestsQuery)
      const requestsData = requestsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      setMeetingRequests(
        requestsData.sort(
          (a: any, b: any) => b.createdAt?.seconds - a.createdAt?.seconds
        )
      )
    } catch (error) {
      console.error("Error fetching meetings:", error)
      toast.error(t("errorLoadingData"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const init = async () => {
      if (!userData?.uid) return
      const { pid, sid } = await resolveProjectAndSupervisor()
      setResolvedProjectId(pid)
      setResolvedSupervisorId(sid)

      if (sid) {
        try {
          const supervisor = await getDocument("users", sid)
          if (supervisor) {
            setSupervisorName(supervisor.name || t("notSpecified"))
          }
        } catch (error) {
          console.error("Error fetching supervisor:", error)
        }
      }

      await fetchMeetings()
    }

    init()
  }, [userData])

  const validateTime = (time: string) => {
    if (!time) return false
    const [hours] = time.split(":").map(Number)
    return hours >= 8 && hours < 20
  }

  const handleRequestMeeting = async () => {
    if (!userData?.uid) {
      toast.error(t("errorMessage"))
      return
    }

    if (!requestData.title || !requestData.date || !requestData.time) {
      toast.error(t("fieldRequired"))
      return
    }

    if (!validateTime(requestData.time)) {
      toast.error(t("meetingsBetweenHours"))
      return
    }

    try {
      const db = getFirebaseDb()

      const meetingDateTime = new Date(
        `${requestData.date}T${requestData.time}`
      )

      const projectId = resolvedProjectId || userData.projectId || ""
      const supervisorId = resolvedSupervisorId || userData.supervisorId || ""

      await addDoc(collection(db, "meeting_requests"), {
        studentId: userData.uid,
        studentName: userData.name,
        projectId,
        supervisorId,
        title: requestData.title,
        notes: requestData.notes,
        date: Timestamp.fromDate(meetingDateTime),
        time: requestData.time,
        status: "pending",
        createdAt: Timestamp.now(),
      })

      toast.success(t("savedSuccessfully"))
      setIsDialogOpen(false)
      setRequestData({
        title: "",
        notes: "",
        date: "",
        time: "",
      })
      fetchMeetings()
    } catch (error) {
      console.error("Error requesting meeting:", error)
      toast.error(t("errorMessage"))
    }
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp?.seconds) return ""
    const date = new Date(timestamp.seconds * 1000)
    return language === "ar"
      ? date.toLocaleDateString("ar-EG")
      : date.toLocaleDateString("en-US")
  }

  return (
    <DashboardLayout sidebarItems={studentSidebarItems} requiredRole="student">
      <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">

        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">{t("meetings")}</h1>
            <p className="text-muted-foreground">
              {t("meetings")} {supervisorName || t("supervisor")}
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                {t("requestMeeting")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("requestMeeting")}</DialogTitle>
                <DialogDescription>
                  {t("requestMeeting")}{" "}
                  {supervisorName || t("supervisor")}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div>
                  <Label>{t("meetingTitle")}</Label>
                  <Input
                    value={requestData.title}
                    onChange={(e) =>
                      setRequestData({ ...requestData, title: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label>{t("meetingNotes")}</Label>
                  <Textarea
                    value={requestData.notes}
                    onChange={(e) =>
                      setRequestData({ ...requestData, notes: e.target.value })
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    type="date"
                    value={requestData.date}
                    onChange={(e) =>
                      setRequestData({ ...requestData, date: e.target.value })
                    }
                  />
                  <Input
                    type="time"
                    min="08:00"
                    max="20:00"
                    value={requestData.time}
                    onChange={(e) =>
                      setRequestData({ ...requestData, time: e.target.value })
                    }
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    className="flex-1"
                  >
                    {t("cancel")}
                  </Button>
                  <Button
                    onClick={handleRequestMeeting}
                    className="flex-1"
                  >
                    {t("send")}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="scheduled">
          <TabsList className="grid grid-cols-2 max-w-md">
            <TabsTrigger value="scheduled">
              {t("scheduled")}
            </TabsTrigger>
            <TabsTrigger value="requests">
              {t("meetingRequests")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scheduled" className="space-y-4">
            {meetings.map((meeting) => (
              <Card key={meeting.id}>
                <CardHeader>
                  <div className="flex justify-between">
                    <CardTitle>{meeting.title}</CardTitle>
                    <Badge>
                      {meeting.status === "scheduled"
                        ? t("scheduled")
                        : t("completed")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p>{formatDate(meeting.date)}</p>
                  <p>{meeting.time}</p>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="requests" className="space-y-4">
            {meetingRequests.map((request) => (
              <Card key={request.id}>
                <CardHeader>
                  <div className="flex justify-between">
                    <CardTitle>{request.title}</CardTitle>
                    <Badge>{request.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p>{formatDate(request.date)}</p>
                  <p>{request.time}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("submittedOn")} {formatDate(request.createdAt)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>

      </div>
    </DashboardLayout>
  )
}
