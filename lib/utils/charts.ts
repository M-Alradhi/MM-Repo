export interface ChartDataPoint {
  label: string
  value: number
  color?: string
}

export function processGradeDistribution(grades: number[]): ChartDataPoint[] {
  const ranges = [
    { label: "ممتاز (90-100)", min: 90, max: 100, color: "#10b981" },
    { label: "جيد جداً (80-89)", min: 80, max: 89, color: "#3b82f6" },
    { label: "جيد (70-79)", min: 70, max: 79, color: "#f59e0b" },
    { label: "مقبول (60-69)", min: 60, max: 69, color: "#ef4444" },
    { label: "ضعيف (أقل من 60)", min: 0, max: 59, color: "#991b1b" },
  ]

  return ranges.map((range) => ({
    label: range.label,
    value: grades.filter((g) => g >= range.min && g <= range.max).length,
    color: range.color,
  }))
}

export function processProjectProgress(projects: Array<{ progress: number }>): ChartDataPoint[] {
  const ranges = [
    { label: "0-25%", min: 0, max: 25 },
    { label: "26-50%", min: 26, max: 50 },
    { label: "51-75%", min: 51, max: 75 },
    { label: "76-100%", min: 76, max: 100 },
  ]

  return ranges.map((range) => ({
    label: range.label,
    value: projects.filter((p) => p.progress >= range.min && p.progress <= range.max).length,
  }))
}

export function processTaskStatusData(tasks: Array<{ status: string }>): ChartDataPoint[] {
  const statuses = {
    pending: { label: "قيد الانتظار", color: "#f59e0b" },
    submitted: { label: "مُسلم", color: "#3b82f6" },
    graded: { label: "مُقيّم", color: "#10b981" },
  }

  return Object.entries(statuses).map(([key, config]) => ({
    label: config.label,
    value: tasks.filter((t) => t.status === key).length,
    color: config.color,
  }))
}

export function calculateMonthlyProgress(data: Array<{ createdAt: Date; value: number }>): ChartDataPoint[] {
  const months = [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
  ]

  const monthlyData = new Map<string, number>()

  data.forEach((item) => {
    const month = months[item.createdAt.getMonth()]
    monthlyData.set(month, (monthlyData.get(month) || 0) + item.value)
  })

  return Array.from(monthlyData.entries()).map(([label, value]) => ({
    label,
    value,
  }))
}
