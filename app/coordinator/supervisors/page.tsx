"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { coordinatorSidebarItems } from "@/lib/constants/coordinator-sidebar"
import { Users, Bell, Plus, UserPlus } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { collection, getDocs, query, where, setDoc, doc } from "firebase/firestore"
import { db, auth } from "@/lib/firebase/config"
import { createUserWithEmailAndPassword } from "firebase/auth"
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
import { toast } from "sonner"
import { useAuth } from "@/lib/contexts/auth-context"
import { useLanguage } from "@/lib/contexts/language-context"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getDepartments, getDepartmentName, type Department } from "@/lib/utils/department-helper"

export default function CoordinatorSupervisors() {
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
  const [supervisors, setSupervisors] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isStudentDialogOpen, setIsStudentDialogOpen] = useState(false)
  const [departments, setDepartments] = useState<Department[]>([])
  const [newSupervisor, setNewSupervisor] = useState({
    name: "",
    email: "",
    password: "",
    supervisorId: "",
    department: "",
    phone: "",
  })
  const [newStudent, setNewStudent] = useState({
    name: "",
    email: "",
    password: "",
    studentId: "",
    department: "",
    phone: "",
  })

  const fetchSupervisors = async () => {
    try {
      const supervisorsQuery = query(collection(db, "users"), where("role", "==", "supervisor"))
      const supervisorsSnapshot = await getDocs(supervisorsQuery)
      const supervisorsData = await Promise.all(
        supervisorsSnapshot.docs.map(async (doc) => {
          const supervisorData = { id: doc.id, ...doc.data() }

          const projectsQuery = query(collection(db, "projects"), where("supervisorId", "==", doc.id))
          const projectsSnapshot = await getDocs(projectsQuery)

          return {
            ...supervisorData,
            projectsCount: projectsSnapshot.size,
          }
        }),
      )
      setSupervisors(supervisorsData)
    } catch (error) {
      console.error("Error fetching supervisors:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStudents = async () => {
    try {
      const studentsQuery = query(collection(db, "users"), where("role", "==", "student"))
      const studentsSnapshot = await getDocs(studentsQuery)
      const studentsData = studentsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      setStudents(studentsData)
    } catch (error) {
      console.error("Error fetching students:", error)
    }
  }

  const fetchDepartments = async () => {
    const depts = await getDepartments()
    setDepartments(depts)
  }

  useEffect(() => {
    fetchSupervisors()
    fetchStudents()
    fetchDepartments()
  }, [])

  const handleAddSupervisor = async () => {
    if (
      !newSupervisor.name ||
      !newSupervisor.email ||
      !newSupervisor.password ||
      !newSupervisor.supervisorId ||
      !newSupervisor.department ||
      !newSupervisor.phone
    ) {
      toast.error(t("pleaseFillAllRequiredFields"))
      return
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, newSupervisor.email, newSupervisor.password)
      await setDoc(doc(db, "users", userCredential.user.uid), {
        uid: userCredential.user.uid,
        name: newSupervisor.name,
        email: newSupervisor.email,
        supervisorId: newSupervisor.supervisorId,
        department: newSupervisor.department,
        phone: newSupervisor.phone,
        role: "supervisor",
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      toast.success(t("supervisorAddedSuccessfully"))
      setIsDialogOpen(false)
      setNewSupervisor({ name: "", email: "", password: "", supervisorId: "", department: "", phone: "" })
      fetchSupervisors()
    } catch (error: any) {
      console.error("Error adding supervisor:", error)
      if (error.code === "auth/email-already-in-use") {
        toast.error(t("emailAlreadyInUse"))
      } else {
        toast.error(t("errorAddingSupervisor"))
      }
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
        email: newStudent.email,
        studentId: newStudent.studentId,
        department: newStudent.department,
        phone: newStudent.phone,
        role: "student",
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      toast.success(t("studentAdded"))
      setIsStudentDialogOpen(false)
      setNewStudent({ name: "", email: "", password: "", studentId: "", department: "", phone: "" })
      fetchStudents()
    } catch (error: any) {
      console.error("Error adding student:", error)
      if (error.code === "auth/email-already-in-use") {
        toast.error(t("emailAlreadyInUse"))
      } else {
        toast.error(t("errorAddingStudent"))
      }
    }
  }

  if (authLoading) {
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
            <h1 className="text-3xl font-bold">{t("supervisorsAndStudents")}</h1>
            <p className="text-muted-foreground mt-2">{t("manageSupervisorsAndStudents")}</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-lg">
                  <Plus className="w-4 h-4 ml-2" />
                  {t("addSupervisor")}
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-xl">
                <DialogHeader>
                  <DialogTitle>{t("addNewSupervisor")}</DialogTitle>
                  <DialogDescription>{t("enterSupervisorDetails")}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">{t("fullName")} *</Label>
                    <Input
                      id="name"
                      value={newSupervisor.name}
                      onChange={(e) => setNewSupervisor({ ...newSupervisor, name: e.target.value })}
                      placeholder={t("egDrAhmedMohamed")}
                      className="rounded-lg"
                    />
                  </div>
                  <div>
                    <Label htmlFor="supervisorId">{t("supervisorId")} *</Label>
                    <Input
                      id="supervisorId"
                      value={newSupervisor.supervisorId}
                      onChange={(e) => setNewSupervisor({ ...newSupervisor, supervisorId: e.target.value })}
                      placeholder={t("egS12345")}
                      className="rounded-lg"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">{t("phone")} *</Label>
                    <Input
                      id="phone"
                      value={newSupervisor.phone}
                      onChange={(e) => setNewSupervisor({ ...newSupervisor, phone: e.target.value })}
                      placeholder="+973 XXXX XXXX"
                      className="rounded-lg"
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">{t("password")} *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={newSupervisor.password}
                      onChange={(e) => setNewSupervisor({ ...newSupervisor, password: e.target.value })}
                      placeholder={t("enterPassword")}
                      className="rounded-lg"
                      minLength={6}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">{t("email")} *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newSupervisor.email}
                      onChange={(e) => setNewSupervisor({ ...newSupervisor, email: e.target.value })}
                      placeholder="supervisor@university.edu"
                      className="rounded-lg"
                    />
                  </div>
                  <div>
                    <Label htmlFor="department">{t("department")} *</Label>
                    <Select
                      value={newSupervisor.department}
                      onValueChange={(value) => setNewSupervisor({ ...newSupervisor, department: value })}
                    >
                      <SelectTrigger className="rounded-lg">
                        <SelectValue placeholder={t("chooseDepartment")}>
                          {newSupervisor.department
                            ? departments.find((d) => d.code === newSupervisor.department)?.nameAr || t("chooseDepartment")
                            : t("chooseDepartment")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="rounded-lg">
                        {departments.length === 0 ? (
                          <div className="p-2 text-center text-sm text-muted-foreground">{t("loading")}</div>
                        ) : (
                          departments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.code} className="font-medium">
                              {dept.nameAr}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-lg">
                    {t("cancel")}
                  </Button>
                  <Button onClick={handleAddSupervisor} className="rounded-lg">
                    {t("add")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={isStudentDialogOpen} onOpenChange={setIsStudentDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="rounded-lg bg-transparent">
                  <UserPlus className="w-4 h-4 ml-2" />
                   {t("addStudent")}
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-xl">
                <DialogHeader>
                  <DialogTitle>{t("addNewStudent")}</DialogTitle>
                  <DialogDescription>{t("enterStudentDetails")}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="studentName"> {t("fullName")} *</Label>
                    <Input
                      id="studentName"
                      value={newStudent.name}
                      onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                      placeholder={t("egAhmedMohamed")}
                      className="rounded-lg"
                    />
                  </div>
                  <div>
                    <Label htmlFor="studentId"> {t("studentId")} *</Label>
                    <Input
                      id="studentId"
                      value={newStudent.studentId}
                      onChange={(e) => setNewStudent({ ...newStudent, studentId: e.target.value })}
                      placeholder="202012345"
                      className="rounded-lg"
                    />
                  </div>
                  <div>
                    <Label htmlFor="studentPhone"> {t("phone")} *</Label>
                    <Input
                      id="studentPhone"
                      value={newStudent.phone}
                      onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })}
                      placeholder="+973 XXXX XXXX"
                      className="rounded-lg"
                    />
                  </div>
                  <div>
                    <Label htmlFor="studentPassword"> {t("password")} *</Label>
                    <Input
                      id="studentPassword"
                      type="password"
                      value={newStudent.password}
                      onChange={(e) => setNewStudent({ ...newStudent, password: e.target.value })}
                      placeholder={t("enterPassword")}
                      className="rounded-lg"
                      minLength={6}
                    />
                  </div>
                  <div>
                    <Label htmlFor="studentEmail"> {t("email")} *</Label>
                    <Input
                      id="studentEmail"
                      type="email"
                      value={newStudent.email}
                      onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                      placeholder="student@university.edu"
                      className="rounded-lg"
                    />
                  </div>
                  <div>
                    <Label htmlFor="studentDepartment">{t("department")} *</Label>
                    <Select
                      value={newStudent.department}
                      onValueChange={(value) => setNewStudent({ ...newStudent, department: value })}
                    >
                      <SelectTrigger className="rounded-lg">
                        <SelectValue placeholder={t("selectDepartment")}>
                          {newStudent.department
                            ? departments.find((d) => d.code === newStudent.department)?.nameAr || t("selectDepartment")
                            : t("selectDepartment")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="rounded-lg">
                        {departments.length === 0 ? (
                          <div className="p-2 text-center text-sm text-muted-foreground">{t("loading")}</div>
                        ) : (
                          departments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.code} className="font-medium">
                              {dept.nameAr}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsStudentDialogOpen(false)} className="rounded-lg">
                    {t("cancel")}
                  </Button>
                  <Button onClick={handleAddStudent} className="rounded-lg">
                    {t("add")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs defaultValue="supervisors" className="space-y-6">
          <TabsList className="rounded-lg">
            <TabsTrigger value="supervisors" className="rounded-lg">
              {t("supervisors")} ({supervisors.length})
            </TabsTrigger>
            <TabsTrigger value="students" className="rounded-lg">
              {t("students")} ({students.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="supervisors">
            {loading ? (
              <Card className="rounded-xl">
                <CardContent className="p-8">
                  <p className="text-center text-muted-foreground">{t("loading")}</p>
                </CardContent>
              </Card>
            ) : supervisors.length === 0 ? (
              <Card className="rounded-xl">
                <CardContent className="p-8">
                  <div className="text-center space-y-4">
                    <Users className="w-16 h-16 mx-auto text-muted-foreground" />
                    <div>
                      <h3 className="text-lg font-semibold">{t("noSupervisorsYet")}</h3>
                      <p className="text-sm text-muted-foreground mt-2">{t("addNewSupervisors")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {supervisors.map((supervisor) => (
                  <Card key={supervisor.id} className="rounded-xl">
                    <CardHeader className="space-y-3">
                      <CardTitle className="break-words">
                        {supervisor.name}
                      </CardTitle>

                      <div className="flex items-center justify-between">
                        <CardDescription>
                          {supervisor.department}
                        </CardDescription>

                        <Badge className="rounded-lg">
                          {supervisor.projectsCount} {t("projects")}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Bell className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground truncate">{supervisor.email}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground"> {t("numberOfProjects")}: </span>
                        <span className="font-medium">{supervisor.projectsCount}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="students">
            {loading ? (
              <Card className="rounded-xl">
                <CardContent className="p-8">
                  <p className="text-center text-muted-foreground">{t("loading")}...</p>
                </CardContent>
              </Card>
            ) : students.length === 0 ? (
              <Card className="rounded-xl">
                <CardContent className="p-8">
                  <div className="text-center space-y-4">
                    <Users className="w-16 h-16 mx-auto text-muted-foreground" />
                    <div>
                      <h3 className="text-lg font-semibold">{t("noStudentsYet")}</h3>
                      <p className="text-sm text-muted-foreground mt-2">{t("addNewStudents")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {students.map((student) => (
                  <Card key={student.id} className="rounded-xl">
                    <CardHeader>
                        <div className="flex flex-col items-center gap-2 text-center">
                          <CardTitle>{student.name}</CardTitle>
                          <CardDescription>{student.studentId}</CardDescription>
                          <Badge
                            variant="secondary"
                            className="rounded-lg px-3 py-1 whitespace-normal break-words max-w-[140px] text-center"
                          >
                            {getDepartmentName(student.department, departments)}
                          </Badge>
                        </div>
                      </CardHeader>

                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Bell className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground truncate">{student.email}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
