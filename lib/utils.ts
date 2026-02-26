import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "approved":
    case "completed":
      return "text-green-600 bg-green-50"
    case "pending":
    case "in-progress":
      return "text-yellow-600 bg-yellow-50"
    case "rejected":
    case "cancelled":
      return "text-red-600 bg-red-50"
    default:
      return "text-gray-600 bg-gray-50"
  }
}

export function getStatusText(status: string): string {
  switch (status) {
    case "approved":
      return "معتمد"
    case "pending":
      return "قيد المراجعة"
    case "rejected":
      return "مرفوض"
    case "completed":
      return "مكتمل"
    case "in-progress":
      return "قيد التنفيذ"
    case "cancelled":
      return "ملغي"
    default:
      return status
  }
}
