"use client"

import { Button } from "@/components/ui/button"
import { Eye, User, Users, Bird, ArrowDown, type LucideIcon } from "lucide-react"

export type ViewMode = "default" | "top" | "firstPerson" | "thirdPerson" | "birdEye"

interface ViewControlsPanelProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
}

export function ViewControlsPanel({ viewMode, onViewModeChange }: ViewControlsPanelProps) {
  const viewModes: { mode: ViewMode; label: string; icon: LucideIcon }[] = [
    { mode: "default", label: "기본", icon: Eye },
    { mode: "top", label: "탑뷰", icon: ArrowDown },
    { mode: "firstPerson", label: "1인칭", icon: User },
    { mode: "thirdPerson", label: "3인칭", icon: Users },
    { mode: "birdEye", label: "버드아이", icon: Bird },
  ]

  return (
    <div className="absolute top-4 right-4 z-10 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-gray-800 shadow-lg p-2">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-1">시점</span>
        <div className="flex gap-1">
          {viewModes.map(({ mode, label, icon: Icon }) => (
            <Button
              key={mode}
              variant={viewMode === mode ? "default" : "ghost"}
              size="sm"
              className="flex flex-col items-center gap-1 h-auto py-2 px-3"
              onClick={() => onViewModeChange(mode)}
            >
              <Icon className="w-4 h-4" />
              <span className="text-xs">{label}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
