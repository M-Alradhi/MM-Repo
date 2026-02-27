// Enhanced file storage with ImgBB support for images
// Images are stored on ImgBB, other files as base64 in Firestore

import { getFirebaseDb } from "./config"
import { collection, addDoc, serverTimestamp, query, where, getDocs, deleteDoc, doc } from "firebase/firestore"
import { uploadToImgBB, isImageFile, validateImageSize, isFileSafeToUpload, sanitizeFileName } from "@/lib/imgbb"

export interface FileMetadata {
  id?: string
  name: string
  url: string // ImgBB URL for images, base64 for other files
  size: number
  type: string
  uploadedBy: string
  uploadedAt: Date
  projectId?: string
  isImage?: boolean
  imgbbId?: string // ImgBB image ID for deletion
  deleteUrl?: string // ImgBB delete URL
}

export async function uploadFile(
  file: File,
  userId: string,
  projectId?: string,
): Promise<{ url: string; metadata: FileMetadata }> {
  try {
    const db = getFirebaseDb()

    // Security: Validate file safety before any upload
    const safetyCheck = isFileSafeToUpload(file)
    if (!safetyCheck.safe) {
      throw new Error(safetyCheck.reason || "نوع الملف غير مسموح به")
    }

    // Sanitize filename
    const safeName = sanitizeFileName(file.name)

    let url: string
    let imgbbId: string | undefined
    let deleteUrl: string | undefined
    const isImage = isImageFile(file)

    // Upload images to ImgBB, other files as base64
    if (isImage) {
      // Validate image size
      if (!validateImageSize(file)) {
        throw new Error("حجم الصورة كبير جداً. الحد الأقصى 32 ميجابايت")
      }

      try {
        const imgbbResponse = await uploadToImgBB(file, safeName)
        url = imgbbResponse.data.display_url
        imgbbId = imgbbResponse.data.id
        deleteUrl = imgbbResponse.data.delete_url
      } catch (error) {
        console.error("Error uploading to ImgBB:", error)
        throw new Error("فشل رفع الصورة. يرجى المحاولة مرة أخرى")
      }
    } else {
      // Non-image files: limit to 700KB to stay under Firestore's 1MB document limit
      // (base64 encoding increases size by ~33%)
      if (file.size > 700 * 1024) {
        throw new Error("حجم الملف كبير جداً. الحد الأقصى 700 كيلوبايت للملفات غير الصور")
      }

      // Convert file to base64 for non-image files
      url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error("فشل قراءة الملف"))
        reader.readAsDataURL(file)
      })
    }

    const metadata: FileMetadata = {
      name: safeName,
      url,
      size: file.size,
      type: file.type,
      uploadedBy: userId,
      uploadedAt: new Date(),
      projectId,
      isImage,
      imgbbId,
      deleteUrl,
    }

    const fileData: Record<string, unknown> = {
      name: safeName,
      url,
      size: file.size,
      type: file.type,
      uploadedBy: userId,
      uploadedAt: serverTimestamp(),
      isImage,
    }

    if (projectId !== undefined) {
      fileData.projectId = projectId
    }

    if (imgbbId) {
      fileData.imgbbId = imgbbId
    }

    if (deleteUrl) {
      fileData.deleteUrl = deleteUrl
    }

    try {
      const docRef = await addDoc(collection(db, "files"), fileData)
      metadata.id = docRef.id
    } catch (firestoreError) {
      console.error("Error saving to Firestore:", firestoreError)
      throw new Error("فشل حفظ بيانات الملف. يرجى المحاولة مرة أخرى")
    }

    return { url, metadata }
  } catch (error: unknown) {
    throw error
  }
}

export async function listFiles(projectId: string): Promise<FileMetadata[]> {
  try {
    const db = getFirebaseDb()
    const filesRef = collection(db, "files")
    const q = query(filesRef, where("projectId", "==", projectId))
    const querySnapshot = await getDocs(q)

    const files = querySnapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        name: data.name,
        url: data.url,
        size: data.size,
        type: data.type,
        uploadedBy: data.uploadedBy,
        uploadedAt: data.uploadedAt?.toDate(),
        projectId: data.projectId,
        isImage: data.isImage,
        imgbbId: data.imgbbId,
        deleteUrl: data.deleteUrl,
      } as FileMetadata
    })

    return files
  } catch (error) {
    console.error("Error listing files:", error)
    throw error
  }
}

export async function deleteFile(fileId: string) {
  try {
    const db = getFirebaseDb()
    await deleteDoc(doc(db, "files", fileId))
    // Note: ImgBB images are not automatically deleted
    // You would need to use the delete_url if you want to delete from ImgBB
  } catch (error) {
    console.error("Error deleting file:", error)
    throw error
  }
}

export async function getUserFiles(userId: string): Promise<FileMetadata[]> {
  try {
    const db = getFirebaseDb()
    const filesRef = collection(db, "files")
    const q = query(filesRef, where("uploadedBy", "==", userId))
    const querySnapshot = await getDocs(q)

    const files = querySnapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        name: data.name,
        url: data.url,
        size: data.size,
        type: data.type,
        uploadedBy: data.uploadedBy,
        uploadedAt: data.uploadedAt?.toDate(),
        projectId: data.projectId,
        isImage: data.isImage,
        imgbbId: data.imgbbId,
        deleteUrl: data.deleteUrl,
      } as FileMetadata
    })

    return files
  } catch (error) {
    console.error("Error listing user files:", error)
    throw error
  }
}
