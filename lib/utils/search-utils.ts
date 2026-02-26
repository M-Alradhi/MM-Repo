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

    // Supervisor filter
    if (filters.supervisorId && project.supervisorId !== filters.supervisorId) {
      return false
    }

    // Student filter
    if (filters.studentId && project.studentId !== filters.studentId) {
      return false
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

export function filterTasks(tasks: any[], filters: SearchFilters) {
  return tasks.filter((task) => {
    // Search text filter
    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase()
      const matchesSearch =
        task.title?.toLowerCase().includes(searchLower) || task.description?.toLowerCase().includes(searchLower)

      if (!matchesSearch) return false
    }

    // Status filter
    if (filters.status && task.status !== filters.status) {
      return false
    }

    // Priority filter
    if (filters.priority && task.priority !== filters.priority) {
      return false
    }

    // Supervisor filter
    if (filters.supervisorId && task.supervisorId !== filters.supervisorId) {
      return false
    }

    // Student filter
    if (filters.studentId && task.studentId !== filters.studentId) {
      return false
    }

    // Date range filter (using dueDate for tasks)
    if (filters.dateFrom || filters.dateTo) {
      const taskDate = task.dueDate?.toDate?.() || new Date(task.dueDate)

      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom)
        if (taskDate < fromDate) return false
      }

      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo)
        toDate.setHours(23, 59, 59, 999)
        if (taskDate > toDate) return false
      }
    }

    return true
  })
}

export function filterDiscussions(discussions: any[], filters: SearchFilters) {
  return discussions.filter((discussion) => {
    // Search text filter
    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase()
      const matchesSearch =
        discussion.title?.toLowerCase().includes(searchLower) ||
        discussion.content?.toLowerCase().includes(searchLower) ||
        discussion.creatorName?.toLowerCase().includes(searchLower)

      if (!matchesSearch) return false
    }

    // Status filter
    if (filters.status && discussion.status !== filters.status) {
      return false
    }

    // Date range filter
    if (filters.dateFrom || filters.dateTo) {
      const discussionDate = discussion.createdAt?.toDate?.() || new Date(discussion.createdAt)

      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom)
        if (discussionDate < fromDate) return false
      }

      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo)
        toDate.setHours(23, 59, 59, 999)
        if (discussionDate > toDate) return false
      }
    }

    return true
  })
}
