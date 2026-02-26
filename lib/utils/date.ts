export function formatDate(date: any): string {
  if (!date) return "غير محدد"

  try {
    // Handle Firestore Timestamp
    if (date?.toDate && typeof date.toDate === "function") {
      return date.toDate().toLocaleDateString("ar-EG")
    }

    // Handle Date object
    if (date instanceof Date) {
      return date.toLocaleDateString("ar-EG")
    }

    // Handle string or number
    return new Date(date).toLocaleDateString("ar-EG")
  } catch (error) {
    console.error("Error formatting date:", error)
    return "غير محدد"
  }
}

export function formatDateTime(date: any): string {
  if (!date) return "غير محدد"

  try {
    // Handle Firestore Timestamp
    if (date?.toDate && typeof date.toDate === "function") {
      return date.toDate().toLocaleString("ar-EG")
    }

    // Handle Date object
    if (date instanceof Date) {
      return date.toLocaleString("ar-EG")
    }

    // Handle string or number
    return new Date(date).toLocaleString("ar-EG")
  } catch (error) {
    console.error("Error formatting date time:", error)
    return "غير محدد"
  }
}

export function toDate(date: any): Date {
  if (!date) return new Date()

  try {
    // Handle Firestore Timestamp
    if (date?.toDate && typeof date.toDate === "function") {
      return date.toDate()
    }

    // Handle Date object
    if (date instanceof Date) {
      return date
    }

    // Handle string or number
    return new Date(date)
  } catch (error) {
    console.error("Error converting to date:", error)
    return new Date()
  }
}
