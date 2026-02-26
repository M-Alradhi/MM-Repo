import { collection, getDocs, query, where } from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase/config"

export interface Department {
  id: string
  code: string
  name?: string // Added optional name field for backward compatibility
  nameAr: string
  nameEn: string
  isActive: boolean
  createdAt: any
}

export async function getDepartments(): Promise<Department[]> {
  try {
    const db = getFirebaseDb()
    const q = query(collection(db, "departments"), where("isActive", "==", true))
    const snapshot = await getDocs(q)
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Department[]
  } catch (error) {
    console.error("Error fetching departments:", error)
    return []
  }
}

export function getDepartmentName(code: string, departments: Department[]): string {
  const dept = departments.find((d) => d.code === code)
  if (!dept) return code || "غير محدد"
  return dept.name || dept.nameAr || code || "غير محدد"
}
