"use client"

import { useState } from "react"
import { Search, Filter, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { useLanguage } from "@/lib/contexts/language-context"

export interface SearchFilters {
  searchText: string
  status?: string
  department?: string
  supervisorId?: string
  studentId?: string
  dateFrom?: string
  dateTo?: string
  priority?: string
}

interface AdvancedSearchProps {
  filters: SearchFilters
  onFiltersChange: (filters: SearchFilters) => void
  showStatusFilter?: boolean
  showDepartmentFilter?: boolean
  showSupervisorFilter?: boolean
  showStudentFilter?: boolean
  showDateFilter?: boolean
  showPriorityFilter?: boolean
  supervisors?: Array<{ id: string; name: string }>
  students?: Array<{ id: string; name: string }>
  statusOptions?: Array<{ value: string; label: string }>
  priorityOptions?: Array<{ value: string; label: string }>
  departments?: Array<{ value: string; label: string }>
  placeholder?: string
}

export function AdvancedSearch({
  filters,
  onFiltersChange,
  showStatusFilter = true,
  showDepartmentFilter = false,
  showSupervisorFilter = false,
  showStudentFilter = false,
  showDateFilter = false,
  showPriorityFilter = false,
  supervisors = [],
  students = [],
  statusOptions = [],
  priorityOptions = [],
  departments = [],
  placeholder = "ابحث...",
}: AdvancedSearchProps) {
  const { t, language } = useLanguage()
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  const handleSearchChange = (value: string) => {
    onFiltersChange({ ...filters, searchText: value })
  }

  const handleFilterChange = (key: keyof SearchFilters, value: string) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const clearFilter = (key: keyof SearchFilters) => {
    const newFilters = { ...filters }
    delete newFilters[key]
    onFiltersChange(newFilters)
  }

  const clearAllFilters = () => {
    onFiltersChange({ searchText: "" })
    setIsFilterOpen(false)
  }

  const activeFiltersCount = Object.keys(filters).filter(
    (key) => key !== "searchText" && filters[key as keyof SearchFilters],
  ).length

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder={placeholder}
            value={filters.searchText}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pr-10 rounded-lg"
          />
        </div>

        <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 rounded-lg relative bg-transparent">
              <Filter className="w-4 h-4" />
              {t("filte")}
              {activeFiltersCount > 0 && (
                <Badge variant="default" className="rounded-full w-5 h-5 p-0 flex items-center justify-center text-xs">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 rounded-xl" align="end">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">{t("filters")}</h4>
                {activeFiltersCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-8 text-xs rounded-lg">
                   {t("clearAll")}
                  </Button>
                )}
              </div>

              {showStatusFilter && statusOptions.length > 0 && (
                <div className="space-y-2">
                  <Label>{t("status")}</Label>
                  <Select value={filters.status} onValueChange={(value) => handleFilterChange("status", value)}>
                    <SelectTrigger className="rounded-lg">
                      <SelectValue placeholder={t("selectStatus")} />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {showPriorityFilter && priorityOptions.length > 0 && (
                <div className="space-y-2">
                  <Label>{t("priority")}</Label>
                  <Select value={filters.priority} onValueChange={(value) => handleFilterChange("priority", value)}>
                    <SelectTrigger className="rounded-lg">
                      <SelectValue placeholder={t("selectPriority")} />
                    </SelectTrigger>
                    <SelectContent>
                      {priorityOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {showDepartmentFilter && departments.length > 0 && (
                <div className="space-y-2">
                  <Label>{t("department")}</Label>
                  <Select value={filters.department} onValueChange={(value) => handleFilterChange("department", value)}>
                    <SelectTrigger className="rounded-lg">
                      <SelectValue placeholder={t("selectDepartment")} />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {showSupervisorFilter && supervisors.length > 0 && (
                <div className="space-y-2">
                  <Label>{t("supervisor")}</Label>
                  <Select
                    value={filters.supervisorId}
                    onValueChange={(value) => handleFilterChange("supervisorId", value)}
                  >
                    <SelectTrigger className="rounded-lg">
                      <SelectValue placeholder={t("selectSupervisor")} />
                    </SelectTrigger>
                    <SelectContent>
                      {supervisors.map((supervisor) => (
                        <SelectItem key={supervisor.id} value={supervisor.id}>
                          {supervisor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {showStudentFilter && students.length > 0 && (
                <div className="space-y-2">
                  <Label>{t("student")}</Label>
                  <Select value={filters.studentId} onValueChange={(value) => handleFilterChange("studentId", value)}>
                    <SelectTrigger className="rounded-lg">
                      <SelectValue placeholder={t("selectStuden")} />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {showDateFilter && (
                <div className="space-y-3">
                  <Label>{t("timePeriod")}</Label>
                  <div className="space-y-2">
                    <Input
                      type="date"
                      value={filters.dateFrom || ""}
                      onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
                      placeholder={t("fromDate")}
                      className="rounded-lg"
                    />
                    <Input
                      type="date"
                      value={filters.dateTo || ""}
                      onChange={(e) => handleFilterChange("dateTo", e.target.value)}
                      placeholder={t("toDate")}
                      className="rounded-lg"
                    />
                  </div>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Active Filters Display */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.status && (
            <Badge variant="secondary" className="gap-1 rounded-lg">
              {t("status")}: {statusOptions.find((opt) => opt.value === filters.status)?.label}
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 w-4 h-4 hover:bg-transparent"
                onClick={() => clearFilter("status")}
              >
                <X className="w-3 h-3" />
              </Button>
            </Badge>
          )}
          {filters.priority && (
            <Badge variant="secondary" className="gap-1 rounded-lg">
              {t("priority")}: {priorityOptions.find((opt) => opt.value === filters.priority)?.label}
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 w-4 h-4 hover:bg-transparent"
                onClick={() => clearFilter("priority")}
              >
                <X className="w-3 h-3" />
              </Button>
            </Badge>
          )}
          {filters.department && (
            <Badge variant="secondary" className="gap-1 rounded-lg">
              {t("department")}: {filters.department}
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 w-4 h-4 hover:bg-transparent"
                onClick={() => clearFilter("department")}
              >
                <X className="w-3 h-3" />
              </Button>
            </Badge>
          )}
          {filters.supervisorId && (
            <Badge variant="secondary" className="gap-1 rounded-lg">
              {t("supervisor")}: {supervisors.find((s) => s.id === filters.supervisorId)?.name}
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 w-4 h-4 hover:bg-transparent"
                onClick={() => clearFilter("supervisorId")}
              >
                <X className="w-3 h-3" />
              </Button>
            </Badge>
          )}
          {filters.studentId && (
            <Badge variant="secondary" className="gap-1 rounded-lg">
              {t("student")}: {students.find((s) => s.id === filters.studentId)?.name}
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 w-4 h-4 hover:bg-transparent"
                onClick={() => clearFilter("studentId")}
              >
                <X className="w-3 h-3" />
              </Button>
            </Badge>
          )}
          {(filters.dateFrom || filters.dateTo) && (
            <Badge variant="secondary" className="gap-1 rounded-lg">
              {t("AFilter")}: {filters.dateFrom || "..."} - {filters.dateTo || "..."}
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 w-4 h-4 hover:bg-transparent"
                onClick={() => {
                  clearFilter("dateFrom")
                  clearFilter("dateTo")
                }}
              >
                <X className="w-3 h-3" />
              </Button>
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}
