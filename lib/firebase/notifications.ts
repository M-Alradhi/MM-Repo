import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  orderBy,
  updateDoc,
  doc,
  onSnapshot,
  limit,
  type Unsubscribe,
} from "firebase/firestore"
import { getFirebaseDb } from "./config"

export interface Notification {
  id?: string
  userId: string
  title: string
  message: string
  type: "info" | "success" | "warning" | "error" | "evaluation" | "task" | "meeting" | "project" | "message"
  read: boolean
  createdAt: any
  link?: string
  priority?: "low" | "medium" | "high" // Added priority field
  category?: string // Added category for filtering
}

const notificationCache = new Map<string, Notification[]>()
const activeSubscriptions = new Map<string, Unsubscribe>()

export async function createNotification(params: {
  userId: string
  title: string
  message: string
  type?: "info" | "success" | "warning" | "error" | "evaluation" | "task" | "meeting" | "project" | "message"
  link?: string
  priority?: "low" | "medium" | "high"
  category?: string
}) {
  try {
    const db = getFirebaseDb()

    const notificationData: any = {
      userId: params.userId,
      title: params.title,
      message: params.message,
      type: params.type || "info",
      priority: params.priority || "medium",
      read: false,
      createdAt: serverTimestamp(),
    }

    if (params.link) {
      notificationData.link = params.link
    }
    if (params.category) {
      notificationData.category = params.category
    }

    await addDoc(collection(db, "notifications"), notificationData)
    console.log("Notification created successfully")
  } catch (error) {
    console.error("Error creating notification:", error)
    throw error
  }
}

export async function getUserNotifications(userId: string, limitCount = 50) {
  try {
    const db = getFirebaseDb()
    try {
      const notificationsQuery = query(
        collection(db, "notifications"),
        where("userId", "==", userId),
        orderBy("createdAt", "desc"),
        limit(limitCount),
      )
      const notificationsSnapshot = await getDocs(notificationsQuery)
      return notificationsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Notification)
    } catch (indexError: any) {
      if (indexError.code === "failed-precondition" || indexError.message?.includes("index")) {
        console.warn("Firebase index not available, using fallback query")
        const fallbackQuery = query(collection(db, "notifications"), where("userId", "==", userId), limit(limitCount))
        const notificationsSnapshot = await getDocs(fallbackQuery)
        const notifications = notificationsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Notification)
        // Sort in memory
        return notifications.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0
          const bTime = b.createdAt?.toMillis?.() || 0
          return bTime - aTime
        })
      }
      throw indexError
    }
  } catch (error: any) {
    console.error("Error getting notifications:", error)
    throw error
  }
}

export async function markNotificationAsRead(notificationId: string) {
  try {
    const db = getFirebaseDb()
    await updateDoc(doc(db, "notifications", notificationId), {
      read: true,
    })
  } catch (error) {
    console.error("Error marking notification as read:", error)
    throw error
  }
}

export async function markAllNotificationsAsRead(userId: string) {
  try {
    const db = getFirebaseDb()
    const notificationsQuery = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      where("read", "==", false),
    )
    const notificationsSnapshot = await getDocs(notificationsQuery)

    const updatePromises = notificationsSnapshot.docs.map((docSnapshot) =>
      updateDoc(doc(db, "notifications", docSnapshot.id), { read: true }),
    )

    await Promise.all(updatePromises)
  } catch (error) {
    console.error("Error marking all notifications as read:", error)
    throw error
  }
}

export function subscribeToNotifications(
  userId: string,
  callback: (notifications: Notification[]) => void,
  limitCount = 10,
): Unsubscribe {
  const existingSubscription = activeSubscriptions.get(userId)
  if (existingSubscription) {
    existingSubscription()
    activeSubscriptions.delete(userId)
  }

  const db = getFirebaseDb()
  let unsubscribe: Unsubscribe | null = null

  const simpleQuery = query(collection(db, "notifications"), where("userId", "==", userId), limit(limitCount))

  unsubscribe = onSnapshot(
    simpleQuery,
    (snapshot) => {
      const notifications = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Notification)

      const sorted = notifications.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0
        const bTime = b.createdAt?.toMillis?.() || 0
        return bTime - aTime
      })

      notificationCache.set(userId, sorted)
      callback(sorted)
    },
    (error: any) => {
      console.error("Error in notifications subscription:", error)
      const cached = notificationCache.get(userId)
      if (cached) {
        callback(cached)
      }
    },
  )

  activeSubscriptions.set(userId, unsubscribe)

  return () => {
    if (unsubscribe) {
      unsubscribe()
    }
    activeSubscriptions.delete(userId)
  }
}

export async function getUnreadNotificationsCount(userId: string): Promise<number> {
  try {
    const db = getFirebaseDb()
    const notificationsQuery = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      where("read", "==", false),
    )
    const notificationsSnapshot = await getDocs(notificationsQuery)
    return notificationsSnapshot.size
  } catch (error) {
    console.error("Error getting unread notifications count:", error)
    return 0
  }
}

export async function createBatchNotifications(
  notifications: Array<{
    userId: string
    title: string
    message: string
    type?: "info" | "success" | "warning" | "error" | "evaluation" | "task" | "meeting" | "project" | "message"
    link?: string
    priority?: "low" | "medium" | "high"
    category?: string
  }>,
) {
  try {
    const db = getFirebaseDb()
    const batch = notifications.map((params) => {
      const notificationData: any = {
        userId: params.userId,
        title: params.title,
        message: params.message,
        type: params.type || "info",
        priority: params.priority || "medium",
        read: false,
        createdAt: serverTimestamp(),
      }

      if (params.link) notificationData.link = params.link
      if (params.category) notificationData.category = params.category

      return addDoc(collection(db, "notifications"), notificationData)
    })

    await Promise.all(batch)
  } catch (error) {
    console.error("Error creating batch notifications:", error)
    throw error
  }
}

export async function getNotificationsByCategory(userId: string, category: string, limitCount = 20) {
  try {
    const db = getFirebaseDb()
    const notificationsQuery = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      where("category", "==", category),
      limit(limitCount),
    )
    const notificationsSnapshot = await getDocs(notificationsQuery)
    return notificationsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Notification)
  } catch (error) {
    console.error("Error getting notifications by category:", error)
    throw error
  }
}

export function cleanupNotificationSubscriptions() {
  activeSubscriptions.forEach((unsubscribe) => unsubscribe())
  activeSubscriptions.clear()
  notificationCache.clear()
}
