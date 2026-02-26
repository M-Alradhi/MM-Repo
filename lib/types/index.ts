export type UserRole = "student" | "supervisor" | "coordinator"

export interface UserData {
  uid: string
  email: string
  name: string
  role: UserRole
  createdAt: any
  studentId?: string
  department?: string
  projectId?: string
  supervisorId?: string
  allowSoloProject?: boolean
  soloProjectApprovedBy?: string
  soloProjectApprovedAt?: any
}

export interface Project {
  id: string
  title: string
  description: string
  status: "pending" | "approved" | "rejected" | "active" | "completed"
  progress: number // calculated from completed weighted tasks
  isTeamProject?: boolean
  studentId: string // Primary student for backward compatibility
  studentIds?: string[] // Array of student IDs for team projects
  supervisorId?: string // Primary supervisor for backward compatibility
  supervisorIds?: string[] // Array of supervisor IDs for team projects
  teamMembers?: TeamMember[] // Detailed team member info
  supervisors?: SupervisorInfo[] // Detailed supervisor info
  startDate: any
  endDate?: any
  createdAt: any
  updatedAt?: any
  academicYear?: string
  semester?: string
  projectType?: string
  coSupervisorName?: string
  coSupervisorEmail?: string
  problemStatement?: string
  objectives?: string[]
  significance?: string
  literatureReview?: string
  references?: string
  timeline?: ProjectTimeline
  sameDepartment?: boolean
  plagiarismDeclaration?: boolean
}

export interface TeamMember {
  userId: string
  name: string
  email: string
  studentId?: string
  role: "leader" | "member"
  approved: boolean
  approvedAt?: any
}

export interface SupervisorInfo {
  userId: string
  name: string
  email: string
  role: "primary" | "secondary"
  assignedAt: any
}

export interface Task {
  id: string
  title: string
  description: string
  status: "pending" | "submitted" | "graded"
  priority: "low" | "medium" | "high"
  studentId: string
  supervisorId?: string
  projectId?: string
  maxGrade: number
  grade?: number
  weight: number
  feedback?: string
  submissionText?: string
  submittedFiles?: SubmittedFile[]
  submittedAt?: any
  submittedBy?: string // Track which team member submitted
  gradedAt?: any
  dueDate?: any
  createdAt: any
}

export interface SubmittedFile {
  id: string
  name: string
  url: string
  size: number
  type: string
  isImage: boolean
  uploadedAt: any
}

export interface Meeting {
  id: string
  title: string
  description?: string
  date: any
  duration: number
  location?: string
  meetingLink?: string
  status: "scheduled" | "completed" | "cancelled"
  studentId: string
  supervisorId: string
  projectId?: string
  notes?: string
  createdAt: any
}

export interface Notification {
  id: string
  userId: string
  title: string
  message: string
  type: "info" | "success" | "warning" | "error" | "task" | "grade"
  read: boolean
  link?: string
  createdAt: any
}

export interface Department {
  id: string
  code: string // e.g., "cs", "it", "is"
  nameAr: string // Arabic name
  nameEn: string // English name
  description?: string
  isActive: boolean
  createdAt: any
  createdBy?: string
}

export interface ProjectTimeline {
  requirementCollection?: string // W 1-3, W 4-6, etc.
  literatureReview?: string
  design?: string
  implementation?: string
  testingAndResults?: string
  reportWriting?: string
  presentation?: string
}
