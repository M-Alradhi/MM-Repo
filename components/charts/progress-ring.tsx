"use client"

interface ProgressRingProps {
  progress: number
  size?: number
  strokeWidth?: number
  className?: string
  showLabel?: boolean
}

export function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 8,
  className = "",
  showLabel = true,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (progress / 100) * circumference

  const getColor = () => {
    if (progress >= 75) return "#10b981" // green
    if (progress >= 50) return "#3b82f6" // blue
    if (progress >= 25) return "#f59e0b" // orange
    return "#ef4444" // red
  }

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-muted opacity-20"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor()}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold" style={{ color: getColor() }}>
            {progress}%
          </span>
        </div>
      )}
    </div>
  )
}
