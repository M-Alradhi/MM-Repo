import type { Timestamp } from "firebase/firestore"

export type TaskPriority = "low" | "medium" | "high" | "urgent"

export interface TaskWithPriority {
  id: string
  title: string
  priority: TaskPriority
  dueDate: Timestamp | Date
  status: "pending" | "submitted" | "graded"
}

export function getPriorityColor(priority: TaskPriority): string {
  switch (priority) {
    case "low":
      return "text-green-600 bg-green-100 dark:bg-green-950/30"
    case "medium":
      return "text-blue-600 bg-blue-100 dark:bg-blue-950/30"
    case "high":
      return "text-orange-600 bg-orange-100 dark:bg-orange-950/30"
    case "urgent":
      return "text-red-600 bg-red-100 dark:bg-red-950/30"
    default:
      return "text-gray-600 bg-gray-100 dark:bg-gray-950/30"
  }
}

export function getPriorityLabel(priority: TaskPriority): string {
  switch (priority) {
    case "low":
      return "منخفضة"
    case "medium":
      return "متوسطة"
    case "high":
      return "عالية"
    case "urgent":
      return "عاجلة"
    default:
      return priority
  }
}

export function calculateAutoPriority(dueDate: Timestamp | Date, status: string): TaskPriority {
  if (status === "graded") return "low"

  const now = new Date()
  const due = dueDate instanceof Date ? dueDate : dueDate.toDate()
  const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (daysUntilDue < 0 && status === "pending") return "urgent"
  if (daysUntilDue <= 2) return "urgent"
  if (daysUntilDue <= 5) return "high"
  if (daysUntilDue <= 10) return "medium"
  return "low"
}

export function sortTasksByPriority(tasks: TaskWithPriority[]): TaskWithPriority[] {
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 }
  return [...tasks].sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
    if (priorityDiff !== 0) return priorityDiff

    const aDate = a.dueDate instanceof Date ? a.dueDate : a.dueDate.toDate()
    const bDate = b.dueDate instanceof Date ? b.dueDate : b.dueDate.toDate()
    return aDate.getTime() - bDate.getTime()
  })
}
