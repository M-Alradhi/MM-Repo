import { Badge } from "@/components/ui/badge"
import { AlertCircle, AlertTriangle, Info, Zap } from "lucide-react"
import { getPriorityColor, getPriorityLabel, type TaskPriority } from "@/lib/utils/task-priorities"

interface PriorityBadgeProps {
  priority: TaskPriority
  showIcon?: boolean
  className?: string
}

export function PriorityBadge({ priority, showIcon = true, className = "" }: PriorityBadgeProps) {
  const getIcon = () => {
    switch (priority) {
      case "urgent":
        return <Zap className="w-3 h-3" />
      case "high":
        return <AlertCircle className="w-3 h-3" />
      case "medium":
        return <AlertTriangle className="w-3 h-3" />
      case "low":
        return <Info className="w-3 h-3" />
    }
  }

  return (
    <Badge variant="secondary" className={`${getPriorityColor(priority)} gap-1 ${className}`}>
      {showIcon && getIcon()}
      {getPriorityLabel(priority)}
    </Badge>
  )
}
