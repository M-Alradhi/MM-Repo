import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Home, FolderKanban, Users, Star, Calendar } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

const sidebarItems = [
  { title: "لوحة التحكم", href: "/supervisor/dashboard", icon: <Home className="w-5 h-5" /> },
  { title: "المشاريع", href: "/supervisor/projects", icon: <FolderKanban className="w-5 h-5" /> },
  { title: "الطلاب", href: "/supervisor/students", icon: <Users className="w-5 h-5" /> },
  { title: "الاجتماعات", href: "/supervisor/meetings", icon: <Calendar className="w-5 h-5" /> },
]

export default function Loading() {
  return (
    <DashboardLayout sidebarItems={sidebarItems} requiredRole="supervisor">
      <div className="p-8 space-y-8">
        <div>
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-5 w-48 mt-2" />
        </div>

        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
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
