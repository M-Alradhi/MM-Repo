import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// ─── Configuration ────────────────────────────────────────────────

const PUBLIC_PATHS = ["/", "/auth/login", "/auth/register", "/auth/forgot-password"]
const STATIC_PREFIXES = ["/api", "/_next", "/favicon.ico"]

// Role-path mapping for authorization
const ROLE_PATH_MAP: Record<string, string> = {
  student: "/student",
  supervisor: "/supervisor",
  coordinator: "/coordinator",
}

// ─── Security Headers ─────────────────────────────────────────────

function applySecurityHeaders(response: NextResponse): NextResponse {
  // Prevent MIME-type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff")

  // Prevent clickjacking
  response.headers.set("X-Frame-Options", "DENY")

  // XSS Protection (legacy, but still useful for older browsers)
  response.headers.set("X-XSS-Protection", "1; mode=block")

  // Referrer Policy
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")

  // Permissions Policy (restrict browser features)
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  )

  // Content Security Policy
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://*.firebaseapp.com https://*.googleapis.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.imgbb.com https://i.ibb.co https://*.googleapis.com https://*.googleusercontent.com",
      "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://*.firebaseapp.com wss://*.firebaseio.com https://api.deepseek.com https://api.imgbb.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com",
      "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  )

  // Strict Transport Security (HTTPS only)
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")

  return response
}

// ─── Rate Limiting for Pages ──────────────────────────────────────

const pageRequestCounts = new Map<string, { count: number; resetAt: number }>()
const PAGE_RATE_LIMIT = 60 // requests per window
const PAGE_RATE_WINDOW = 60 * 1000 // 1 minute

function isPageRateLimited(ip: string): boolean {
  const now = Date.now()
  const record = pageRequestCounts.get(ip)

  if (!record || now > record.resetAt) {
    pageRequestCounts.set(ip, { count: 1, resetAt: now + PAGE_RATE_WINDOW })
    return false
  }

  record.count++
  return record.count > PAGE_RATE_LIMIT
}

// ─── Middleware ───────────────────────────────────────────────────

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip static resources
  if (STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return applySecurityHeaders(NextResponse.next())
  }

  // Rate limit check
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  if (isPageRateLimited(clientIp)) {
    return new NextResponse("طلبات كثيرة جدا. حاول مرة اخرى بعد قليل.", {
      status: 429,
      headers: { "Retry-After": "60" },
    })
  }

  // Allow public paths
  if (PUBLIC_PATHS.includes(pathname)) {
    const response = NextResponse.next()
    return applySecurityHeaders(response)
  }

  // Check for auth session cookie
  const sessionCookie = request.cookies.get("session_role")?.value

  // Protected routes: if no session cookie, redirect to login
  const isProtectedRoute = Object.values(ROLE_PATH_MAP).some((p) => pathname.startsWith(p))

  if (isProtectedRoute && !sessionCookie) {
    const loginUrl = new URL("/auth/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return applySecurityHeaders(NextResponse.redirect(loginUrl))
  }

  // Role-based access control via cookie
  if (sessionCookie && isProtectedRoute) {
    const allowedPath = ROLE_PATH_MAP[sessionCookie]
    if (allowedPath && !pathname.startsWith(allowedPath)) {
      // User is trying to access a path for a different role
      const correctDashboard = `${allowedPath}/dashboard`
      return applySecurityHeaders(NextResponse.redirect(new URL(correctDashboard, request.url)))
    }
  }

  const response = NextResponse.next()
  return applySecurityHeaders(response)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}
