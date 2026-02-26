"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"

interface ProjectStatsChartProps {
  projects: any[]
}

export function ProjectStatsChart({ projects }: ProjectStatsChartProps) {
  const statusData = [
    { name: "نشط", value: projects.filter((p) => p.status === "active").length, color: "#3b82f6" },
    { name: "مكتمل", value: projects.filter((p) => p.status === "completed").length, color: "#10b981" },
    { name: "معلق", value: projects.filter((p) => p.status === "pending").length, color: "#f59e0b" },
    { name: "مرفوض", value: projects.filter((p) => p.status === "rejected").length, color: "#ef4444" },
  ]

  const progressData = [
    { range: "0-25%", count: projects.filter((p) => p.progress >= 0 && p.progress < 25).length },
    { range: "25-50%", count: projects.filter((p) => p.progress >= 25 && p.progress < 50).length },
    { range: "50-75%", count: projects.filter((p) => p.progress >= 50 && p.progress < 75).length },
    { range: "75-100%", count: projects.filter((p) => p.progress >= 75 && p.progress <= 100).length },
  ]

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>توزيع حالة المشاريع</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label>
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>توزيع التقدم</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={progressData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
