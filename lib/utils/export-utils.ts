import type { Project, Task } from "@/lib/types"

export function exportToCSV(data: any[], filename: string) {
  if (data.length === 0) return

  const headers = Object.keys(data[0])
  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header]
          if (value === null || value === undefined) return ""
          if (typeof value === "object") return JSON.stringify(value)
          return `"${String(value).replace(/"/g, '""')}"`
        })
        .join(","),
    ),
  ].join("\n")

  const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}-${new Date().toISOString().split("T")[0]}.csv`
  link.click()
}

export function exportProjectsReport(projects: Project[]) {
  const data = projects.map((project) => ({
    العنوان: project.title,
    الوصف: project.description,
    الحالة: project.status,
    التقدم: `${project.progress}%`,
    اسم_الطالب: project.studentId || "",
    اسم_المشرف: project.supervisorId || "",
    تاريخ_البدء: project.startDate?.toDate?.().toLocaleDateString("ar-EG") || "",
    تاريخ_الانتهاء: project.endDate?.toDate?.().toLocaleDateString("ar-EG") || "",
  }))

  exportToCSV(data, "تقرير-المشاريع")
}

export function exportTasksReport(tasks: Task[]) {
  const data = tasks.map((task) => ({
    العنوان: task.title,
    الوصف: task.description,
    الحالة: task.status,
    الأولوية: task.priority,
    الدرجة_القصوى: task.maxGrade,
    الدرجة_المحصلة: task.grade || "",
    الوزن: `${task.weight}%`,
    تاريخ_الاستحقاق: task.dueDate?.toDate?.().toLocaleDateString("ar-EG") || "",
    تاريخ_التسليم: task.submittedAt?.toDate?.().toLocaleDateString("ar-EG") || "",
  }))

  exportToCSV(data, "تقرير-المهام")
}
