import { createNotification, createBatchNotifications } from "@/lib/firebase/notifications"
import { collection, query, where, getDocs } from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase/config"

export async function notifyProjectApproved(studentId: string, projectTitle: string, supervisorName: string) {
  await createNotification({
    userId: studentId,
    title: "تم قبول فكرة المشروع",
    message: `تم قبول فكرة مشروعك "${projectTitle}" وتم تعيين المشرف ${supervisorName}`,
    type: "success",
    link: "/student/project",
    priority: "high",
    category: "project",
  })
}

export async function notifyProjectRejected(studentId: string, projectTitle: string, reason: string) {
  await createNotification({
    userId: studentId,
    title: "تم رفض فكرة المشروع",
    message: `تم رفض فكرة مشروعك "${projectTitle}". السبب: ${reason}`,
    type: "error",
    link: "/student/project",
    priority: "high",
    category: "project",
  })
}

export async function notifyNewProjectIdea(coordinatorId: string, studentName: string, projectTitle: string) {
  await createNotification({
    userId: coordinatorId,
    title: "فكرة مشروع جديدة",
    message: `قدم الطالب ${studentName} فكرة مشروع جديدة: ${projectTitle}`,
    type: "info",
    link: "/coordinator/approve-projects",
    priority: "medium",
    category: "project",
  })
}

export async function notifyTaskAssigned(studentId: string, taskTitle: string, dueDate: Date) {
  await createNotification({
    userId: studentId,
    title: "مهمة جديدة",
    message: `تم تعيين مهمة جديدة: ${taskTitle}. تاريخ الاستحقاق: ${dueDate.toLocaleDateString("ar-EG")}`,
    type: "task",
    link: "/student/tasks",
    priority: "high",
    category: "task",
  })
}

export async function notifyTaskSubmitted(supervisorId: string, studentName: string, taskTitle: string) {
  await createNotification({
    userId: supervisorId,
    title: "تم تسليم مهمة",
    message: `قام الطالب ${studentName} بتسليم المهمة: ${taskTitle}`,
    type: "info",
    link: "/supervisor/tasks",
    priority: "medium",
    category: "task",
  })
}

export async function notifyTaskGraded(studentId: string, taskTitle: string, grade: number, maxGrade: number) {
  await createNotification({
    userId: studentId,
    title: "تم تقييم المهمة",
    message: `تم تقييم المهمة "${taskTitle}". الدرجة: ${grade}/${maxGrade}`,
    type: "evaluation",
    link: "/student/tasks",
    priority: "high",
    category: "task",
  })
}

export async function notifyMeetingScheduled(studentId: string, title: string, date: Date, supervisorName: string) {
  await createNotification({
    userId: studentId,
    title: "اجتماع جديد",
    message: `تم جدولة اجتماع "${title}" مع ${supervisorName} في ${date.toLocaleString("ar-SA")}`,
    type: "meeting",
    link: "/student/meetings",
    priority: "high",
    category: "meeting",
  })
}

export async function notifyMeetingCancelled(studentId: string, title: string) {
  await createNotification({
    userId: studentId,
    title: "تم إلغاء الاجتماع",
    message: `تم إلغاء الاجتماع: ${title}`,
    type: "warning",
    link: "/student/meetings",
    priority: "medium",
    category: "meeting",
  })
}

export async function notifyDeadlineApproaching(studentId: string, taskTitle: string, daysRemaining: number) {
  await createNotification({
    userId: studentId,
    title: "تذكير: موعد التسليم قريب",
    message: `موعد تسليم المهمة "${taskTitle}" بعد ${daysRemaining} ${daysRemaining === 1 ? "يوم" : "أيام"}`,
    type: "warning",
    link: "/student/tasks",
    priority: "high",
    category: "task",
  })
}

export async function notifyNewMessage(userId: string, senderName: string, preview: string) {
  await createNotification({
    userId: userId,
    title: `رسالة جديدة من ${senderName}`,
    message: preview,
    type: "message",
    link: "/student/messages",
    priority: "medium",
    category: "message",
  })
}

export async function notifyProjectAssigned(supervisorId: string, projectTitle: string, studentName: string) {
  await createNotification({
    userId: supervisorId,
    title: "مشروع جديد تم تعيينه",
    message: `تم تعيينك كمشرف على مشروع "${projectTitle}" للطالب ${studentName}`,
    type: "project",
    link: "/supervisor/projects",
    priority: "high",
    category: "project",
  })
}

export async function notifyBulkTaskDeadlines(
  notifications: Array<{ studentId: string; taskTitle: string; daysRemaining: number }>,
) {
  await createBatchNotifications(
    notifications.map((n) => ({
      userId: n.studentId,
      title: "تذكير: موعد التسليم قريب",
      message: `موعد تسليم المهمة "${n.taskTitle}" بعد ${n.daysRemaining} ${n.daysRemaining === 1 ? "يوم" : "أيام"}`,
      type: "warning",
      link: "/student/tasks",
      priority: "high",
      category: "task",
    })),
  )
}

export async function notifyCoordinators(title: string, message: string, link: string) {
  try {
    const db = getFirebaseDb()
    const coordinatorsQuery = query(collection(db, "users"), where("role", "==", "coordinator"))
    const coordinatorsSnapshot = await getDocs(coordinatorsQuery)

    const notifications = coordinatorsSnapshot.docs.map((doc) => ({
      userId: doc.id,
      title,
      message,
      type: "info" as const,
      link,
      priority: "high" as const,
      category: "project" as const,
    }))

    if (notifications.length > 0) {
      await createBatchNotifications(notifications)
      console.log(`Sent notifications to ${notifications.length} coordinators`)
    }
  } catch (error) {
    console.error("Error notifying coordinators:", error)
  }
}
