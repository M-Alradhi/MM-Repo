import { Home, FolderKanban, Users, Award, Calendar, MessageSquare, Mail, Lightbulb, CalendarDays } from "lucide-react"

export const supervisorSidebarItems = [
  { title: "dashboard", href: "/supervisor/dashboard", icon: <Home className="w-5 h-5" /> },
  { title: "projects", href: "/supervisor/projects", icon: <FolderKanban className="w-5 h-5" /> },
  { title: "projectIdeas", href: "/supervisor/project-ideas", icon: <Lightbulb className="w-5 h-5" /> },
  { title: "students", href: "/supervisor/students", icon: <Users className="w-5 h-5" /> },
  { title: "tasksAndEvaluation", href: "/supervisor/tasks", icon: <Award className="w-5 h-5" /> },
  { title: "calendar", href: "/supervisor/calendar", icon: <CalendarDays className="w-5 h-5" /> },
  { title: "meetings", href: "/supervisor/meetings", icon: <Calendar className="w-5 h-5" /> },
  { title: "messages", href: "/supervisor/messages", icon: <Mail className="w-5 h-5" /> },
  { title: "discussions", href: "/supervisor/discussions", icon: <MessageSquare className="w-5 h-5" /> },
]
