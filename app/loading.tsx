import { Spinner } from "@/components/ui/spinner"

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center space-y-4">
        <Spinner className="h-12 w-12 mx-auto text-blue-600" />
        <p className="text-lg text-gray-600">جاري التحميل...</p>
      </div>
    </div>
  )
}
