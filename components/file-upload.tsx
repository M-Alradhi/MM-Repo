"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Upload, File, X, ImageIcon } from "lucide-react"
import { uploadFile } from "@/lib/firebase/storage"
import { useAuth } from "@/lib/contexts/auth-context"
import { useLanguage } from "@/lib/contexts/language-context"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { isImageFile, isFileSafeToUpload } from "@/lib/imgbb"

interface FileUploadProps {
  projectId?: string
  onUploadComplete?: () => void
  acceptImages?: boolean // Only accept images
  acceptFiles?: boolean // Accept all files
}

export function FileUpload({ projectId, onUploadComplete, acceptImages = false, acceptFiles = true }: FileUploadProps) {
  const { userData } = useAuth()
    const { t } = useLanguage()
    const [stats, setStats] = useState({
      totalProjects: 0,
      activeProjects: 0,
      completedProjects: 0,
      totalSupervisors: 0,
      totalStudents: 0,
      averageProgress: 0,
      projectsNeedingAttention: 0,
    })
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({})

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)

      // Security: Validate all files are safe to upload
      for (const file of files) {
        const safetyCheck = isFileSafeToUpload(file)
        if (!safetyCheck.safe) {
          setError(safetyCheck.reason || "ملف غير مسموح به")
          return
        }
      }

      // Validate file types if only images are accepted
      if (acceptImages && !acceptFiles) {
        const invalidFiles = files.filter((file) => !isImageFile(file))
        if (invalidFiles.length > 0) {
          setError(t("pleaseChoosePicOnly"))
          return
        }
      }

      // Limit total file count to prevent abuse
      if (files.length > 10) {
        setError("الحد الاقصى 10 ملفات في المرة الواحدة")
        return
      }

      setSelectedFiles(files)
      setError("")
      setSuccess("")
    }
  }

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (!userData?.uid || selectedFiles.length === 0) return

    setUploading(true)
    setError("")
    setSuccess("")
    setUploadProgress({})

    try {
      let uploadedCount = 0
      for (const file of selectedFiles) {
        try {
          setUploadProgress((prev) => ({ ...prev, [file.name]: 50 }))
          await uploadFile(file, userData.uid, projectId)
          uploadedCount++
          setUploadProgress((prev) => ({ ...prev, [file.name]: 100 }))
        } catch (fileError: any) {
          console.error(`Error uploading ${file.name}:`, fileError)
          // Continue with other files even if one fails
          setError(`فشل رفع ${file.name}: ${fileError.message || t("unknowError")}`)
          setUploadProgress((prev) => ({ ...prev, [file.name]: 0 }))
        }
      }

      if (uploadedCount > 0) {
        setSuccess(`تم رفع ${uploadedCount} من ${selectedFiles.length} ملف بنجاح`)
        setSelectedFiles([])
        setUploadProgress({})

        // Call the callback after a short delay to show success message
        setTimeout(() => {
          onUploadComplete?.()
        }, 1000)
      } else {
        setError("فشل رفع جميع الملفات. يرجى المحاولة مرة أخرى")
      }
    } catch (err: any) {
      console.error("Upload error:", err)
      setError(err.message || "حدث خطأ أثناء رفع الملفات")
    } finally {
      setUploading(false)
    }
  }

  const acceptType = acceptImages && !acceptFiles ? "image/*" : undefined

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-500 text-green-700 dark:text-green-400">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Card className="rounded-xl border-2">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
              {acceptImages && !acceptFiles ? (
                <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              ) : (
                <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              )}
              <p className="text-sm text-muted-foreground mb-2">
                {acceptImages && !acceptFiles ? "اسحب الصور هنا أو انقر للاختيار" : "اسحب الملفات هنا أو انقر للاختيار"}
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                {acceptImages && !acceptFiles
                  ? "(الصور ستُرفع على ImgBB)"
                  : "(الصور ستُرفع على ImgBB، الملفات الأخرى ستُحفظ في Firestore)"}
              </p>
              <input
                type="file"
                multiple
                accept={acceptType}
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
                disabled={uploading}
              />
              <label htmlFor="file-upload">
                <Button variant="outline" disabled={uploading} asChild className="rounded-lg bg-transparent">
                  <span>اختيار {acceptImages && !acceptFiles ? "الصور" : "الملفات"}</span>
                </Button>
              </label>
            </div>

            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">الملفات المحددة ({selectedFiles.length}):</p>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {selectedFiles.map((file, index) => {
                    const isImg = isImageFile(file)
                    const progress = uploadProgress[file.name] || 0

                    return (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {isImg ? (
                            <ImageIcon className="w-5 h-5 text-blue-500 flex-shrink-0" />
                          ) : (
                            <File className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(file.size / 1024).toFixed(2)} KB
                              {isImg && " • سيتم الرفع على ImgBB"}
                            </p>
                            {uploading && progress > 0 && (
                              <div className="mt-1 w-full bg-secondary rounded-full h-1">
                                <div
                                  className="bg-primary h-1 rounded-full transition-all duration-300"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFile(index)}
                          disabled={uploading}
                          className="flex-shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )
                  })}
                </div>

                <Button onClick={handleUpload} disabled={uploading} className="w-full rounded-lg">
                  {uploading ? "جاري الرفع..." : `رفع ${selectedFiles.length} ملف`}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
