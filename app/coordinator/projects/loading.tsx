import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Home, FolderKanban, Users, FileText, Archive } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

const sidebarItems = [
  { title: "لوحة التحكم", href: "/coordinator/dashboard", icon: <Home className="w-5 h-5" /> },
  { title: "جميع المشاريع", href: "/coordinator/projects", icon: <FolderKanban className="w-5 h-5" /> },
  { title: "المشرفين", href: "/coordinator/supervisors", icon: <Users className="w-5 h-5" /> },
  { title: "التقارير", href: "/coordinator/reports", icon: <FileText className="w-5 h-5" /> },
  { title: "الأرشيف", href: "/coordinator/archive", icon: <Archive className="w-5 h-5" /> },
]

export default function Loading() {
  return (
    <DashboardLayout sidebarItems={sidebarItems} requiredRole="coordinator">
      <div className="p-8 space-y-8">
        <div>
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-5 w-48 mt-2" />
        </div>

        <div className="grid gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-full mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  )
}
