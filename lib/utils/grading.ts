/**
 * Grading System Utilities
 * Complete grading system based on weighted tasks out of 100
 */

export interface TaskGrade {
  id: string
  title: string
  maxGrade: number
  grade?: number
  weight: number
  status: "pending" | "submitted" | "graded"
}

export interface GradeCalculation {
  totalGrade: number // Out of 100
  completedWeight: number // Total weight of graded tasks
  remainingWeight: number // Weight of ungraded tasks
  gradedTasksCount: number
  totalTasksCount: number
  percentage: number // Same as totalGrade for clarity
  isPassing: boolean // >= 50
  letterGrade: string
  status: "excellent" | "very-good" | "good" | "acceptable" | "failing"
}

/**
 * Calculate student's total grade based on weighted tasks
 * The final grade is out of 100, calculated from weighted task scores
 */
export function calculateWeightedGrade(tasks: TaskGrade[]): GradeCalculation {
  const gradedTasks = tasks.filter((t) => t.status === "graded" && t.grade !== undefined)

  // Calculate weighted sum from graded tasks
  const weightedSum = gradedTasks.reduce((sum, task) => {
    const taskPercentage = ((task.grade || 0) / task.maxGrade) * 100
    const weightedScore = taskPercentage * (task.weight / 100)
    return sum + weightedScore
  }, 0)

  const completedWeight = gradedTasks.reduce((sum, task) => sum + task.weight, 0)
  const totalWeight = tasks.reduce((sum, task) => sum + task.weight, 0)
  const remainingWeight = totalWeight - completedWeight

  const totalGrade = Math.round(weightedSum * 10) / 10
  const isPassing = totalGrade >= 50

  let letterGrade = "F"
  let status: "excellent" | "very-good" | "good" | "acceptable" | "failing" = "failing"

  if (totalGrade >= 90) {
    letterGrade = "A+"
    status = "excellent"
  } else if (totalGrade >= 85) {
    letterGrade = "A"
    status = "excellent"
  } else if (totalGrade >= 80) {
    letterGrade = "B+"
    status = "very-good"
  } else if (totalGrade >= 75) {
    letterGrade = "B"
    status = "very-good"
  } else if (totalGrade >= 70) {
    letterGrade = "C+"
    status = "good"
  } else if (totalGrade >= 65) {
    letterGrade = "C"
    status = "good"
  } else if (totalGrade >= 60) {
    letterGrade = "D+"
    status = "acceptable"
  } else if (totalGrade >= 50) {
    letterGrade = "D"
    status = "acceptable"
  }

  return {
    totalGrade,
    completedWeight,
    remainingWeight,
    gradedTasksCount: gradedTasks.length,
    totalTasksCount: tasks.length,
    percentage: totalGrade,
    isPassing,
    letterGrade,
    status,
  }
}

export function calculateProjectProgress(tasks: TaskGrade[]): number {
  // Return 0 if no tasks exist
  if (!tasks || tasks.length === 0) return 0

  // Calculate based on completed (graded) tasks weight
  const completedTasks = tasks.filter((t) => t.status === "graded")

  // If no tasks are completed yet, return 0 instead of NaN
  if (completedTasks.length === 0) return 0

  const completedWeight = completedTasks.reduce((sum, task) => sum + (task.weight || 0), 0)
  const totalWeight = tasks.reduce((sum, task) => sum + (task.weight || 0), 0)

  // Prevent division by zero
  if (totalWeight === 0) return 0

  const progress = (completedWeight / totalWeight) * 100

  // Ensure the result is a valid number and round it
  return isNaN(progress) ? 0 : Math.round(progress)
}

/**
 * Get grade color based on score
 */
export function getGradeColor(grade: number): string {
  if (grade >= 90) return "text-green-600 dark:text-green-400"
  if (grade >= 80) return "text-blue-600 dark:text-blue-400"
  if (grade >= 70) return "text-yellow-600 dark:text-yellow-400"
  if (grade >= 60) return "text-orange-600 dark:text-orange-400"
  if (grade >= 50) return "text-amber-600 dark:text-amber-400"
  return "text-red-600 dark:text-red-400"
}

/**
 * Get status badge color
 */
export function getStatusColor(status: string): {
  bg: string
  text: string
  border: string
} {
  switch (status) {
    case "excellent":
      return {
        bg: "bg-green-50 dark:bg-green-950/20",
        text: "text-green-700 dark:text-green-400",
        border: "border-green-200 dark:border-green-900",
      }
    case "very-good":
      return {
        bg: "bg-blue-50 dark:bg-blue-950/20",
        text: "text-blue-700 dark:text-blue-400",
        border: "border-blue-200 dark:border-blue-900",
      }
    case "good":
      return {
        bg: "bg-yellow-50 dark:bg-yellow-950/20",
        text: "text-yellow-700 dark:text-yellow-400",
        border: "border-yellow-200 dark:border-yellow-900",
      }
    case "acceptable":
      return {
        bg: "bg-orange-50 dark:bg-orange-950/20",
        text: "text-orange-700 dark:text-orange-400",
        border: "border-orange-200 dark:border-orange-900",
      }
    default:
      return {
        bg: "bg-red-50 dark:bg-red-950/20",
        text: "text-red-700 dark:text-red-400",
        border: "border-red-200 dark:border-red-900",
      }
  }
}

/**
 * Validate task weights total to 100
 */
export function validateTaskWeights(tasks: TaskGrade[]): {
  isValid: boolean
  totalWeight: number
  message: string
} {
  const totalWeight = tasks.reduce((sum, task) => sum + task.weight, 0)

  if (totalWeight === 100) {
    return {
      isValid: true,
      totalWeight,
      message: "مجموع أوزان المهام صحيح (100%)",
    }
  } else if (totalWeight < 100) {
    return {
      isValid: false,
      totalWeight,
      message: `مجموع أوزان المهام ${totalWeight}% - يجب أن يكون 100%`,
    }
  } else {
    return {
      isValid: false,
      totalWeight,
      message: `مجموع أوزان المهام ${totalWeight}% - تجاوز 100%`,
    }
  }
}

/**
 * Format grade for display
 */
export function formatGrade(grade: number | undefined, maxGrade = 100): string {
  if (grade === undefined) return "-"
  return `${grade.toFixed(1)}/${maxGrade}`
}

/**
 * Get task status in Arabic
 */
export function getTaskStatusText(status: string): string {
  switch (status) {
    case "pending":
      return "في الانتظار"
    case "submitted":
      return "تم التسليم"
    case "graded":
      return "تم التقييم"
    default:
      return status
  }
}

/**
 * Check if task is overdue
 */
export function isTaskOverdue(dueDate: any, status: string): boolean {
  if (!dueDate || status !== "pending") return false
  const date = dueDate.toDate ? dueDate.toDate() : new Date(dueDate)
  return date < new Date()
}

/**
 * Format date in Arabic
 */
export function formatArabicDate(timestamp: any): string {
  if (!timestamp) return "غير محدد"
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return date.toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    weekday: "short",
  })
}
