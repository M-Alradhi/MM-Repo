import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Award, Clock, TrendingUp, TrendingDown } from "lucide-react"
import { calculateWeightedGrade, getGradeColor, getStatusColor, type TaskGrade } from "@/lib/utils/grading"

interface GradeOverviewCardProps {
  tasks: TaskGrade[]
  showDetails?: boolean
}

export function GradeOverviewCard({ tasks, showDetails = true }: GradeOverviewCardProps) {
  const gradeInfo = calculateWeightedGrade(tasks)
  const statusColors = getStatusColor(gradeInfo.status)

  const pendingTasks = tasks.filter((t) => t.status === "pending")
  const submittedTasks = tasks.filter((t) => t.status === "submitted")

  return (
    <Card className="border-2 bg-gradient-to-br from-primary/5 via-background to-background overflow-hidden relative">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-l from-primary via-primary/50 to-transparent" />

      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Award className="w-6 h-6 text-primary" />
              درجتك الإجمالية
            </CardTitle>
            <CardDescription className="mt-1">من إجمالي 100 درجة للمشروع الكامل</CardDescription>
          </div>
          <Badge
            variant="outline"
            className={`${statusColors.bg} ${statusColors.text} ${statusColors.border} px-4 py-2 text-sm font-bold`}
          >
            {gradeInfo.letterGrade}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Main Grade Display */}
        <div className="flex items-start gap-6">
          {/* Left: status pills (horizontal) */}
          <div className="flex flex-row gap-3 w-auto flex-shrink-0 items-center overflow-x-auto pr-2">
            <div className="w-20 h-20 rounded-2xl flex flex-col items-center justify-center border border-amber-200 p-2 bg-background">
              <div className="text-[10px] text-muted-foreground text-center">في الانتظار</div>
              <div className="text-lg font-bold text-amber-600">{pendingTasks.length}</div>
            </div>

            <div className="w-20 h-20 rounded-2xl flex flex-col items-center justify-center border border-blue-200 p-2 bg-background">
              <div className="text-[10px] text-muted-foreground text-center">تم التسليم</div>
              <div className="text-lg font-bold text-blue-600">{submittedTasks.length}</div>
            </div>

            <div className="w-20 h-20 rounded-2xl flex flex-col items-center justify-center border border-green-200 p-2 bg-background">
              <div className="text-[10px] text-muted-foreground text-center">تم التقييم</div>
              <div className="text-lg font-bold text-green-600">{gradeInfo.gradedTasksCount}</div>
            </div>
          </div>

          <div className="flex-1 space-y-3">
            <div className="flex items-baseline gap-3">
              <span className={`text-6xl font-bold ${getGradeColor(gradeInfo.totalGrade)}`}>
                {gradeInfo.totalGrade.toFixed(1)}
              </span>
              <span className="text-3xl text-muted-foreground font-medium">/100</span>
              {gradeInfo.totalGrade >= 50 ? (
                <TrendingUp className="w-8 h-8 text-green-500" />
              ) : (
                <TrendingDown className="w-8 h-8 text-red-500" />
              )}
            </div>

            <div className="space-y-2">
              <Progress value={gradeInfo.percentage} className="h-4" />
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {gradeInfo.gradedTasksCount} من {gradeInfo.totalTasksCount} مهمة تم تقييمها
                </span>
                <span>الوزن المنجز: {gradeInfo.completedWeight.toFixed(0)}%</span>
              </div>
            </div>

            {gradeInfo.remainingWeight > 0 && (
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-900">
                <Clock className="w-4 h-4" />
                <span>متبقي {gradeInfo.remainingWeight.toFixed(0)}% من المهام لم يتم تقييمها بعد</span>
              </div>
            )}
          </div>

          {/* showDetails handled above as left column on larger screens */}
        </div>

        {/* Status Message */}
        <div className={`${statusColors.bg} ${statusColors.border} border rounded-lg p-4`}>
          <p className={`text-sm font-semibold ${statusColors.text}`}>
            {gradeInfo.isPassing
              ? gradeInfo.status === "excellent"
                ? "ممتاز! أداء رائع جداً - استمر في التميز"
                : gradeInfo.status === "very-good"
                  ? "جيد جداً! أداء مميز - قريب من الامتياز"
                  : gradeInfo.status === "good"
                    ? "جيد! أداء جيد - يمكنك تحسين المزيد"
                    : "مقبول - حاول تحسين أدائك في المهام القادمة"
              : gradeInfo.totalGrade > 0
                ? "تحتاج إلى تحسين - درجتك أقل من 50% للنجاح"
                : "لم يتم التقييم بعد - في انتظار تقييم المهام"}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
