"use client"

import { useState, useEffect } from "react"
import { SceneViewer } from "@/components/scene-viewer"
import { Sidebar } from "@/components/sidebar"
import { TransformControlsPanel } from "@/components/transform-controls-panel"
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
  const [floorOrientation, setFloorOrientation] = useState<"Y" | "X" | "Z">("Y")
  const [plyColor, setPlyColor] = useState("#ffffff")

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
      console.warn("Could not find valid position for furniture")
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
      console.warn("Could not find valid position for custom model")
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
        onFloorOrientationChange={setFloorOrientation}
        floorOrientation={floorOrientation}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        plyColor={plyColor}
        onPlyColorChange={setPlyColor}
        hasPlyFile={!!plyFile}
      />
      <main className="flex-1 relative">
        <TransformControlsPanel mode={transformMode} onModeChange={setTransformMode} selectedId={selectedId} />
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
          floorOrientation={floorOrientation}
          plyColor={plyColor}
        />
      </main>
    </div>
  )
}
