// ─── Email Validation ────────────────────────────────────────────

export function validateEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false
  // RFC 5322 simplified regex + length check
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
  return email.length <= 254 && emailRegex.test(email)
}

// ─── Password Validation (Strengthened) ──────────────────────────

export interface PasswordValidationResult {
  valid: boolean
  message?: string
  strength: "weak" | "medium" | "strong"
  checks: {
    minLength: boolean
    hasUppercase: boolean
    hasLowercase: boolean
    hasNumber: boolean
    hasSpecialChar: boolean
    noCommonPatterns: boolean
  }
}

const COMMON_PASSWORDS = [
  "password", "123456", "12345678", "qwerty", "abc123",
  "monkey", "master", "dragon", "111111", "baseball",
  "iloveyou", "trustno1", "sunshine", "princess", "football",
  "shadow", "superman", "michael", "password1", "123456789",
]

export function validatePassword(password: string): PasswordValidationResult {
  const checks = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password),
    noCommonPatterns: !COMMON_PASSWORDS.includes(password.toLowerCase()),
  }

  const passedChecks = Object.values(checks).filter(Boolean).length

  if (!checks.minLength) {
    return {
      valid: false,
      message: "كلمة المرور يجب ان تكون 8 احرف على الاقل",
      strength: "weak",
      checks,
    }
  }

  if (!checks.noCommonPatterns) {
    return {
      valid: false,
      message: "كلمة المرور شائعة جدا. اختر كلمة مرور اقوى",
      strength: "weak",
      checks,
    }
  }

  if (!checks.hasUppercase && !checks.hasNumber) {
    return {
      valid: false,
      message: "كلمة المرور يجب ان تحتوي على حرف كبير او رقم على الاقل",
      strength: "weak",
      checks,
    }
  }

  let strength: "weak" | "medium" | "strong" = "weak"
  if (passedChecks >= 5) {
    strength = "strong"
  } else if (passedChecks >= 3) {
    strength = "medium"
  }

  if (passedChecks < 3) {
    return {
      valid: false,
      message: "كلمة المرور ضعيفة. اضف حروف كبيرة وارقام ورموز",
      strength,
      checks,
    }
  }

  return { valid: true, strength, checks }
}

// ─── Project Title Validation ────────────────────────────────────

export function validateProjectTitle(title: string): { valid: boolean; message?: string } {
  if (!title || typeof title !== "string") {
    return { valid: false, message: "عنوان المشروع مطلوب" }
  }
  const trimmed = title.trim()
  if (trimmed.length < 5) {
    return { valid: false, message: "عنوان المشروع يجب ان يكون 5 احرف على الاقل" }
  }
  if (trimmed.length > 100) {
    return { valid: false, message: "عنوان المشروع يجب ان لا يتجاوز 100 حرف" }
  }
  // Check for injection patterns
  if (/<script/i.test(trimmed) || /javascript:/i.test(trimmed)) {
    return { valid: false, message: "العنوان يحتوي على محتوى غير مسموح" }
  }
  return { valid: true }
}

// ─── Description Validation ──────────────────────────────────────

export function validateDescription(description: string): { valid: boolean; message?: string } {
  if (!description || typeof description !== "string") {
    return { valid: false, message: "الوصف مطلوب" }
  }
  const trimmed = description.trim()
  if (trimmed.length < 20) {
    return { valid: false, message: "الوصف يجب ان يكون 20 حرف على الاقل" }
  }
  if (trimmed.length > 1000) {
    return { valid: false, message: "الوصف يجب ان لا يتجاوز 1000 حرف" }
  }
  if (/<script/i.test(trimmed) || /javascript:/i.test(trimmed)) {
    return { valid: false, message: "الوصف يحتوي على محتوى غير مسموح" }
  }
  return { valid: true }
}

// ─── Phone Number Validation ─────────────────────────────────────

export function validatePhoneNumber(phone: string): boolean {
  if (!phone || typeof phone !== "string") return false
  const cleaned = phone.replace(/[\s\-()]/g, "")
  // Allow Saudi phone numbers and international formats
  return /^(\+?966|0)?[0-9]{9,10}$/.test(cleaned)
}

// ─── Student ID Validation ───────────────────────────────────────

export function validateStudentId(studentId: string): boolean {
  if (!studentId || typeof studentId !== "string") return false
  const trimmed = studentId.trim()
  // Must be alphanumeric, reasonable length
  return trimmed.length > 0 && trimmed.length <= 20 && /^[a-zA-Z0-9]+$/.test(trimmed)
}

// ─── Generic Text Sanitization for Firestore writes ──────────────

export function sanitizeTextForDb(text: string, maxLength: number = 500): string {
  if (typeof text !== "string") return ""
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/<[^>]*>/g, "")
    .trim()
    .slice(0, maxLength)
}
