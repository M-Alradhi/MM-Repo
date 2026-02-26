"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Upload, File, X, ImageIcon, Loader2 } from "lucide-react"
import { uploadFile } from "@/lib/firebase/storage"
import { useAuth } from "@/lib/contexts/auth-context"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { isImageFile, isFileSafeToUpload } from "@/lib/imgbb"
import type { SubmittedFile } from "@/lib/types"

interface TaskFileUploadProps {
  onFilesChange: (files: SubmittedFile[]) => void
  existingFiles?: SubmittedFile[]
  maxFiles?: number
}

export function TaskFileUpload({ onFilesChange, existingFiles = [], maxFiles = 5 }: TaskFileUploadProps) {
  const { userData } = useAuth()
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadedFiles, setUploadedFiles] = useState<SubmittedFile[]>(existingFiles)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")

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

        // Enforce max file size (10MB per file for tasks)
        if (file.size > 10 * 1024 * 1024) {
          setError(`حجم الملف "${file.name}" كبير جدا. الحد الاقصى 10 ميجابايت`)
          return
        }
      }

      const totalFiles = uploadedFiles.length + selectedFiles.length + files.length

      if (totalFiles > maxFiles) {
        setError(`الحد الاقصى ${maxFiles} ملفات`)
        return
      }

      setSelectedFiles([...selectedFiles, ...files])
      setError("")
    }
  }

  const handleRemoveSelected = (index: number) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index))
  }

  const handleRemoveUploaded = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index)
    setUploadedFiles(newFiles)
    onFilesChange(newFiles)
  }

  const handleUpload = async () => {
    if (!userData?.uid || selectedFiles.length === 0) return

    setUploading(true)
    setError("")

    try {
      const uploadPromises = selectedFiles.map(async (file) => {
        const { url, metadata } = await uploadFile(file, userData.uid, userData.projectId)
        return {
          id: metadata.id || crypto.randomUUID(),
          name: file.name,
          url,
          size: file.size,
          type: file.type,
          isImage: isImageFile(file),
          uploadedAt: new Date(),
        } as SubmittedFile
      })

      const newFiles = await Promise.all(uploadPromises)
      const allFiles = [...uploadedFiles, ...newFiles]
      setUploadedFiles(allFiles)
      onFilesChange(allFiles)
      setSelectedFiles([])
    } catch (err: any) {
      console.error("Upload error:", err)
      setError(err.message || "حدث خطأ أثناء رفع الملفات")
    } finally {
      setUploading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">الملفات المرفقة ({uploadedFiles.length}):</p>
          <div className="space-y-2">
            {uploadedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {file.isImage ? (
                    <ImageIcon className="w-5 h-5 text-green-600 flex-shrink-0" />
                  ) : (
                    <File className="w-5 h-5 text-green-600 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-green-900 dark:text-green-100">{file.name}</p>
                    <p className="text-xs text-green-600 dark:text-green-400">
                      {formatFileSize(file.size)}
                      {file.isImage && " • صورة"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveUploaded(index)}
                  disabled={uploading}
                  className="flex-shrink-0 text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-950"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* File Selection */}
      {uploadedFiles.length < maxFiles && (
        <Card className="border-2 border-dashed">
          <CardContent className="p-4">
            <div className="space-y-4">
              <div className="text-center py-4">
                <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-2">اسحب الملفات هنا أو انقر للاختيار</p>
                <p className="text-xs text-muted-foreground">
                  (الصور: ImgBB • الملفات الأخرى: Firestore) - الحد الأقصى {maxFiles} ملفات
                </p>
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  id="task-file-upload"
                  disabled={uploading}
                />
                <label htmlFor="task-file-upload">
                  <Button variant="outline" disabled={uploading} asChild className="mt-3 bg-transparent">
                    <span>اختيار الملفات</span>
                  </Button>
                </label>
              </div>

              {/* Selected Files (not uploaded yet) */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">ملفات محددة ({selectedFiles.length}):</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedFiles.map((file, index) => {
                      const isImg = isImageFile(file)
                      return (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {isImg ? (
                              <ImageIcon className="w-5 h-5 text-blue-500 flex-shrink-0" />
                            ) : (
                              <File className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{file.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(file.size)}
                                {isImg && " �� سيتم الرفع على ImgBB"}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveSelected(index)}
                            disabled={uploading}
                            className="flex-shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>

                  <Button onClick={handleUpload} disabled={uploading} className="w-full">
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                        جاري الرفع...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 ml-2" />
                        رفع {selectedFiles.length} ملف
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
