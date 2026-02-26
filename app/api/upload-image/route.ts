import { type NextRequest, NextResponse } from "next/server"

// In-memory rate limiter for upload endpoint
const uploadAttempts = new Map<string, { count: number; resetAt: number }>()
const UPLOAD_RATE_LIMIT = 10 // max uploads per window
const UPLOAD_RATE_WINDOW = 60 * 1000 // 1 minute window

// Max upload size: 32MB
const MAX_UPLOAD_SIZE = 32 * 1024 * 1024

function checkUploadRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = uploadAttempts.get(ip)

  if (!record || now > record.resetAt) {
    uploadAttempts.set(ip, { count: 1, resetAt: now + UPLOAD_RATE_WINDOW })
    return true
  }

  if (record.count >= UPLOAD_RATE_LIMIT) {
    return false
  }

  record.count++
  return true
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit check
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    if (!checkUploadRateLimit(clientIp)) {
      return NextResponse.json(
        { error: "تم تجاوز حد الطلبات. حاول مرة أخرى بعد دقيقة." },
        { status: 429 },
      )
    }

    // Validate API key exists
    const apiKey = process.env.IMGBB_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "خدمة رفع الصور غير مهيأة" },
        { status: 503 },
      )
    }

    // Validate content length
    const contentLength = request.headers.get("content-length")
    if (contentLength && parseInt(contentLength) > MAX_UPLOAD_SIZE) {
      return NextResponse.json(
        { error: "حجم الملف كبير جدا. الحد الاقصى 32 ميجابايت" },
        { status: 413 },
      )
    }

    const formData = await request.formData()
    const image = formData.get("image") as string
    const name = formData.get("name") as string | null

    if (!image) {
      return NextResponse.json(
        { error: "لم يتم ارسال صورة" },
        { status: 400 },
      )
    }

    // Validate image data is base64
    if (typeof image !== "string" || image.length === 0) {
      return NextResponse.json(
        { error: "بيانات الصورة غير صالحة" },
        { status: 400 },
      )
    }

    // Sanitize file name to prevent path traversal
    const sanitizedName = name ? name.replace(/[^a-zA-Z0-9_\-.\u0600-\u06FF]/g, "_").slice(0, 100) : undefined

    // Create form data for ImgBB
    const imgbbFormData = new FormData()
    imgbbFormData.append("image", image)
    if (sanitizedName) {
      imgbbFormData.append("name", sanitizedName)
    }

    // Upload to ImgBB
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: "POST",
      body: imgbbFormData,
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error("ImgBB API error:", errorData)
      return NextResponse.json(
        { error: "فشل رفع الصورة. حاول مرة اخرى." },
        { status: response.status },
      )
    }

    const data = await response.json()

    if (!data.success) {
      return NextResponse.json({ error: "فشل رفع الصورة" }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error("Error in upload-image API:", error)
    return NextResponse.json({ error: "حدث خطأ في السيرفر" }, { status: 500 })
  }
}