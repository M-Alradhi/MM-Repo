"use client"

import type React from "react"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { coordinatorSidebarItems } from "@/lib/constants/coordinator-sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useState, useEffect } from "react"
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, Timestamp } from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase/config"
import { useAuth } from "@/lib/contexts/auth-context"
import { useLanguage } from "@/lib/contexts/language-context"
import { toast } from "sonner"
import { Building2, Plus, Edit, Trash2 } from "lucide-react"
import type { Department } from "@/lib/types"

export default function DepartmentsPage() {
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
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)
  const [formData, setFormData] = useState({
    code: "",
    nameAr: "",
    nameEn: "",
    description: "",
    isActive: true,
  })

  useEffect(() => {
    fetchDepartments()
  }, [])

  const fetchDepartments = async () => {
    try {
      setLoading(true)
      const db = getFirebaseDb()
      const snapshot = await getDocs(collection(db, "departments"))
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Department[]
      setDepartments(data)
    } catch (error) {
      console.error("Error fetching departments:", error)
      toast.error(t("errorLoadingDepartments"))
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDialog = (department?: Department) => {
    if (department) {
      setEditingDepartment(department)
      setFormData({
        code: department.code,
        nameAr: department.nameAr,
        nameEn: department.nameEn,
        description: department.description || "",
        isActive: department.isActive,
      })
    } else {
      setEditingDepartment(null)
      setFormData({
        code: "",
        nameAr: "",
        nameEn: "",
        description: "",
        isActive: true,
      })
    }
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.code || !formData.nameAr || !formData.nameEn) {
      toast.error(t("pleaseFillRequiredFields"))
      return
    }

    try {
      const db = getFirebaseDb()

      if (editingDepartment) {
        // Update existing department
        await updateDoc(doc(db, "departments", editingDepartment.id), {
          code: formData.code,
          nameAr: formData.nameAr,
          nameEn: formData.nameEn,
          description: formData.description,
          isActive: formData.isActive,
        })
        toast.success(t("departmentUpdatedSuccessfully"))
      } else {
        // Add new department
        await addDoc(collection(db, "departments"), {
          code: formData.code,
          nameAr: formData.nameAr,
          nameEn: formData.nameEn,
          description: formData.description,
          isActive: formData.isActive,
          createdAt: Timestamp.now(),
          createdBy: userData?.uid,
        })
        toast.success(t("departmentAddedSuccessfully"))
      }

      setIsDialogOpen(false)
      fetchDepartments()
    } catch (error) {
      console.error("Error saving department:", error)
      toast.error(t("errorSavingDepartment"))
    }
  }

  const handleDelete = async (departmentId: string) => {
    if (!confirm(t("confirmDeleteDepartment"))) return

    try {
      const db = getFirebaseDb()
      await deleteDoc(doc(db, "departments", departmentId))
      toast.success(t("departmentDeletedSuccessfully"))
      fetchDepartments()
    } catch (error) {
      console.error("Error deleting department:", error)
      toast.error(t("errorDeletingDepartment"))
    }
  }

  return (
    <DashboardLayout sidebarItems={coordinatorSidebarItems} requiredRole="coordinator">
      <div className="p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Building2 className="h-8 w-8" />
             {t("manageDepartments")}
            </h1>
            <p className="text-muted-foreground mt-2">{t("AddAndEditAcademicDepartments")}</p>
          </div>
          <Button onClick={() => handleOpenDialog()} className="rounded-lg">
            <Plus className="h-4 w-4 mr-2" />
             {t("addNewDepartment")}
          </Button>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-muted rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : departments.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Building2 className="w-16 h-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-xl font-semibold mb-2">{t("noDepartmentsFound")}</h3>
              <p className="text-sm text-muted-foreground mb-4">{t("addNewDepartmentInstructions")}</p>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                {t("addNewDepartment")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {departments.map((dept) => (
              <Card key={dept.id} className="rounded-xl hover:shadow-lg transition-all">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        {dept.nameAr}
                        {dept.isActive ? (
                          <Badge variant="default" className="rounded-lg">
                            {t("active")}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="rounded-lg">
                            {t("inactive")}
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-1">{dept.nameEn}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t("theCode")}:</span>
                      <span className="font-medium">{dept.code}</span>
                    </div>
                    {dept.description && <p className="text-sm text-muted-foreground">{dept.description}</p>}
                  </div>
                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 rounded-lg bg-transparent"
                      onClick={() => handleOpenDialog(dept)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      {t("edit")}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1 rounded-lg"
                      onClick={() => handleDelete(dept.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t("delete")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="rounded-xl max-w-md">
          <DialogHeader>
            <DialogTitle>{editingDepartment ? t("editDepartment") : t("addNewDepartment")}</DialogTitle>
            <DialogDescription>
              {editingDepartment ? t("updateDepartmentInfo") : t("enterNewDepartmentInfo")}    
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">{t("departmentCode")} *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder={t("egCS")}
                className="rounded-lg"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nameAr">{t("departmentNameAr")} *</Label>
              <Input
                id="nameAr"
                value={formData.nameAr}
                onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                placeholder={t("egDepartmentName")}
                className="rounded-lg"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nameEn">{t("departmentNameEn")} *</Label>
              <Input
                id="nameEn"
                value={formData.nameEn}
                onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                placeholder={t("egDepartmentNameEn")}
                className="rounded-lg"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t("description")}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t("departmentDescriptionPlaceholder")}
                className="rounded-lg"
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="isActive">{t("isActiveDepartment")}</Label>
                <p className="text-sm text-muted-foreground">{t("departmentCanBeSelectedByStudents")}</p>
              </div>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-lg">
                {t("cancel")}
              </Button>
              <Button type="submit" className="rounded-lg">
                {editingDepartment ? t("update") : t("add")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
