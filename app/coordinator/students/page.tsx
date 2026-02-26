"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Users, UserPlus, UserCheck } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  setDoc,
  getDoc,
  Timestamp,
} from "firebase/firestore"
import { db } from "@/lib/firebase/config"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { useAuth } from "@/lib/contexts/auth-context"
import { useLanguage } from "@/lib/contexts/language-context"
import { createUserWithEmailAndPassword } from "firebase/auth"
import { auth } from "@/lib/firebase/config"
import { coordinatorSidebarItems } from "@/lib/constants/coordinator-sidebar"

type AnyDoc = Record<string, any>

export default function CoordinatorStudents() {
  const { loading: authLoading } = useAuth()
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
  const [students, setStudents] = useState<AnyDoc[]>([])
  const [supervisors, setSupervisors] = useState<AnyDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStudent, setSelectedStudent] = useState<AnyDoc | null>(null)
  const [selectedSupervisorId, setSelectedSupervisorId] = useState("")
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
  const [isAddStudentDialogOpen, setIsAddStudentDialogOpen] = useState(false)
  const [departments, setDepartments] = useState<AnyDoc[]>([])
  const [newStudent, setNewStudent] = useState({
    name: "",
    email: "",
    password: "",
    studentId: "", // رقم جامعي
    department: "",
    phone: "",
  })

  const [isConfirmChangeOpen, setIsConfirmChangeOpen] = useState(false)
  const [pendingSupervisorId, setPendingSupervisorId] = useState("")
  const [currentSupervisorName, setCurrentSupervisorName] = useState("")
  const [targetSupervisorName, setTargetSupervisorName] = useState("")

  const fetchData = async () => {
    try {
      setLoading(true)

      const studentsQuery = query(collection(db, "users"), where("role", "==", "student"))
      const studentsSnapshot = await getDocs(studentsQuery)
      const studentsData = studentsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }))

      const supervisorsQuery = query(collection(db, "users"), where("role", "==", "supervisor"))
      const supervisorsSnapshot = await getDocs(supervisorsQuery)
      const supervisorsData = supervisorsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }))

      const departmentsQuery = query(collection(db, "departments"), where("isActive", "==", true))
      const departmentsSnapshot = await getDocs(departmentsQuery)
      const departmentsData = departmentsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      setDepartments(departmentsData)

      const supervisorsWithCounts = await Promise.all(
        supervisorsData.map(async (supervisor) => {
          const studentCount = studentsData.filter((s) => s.supervisorId === supervisor.id).length
          return { ...supervisor, studentCount }
        }),
      )

      setStudents(studentsData)
      setSupervisors(supervisorsWithCounts)
    } catch (error) {
      console.error("Error fetching data:", error)
      toast.error(t("errorLoadingData"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // ✅ Helper: get real Firebase UID for a team member object (by email OR university studentId)
  const resolveUserUidFromMember = async (member: any): Promise<string | null> => {
    try {
      const email = typeof member?.email === "string" ? member.email.trim().toLowerCase() : ""
      const uniStudentId = typeof member?.studentId === "string" ? member.studentId.trim() : ""

      // 1) Try by email
      if (email) {
        const q1 = query(collection(db, "users"), where("email", "==", email))
        const snap1 = await getDocs(q1)
        if (!snap1.empty) return snap1.docs[0].id
      }

      // 2) Try by university studentId (field name in users is also studentId)
      if (uniStudentId) {
        const q2 = query(collection(db, "users"), where("studentId", "==", uniStudentId))
        const snap2 = await getDocs(q2)
        if (!snap2.empty) return snap2.docs[0].id
      }

      return null
    } catch (e) {
      console.error("resolveUserUidFromMember error:", e)
      return null
    }
  }

  const handleAssignSupervisor = async () => {
    if (!selectedStudent || !selectedSupervisorId) {
      toast.error(t("pleaseSelectSupervisor"))
      return
    }

    const oldSupervisorId = selectedStudent.supervisorId || ""
    const hasProject = !!selectedStudent.projectId
    const isChangingSupervisor = oldSupervisorId && oldSupervisorId !== selectedSupervisorId

    if ((hasProject || isChangingSupervisor) && !isConfirmChangeOpen) {
      const oldName = supervisors.find((s) => s.id === oldSupervisorId)?.name || t("notSpecified")
      const newName = supervisors.find((s) => s.id === selectedSupervisorId)?.name || t("notSpecified")

      setCurrentSupervisorName(oldSupervisorId ? oldName : t("None"))
      setTargetSupervisorName(newName)
      setPendingSupervisorId(selectedSupervisorId)
      setIsConfirmChangeOpen(true)
      return
    }

    try {
      const supervisorToApply = pendingSupervisorId || selectedSupervisorId

      // ✅ Update selected student's supervisor
      await updateDoc(doc(db, "users", selectedStudent.id), {
        supervisorId: supervisorToApply,
        updatedAt: Timestamp.now(),
      })

      // ✅ If student has project, update project + team members users
      if (selectedStudent.projectId) {
        const projectRef = doc(db, "projects", selectedStudent.projectId)
        const projectDoc = await getDoc(projectRef)

        if (projectDoc.exists()) {
          const projectData: any = projectDoc.data()

          // Update project supervisor
          await updateDoc(projectRef, {
            supervisorId: supervisorToApply,
            updatedAt: Timestamp.now(),
          })

          // ✅ FIX: teamMembers are OBJECTS (not UIDs). Resolve each to real user uid then update users docs.
          const rawMembers = projectData.teamMembers

          if (Array.isArray(rawMembers) && rawMembers.length > 0) {
            const resolvedUids: string[] = []

            for (const m of rawMembers) {
              const uid = await resolveUserUidFromMember(m)
              if (uid) resolvedUids.push(uid)
            }

            // remove duplicates
            const uniqueUids = Array.from(new Set(resolvedUids))

            if (uniqueUids.length > 0) {
              await Promise.all(
                uniqueUids.map((uid) =>
                  // ✅ use setDoc merge to avoid "No document to update" if a doc is missing for any reason
                  setDoc(
                    doc(db, "users", uid),
                    { supervisorId: supervisorToApply, updatedAt: Timestamp.now() },
                    { merge: true },
                  ),
                ),
              )
            } else {
              console.warn("No team member UIDs resolved from teamMembers:", rawMembers)
            }
          }
        } else {
          console.warn("Project not found:", selectedStudent.projectId)
        }
      }

      toast.success(t("supervisorAssignedSuccessfully"))
      setIsAssignDialogOpen(false)
      setIsConfirmChangeOpen(false)
      setPendingSupervisorId("")
      setCurrentSupervisorName("")
      setTargetSupervisorName("")
      setSelectedStudent(null)
      setSelectedSupervisorId("")
      fetchData()
    } catch (error) {
      console.error("Error assigning supervisor:", error)
      toast.error(t("errorAssigningSupervisor"))
    }
  }

  const handleAddStudent = async () => {
    if (
      !newStudent.name ||
      !newStudent.email ||
      !newStudent.password ||
      !newStudent.studentId ||
      !newStudent.department ||
      !newStudent.phone
    ) {
      toast.error(t("pleaseFillAllRequiredFields"))
      return
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, newStudent.email, newStudent.password)

      await setDoc(doc(db, "users", userCredential.user.uid), {
        uid: userCredential.user.uid,
        name: newStudent.name,
        email: newStudent.email.trim().toLowerCase(),
        studentId: newStudent.studentId, // رقم جامعي
        department: newStudent.department,
        phone: newStudent.phone,
        role: "student",
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })

      toast.success(t("studentAddedSuccessfully"))
      setIsAddStudentDialogOpen(false)
      setNewStudent({
        name: "",
        email: "",
        password: "",
        studentId: "",
        department: "",
        phone: "",
      })
      fetchData()
    } catch (error: any) {
      console.error("Error adding student:", error)
      if (error.code === "auth/email-already-in-use") {
        toast.error(t("emailAlreadyInUse"))
      } else {
        toast.error(t("errorAddingStudent"))
      }
    }
  }

  const openAssignDialog = (student: AnyDoc) => {
    setSelectedStudent(student)
    setSelectedSupervisorId(student.supervisorId || "")
    setIsAssignDialogOpen(true)
  }

  if (authLoading || loading) {
    return (
      <DashboardLayout sidebarItems={coordinatorSidebarItems} requiredRole="coordinator">
        <div className="p-8">
          <Card className="rounded-xl">
            <CardContent className="p-8">
              <p className="text-center text-muted-foreground">{t("loading")}</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout sidebarItems={coordinatorSidebarItems} requiredRole="coordinator">
      <div className="p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t("manageStudents")}</h1>
            <p className="text-muted-foreground mt-2">{t("assignSupervisorsAndTrackStudents")}</p>
          </div>
          <Button onClick={() => setIsAddStudentDialogOpen(true)} className="rounded-lg">
            <UserPlus className="w-4 h-4 ml-2" />
            {t("addNewStudent")}
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("totalStudents")}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{students.length}</div>
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("studentsWithoutSupervisor")}</CardTitle>
              <UserPlus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{students.filter((s) => !s.supervisorId).length}</div>
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("studentsWithSupervisor")}</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{students.filter((s) => s.supervisorId).length}</div>
            </CardContent>
          </Card>
        </div>

        {students.length === 0 ? (
          <Card className="rounded-xl">
            <CardContent className="p-8">
              <div className="text-center space-y-4">
                <Users className="w-16 h-16 mx-auto text-muted-foreground" />
                <div>
                  <h3 className="text-lg font-semibold">{t("noStudentsYet")}</h3>
                  <p className="text-sm text-muted-foreground mt-2">{t("studentsWillAppearAfterRegistration")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle>{t("studentsList")}</CardTitle>
              <CardDescription>{t("allStudentsInSystem")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {students.map((student) => {
                  const supervisor = supervisors.find((s) => s.id === student.supervisorId)
                  return (
                    <div
                      key={student.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-3">
                          <p className="font-medium">{student.name}</p>
                          <Badge variant="outline" className="rounded-lg">
                            {student.studentId}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{student.email}</p>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">{t("department")}:</span>
                          <span>
                            {departments.find((d) => d.code === student.department)?.name ||
                              student.department ||
                              t("notSpecified")}
                          </span>
                        </div>
                        {supervisor && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">{t("supervisor")}:</span>
                            <span className="font-medium text-primary">{supervisor.name}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {student.supervisorId ? (
                          <Badge className="rounded-lg bg-green-500">{t("assigned")}</Badge>
                        ) : (
                          <Badge variant="secondary" className="rounded-lg">
                            {t("noSupervisor")}
                          </Badge>
                        )}
                        <Button onClick={() => openAssignDialog(student)} size="sm" className="rounded-lg">
                          {student.supervisorId ? t("changeSupervisor") : t("assignSupervisor")}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Assign Dialog */}
        <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
          <DialogContent className="rounded-xl">
            <DialogHeader>
              <DialogTitle>{t("assignSupervisor")}</DialogTitle>
              <DialogDescription>{t("selectSupervisorForStudent")} {selectedStudent?.name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t("supervisor")}</Label>
                <Select value={selectedSupervisorId} onValueChange={setSelectedSupervisorId}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder={t("selectSupervisor")} />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    {supervisors.map((supervisor) => (
                      <SelectItem key={supervisor.id} value={supervisor.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{supervisor.name}</span>
                          <span className="text-xs text-muted-foreground mr-2">({supervisor.studentCount} {t("student")})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedSupervisorId && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    {t("selectedSupervisor")}:{" "}
                    <span className="font-medium text-foreground">
                      {supervisors.find((s) => s.id === selectedSupervisorId)?.name}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    عدد الطلاب الحالي:{" "}
                    <span className="font-medium text-foreground">
                      {supervisors.find((s) => s.id === selectedSupervisorId)?.studentCount}
                    </span>
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAssignDialogOpen(false)
                  setIsConfirmChangeOpen(false)
                  setPendingSupervisorId("")
                  setCurrentSupervisorName("")
                  setTargetSupervisorName("")
                }}
                className="rounded-lg"
              >
                {t("cancel")}
              </Button>
              <Button onClick={handleAssignSupervisor} className="rounded-lg">
                {t("assign")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirm Change Dialog */}
        <Dialog open={isConfirmChangeOpen} onOpenChange={setIsConfirmChangeOpen}>
          <DialogContent className="rounded-xl">
            <DialogHeader>
              <DialogTitle>{t("confirmChangeSupervisor")}</DialogTitle>
              <DialogDescription>{t("studentAlreadyAssignedToProjectOrSupervisor")}</DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">
                  الطالب: <span className="font-medium text-foreground">{selectedStudent?.name}</span>
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  المشرف الحالي: <span className="font-medium text-foreground">{currentSupervisorName}</span>
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  المشرف الجديد: <span className="font-medium text-foreground">{targetSupervisorName}</span>
                </p>

                {selectedStudent?.projectId && (
                  <p className="text-sm text-amber-700 mt-2">
                    {t("alertStudentHasProjectLinked")} 
                  </p>
                )}
              </div>

              <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-sm">
               {t("AreYouSureYouWantToChangeTheSupervisor")}
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsConfirmChangeOpen(false)
                  setPendingSupervisorId("")
                  setCurrentSupervisorName("")
                  setTargetSupervisorName("")
                }}
                className="rounded-lg"
              >
                {t("cancel")}
              </Button>
              <Button onClick={handleAssignSupervisor} className="rounded-lg">
               {t("YesChange")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Student Dialog */}
        <Dialog open={isAddStudentDialogOpen} onOpenChange={setIsAddStudentDialogOpen}>
          <DialogContent className="rounded-xl max-w-md">
            <DialogHeader>
              <DialogTitle>{t("AddNewStudent")}</DialogTitle>
              <DialogDescription>{t("addNewStudentDescription")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t("fullName")}  *</Label>
                <Input
                  value={newStudent.name}
                  onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                  placeholder={t("enterFullName")}
                  className="rounded-lg"
                />
              </div>
              <div>
                <Label>{t("email")} *</Label>
                <Input
                  type="email"
                  value={newStudent.email}
                  onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                  placeholder="student@example.com"
                  className="rounded-lg"
                />
              </div>
              <div>
                <Label>{t("password")} *</Label>
                <Input
                  type="password"
                  value={newStudent.password}
                  onChange={(e) => setNewStudent({ ...newStudent, password: e.target.value })}
                  placeholder={t("enterPassword")}
                  className="rounded-lg"
                  minLength={6}
                />
              </div>
              <div>
                <Label>{t("studentId")} *</Label>
                <Input
                  value={newStudent.studentId}
                  onChange={(e) => setNewStudent({ ...newStudent, studentId: e.target.value })}
                  placeholder={t("enterStudentId")}
                  className="rounded-lg"
                />
              </div>

              <div>
                <Label>{t("department")} *</Label>
                <Select
                  value={newStudent.department}
                  onValueChange={(value) => setNewStudent({ ...newStudent, department: value })}
                >
                  <SelectTrigger className="rounded-lg border-2">
                    <SelectValue placeholder={t("selectDepartment")}>
                      {newStudent.department && departments.length > 0 ? (
                        <span className="text-foreground font-medium">
                          {departments.find((d) => d.code === newStudent.department)?.name || newStudent.department}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{t("selectDepartment")}</span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    {departments.length === 0 ? (
                      <div className="p-3 text-sm text-center">
                        <p className="text-foreground font-medium">{t("noDepartmentsAvailable")}</p>
                        <p className="text-xs text-muted-foreground mt-1">{t("addDepartmentsFromManagementPage")}</p>
                      </div>
                    ) : (
                      departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.code} className="cursor-pointer">
                          <div className="flex items-center justify-between w-full">
                            <span className="font-medium text-foreground">{dept.name}</span>
                            <span className="text-xs text-muted-foreground mr-2">({dept.code})</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>

                {newStudent.department && departments.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("selectedDepartment")}:{" "}
                    <span className="font-medium text-foreground">
                      {departments.find((d) => d.code === newStudent.department)?.name}
                    </span>
                  </p>
                )}
              </div>

              <div>
                <Label>{t("phone")} *</Label>
                <Input
                  value={newStudent.phone}
                  onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })}
                  placeholder={t("enterPhone")}
                  className="rounded-lg"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddStudentDialogOpen(false)} className="rounded-lg">
                {t("cancel")}
              </Button>
              <Button onClick={handleAddStudent} className="rounded-lg">
                {t("addStudent")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
