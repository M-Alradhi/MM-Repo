import {
  Home,
  FolderKanban,
  Users,
  FileText,
  Bell,
  UserPlus,
  CheckCircle,
  MessageSquare,
  Building2,
} from "lucide-react"

export const coordinatorSidebarItems = [
  { title: "dashboard", href: "/coordinator/dashboard", icon: <Home className="w-5 h-5" /> },
  { title: "allProjects", href: "/coordinator/projects", icon: <FolderKanban className="w-5 h-5" /> },
  { title: "approveProjects", href: "/coordinator/approve-projects", icon: <CheckCircle className="w-5 h-5" /> },
  { title: "supervisors", href: "/coordinator/supervisors", icon: <Users className="w-5 h-5" /> },
  { title: "students", href: "/coordinator/students", icon: <UserPlus className="w-5 h-5" /> },
  { title: "departments", href: "/coordinator/departments", icon: <Building2 className="w-5 h-5" /> },
  { title: "messages", href: "/coordinator/messages", icon: <MessageSquare className="w-5 h-5" /> },
  { title: "announcements", href: "/coordinator/announcements", icon: <Bell className="w-5 h-5" /> },
  { title: "reports", href: "/coordinator/reports", icon: <FileText className="w-5 h-5" /> },
]
