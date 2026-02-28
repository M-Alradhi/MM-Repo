// Enhanced file storage with ImgBB support for images
// Images are stored on ImgBB, other files are stored on Firebase Storage

import { getFirebaseDb, getFirebaseStorage } from "./config"
import { collection, addDoc, serverTimestamp, query, where, getDocs, deleteDoc, doc } from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage"
import { uploadToImgBB, isImageFile, validateImageSize, isFileSafeToUpload, sanitizeFileName } from "@/lib/imgbb"

export interface FileMetadata {
  id?: string
  name: string
  url: string // ImgBB URL for images, Firebase Storage URL for other files
  storagePath?: string // Firebase Storage path for deletion
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
    let storagePath: string | undefined
    const isImage = isImageFile(file)

    // Upload images to ImgBB, other files to Firebase Storage
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
      // Non-image files: upload to Firebase Storage (no size limit issue)
      if (file.size > 50 * 1024 * 1024) {
        throw new Error("حجم الملف كبير جداً. الحد الأقصى 50 ميجابايت")
      }

      try {
        const firebaseStorage = getFirebaseStorage()
        const timestamp = Date.now()
        storagePath = `files/${userId}/${timestamp}_${safeName}`
        const storageRef = ref(firebaseStorage, storagePath)
        await uploadBytes(storageRef, file)
        url = await getDownloadURL(storageRef)
      } catch (error) {
        console.error("Error uploading to Firebase Storage:", error)
        throw new Error("فشل رفع الملف. يرجى المحاولة مرة أخرى")
      }
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
      storagePath,
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

    if (storagePath) {
      fileData.storagePath = storagePath
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
        storagePath: data.storagePath,
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
    const fileDoc = await getDocs(query(collection(db, "files"), where("__name__", "==", fileId)))
    
    // If file is stored in Firebase Storage, delete it there too
    if (!fileDoc.empty) {
      const data = fileDoc.docs[0].data()
      if (data.storagePath) {
        try {
          const firebaseStorage = getFirebaseStorage()
          const storageRef = ref(firebaseStorage, data.storagePath)
          await deleteObject(storageRef)
        } catch (storageError) {
          console.error("Error deleting from Firebase Storage:", storageError)
        }
      }
    }

    await deleteDoc(doc(db, "files", fileId))
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
        storagePath: data.storagePath,
      } as FileMetadata
    })

    return files
  } catch (error) {
    console.error("Error listing user files:", error)
    throw error
  }
}
