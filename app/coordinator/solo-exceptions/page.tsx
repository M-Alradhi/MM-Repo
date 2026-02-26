"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { coordinatorSidebarItems } from "@/lib/constants/coordinator-sidebar"
import { useAuth } from "@/lib/contexts/auth-context"
import { useLanguage } from "@/lib/contexts/language-context"
import { useEffect, useState } from "react"
import { getFirebaseDb } from "@/lib/firebase/config"
import { collection, getDocs, doc, updateDoc, query, where, serverTimestamp } from "firebase/firestore"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { UserCheck, UserX, Search, Shield } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { getDepartments, getDepartmentName, type Department } from "@/lib/utils/department-helper"

export default function SoloProjectExceptions() {
  const { userData } = useAuth()
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
  const [students, setStudents] = useState<any[]>([])
  const [filteredStudents, setFilteredStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStudent, setSelectedStudent] = useState<any>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [departments, setDepartments] = useState<Department[]>([])
  

  const fetchStudents = async () => {
    try {
      setLoading(true)
      const db = getFirebaseDb()
      const studentsQuery = query(collection(db, "users"), where("role", "==", "student"))
      const studentsSnapshot = await getDocs(studentsQuery)
      const studentsData = studentsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      setStudents(studentsData)
      setFilteredStudents(studentsData)
    } catch (error) {
      console.error("Error fetching students:", error)
      toast.error(t("errorLoadingStudents"))
    } finally {
      setLoading(false)
    }
  }

  const fetchDepartments = async () => {
    const depts = await getDepartments()
    setDepartments(depts)
  }

  useEffect(() => {
    fetchStudents()
    fetchDepartments()
  }, [])

  useEffect(() => {
    const filtered = students.filter(
      (student) =>
        student.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.studentId?.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    setFilteredStudents(filtered)
  }, [searchQuery, students])

  const handleToggleException = async (student: any, allow: boolean) => {
    setSelectedStudent({ ...student, newAllowStatus: allow })
    setIsDialogOpen(true)
  }

  const confirmToggleException = async () => {
    if (!selectedStudent || !userData) return

    try {
      setIsProcessing(true)
      const db = getFirebaseDb()

      const updateData: any = {
        allowSoloProject: selectedStudent.newAllowStatus,
      }

      if (selectedStudent.newAllowStatus) {
        updateData.soloProjectApprovedBy = userData.uid
        updateData.soloProjectApprovedAt = serverTimestamp()
      } else {
        updateData.soloProjectApprovedBy = null
        updateData.soloProjectApprovedAt = null
      }

      await updateDoc(doc(db, "users", selectedStudent.id), updateData)

      toast.success(
        selectedStudent.newAllowStatus ? t("studentExceptionGranted") : t("studentExceptionRemoved"),
      )

      setIsDialogOpen(false)
      setSelectedStudent(null)
      fetchStudents()
    } catch (error) {
      console.error("Error updating exception:", error)
      toast.error(t("errorUpdatingException"))
    } finally {
      setIsProcessing(false)
    }
  }

  const studentsWithException = students.filter((s) => s.allowSoloProject)
  const studentsWithoutException = students.filter((s) => !s.allowSoloProject)

  return (
    <DashboardLayout sidebarItems={coordinatorSidebarItems} requiredRole="coordinator">
      <div className="p-8 space-y-8">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-l from-primary to-primary/60 bg-clip-text text-transparent">
           {t("soloProjectExceptions")}
          </h1>
          <p className="text-muted-foreground mt-2">{t("manageStudentsWithSoloProjectExceptions")}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-2 border-green-200 dark:border-green-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                  {t("studentsWithSoloProjectExceptions")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-green-600 dark:text-green-400">
                {studentsWithException.length}
              </div>
              <p className="text-sm text-muted-foreground mt-1">طالب يمكنه تقديم مشروع فردي</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-amber-200 dark:border-amber-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <UserX className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                بدون استثناء
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-amber-600 dark:text-amber-400">
                {studentsWithoutException.length}
              </div>
              <p className="text-sm text-muted-foreground mt-1">طالب يحتاج لفريق</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>قائمة الطلاب</CardTitle>
            <CardDescription>ابحث عن طالب لمنحه أو إلغاء استثناء المشروع الفردي</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="ابحث بالاسم أو البريد الإلكتروني أو الرقم الجامعي..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10 rounded-lg"
              />
            </div>

            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">لا توجد نتائج</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredStudents.map((student) => (
                  <Card key={student.id} className="rounded-lg">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{student.name}</h3>
                            {student.allowSoloProject && (
                              <Badge variant="default" className="gap-1">
                                <Shield className="w-3 h-3" />
                                استثناء فعال
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{student.email}</p>
                          <div className="flex gap-2 mt-1">
                            {student.studentId && (
                              <Badge variant="outline" className="text-xs">
                                {student.studentId}
                              </Badge>
                            )}
                            {student.department && (
                              <Badge variant="outline" className="text-xs">
                                {getDepartmentName(student.department, departments)}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`toggle-${student.id}`} className="text-sm">
                            {student.allowSoloProject ? "إلغاء الاستثناء" : "منح استثناء"}
                          </Label>
                          <Switch
                            id={`toggle-${student.id}`}
                            checked={student.allowSoloProject || false}
                            onCheckedChange={(checked) => handleToggleException(student, checked)}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>
              {selectedStudent?.newAllowStatus ? "منح استثناء مشروع فردي" : "إلغاء استثناء مشروع فردي"}
            </DialogTitle>
            <DialogDescription>
              {selectedStudent?.newAllowStatus
                ? `هل أنت متأكد من منح الطالب ${selectedStudent?.name} استثناءً لتقديم مشروع فردي؟`
                : `هل أنت متأكد من إلغاء استثناء المشروع الفردي للطالب ${selectedStudent?.name}؟`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isProcessing}>
              إلغاء
            </Button>
            <Button onClick={confirmToggleException} disabled={isProcessing}>
              {isProcessing ? "جاري المعالجة..." : "تأكيد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
