import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Home, ArrowRight } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <div className="mx-auto mb-4 text-6xl font-bold text-blue-600">404</div>
          <CardTitle className="text-2xl">الصفحة غير موجودة</CardTitle>
          <CardDescription className="text-base mt-2">
            عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها إلى موقع آخر
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3">
            <Button asChild size="lg" className="w-full">
              <Link href="/">
                <Home className="ml-2 h-4 w-4" />
                العودة للصفحة الرئيسية
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full bg-transparent">
              <Link href="/auth/login">
                تسجيل الدخول
                <ArrowRight className="mr-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
