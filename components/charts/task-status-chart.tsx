"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { processTaskStatusData } from "@/lib/utils/charts"

interface TaskStatusChartProps {
  tasks: Array<{ status: string }>
  title?: string
  description?: string
}

export function TaskStatusChart({
  tasks,
  title = "حالة المهام",
  description = "توزيع المهام حسب الحالة",
}: TaskStatusChartProps) {
  const data = processTaskStatusData(tasks)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="label" className="text-xs" tick={{ fill: "currentColor" }} />
            <YAxis className="text-xs" tick={{ fill: "currentColor" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
