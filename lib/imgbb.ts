// ImgBB API Integration for image uploads
// Images are uploaded through our API route to keep API key secure

export interface ImgBBUploadResponse {
  data: {
    id: string
    title: string
    url_viewer: string
    url: string
    display_url: string
    width: number
    height: number
    size: number
    time: number
    expiration: number
    image: {
      filename: string
      name: string
      mime: string
      extension: string
      url: string
    }
    thumb: {
      filename: string
      name: string
      mime: string
      extension: string
      url: string
    }
    medium?: {
      filename: string
      name: string
      mime: string
      extension: string
      url: string
    }
    delete_url: string
  }
  success: boolean
  status: number
}

/**
 * Upload an image to ImgBB through our secure API route
 * @param file - The image file to upload
 * @param name - Optional name for the image
 * @returns Promise with the upload response
 */
export async function uploadToImgBB(file: File, name?: string): Promise<ImgBBUploadResponse> {
  try {
    // Convert file to base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        // Remove the data URL prefix (e.g., "data:image/png;base64,")
        const base64String = result.split(",")[1]
        resolve(base64String)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    // Create form data
    const formData = new FormData()
    formData.append("image", base64)
    if (name) {
      formData.append("name", name)
    }

    // Upload through our API route (keeps API key secure on server)
    const response = await fetch("/api/upload-image", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      throw new Error(errData?.error || `فشل رفع الصورة (${response.status})`)
    }

    const data: ImgBBUploadResponse = await response.json()

    if (!data.success) {
      throw new Error("فشل رفع الصورة على ImgBB")
    }

    return data
  } catch (err: any) {
    throw new Error(err?.message || "فشل رفع الصورة. يرجى المحاولة مرة أخرى")
  }
}

// ─── Allowed File Types ──────────────────────────────────────────

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
]

const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp"]

// Dangerous file types that should never be uploaded
const BLOCKED_EXTENSIONS = [
  ".exe", ".bat", ".cmd", ".com", ".msi", ".scr", ".pif",
  ".js", ".vbs", ".wsf", ".wsh", ".ps1", ".sh", ".bash",
  ".php", ".asp", ".aspx", ".jsp", ".cgi", ".py", ".pl",
  ".html", ".htm", ".svg", // SVG can contain scripts
]

/**
 * Check if a file is an image by MIME type and extension
 */
export function isImageFile(file: File): boolean {
  const mimeCheck = ALLOWED_IMAGE_TYPES.includes(file.type)
  const extCheck = ALLOWED_IMAGE_EXTENSIONS.some((ext) =>
    file.name.toLowerCase().endsWith(ext)
  )
  // Both MIME type and extension must match to prevent type confusion
  return mimeCheck && extCheck
}

/**
 * Validate that a file is safe to upload
 */
export function isFileSafeToUpload(file: File): { safe: boolean; reason?: string } {
  // Check for blocked extensions
  const fileName = file.name.toLowerCase()
  const isBlocked = BLOCKED_EXTENSIONS.some((ext) => fileName.endsWith(ext))
  if (isBlocked) {
    return { safe: false, reason: "نوع الملف غير مسموح به" }
  }

  // Check for double extensions (e.g., file.jpg.exe)
  const parts = fileName.split(".")
  if (parts.length > 2) {
    const lastExt = `.${parts[parts.length - 1]}`
    if (BLOCKED_EXTENSIONS.includes(lastExt)) {
      return { safe: false, reason: "نوع الملف غير مسموح به" }
    }
  }

  // Check for null bytes in filename (path traversal)
  if (file.name.includes("\0") || file.name.includes("..")) {
    return { safe: false, reason: "اسم الملف غير صالح" }
  }

  return { safe: true }
}

/**
 * Validate image file size (max 32MB for ImgBB free tier)
 */
export function validateImageSize(file: File, maxSizeMB = 32): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024
  return file.size <= maxSizeBytes
}

/**
 * Sanitize a filename for safe storage
 */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/[^\w.\-\u0600-\u06FF]/g, "_") // Allow alphanumeric, dots, hyphens, and Arabic
    .replace(/\.{2,}/g, ".") // Remove double dots
    .replace(/^\./, "_") // Don't start with dot
    .slice(0, 100) // Limit length
}
