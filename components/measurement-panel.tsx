"use client"

import { Button } from "@/components/ui/button"
import { Ruler, Trash2 } from "lucide-react"
import type { MeasurementPoint } from "@/app/page"

interface MeasurementPanelProps {
  measurementMode: boolean
  onMeasurementModeChange: (mode: boolean) => void
  measurementPoints: MeasurementPoint[]
  onClearMeasurements: () => void
}

function calculateDistance(p1: [number, number, number], p2: [number, number, number]): number {
  const dx = p2[0] - p1[0]
  const dy = p2[1] - p1[1]
  const dz = p2[2] - p1[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function calculateTotalDistance(points: MeasurementPoint[]): number {
  if (points.length < 2) return 0
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += calculateDistance(points[i - 1].position, points[i].position)
  }
  return total
}

export function MeasurementPanel({
  measurementMode,
  onMeasurementModeChange,
  measurementPoints,
  onClearMeasurements,
}: MeasurementPanelProps) {
  const totalDistance = calculateTotalDistance(measurementPoints)

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-gray-800 shadow-lg p-2">
      <Button
        variant={measurementMode ? "default" : "outline"}
        size="sm"
        onClick={() => onMeasurementModeChange(!measurementMode)}
        className={measurementMode ? "bg-blue-600 hover:bg-blue-700" : ""}
      >
        <Ruler className="w-4 h-4 mr-2" />
        측정
      </Button>

      {measurementMode && (
        <>
          {measurementPoints.length === 2 ? (
            <>
              <div className="h-6 w-px bg-gray-300 dark:bg-gray-700" />
              <div className="text-sm px-2">
                <span className="text-gray-500">거리:</span>{" "}
                <span className="font-medium text-blue-600">{totalDistance.toFixed(2)}m</span>
              </div>
              <div className="h-6 w-px bg-gray-300 dark:bg-gray-700" />
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearMeasurements}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          ) : measurementPoints.length === 1 ? (
            <span className="text-xs text-gray-400 px-2">끝점을 클릭하세요</span>
          ) : (
            <span className="text-xs text-gray-400 px-2">시작점을 클릭하세요</span>
          )}
        </>
      )}
    </div>
  )
}
