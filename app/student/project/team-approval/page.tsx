"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/contexts/auth-context"
import { useLanguage } from "@/lib/contexts/language-context"
import { useState, useEffect } from "react"
import { collection, query, where, getDocs, doc, updateDoc, Timestamp } from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase/config"
import { toast } from "sonner"
import { studentSidebarItems } from "@/lib/constants/student-sidebar"
import { Users, Check, X, Clock } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function TeamApprovalPage() {
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
  const [loading, setLoading] = useState(true)
  const [pendingInvites, setPendingInvites] = useState<any[]>([])

  useEffect(() => {
    fetchPendingInvites()
  }, [userData])

  const fetchPendingInvites = async () => {
    if (!userData?.email) return

    try {
      const db = getFirebaseDb()
      const ideasQuery = query(collection(db, "projectIdeas"), where("status", "==", "pending_team_approval"))
      const snapshot = await getDocs(ideasQuery)

      console.log("Found project ideas:", snapshot.docs.length)

      const invites = snapshot.docs
        .map((doc) => {
          const data = doc.data()
          const teamMembers = data.teamMembers || []
          const myInvite = teamMembers.find(
            (member: any) => member.email === userData.email && member.approved === false,
          )

          if (myInvite) {
            console.log("Found pending invite for:", userData.email, "in project:", data.title)
            return {
              id: doc.id,
              ...data,
              myInvite,
            }
          }
          return null
        })
        .filter(Boolean)

      console.log("Total pending invites for user:", invites.length)
      setPendingInvites(invites)
    } catch (error) {
      console.error("Error fetching invites:", error)
      toast.error(t("errorLoadingInvites"))
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (ideaId: string) => {
    try {
      const db = getFirebaseDb()
      const ideaRef = doc(db, "projectIdeas", ideaId)
      const idea = pendingInvites.find((inv) => inv.id === ideaId)

      if (!idea) return

      const updatedTeamMembers = idea.teamMembers.map((member: any) => {
        if (member.email === userData?.email) {
          return {
            ...member,
            userId: userData.uid,
            name: userData.name || member.name,
            studentId: userData.studentId || member.studentId,
            approved: true,
            approvedAt: Timestamp.now(),
          }
        }
        return member
      })

      const allApproved = updatedTeamMembers.every((member: any) => member.approved)

      const updateData: any = {
        teamMembers: updatedTeamMembers,
        teamStatus: allApproved ? "all_approved" : "pending_approval",
      }

      if (allApproved) {
        updateData.status = "pending"

        const { notifyCoordinators } = await import("@/lib/utils/notification-helper")
        await notifyCoordinators(
          "فريق مشروع جاهز للمراجعة",
          `وافق جميع أعضاء فريق المشروع "${idea.title}" على الانضمام. المشروع جاهز للمراجعة النهائية.`,
          "/coordinator/approve-projects",
        )
      }

      await updateDoc(ideaRef, updateData)

      toast.success(t("inviteApproved"))
      fetchPendingInvites()
    } catch (error) {
      console.error("Error approving invite:", error)
      toast.error(t("errorApproving"))
    }
  }

  const handleReject = async (ideaId: string) => {
    try {
      const db = getFirebaseDb()
      const ideaRef = doc(db, "projectIdeas", ideaId)
      const idea = pendingInvites.find((inv) => inv.id === ideaId)

      if (!idea) return

      const updatedTeamMembers = idea.teamMembers.filter((member: any) => member.email !== userData?.email)

      const newTeamStatus = updatedTeamMembers.length < 2 ? "pending_formation" : "pending_approval"

      await updateDoc(ideaRef, {
        teamMembers: updatedTeamMembers,
        teamStatus: newTeamStatus,
      })

      toast.success(t("inviteRejected"))
      fetchPendingInvites()
    } catch (error) {
      console.error("Error rejecting invite:", error)
      toast.error(t("errorRejecting"))
    }
  }

  if (loading) {
    return (
      <DashboardLayout sidebarItems={studentSidebarItems} requiredRole="student">
        <div className="p-8">
          <Card>
            <CardContent className="p-8">
              <p className="text-center text-muted-foreground">
                {t("loading")}
              </p>

            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout sidebarItems={studentSidebarItems} requiredRole="student">
      <div className="p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            {t("teamInvites")}
          </h1>

          <p className="text-muted-foreground mt-2">{t("reviewPendingInvites")}</p>
        </div>

        {pendingInvites.length === 0 ? (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>{t("noPendingInvites")}</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-6">
            {pendingInvites.map((invite) => (
              <Card key={invite.id} className="rounded-xl">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle>{invite.title}</CardTitle>
                      <CardDescription>
                        {t("from")}: {invite.studentName}
                      </CardDescription>

                    </div>
                    <Badge variant="outline">{invite.department}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm">{invite.problemStatement || invite.description}</p>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">{t("teamMembers")}</p>
                    <div className="flex flex-wrap gap-2">
                      {invite.teamMembers.map((member: any, index: number) => (
                        <Badge
                          key={`${invite.id}-member-${member.email}-${index}`}
                          variant={member.approved ? "default" : "secondary"}
                        >
                          {member.name || member.email}
                          {member.role === "leader" && ` (${t("leader")})`}
                          {member.approved && <Check className="h-3 w-3 mr-1" />}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button onClick={() => handleApprove(invite.id)} className="rounded-lg">
                      <Check className="h-4 w-4 mr-2" />
                      {t("approveInvite")}
                    </Button>
                    <Button variant="destructive" onClick={() => handleReject(invite.id)} className="rounded-lg">
                      <X className="h-4 w-4 mr-2" />
                      {t("rejectInvite")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
