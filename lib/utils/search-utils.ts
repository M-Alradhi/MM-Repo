import type { SearchFilters } from "@/components/search/advanced-search"

export function filterProjects(projects: any[], filters: SearchFilters) {
  return projects.filter((project) => {
    // Search text filter
    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase()
      const matchesSearch =
        project.title?.toLowerCase().includes(searchLower) ||
        project.description?.toLowerCase().includes(searchLower) ||
        project.studentName?.toLowerCase().includes(searchLower) ||
        project.supervisorName?.toLowerCase().includes(searchLower)

      if (!matchesSearch) return false
    }

    // Status filter
    if (filters.status && project.status !== filters.status) {
      return false
    }

    // Department filter
    if (filters.department && project.department !== filters.department) {
      return false
    }

    // Supervisor filter - check both primary and co-supervisor
    if (filters.supervisorId) {
      const isPrimary = project.supervisorId === filters.supervisorId
      const isCo = project.coSupervisorId === filters.supervisorId
      const inSupervisorsArray = Array.isArray(project.supervisors) &&
        project.supervisors.some((s: any) => s.userId === filters.supervisorId || s.id === filters.supervisorId)
      if (!isPrimary && !isCo && !inSupervisorsArray) return false
    }

    // Student filter - check studentId, teamMembers array, and studentIds array
    if (filters.studentId) {
      const inStudentId = project.studentId === filters.studentId
      const inTeamMembers = Array.isArray(project.teamMembers) &&
        project.teamMembers.some((m: any) =>
          m === filters.studentId || m?.id === filters.studentId || m?.studentId === filters.studentId
        )
      const inStudentIds = Array.isArray(project.studentIds) && project.studentIds.includes(filters.studentId)
      if (!inStudentId && !inTeamMembers && !inStudentIds) return false
    }

    // Date range filter
    if (filters.dateFrom || filters.dateTo) {
      const projectDate = project.startDate?.toDate?.() || new Date(project.startDate)

      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom)
        if (projectDate < fromDate) return false
      }

      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo)
        toDate.setHours(23, 59, 59, 999) // End of day
        if (projectDate > toDate) return false
      }
    }

    return true
  })
}