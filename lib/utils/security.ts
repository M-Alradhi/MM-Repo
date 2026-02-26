/**
 * Security utility functions for the graduation projects platform.
 * Provides XSS prevention, input sanitization, CSRF token handling,
 * and other security helpers.
 */

// ─── XSS Prevention ───────────────────────────────────────────────
const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
  "`": "&#96;",
}

/**
 * Escape HTML entities in a string to prevent XSS
 */
export function escapeHtml(str: string): string {
  return str.replace(/[&<>"'`/]/g, (char) => HTML_ESCAPE_MAP[char] || char)
}

/**
 * Sanitize user input by removing dangerous HTML/script content
 * while preserving Arabic/Unicode text.
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== "string") return ""

  return input
    // Remove script tags and their content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    // Remove event handlers (onclick, onerror, etc.)
    .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\bon\w+\s*=\s*[^\s>]*/gi, "")
    // Remove javascript: protocol
    .replace(/javascript\s*:/gi, "")
    // Remove data: protocol in links (prevents data: URI XSS)
    .replace(/data\s*:[^,]*,/gi, "")
    // Remove vbscript: protocol
    .replace(/vbscript\s*:/gi, "")
    // Remove HTML tags
    .replace(/<[^>]*>/g, "")
    // Trim excessive whitespace
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Sanitize an object's string values recursively
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized = { ...obj }
  for (const key in sanitized) {
    const value = sanitized[key]
    if (typeof value === "string") {
      ;(sanitized as Record<string, unknown>)[key] = sanitizeInput(value)
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      ;(sanitized as Record<string, unknown>)[key] = sanitizeObject(value as Record<string, unknown>)
    }
  }
  return sanitized
}

// ─── CSRF Protection ──────────────────────────────────────────────

/**
 * Generate a CSRF token for use in forms (client-side)
 */
export function generateCsrfToken(): string {
  const array = new Uint8Array(32)
  if (typeof window !== "undefined" && window.crypto) {
    window.crypto.getRandomValues(array)
  } else {
    // Fallback for environments without crypto
    for (let i = 0; i < 32; i++) {
      array[i] = Math.floor(Math.random() * 256)
    }
  }
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

// ─── Rate Limiting (Client-side) ─────────────────────────────────

const clientRateLimits = new Map<string, { count: number; resetAt: number }>()

/**
 * Client-side rate limiter to throttle sensitive actions (e.g., login attempts)
 */
export function checkClientRateLimit(
  action: string,
  maxAttempts: number = 5,
  windowMs: number = 60 * 1000
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now()
  const record = clientRateLimits.get(action)

  if (!record || now > record.resetAt) {
    clientRateLimits.set(action, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfterMs: 0 }
  }

  if (record.count >= maxAttempts) {
    return { allowed: false, retryAfterMs: record.resetAt - now }
  }

  record.count++
  return { allowed: true, retryAfterMs: 0 }
}

// ─── URL Validation ──────────────────────────────────────────────

/**
 * Validate that a URL is safe (not javascript:, data:, etc.)
 */
export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url, "https://example.com")
    return ["http:", "https:"].includes(parsed.protocol)
  } catch {
    return false
  }
}

// ─── Content Validation ──────────────────────────────────────────

/**
 * Validate that a string doesn't contain potential injection patterns
 */
export function containsInjectionPatterns(str: string): boolean {
  const patterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // event handlers
    /eval\s*\(/i,
    /expression\s*\(/i,
    /url\s*\(\s*['"]?\s*javascript/i,
    /import\s*\(/i, // dynamic imports
    /__proto__/i,
    /constructor\s*\[/i,
    /prototype/i,
  ]
  return patterns.some((pattern) => pattern.test(str))
}

// ─── Session Security ────────────────────────────────────────────

/**
 * Generate a secure random session identifier
 */
export function generateSessionId(): string {
  const array = new Uint8Array(48)
  if (typeof window !== "undefined" && window.crypto) {
    window.crypto.getRandomValues(array)
  } else {
    for (let i = 0; i < 48; i++) {
      array[i] = Math.floor(Math.random() * 256)
    }
  }
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

// ─── Login Attempt Tracking ──────────────────────────────────────

const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_DURATION = 15 * 60 * 1000 // 15 minutes
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>()

/**
 * Track login attempts and enforce account lockout
 */
export function trackLoginAttempt(email: string): {
  allowed: boolean
  remainingAttempts: number
  lockedUntilMs: number
} {
  const now = Date.now()
  const key = email.toLowerCase().trim()
  const record = loginAttempts.get(key)

  // Check if locked out
  if (record && record.lockedUntil > now) {
    return {
      allowed: false,
      remainingAttempts: 0,
      lockedUntilMs: record.lockedUntil - now,
    }
  }

  // Reset if lockout expired
  if (record && record.lockedUntil <= now && record.count >= MAX_LOGIN_ATTEMPTS) {
    loginAttempts.delete(key)
  }

  const current = loginAttempts.get(key) || { count: 0, lockedUntil: 0 }
  current.count++

  if (current.count >= MAX_LOGIN_ATTEMPTS) {
    current.lockedUntil = now + LOCKOUT_DURATION
    loginAttempts.set(key, current)
    return {
      allowed: false,
      remainingAttempts: 0,
      lockedUntilMs: LOCKOUT_DURATION,
    }
  }

  loginAttempts.set(key, current)
  return {
    allowed: true,
    remainingAttempts: MAX_LOGIN_ATTEMPTS - current.count,
    lockedUntilMs: 0,
  }
}

/**
 * Reset login attempts on successful login
 */
export function resetLoginAttempts(email: string): void {
  loginAttempts.delete(email.toLowerCase().trim())
}

// ─── Suspicious Activity Detection ──────────────────────────────

/**
 * Log suspicious activity for monitoring
 */
export function logSecurityEvent(event: {
  type: "login_failure" | "rate_limit" | "xss_attempt" | "unauthorized_access" | "suspicious_input"
  details: string
  userId?: string
  ip?: string
}) {
  // In production, this should send to a security monitoring service
  console.warn(`[SECURITY] ${event.type}: ${event.details}`, {
    userId: event.userId,
    ip: event.ip,
    timestamp: new Date().toISOString(),
  })
}
