"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Home, FolderKanban, Users, FileText, Archive, User, Save, Key, Lightbulb } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/lib/contexts/auth-context"
import { useState } from "react"
import { doc, updateDoc } from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase/config"
import { updateEmail, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth"
import { getFirebaseAuth } from "@/lib/firebase/config"
import { toast } from "sonner"

const sidebarItems = [
  { title: "لوحة التحكم", href: "/coordinator/dashboard", icon: <Home className="w-5 h-5" /> },
  { title: "الملف الشخصي", href: "/coordinator/profile", icon: <User className="w-5 h-5" /> },
  { title: "جميع المشاريع", href: "/coordinator/projects", icon: <FolderKanban className="w-5 h-5" /> },
  { title: "أفكار المشاريع", href: "/coordinator/project-ideas", icon: <Lightbulb className="w-5 h-5" /> },
  { title: "المشرفين", href: "/coordinator/supervisors", icon: <Users className="w-5 h-5" /> },
  { title: "التقارير", href: "/coordinator/reports", icon: <FileText className="w-5 h-5" /> },
  { title: "الأرشيف", href: "/coordinator/archive", icon: <Archive className="w-5 h-5" /> },
]

export default function CoordinatorProfile() {
  const { userData } = useAuth()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: userData?.name || "",
    email: userData?.email || "",
    phone: userData?.phone || "",
    department: userData?.department || "",
  })

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  const handleUpdateProfile = async () => {
    setLoading(true)
    try {
      const db = getFirebaseDb()
      const auth = getFirebaseAuth()

      if (formData.email !== userData?.email && auth.currentUser) {
        await updateEmail(auth.currentUser, formData.email)
      }

      await updateDoc(doc(db, "users", userData?.id), {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        department: formData.department,
        updatedAt: new Date(),
      })

      toast.success("تم تحديث الملف الشخصي بنجاح")
    } catch (error) {
      console.error("Error updating profile:", error)
      toast.error("حدث خطأ في تحديث الملف الشخصي")
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("كلمة المرور الجديدة غير متطابقة")
      return
    }

    if (passwordData.newPassword.length < 6) {
      toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل")
      return
    }

    setLoading(true)
    try {
      const auth = getFirebaseAuth()
      const user = auth.currentUser

      if (!user || !user.email) {
        toast.error("المستخدم غير مسجل دخول")
        return
      }

      const credential = EmailAuthProvider.credential(user.email, passwordData.currentPassword)
      await reauthenticateWithCredential(user, credential)
      await updatePassword(user, passwordData.newPassword)

      toast.success("تم تغيير كلمة المرور بنجاح")
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" })
    } catch (error: any) {
      console.error("Error changing password:", error)
      if (error.code === "auth/wrong-password") {
        toast.error("كلمة المرور الحالية غير صحيحة")
      } else {
        toast.error("حدث خطأ في تغيير كلمة المرور")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout sidebarItems={sidebarItems} requiredRole="coordinator">
      <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-700">
        <div className="animate-in slide-in-from-top duration-500">
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-l from-foreground to-foreground/70 bg-clip-text text-transparent">
            الملف الشخصي
          </h1>
          <p className="text-muted-foreground mt-2">إدارة معلوماتك الشخصية وإعدادات الحساب</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">المعلومات الشخصية</TabsTrigger>
            <TabsTrigger value="password">تغيير كلمة المرور</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card className="animate-in slide-in-from-bottom duration-700">
              <CardHeader>
                <CardTitle>المعلومات الشخصية</CardTitle>
                <CardDescription>تحديث معلوماتك الشخصية</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">الاسم الكامل</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">البريد الإلكتروني</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">رقم الهاتف</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+973 XXXX XXXX"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="department">القسم</Label>
                    <Input
                      id="department"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    />
                  </div>
                </div>

                <Button onClick={handleUpdateProfile} disabled={loading} className="w-full md:w-auto">
                  <Save className="w-4 h-4 ml-2" />
                  {loading ? "جاري الحفظ..." : "حفظ التغييرات"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="password">
            <Card className="animate-in slide-in-from-bottom duration-700">
              <CardHeader>
                <CardTitle>تغيير كلمة المرور</CardTitle>
                <CardDescription>تحديث كلمة المرور الخاصة بك</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">كلمة المرور الحالية</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">كلمة المرور الجديدة</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">تأكيد كلمة المرور الجديدة</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    />
                  </div>
                </div>

                <Button onClick={handleChangePassword} disabled={loading} className="w-full md:w-auto">
                  <Key className="w-4 h-4 ml-2" />
                  {loading ? "جاري التغيير..." : "تغيير كلمة المرور"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
