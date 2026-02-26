"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { CalendarIcon, Clock, MapPin, LinkIcon, CheckSquare, Users, ChevronLeft, ChevronRight } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/contexts/auth-context"
import { useLanguage } from "@/lib/contexts/language-context"
import { useEffect, useState } from "react"
import { collection, query, where, getDocs, orderBy } from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase/config"
import { studentSidebarItems } from "@/lib/constants/student-sidebar"
import { formatArabicDate } from "@/lib/utils/grading"

interface CalendarEvent {
  id: string
  title: string
  description?: string
  type: "task" | "meeting"
  date: Date
  status?: string
  location?: string
  meetingLink?: string
  duration?: number
  priority?: string
  maxGrade?: number
}

export default function StudentCalendar() {
  const { userData, loading: authLoading } = useAuth()
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
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  useEffect(() => {
    const fetchEvents = async () => {
      if (!userData?.uid) return

      try {
        const db = getFirebaseDb()

        // Fetch tasks
        const tasksQuery = query(
          collection(db, "tasks"),
          where("studentId", "==", userData.uid),
          orderBy("dueDate", "asc"),
        )
        const tasksSnapshot = await getDocs(tasksQuery)
        const taskEvents: CalendarEvent[] = tasksSnapshot.docs.map((doc) => {
          const data = doc.data()
          return {
            id: doc.id,
            title: data.title,
            description: data.description,
            type: "task",
            date: data.dueDate?.toDate() || new Date(),
            status: data.status,
            priority: data.priority,
            maxGrade: data.maxGrade,
          }
        })

        // Fetch meetings
        const meetingsQuery = query(
          collection(db, "meetings"),
          where("studentId", "==", userData.uid),
          orderBy("date", "asc"),
        )
        const meetingsSnapshot = await getDocs(meetingsQuery)
        const meetingEvents: CalendarEvent[] = meetingsSnapshot.docs.map((doc) => {
          const data = doc.data()
          return {
            id: doc.id,
            title: data.title,
            description: data.description,
            type: "meeting",
            date: data.date?.toDate() || new Date(),
            status: data.status,
            location: data.location,
            meetingLink: data.meetingLink,
            duration: data.duration,
          }
        })

        const allEvents = [...taskEvents, ...meetingEvents].sort((a, b) => a.date.getTime() - b.date.getTime())
        setEvents(allEvents)
      } catch (error) {
        console.error("Error fetching events:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [userData])

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    return { daysInMonth, startingDayOfWeek, year, month }
  }

  const getEventsForDate = (date: Date) => {
    return events.filter((event) => {
      const eventDate = new Date(event.date)
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      )
    })
  }

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentDate)

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

    const monthNames = [
    t("january"),
    t("february"),
    t("march"),
    t("april"),
    t("may"),
    t("june"),
    t("july"),
    t("august"),
    t("september"),
    t("october"),
    t("november"),
    t("december"),
  ]


    const dayNames = [
    t("sunday"),
    t("monday"),
    t("tuesday"),
    t("wednesday"),
    t("thursday"),
    t("friday"),
    t("saturday"),
  ]

  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : []
  const upcomingEvents = events.filter((event) => event.date >= new Date()).slice(0, 5)

  return (
    <DashboardLayout sidebarItems={studentSidebarItems} requiredRole="student">
      <div className="p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold">
            {t("calendar")}
          </h1>

          <p className="text-muted-foreground mt-2">
            {t("calendarSubtitle")}
          </p>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-8">
              <p className="text-center text-muted-foreground">
              {t("loading")}
            </p>

            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendar */}
            <Card className="lg:col-span-2 rounded-xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    {monthNames[month]} {year}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={previousMonth} className="rounded-lg bg-transparent">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={nextMonth} className="rounded-lg bg-transparent">
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {dayNames.map((day) => (
                    <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: startingDayOfWeek }).map((_, index) => (
                    <div key={`empty-${index}`} className="aspect-square" />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, index) => {
                    const day = index + 1
                    const date = new Date(year, month, day)
                    const dayEvents = getEventsForDate(date)
                    const isToday =
                      date.getDate() === new Date().getDate() &&
                      date.getMonth() === new Date().getMonth() &&
                      date.getFullYear() === new Date().getFullYear()
                    const isSelected =
                      selectedDate &&
                      date.getDate() === selectedDate.getDate() &&
                      date.getMonth() === selectedDate.getMonth() &&
                      date.getFullYear() === selectedDate.getFullYear()

                    return (
                      <button
                        key={day}
                        onClick={() => setSelectedDate(date)}
                        className={`aspect-square p-2 rounded-lg border transition-all hover:border-primary ${
                          isToday ? "border-primary bg-primary/10" : ""
                        } ${isSelected ? "bg-primary text-primary-foreground" : ""} ${
                          dayEvents.length > 0 ? "font-semibold" : ""
                        }`}
                      >
                        <div className="flex flex-col items-center justify-center h-full">
                          <span className="text-sm">{day}</span>
                          {dayEvents.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {dayEvents.slice(0, 3).map((event, i) => (
                                <div
                                  key={i}
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    event.type === "task" ? "bg-blue-500" : "bg-green-500"
                                  }`}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Upcoming Events */}
              <Card className="rounded-xl">
                <CardHeader>
                  <CardTitle className="text-lg">
                  {t("upcomingEvents")}
                </CardTitle>

                </CardHeader>
                <CardContent className="space-y-3">
                  {upcomingEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {t("noUpcomingEvents")}
                    </p>
                  ) : (
                    upcomingEvents.map((event) => (
                      <div key={event.id} className="p-3 rounded-lg border space-y-1">
                        <div className="flex items-start gap-2">
                          {event.type === "task" ? (
                            <CheckSquare className="w-4 h-4 text-blue-500 mt-0.5" />
                          ) : (
                            <Users className="w-4 h-4 text-green-500 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{event.title}</p>
                            <p className="text-xs text-muted-foreground">{formatArabicDate(event.date)}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Legend */}
              <Card className="rounded-xl">
                <CardHeader>
                  <CardTitle className="text-lg">
                    {t("colorLegend")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-sm">{t("tasks")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-sm">{t("meetings")}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Selected Date Events */}
            {selectedDate && (
              <Card className="lg:col-span-3 rounded-xl">
                <CardHeader>
                  <CardTitle>{t("events")} {formatArabicDate(selectedDate)}</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedDateEvents.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">{t("noEventsForSelectedDate")}</p>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {selectedDateEvents.map((event) => (
                        <Card key={event.id}>
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                {event.type === "task" ? (
                                  <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                                    <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                  </div>
                                ) : (
                                  <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                                    <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
                                  </div>
                                )}
                                <div>
                                  <CardTitle className="text-base">{event.title}</CardTitle>
                                  <CardDescription className="mt-1">{event.description}</CardDescription>
                                </div>
                              </div>
                              {event.status && (
                                <Badge
                                  variant={
                                    event.status === "pending"
                                      ? "secondary"
                                      : event.status === "completed" || event.status === "graded"
                                        ? "default"
                                        : "outline"
                                  }
                                  className="rounded-lg"
                                >
                                  {event.status === "pending"
                                    ? t("pending")
                                    : event.status === "submitted"
                                      ? t("submitted")
                                      : event.status === "graded"
                                        ? t("graded")
                                        : event.status === "completed"
                                          ? t("completed")
                                          : event.status}
                                </Badge>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="w-4 h-4" />
                              {event.date.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                              {event.duration && ` (${event.duration} ${t("minutes")})`}
                            </div>
                            {event.location && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <MapPin className="w-4 h-4" />
                                {event.location}
                              </div>
                            )}
                            {event.meetingLink && (
                              <div className="flex items-center gap-2 text-sm">
                                <LinkIcon className="w-4 h-4" />
                                <a className="text-primary hover:underline">
                                  {t("meetingLink")}
                                </a>
                              </div>
                            )}
                            {event.maxGrade && (
                              <div className="text-sm text-muted-foreground">
                                {t("grade")}: {event.maxGrade}
                              </div>
                            )}
                            {event.priority && (
                              <Badge
                                variant={
                                  event.priority === "high"
                                    ? "destructive"
                                    : event.priority === "medium"
                                      ? "secondary"
                                      : "outline"
                                }
                                className="rounded-lg"
                              >
                                {event.priority === "high"
                                  ? t("high")
                                  : event.priority === "medium"
                                    ? t("medium")
                                    : t("low")}
                              </Badge>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
