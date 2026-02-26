"use client"

import type React from "react"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Upload, AlertCircle, Download, FileIcon, ImageIcon, CheckSquare, ExternalLink } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/contexts/auth-context"
import { useLanguage } from "@/lib/contexts/language-context"
import { useEffect, useState } from "react"
import { collection, query, where, getDocs, doc, updateDoc, Timestamp, orderBy } from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase/config"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createNotification } from "@/lib/firebase/notifications"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { GradeOverviewCard } from "@/components/grading/grade-overview-card"
import { TaskGradeBadge } from "@/components/grading/task-grade-badge"
import { isTaskOverdue, formatArabicDate, getGradeColor, type TaskGrade } from "@/lib/utils/grading"
import { TaskFileUpload } from "@/components/task-file-upload"
import type { SubmittedFile } from "@/lib/types"
import { studentSidebarItems } from "@/lib/constants/student-sidebar"

interface Task extends TaskGrade {
  description: string
  dueDate: any
  submissionText?: string
  submittedFiles?: SubmittedFile[]
  submittedAt?: any
  feedback?: string
  gradedAt?: any
  supervisorId: string
  createdAt: any
  projectId?: string

  // ✅ NEW: task resources uploaded by supervisor (student can view/download)
  supervisorFiles?: SubmittedFile[]
}

export default function StudentTasks() {
  const { userData, loading: authLoading } = useAuth()
  const { t } = useLanguage()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [submissionForm, setSubmissionForm] = useState({
    text: "",
    files: [] as SubmittedFile[],
  })

  useEffect(() => {
    const fetchTasks = async () => {
      if (authLoading) return

      if (!userData?.uid) {
        setLoading(false)
        setError(t("userNotFound"))
        return
      }

      try {
        setLoading(true)
        setError(null)

        const db = getFirebaseDb()

        const tasksQuery = query(
          collection(db, "tasks"),
          where("studentId", "==", userData.uid),
          orderBy("createdAt", "desc"),
        )
        const tasksSnapshot = await getDocs(tasksQuery)
        const tasksData = tasksSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Task[]

        setTasks(tasksData)
      } catch (error) {
        console.error("Error fetching tasks:", error)
        setError(t("errorLoadingTasks"))
      } finally {
        setLoading(false)
      }
    }

    fetchTasks()
  }, [userData, authLoading])

  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedTask) return

    if (!submissionForm.text.trim() && submissionForm.files.length === 0) {
      toast.error(t("attachFile"))
      return
    }

    try {
      const db = getFirebaseDb()

      const teamTasksQuery = query(
        collection(db, "tasks"),
        where("projectId", "==", selectedTask.projectId),
        where("title", "==", selectedTask.title),
      )
      const teamTasksSnapshot = await getDocs(teamTasksQuery)

      const updatePromises = teamTasksSnapshot.docs.map((taskDoc) => {
        return updateDoc(doc(db, "tasks", taskDoc.id), {
          status: "submitted",
          submissionText: submissionForm.text,
          submittedFiles: submissionForm.files,
          submittedAt: Timestamp.now(),
          submittedBy: userData?.uid,
        })
      })

      await Promise.all(updatePromises)

      if (selectedTask.supervisorId) {
        await createNotification({
          userId: selectedTask.supervisorId,
          title: t("newTaskAssigned"),
          message: `${userData?.name || t("student")} ${t("taskSubmitted")}: ${selectedTask.title}`,
          type: "task",
          link: "/supervisor/tasks",
        })
      }

      toast.success(t("savedSuccessfully"))
      setSubmitDialogOpen(false)
      setSelectedTask(null)
      setSubmissionForm({ text: "", files: [] })

      const tasksQuery = query(
        collection(db, "tasks"),
        where("studentId", "==", userData?.uid),
        orderBy("createdAt", "desc"),
      )
      const tasksSnapshot = await getDocs(tasksQuery)
      const tasksData = tasksSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Task[]
      setTasks(tasksData)
    } catch (error) {
      console.error("Error submitting task:", error)
      toast.error(t("errorMessage"))
    }
  }

  const openSubmitDialog = (task: Task) => {
    setSelectedTask(task)
    setSubmissionForm({
      text: task.submissionText || "",
      files: task.submittedFiles || [],
    })
    setSubmitDialogOpen(true)
  }

  const pendingTasks = tasks.filter((task) => task.status === "pending")
  const submittedTasks = tasks.filter((task) => task.status === "submitted")
  const gradedTasks = tasks.filter((task) => task.status === "graded")

  const TaskCard = ({ task }: { task: Task }) => {
    const overdue = isTaskOverdue(task.dueDate, task.status)

    return (
      <Card
        className={`hover:shadow-lg transition-all duration-300 ${overdue ? "border-destructive/50 bg-destructive/5" : ""}`}
      >
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-lg">{task.title}</CardTitle>
                <TaskGradeBadge status={task.status} isOverdue={overdue} />
              </div>
              <CardDescription className="line-clamp-2 leading-relaxed">{task.description}</CardDescription>
            </div>
            {task.status === "graded" && task.grade !== undefined && (
              <div className="text-left min-w-[80px]">
                <div className={`text-4xl font-bold ${getGradeColor(task.grade)}`}>{task.grade.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">/{task.maxGrade}</div>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-4 text-muted-foreground">
                <span className="font-medium">
                  {t("grade")}: {task.maxGrade}
                </span>
                <span className="font-medium">
                  {t("weight")}: {task.weight}%
                </span>
                <span className={`font-medium ${overdue ? "text-destructive" : ""}`}>
                  {overdue && <AlertCircle className="w-4 h-4 inline ml-1" />}
                  {t("dueDate")}: {formatArabicDate(task.dueDate)}
                </span>
              </div>
            </div>

            {/* ✅ NEW: Supervisor task resources */}
            {task.supervisorFiles && task.supervisorFiles.length > 0 && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                    {t("supervisorTaskFiles")}
                  </Label>
                  <Badge variant="secondary" className="text-xs">
                    {task.supervisorFiles.length}
                  </Badge>
                </div>

                <div className="space-y-2">
                  {task.supervisorFiles.map((file, index) => (
                    <a
                      key={index}
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 bg-white dark:bg-gray-900 rounded border hover:border-amber-400 transition-colors group"
                    >
                      {file.isImage ? (
                        <ImageIcon className="w-4 h-4 text-amber-600" />
                      ) : (
                        <FileIcon className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="text-sm flex-1 truncate group-hover:text-amber-700">{file.name}</span>
                      <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-amber-700" />
                      <Download className="w-4 h-4 text-muted-foreground group-hover:text-amber-700" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {task.status === "graded" && task.feedback && (
              <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
                <Label className="text-sm font-semibold mb-2 block text-green-700 dark:text-green-400">
                  {t("evaluationFeedback")}:
                </Label>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{task.feedback}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {t("taskGraded")}: {formatArabicDate(task.gradedAt)}
                </p>
              </div>
            )}

            {(task.status === "submitted" || task.status === "graded") && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-blue-700 dark:text-blue-400">{t("taskSubmitted")}</Label>
                  <span className="text-xs text-muted-foreground">{formatArabicDate(task.submittedAt)}</span>
                </div>
                {task.submissionText && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">{t("feedback")}:</Label>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{task.submissionText}</p>
                  </div>
                )}
                {task.submittedFiles && task.submittedFiles.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">{t("attachedFiles")}:</Label>
                    <div className="space-y-2">
                      {task.submittedFiles.map((file, index) => (
                        <a
                          key={index}
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-2 bg-white dark:bg-gray-900 rounded border hover:border-blue-400 transition-colors group"
                        >
                          {file.isImage ? (
                            <ImageIcon className="w-4 h-4 text-blue-500" />
                          ) : (
                            <FileIcon className="w-4 h-4 text-muted-foreground" />
                          )}
                          <span className="text-sm flex-1 truncate group-hover:text-blue-600">{file.name}</span>
                          <Download className="w-4 h-4 text-muted-foreground group-hover:text-blue-600" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              {task.status === "pending" && (
                <Button onClick={() => openSubmitDialog(task)} className="gap-2 flex-1" size="lg">
                  <Upload className="w-4 h-4" />
                  {t("submit")} {t("tasks")}
                </Button>
              )}
              {task.status === "submitted" && (
                <Button onClick={() => openSubmitDialog(task)} variant="outline" className="gap-2 flex-1" size="lg">
                  {t("edit")} {t("submit")}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <DashboardLayout sidebarItems={studentSidebarItems} requiredRole="student">
      <div className="p-6 md:p-8 space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl">
                <CheckSquare className="w-8 h-8 text-primary" />
              </div>
              {t("tasks")} {t("evaluations")}
            </h1>
            <p className="text-muted-foreground mt-2">{t("tasksAndAssignments")}</p>
          </div>
        </div>

        {authLoading || loading ? (
          <Card>
            <CardContent className="p-12">
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
                <p className="text-center text-muted-foreground">{t("loading")}</p>
              </div>
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="border-destructive">
            <CardContent className="p-8">
              <div className="text-center text-destructive space-y-2">
                <AlertCircle className="w-16 h-16 mx-auto opacity-50" />
                <h3 className="text-lg font-semibold">{t("errorOccurred")}</h3>
                <p className="text-sm">{error}</p>
              </div>
            </CardContent>
          </Card>
        ) : tasks.length === 0 ? (
          <div className="space-y-8">
            <GradeOverviewCard tasks={tasks} />

            <Card>
              <CardContent className="p-12">
                <div className="text-center space-y-4">
                  <CheckSquare className="w-20 h-20 mx-auto text-muted-foreground opacity-50" />
                  <div>
                    <h3 className="text-xl font-semibold">{t("noTasksYet")}</h3>
                    <p className="text-sm text-muted-foreground mt-2">{t("startByAddingProject")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-8">
            <GradeOverviewCard tasks={tasks} />

            <Tabs defaultValue="all" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all" className="gap-2">
                  {t("viewAll")}
                  <Badge variant="secondary" className="rounded-full px-2">
                    {tasks.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="pending" className="gap-2">
                  {t("pending")}
                  <Badge variant="secondary" className="rounded-full px-2 bg-amber-100 text-amber-700">
                    {pendingTasks.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="submitted" className="gap-2">
                  {t("taskSubmitted")}
                  <Badge variant="secondary" className="rounded-full px-2 bg-blue-100 text-blue-700">
                    {submittedTasks.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="graded" className="gap-2">
                  {t("taskGraded")}
                  <Badge variant="secondary" className="rounded-full px-2 bg-green-100 text-green-700">
                    {gradedTasks.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-6">
                {tasks.map((task, index) => (
                  <div
                    key={task.id}
                    className="animate-in fade-in slide-in-from-bottom duration-500"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <TaskCard task={task} />
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="pending" className="space-y-6">
                {pendingTasks.length === 0 ? (
                  <Card>
                    <CardContent className="p-8">
                      <p className="text-center text-muted-foreground">{t("noTasksYet")}</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-6">
                    {pendingTasks.map((task) => (
                      <TaskCard key={task.id} task={task} />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="submitted" className="space-y-6">
                {submittedTasks.length === 0 ? (
                  <Card>
                    <CardContent className="p-8">
                      <p className="text-center text-muted-foreground">{t("noTasksYet")}</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-6">
                    {submittedTasks.map((task) => (
                      <TaskCard key={task.id} task={task} />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="graded" className="space-y-6">
                {gradedTasks.length === 0 ? (
                  <Card>
                    <CardContent className="p-8">
                      <p className="text-center text-muted-foreground">{t("noGradesYet")}</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-6">
                    {gradedTasks.map((task) => (
                      <TaskCard key={task.id} task={task} />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl">
                {t("submit")} {t("tasks")}
              </DialogTitle>
            </DialogHeader>
            {selectedTask && (
              <div className="space-y-6">
                <Card className="border-2">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckSquare className="w-5 h-5 text-primary" />
                      {selectedTask.title}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-3 flex-wrap">
                      <span>
                        {t("maxGrade")}: {selectedTask.maxGrade}
                      </span>
                      <span>•</span>
                      <span>
                        {t("weight")}: {selectedTask.weight}%
                      </span>
                      <span>•</span>
                      <span>
                        {t("dueDate")}: {formatArabicDate(selectedTask.dueDate)}
                      </span>
                    </CardDescription>
                  </CardHeader>
                  {selectedTask.description && (
                    <CardContent>
                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {selectedTask.description}
                      </p>
                    </CardContent>
                  )}
                </Card>

                <form onSubmit={handleSubmitTask} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="text" className="text-base">
                      {t("feedback")}
                    </Label>
                    <Textarea
                      id="text"
                      value={submissionForm.text}
                      onChange={(e) => setSubmissionForm({ ...submissionForm, text: e.target.value })}
                      placeholder={t("typeMessage")}
                      rows={5}
                      className="resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base">{t("uploadFile")}</Label>
                    <TaskFileUpload
                      onFilesChange={(files) => setSubmissionForm({ ...submissionForm, files })}
                      existingFiles={submissionForm.files}
                      maxFiles={5}
                    />
                  </div>

                  <div className="flex gap-3 justify-end pt-4 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setSubmitDialogOpen(false)
                        setSelectedTask(null)
                        setSubmissionForm({ text: "", files: [] })
                      }}
                      size="lg"
                    >
                      {t("cancel")}
                    </Button>
                    <Button type="submit" className="gap-2" size="lg">
                      <Upload className="w-4 h-4" />
                      {t("submit")} {t("tasks")}
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
