"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, FileIcon, ImageIcon, X } from "lucide-react"
import type { SubmittedFile } from "@/lib/types"

interface FileViewerProps {
  files: SubmittedFile[]
  title?: string
}

export function FileViewer({ files, title = "الملفات المرفقة" }: FileViewerProps) {
  const [selectedFile, setSelectedFile] = useState<SubmittedFile | null>(null)

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <>
      <div className="space-y-2">
        <p className="text-sm font-medium">
          {title} ({files.length}):
        </p>
        <div className="grid gap-2 md:grid-cols-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 bg-card rounded-lg border hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => setSelectedFile(file)}
            >
              {file.isImage ? (
                <ImageIcon className="w-5 h-5 text-blue-500 flex-shrink-0" />
              ) : (
                <FileIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
              </div>
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex-shrink-0"
              >
                <Button variant="ghost" size="sm">
                  <Download className="w-4 h-4" />
                </Button>
              </a>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={!!selectedFile} onOpenChange={() => setSelectedFile(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{selectedFile?.name}</span>
              <Button variant="ghost" size="sm" onClick={() => setSelectedFile(null)}>
                <X className="w-4 h-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          {selectedFile?.isImage ? (
            <div className="flex items-center justify-center p-4 bg-muted/20 rounded-lg">
              <img
                src={selectedFile.url || "/placeholder.svg"}
                alt={selectedFile.name}
                className="max-w-full max-h-[70vh] object-contain rounded"
              />
            </div>
          ) : (
            <div className="text-center py-12">
              <FileIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">معاينة هذا النوع من الملفات غير متاحة</p>
              <a href={selectedFile?.url} target="_blank" rel="noopener noreferrer">
                <Button className="gap-2">
                  <Download className="w-4 h-4" />
                  تحميل الملف
                </Button>
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
