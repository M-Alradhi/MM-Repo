import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Home, FolderKanban, CheckSquare, Calendar, FileText, Bell, Settings } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

const sidebarItems = [
  { title: "لوحة التحكم", href: "/student/dashboard", icon: <Home className="w-5 h-5" /> },
  { title: "مشروعي", href: "/student/project", icon: <FolderKanban className="w-5 h-5" /> },
  { title: "المهام", href: "/student/tasks", icon: <CheckSquare className="w-5 h-5" /> },
  { title: "الاجتماعات", href: "/student/meetings", icon: <Calendar className="w-5 h-5" /> },
  { title: "الإشعارات", href: "/student/notifications", icon: <Bell className="w-5 h-5" /> },
  { title: "الإعدادات", href: "/student/settings", icon: <Settings className="w-5 h-5" /> },
]

export default function Loading() {
  return (
    <DashboardLayout sidebarItems={sidebarItems} requiredRole="student">
      <div className="p-8 space-y-8">
        <div>
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-5 w-48 mt-2" />
        </div>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-full mt-2" />
                <Skeleton className="h-4 w-32 mt-4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  )
}
