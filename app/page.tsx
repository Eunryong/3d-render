"use client"

import { useState, useEffect } from "react"
import { SceneViewer } from "@/components/scene-viewer"
import { Sidebar } from "@/components/sidebar"
import { TransformControlsPanel } from "@/components/transform-controls-panel"
import { ViewControlsPanel, type ViewMode } from "@/components/view-controls-panel"
import { MeasurementPanel } from "@/components/measurement-panel"
import * as THREE from "three"
import { CollisionDetector } from "@/components/collision-detector"
import { useHistory } from "@/hooks/use-history"

interface FurnitureItem {
  id: string
  type: string
  position: [number, number, number]
  rotation: [number, number, number]
  scale: number
  modelUrl?: string
  modelType?: "glb" | "obj"
}

export interface LightingSettings {
  ambientIntensity: number
  directionalIntensity: number
  colorTemperature: number // 2700K (warm) to 6500K (cool)
}

export interface MeasurementPoint {
  id: string
  position: [number, number, number]
}

export default function Home() {
  const [plyFile, setPlyFile] = useState<File | null>(null)
  const {
    state: furnitureItems,
    set: setFurnitureItems,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<FurnitureItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [transformMode, setTransformMode] = useState<"translate" | "rotate">("translate") // Removed scale mode type
  const [collisionDetector] = useState(() => new CollisionDetector())
  const [backgroundType, setBackgroundType] = useState<"color" | "image">("color")
  const [backgroundValue, setBackgroundValue] = useState("#f5f5f5")
  const [viewMode, setViewMode] = useState<ViewMode>("default")
  const [lightingSettings, setLightingSettings] = useState<LightingSettings>({
    ambientIntensity: 0.6,
    directionalIntensity: 1.0,
    colorTemperature: 4000, // Neutral white
  })
  const [measurementMode, setMeasurementMode] = useState(false)
  const [measurementPoints, setMeasurementPoints] = useState<MeasurementPoint[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Auto-dismiss error message
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [errorMessage])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault()
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "y") {
        e.preventDefault()
        redo()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [undo, redo])

  const handleFileUpload = (file: File) => {
    setPlyFile(file)
  }

  const handleAddFurniture = (type: string) => {
    let furnitureSize = new THREE.Vector3(1, 1, 1)
    if (type === "chair") furnitureSize = new THREE.Vector3(0.8, 1.5, 0.8)
    if (type === "table") furnitureSize = new THREE.Vector3(2.5, 0.8, 1.5)
    if (type === "sofa") furnitureSize = new THREE.Vector3(3.0, 1.8, 1.2)
    if (type === "lamp") furnitureSize = new THREE.Vector3(0.4, 2.5, 0.4)
    if (type === "bed") furnitureSize = new THREE.Vector3(2.5, 1.2, 3.5)

    const plyCenter = collisionDetector.getBackgroundCenter()

    if (!plyCenter) {
      const initialPosition: [number, number, number] = [0, 0, 0]
      const newItem: FurnitureItem = {
        id: `${type}-${Date.now()}`,
        type,
        position: initialPosition,
        rotation: [0, 0, 0],
        scale: 1,
      }
      setFurnitureItems([...furnitureItems, newItem])
      setSelectedId(newItem.id)
      return
    }

    const validPosition = collisionDetector.findValidPositionInside(furnitureSize)

    if (!validPosition) {
      setErrorMessage("배치할 공간이 없습니다")
      return
    }

    const initialPosition: [number, number, number] = [validPosition.x, validPosition.y, validPosition.z]

    const newItem: FurnitureItem = {
      id: `${type}-${Date.now()}`,
      type,
      position: initialPosition,
      rotation: [0, 0, 0],
      scale: 1,
    }
    setFurnitureItems([...furnitureItems, newItem])
    setSelectedId(newItem.id)
  }

  const handleDeleteSelected = () => {
    if (selectedId) {
      collisionDetector.unregisterFurniture(selectedId)
      setFurnitureItems(furnitureItems.filter((item) => item.id !== selectedId))
      setSelectedId(null)
    }
  }

  const handleMoveFurniture = (id: string, position: [number, number, number]) => {
    setFurnitureItems(furnitureItems.map((item) => (item.id === id ? { ...item, position } : item)))
  }

  const handleRotateFurniture = (id: string, rotation: [number, number, number]) => {
    setFurnitureItems(furnitureItems.map((item) => (item.id === id ? { ...item, rotation } : item)))
  }

  const handleScaleFurniture = (id: string, scale: number) => {
    setFurnitureItems(furnitureItems.map((item) => (item.id === id ? { ...item, scale } : item)))
  }

  const handleAddCustomModel = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase()
    const modelType = ext === "obj" ? "obj" : "glb"

    // Create a URL for the uploaded file
    const modelUrl = URL.createObjectURL(file)

    const plyCenter = collisionDetector.getBackgroundCenter()

    if (!plyCenter) {
      const initialPosition: [number, number, number] = [0, 0, 0]
      const newItem: FurnitureItem = {
        id: `custom-${Date.now()}`,
        type: "custom",
        position: initialPosition,
        rotation: [0, 0, 0],
        scale: 1,
        modelUrl,
        modelType,
      }
      setFurnitureItems([...furnitureItems, newItem])
      setSelectedId(newItem.id)
      return
    }

    const customModelSize = new THREE.Vector3(1, 1, 1)
    const validPosition = collisionDetector.findValidPositionInside(customModelSize)

    if (!validPosition) {
      setErrorMessage("배치할 공간이 없습니다")
      return
    }

    const initialPosition: [number, number, number] = [validPosition.x, validPosition.y, validPosition.z]

    const newItem: FurnitureItem = {
      id: `custom-${Date.now()}`,
      type: "custom",
      position: initialPosition,
      rotation: [0, 0, 0],
      scale: 1,
      modelUrl,
      modelType,
    }
    setFurnitureItems([...furnitureItems, newItem])
    setSelectedId(newItem.id)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        onFileUpload={handleFileUpload}
        onAddFurniture={handleAddFurniture}
        onAddCustomModel={handleAddCustomModel}
        selectedId={selectedId}
        onDeleteSelected={handleDeleteSelected}
        furnitureCount={furnitureItems.length}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        lightingSettings={lightingSettings}
        onLightingChange={setLightingSettings}
      />
      <main className="flex-1 relative">
        <TransformControlsPanel mode={transformMode} onModeChange={setTransformMode} selectedId={selectedId} />
        <ViewControlsPanel viewMode={viewMode} onViewModeChange={setViewMode} />
        <MeasurementPanel
          measurementMode={measurementMode}
          onMeasurementModeChange={setMeasurementMode}
          measurementPoints={measurementPoints}
          onClearMeasurements={() => setMeasurementPoints([])}
        />
        <SceneViewer
          plyFile={plyFile}
          furnitureItems={furnitureItems}
          selectedId={selectedId}
          onSelectFurniture={setSelectedId}
          onMoveFurniture={handleMoveFurniture}
          onRotateFurniture={handleRotateFurniture}
          transformMode={transformMode}
          collisionDetector={collisionDetector}
          backgroundType={backgroundType}
          backgroundValue={backgroundValue}
          viewMode={viewMode}
          lightingSettings={lightingSettings}
          measurementMode={measurementMode}
          measurementPoints={measurementPoints}
          onAddMeasurementPoint={(point) => setMeasurementPoints([...measurementPoints, point])}
        />
        {/* Error Toast */}
        {errorMessage && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-red-600 text-white rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-2">
            {errorMessage}
          </div>
        )}
      </main>
    </div>
  )
}
