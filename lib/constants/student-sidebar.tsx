import {
  Home,
  FolderKanban,
  CheckSquare,
  Calendar,
  Bell,
  User,
  MessageCircle,
  MessageSquare,
  CalendarDays,
  Users,
} from "lucide-react"

export const studentSidebarItems = [
  { title: "dashboard", href: "/student/dashboard", icon: <Home className="w-5 h-5" /> },
  { title: "myProject", href: "/student/project", icon: <FolderKanban className="w-5 h-5" /> },
  { title: "teamApprovals", href: "/student/project/team-approval", icon: <Users className="w-5 h-5" /> },
  { title: "tasks", href: "/student/tasks", icon: <CheckSquare className="w-5 h-5" /> },
  { title: "calendar", href: "/student/calendar", icon: <CalendarDays className="w-5 h-5" /> },
  { title: "meetings", href: "/student/meetings", icon: <Calendar className="w-5 h-5" /> },
  { title: "messages", href: "/student/messages", icon: <MessageSquare className="w-5 h-5" /> },
  { title: "discussions", href: "/student/discussions", icon: <MessageCircle className="w-5 h-5" /> },
  { title: "notifications", href: "/student/notifications", icon: <Bell className="w-5 h-5" /> },
  { title: "profile", href: "/student/profile", icon: <User className="w-5 h-5" /> },
]
