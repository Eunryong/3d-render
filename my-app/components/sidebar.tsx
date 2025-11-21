"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Upload, Sofa, Lamp, Table, Armchair, Trash2, Plus, Bed, Undo2, Redo2 } from "lucide-react"

interface SidebarProps {
  onFileUpload: (file: File) => void
  onAddFurniture: (type: string) => void
  onAddCustomModel: (file: File) => void
  selectedId: string | null
  onDeleteSelected: () => void
  furnitureCount: number
  onFloorOrientationChange?: (orientation: "Y" | "X" | "Z") => void
  floorOrientation?: "Y" | "X" | "Z"
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
  plyColor?: string
  onPlyColorChange?: (color: string) => void
  hasPlyFile?: boolean
}

export function Sidebar({
  onFileUpload,
  onAddFurniture,
  onAddCustomModel,
  selectedId,
  onDeleteSelected,
  furnitureCount,
  onFloorOrientationChange,
  floorOrientation = "Y",
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  plyColor = "#ffffff",
  onPlyColorChange,
  hasPlyFile = false,
}: SidebarProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const extension = file.name.split(".").pop()?.toLowerCase()
    if (extension !== "ply" && extension !== "glb" && extension !== "gltf") {
      alert("PLY 또는 GLB 파일만 업로드 가능합니다.")
      return
    }

    const fileSizeMB = file.size / (1024 * 1024)
    if (fileSizeMB > 200) {
      alert(`파일 크기가 너무 큽니다 (${fileSizeMB.toFixed(1)}MB). 200MB 이하의 파일을 사용해주세요.`)
      return
    }

    if (fileSizeMB > 50) {
      const proceed = confirm(
        `큰 파일입니다 (${fileSizeMB.toFixed(1)}MB). 로딩에 시간이 걸릴 수 있습니다. 계속하시겠습니까?`,
      )
      if (!proceed) return
    }

    onFileUpload(file)
  }

  const handleModelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const ext = file.name.split(".").pop()?.toLowerCase()
      if (ext === "obj" || ext === "glb" || ext === "gltf") {
        onAddCustomModel(file)
      } else {
        alert("OBJ, GLB, GLTF 파일만 업로드 가능합니다.")
      }
    }
  }

  const furnitureTypes = [
    { type: "chair", label: "의자", icon: Armchair },
    { type: "table", label: "테이블", icon: Table },
    { type: "sofa", label: "소파", icon: Sofa },
    { type: "lamp", label: "조명", icon: Lamp },
    { type: "bed", label: "침대", icon: Bed },
  ]

  return (
    <div className="w-80 h-screen bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden">
      <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <h1 className="text-2xl font-bold text-gray-950 dark:text-gray-50">3D 인테리어</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">가구 배치 디자인 도구</p>
      </div>

      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* File Upload Section */}
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-950 dark:text-gray-50">공간 모델 업로드</h2>
            <Label
              htmlFor="ply-upload"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
            >
              <Upload className="w-8 h-8 text-gray-500 dark:text-gray-400 mb-2" />
              <span className="text-sm text-gray-600 dark:text-gray-400">PLY / GLB 파일 선택</span>
              <Input
                id="ply-upload"
                type="file"
                accept=".ply,.glb,.gltf"
                className="hidden"
                onChange={handleFileChange}
              />
            </Label>
          </div>

          <div className="space-y-3">
            <h2 className="font-semibold text-gray-950 dark:text-gray-50">바닥 방향</h2>
            <div className="space-y-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">PLY 모델의 바닥면을 올바른 방향으로 조정하세요</p>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={floorOrientation === "Y" ? "default" : "outline"}
                  size="sm"
                  className="text-xs"
                  onClick={() => onFloorOrientationChange?.("Y")}
                >
                  <span className="mr-1">↕️</span>
                  Y축
                </Button>
                <Button
                  variant={floorOrientation === "X" ? "default" : "outline"}
                  size="sm"
                  className="text-xs"
                  onClick={() => onFloorOrientationChange?.("X")}
                >
                  <span className="mr-1">↔️</span>
                  X축
                </Button>
                <Button
                  variant={floorOrientation === "Z" ? "default" : "outline"}
                  size="sm"
                  className="text-xs"
                  onClick={() => onFloorOrientationChange?.("Z")}
                >
                  <span className="mr-1">⤴️</span>
                  Z축
                </Button>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 mt-2">
                <p>• Y축: 일반적인 바닥 (수평)</p>
                <p>• X축: 왼쪽/오른쪽이 바닥</p>
                <p>• Z축: 앞/뒤가 바닥</p>
              </div>
            </div>
          </div>

          {hasPlyFile && (
            <div className="space-y-3">
              <h2 className="font-semibold text-gray-950 dark:text-gray-50">공간 모델 색상</h2>
              <div className="space-y-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  PLY 모델에 vertex color가 없는 경우 여기서 색상을 선택하세요
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={plyColor}
                    onChange={(e) => onPlyColorChange?.(e.target.value)}
                    className="w-12 h-12 rounded-lg cursor-pointer border border-gray-300 dark:border-gray-700"
                  />
                  <div className="flex flex-wrap gap-2">
                    {["#ffffff", "#f5f5f5", "#e8d5b7", "#c9b896", "#a0937d", "#808080", "#4a5568", "#2d3748"].map(
                      (color) => (
                        <button
                          key={color}
                          className="w-8 h-8 rounded border border-gray-300 dark:border-gray-700 hover:scale-110 transition-transform"
                          style={{ backgroundColor: color }}
                          onClick={() => onPlyColorChange?.(color)}
                        />
                      ),
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Furniture Library */}
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-950 dark:text-gray-50">가구 라이브러리</h2>
            <div className="grid grid-cols-2 gap-3">
              {furnitureTypes.map(({ type, label, icon: Icon }) => (
                <Button
                  key={type}
                  variant="outline"
                  className="h-24 flex flex-col items-center justify-center gap-2 border-gray-300 dark:border-gray-700 bg-transparent"
                  onClick={() => onAddFurniture(type)}
                >
                  <Icon className="w-6 h-6" />
                  <span className="text-sm">{label}</span>
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="font-semibold text-gray-950 dark:text-gray-50">커스텀 3D 모델</h2>
            <Label
              htmlFor="model-upload"
              className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
            >
              <Plus className="w-6 h-6 text-gray-500 dark:text-gray-400 mb-2" />
              <span className="text-sm text-gray-600 dark:text-gray-400 mb-1">OBJ/GLB 파일 업로드</span>
              <span className="text-xs text-gray-500 dark:text-gray-500">실사 가구 모델</span>
              <Input
                id="model-upload"
                type="file"
                accept=".obj,.glb,.gltf"
                className="hidden"
                onChange={handleModelUpload}
              />
            </Label>
          </div>

          <div className="space-y-3">
            <h2 className="font-semibold text-gray-950 dark:text-gray-50">실행 취소</h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 bg-transparent"
                onClick={onUndo}
                disabled={!canUndo}
              >
                <Undo2 className="w-4 h-4 mr-2" />
                실행취소
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 bg-transparent"
                onClick={onRedo}
                disabled={!canRedo}
              >
                <Redo2 className="w-4 h-4 mr-2" />
                다시실행
              </Button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              단축키: Ctrl+Z (실행취소), Ctrl+Shift+Z (다시실행)
            </p>
          </div>

          {/* Scene Info */}
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-950 dark:text-gray-50">씬 정보</h2>
            <div className="space-y-2 text-sm p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">배치된 가구:</span>
                <span className="font-medium text-gray-950 dark:text-gray-50">{furnitureCount}개</span>
              </div>
              {selectedId && (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
                  <Button variant="destructive" size="sm" className="w-full" onClick={onDeleteSelected}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    선택한 가구 삭제
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
