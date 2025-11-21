"use client"

import { useRef, useEffect, useCallback, useState } from "react"
import { TransformControls } from "@react-three/drei"
import { Box, Cylinder } from "@react-three/drei"
import { useThree } from "@react-three/fiber"
import * as THREE from "three"
import type { CollisionDetector } from "./collision-detector"
import { ModelLoader } from "./model-loader"

interface FurnitureItem {
  id: string
  type: string
  position: [number, number, number]
  rotation: [number, number, number]
  scale: number
  modelUrl?: string
  modelType?: "glb" | "obj"
}

interface FurnitureObjectsProps {
  items: FurnitureItem[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onMove: (id: string, position: [number, number, number]) => void
  onRotate: (id: string, rotation: [number, number, number]) => void
  transformMode: "translate" | "rotate"
  collisionDetector?: CollisionDetector
}

function FurnitureObject({
  item,
  isSelected,
  onSelect,
  onMove,
  onRotate,
  transformMode,
  collisionDetector,
}: {
  item: FurnitureItem
  isSelected: boolean
  onSelect: () => void
  onMove: (position: [number, number, number]) => void
  onRotate: (rotation: [number, number, number]) => void
  transformMode: "translate" | "rotate"
  collisionDetector?: CollisionDetector
}) {
  const groupRef = useRef<THREE.Group>(null)
  const transformRef = useRef<any>(null)
  const previousValidPosition = useRef<[number, number, number]>(item.position)
  const initialYPosition = useRef<number>(item.position[1])
  const isDragging = useRef<boolean>(false)
  const [isReady, setIsReady] = useState(false)
  const { controls } = useThree()

  useEffect(() => {
    initialYPosition.current = item.position[1]
    previousValidPosition.current = item.position
  }, [item.id])

  useEffect(() => {
    if (groupRef.current) {
      setIsReady(true)
      groupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.userData.clickable = true
        }
      })
      console.log("[v0] Furniture group mounted:", item.id)
    }
  }, [item.type, item.modelUrl, item.id])

  const handleClick = useCallback(
    (e: any) => {
      e.stopPropagation()
      console.log("[v0] Furniture clicked:", item.id, item.type)
      onSelect()
    },
    [onSelect, item.id, item.type],
  )

  const handleDragEnd = useCallback(() => {
    console.log("[v0] Drag ended for:", item.id)
    isDragging.current = false

    if (groupRef.current) {
      if (collisionDetector) {
        const box = new THREE.Box3().setFromObject(groupRef.current)
        const hasCollision = collisionDetector.checkCollisionFull(item.id, box)

        if (hasCollision) {
          console.log("[v0] Collision detected, reverting to:", previousValidPosition.current)
          groupRef.current.position.set(...previousValidPosition.current)
        } else {
          const pos = groupRef.current.position
          previousValidPosition.current = [pos.x, pos.y, pos.z]
          console.log("[v0] No collision, new position saved:", previousValidPosition.current)
        }

        const finalBox = new THREE.Box3().setFromObject(groupRef.current)
        collisionDetector.registerFurniture(item.id, finalBox)
      }

      const pos = groupRef.current.position
      const rot = groupRef.current.rotation

      onMove([pos.x, pos.y, pos.z])
      onRotate([rot.x, rot.y, rot.z])
    }
  }, [onMove, onRotate, collisionDetector, item.id])

  useEffect(() => {
    const transformControls = transformRef.current
    if (!transformControls || !isSelected || !isReady) return

    console.log("[v0] Setting up TransformControls for:", item.id, "mode:", transformMode)

    const onDraggingChanged = (event: any) => {
      console.log("[v0] Dragging changed:", event.value, "for:", item.id)

      if (event.value) {
        isDragging.current = true
        if (controls) {
          ;(controls as any).enabled = false
          console.log("[v0] OrbitControls disabled")
        }
      } else {
        if (controls) {
          ;(controls as any).enabled = true
          console.log("[v0] OrbitControls enabled")
        }
        handleDragEnd()
      }
    }

    const onObjectChange = () => {
      if (!groupRef.current || !collisionDetector || !isDragging.current) return

      const pos = groupRef.current.position

      const box = new THREE.Box3().setFromObject(groupRef.current)
      const hasCollision = collisionDetector.checkCollisionFull(item.id, box)

      if (hasCollision) {
        console.log("[v0] Collision during drag, reverting")
        groupRef.current.position.set(...previousValidPosition.current)
        return
      }

      if (transformMode === "translate") {
        const floorY = collisionDetector.getFloorHeightAt(pos.x, pos.z)
        if (floorY !== null) {
          pos.y = floorY
          groupRef.current.position.y = floorY
        }
      }

      previousValidPosition.current = [pos.x, pos.y, pos.z]
    }

    transformControls.addEventListener("dragging-changed", onDraggingChanged)
    transformControls.addEventListener("objectChange", onObjectChange)

    return () => {
      transformControls.removeEventListener("dragging-changed", onDraggingChanged)
      transformControls.removeEventListener("objectChange", onObjectChange)
    }
  }, [isSelected, isReady, transformMode, handleDragEnd, collisionDetector, item.id, controls])

  useEffect(() => {
    if (groupRef.current && collisionDetector) {
      const box = new THREE.Box3().setFromObject(groupRef.current)
      collisionDetector.registerFurniture(item.id, box)
    }

    return () => {
      if (collisionDetector) {
        collisionDetector.unregisterFurniture(item.id)
      }
    }
  }, [item.id, item.position, item.rotation, item.scale, collisionDetector])

  // Get bounding box size for each furniture type (for invisible click area)
  const getBoundingSize = (): [number, number, number, number, number, number] => {
    // Returns [width, height, depth, offsetX, offsetY, offsetZ]
    switch (item.type) {
      case "chair": return [0.5, 0.8, 0.5, 0, 0.4, 0]
      case "table": return [1.2, 0.8, 0.8, 0, 0.4, 0]
      case "sofa": return [2.0, 1.0, 1.0, 0, 0.5, 0]
      case "lamp": return [0.5, 1.9, 0.5, 0, 0.95, 0]
      case "bed": return [1.5, 1.0, 2.1, 0, 0.5, 0]
      default: return [0.5, 0.5, 0.5, 0, 0.25, 0]
    }
  }

  const renderGeometry = () => {
    const commonProps = {
      castShadow: true,
      receiveShadow: true,
    }

    const [bw, bh, bd, bx, by, bz] = getBoundingSize()

    // Invisible bounding box for easier clicking
    const clickBox = (
      <Box args={[bw, bh, bd]} position={[bx, by, bz]}>
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </Box>
    )

    if (item.modelUrl && item.modelType) {
      return (
        <group>
          {clickBox}
          <ModelLoader url={item.modelUrl} type={item.modelType} onClick={handleClick} />
        </group>
      )
    }

    switch (item.type) {
      case "chair":
        return (
          <group>
            {clickBox}
            <Box args={[0.5, 0.08, 0.5]} position={[0, 0.25, 0]} {...commonProps}>
              <meshStandardMaterial color={isSelected ? "#D97706" : "#8B4513"} />
            </Box>
            <Box args={[0.5, 0.5, 0.08]} position={[0, 0.54, -0.21]} {...commonProps}>
              <meshStandardMaterial color={isSelected ? "#D97706" : "#A0522D"} />
            </Box>
            {[
              [-0.2, -0.2],
              [0.2, -0.2],
              [-0.2, 0.2],
              [0.2, 0.2],
            ].map((pos, i) => (
              <Cylinder key={i} args={[0.025, 0.025, 0.25]} position={[pos[0], 0.125, pos[1]]} {...commonProps}>
                <meshStandardMaterial color={isSelected ? "#B45309" : "#654321"} />
              </Cylinder>
            ))}
          </group>
        )
      case "table":
        return (
          <group>
            {clickBox}
            <Box args={[1.2, 0.05, 0.8]} position={[0, 0.75, 0]} {...commonProps}>
              <meshStandardMaterial color={isSelected ? "#D97706" : "#A0522D"} />
            </Box>
            {[
              [-0.55, -0.35],
              [0.55, -0.35],
              [-0.55, 0.35],
              [0.55, 0.35],
            ].map((pos, i) => (
              <Cylinder key={i} args={[0.03, 0.03, 0.75]} position={[pos[0], 0.375, pos[1]]} {...commonProps}>
                <meshStandardMaterial color={isSelected ? "#B45309" : "#654321"} />
              </Cylinder>
            ))}
          </group>
        )
      case "sofa":
        return (
          <group>
            {clickBox}
            <Box args={[1.8, 0.4, 0.8]} position={[0, 0.4, 0]} {...commonProps}>
              <meshStandardMaterial color={isSelected ? "#3B82F6" : "#4A5568"} />
            </Box>
            <Box args={[1.8, 0.6, 0.2]} position={[0, 0.7, -0.3]} {...commonProps}>
              <meshStandardMaterial color={isSelected ? "#3B82F6" : "#4A5568"} />
            </Box>
            {[-0.8, 0.8].map((x, i) => (
              <Box key={i} args={[0.2, 0.5, 0.8]} position={[x, 0.5, 0]} {...commonProps}>
                <meshStandardMaterial color={isSelected ? "#3B82F6" : "#4A5568"} />
              </Box>
            ))}
          </group>
        )
      case "lamp":
        return (
          <group>
            {clickBox}
            <Cylinder args={[0.15, 0.15, 0.03]} position={[0, 0.015, 0]} {...commonProps}>
              <meshStandardMaterial color={isSelected ? "#1E40AF" : "#2D3748"} />
            </Cylinder>
            <Cylinder args={[0.02, 0.02, 1.5]} position={[0, 0.765, 0]} {...commonProps}>
              <meshStandardMaterial color={isSelected ? "#1E40AF" : "#2D3748"} />
            </Cylinder>
            <Cylinder args={[0.25, 0.18, 0.35]} position={[0, 1.69, 0]} {...commonProps}>
              <meshStandardMaterial color="#FBD38D" emissive="#FBD38D" emissiveIntensity={0.3} />
            </Cylinder>
            <pointLight position={[0, 1.5, 0]} intensity={0.5} distance={5} />
          </group>
        )
      case "bed":
        return (
          <group>
            {clickBox}
            <Box args={[1.4, 0.3, 2.0]} position={[0, 0.3, 0]} {...commonProps}>
              <meshStandardMaterial color={isSelected ? "#DC2626" : "#EF4444"} />
            </Box>
            <Box args={[1.4, 0.7, 0.1]} position={[0, 0.65, -0.95]} {...commonProps}>
              <meshStandardMaterial color={isSelected ? "#B45309" : "#8B4513"} />
            </Box>
            <Box args={[1.5, 0.1, 2.1]} position={[0, 0.05, 0]} {...commonProps}>
              <meshStandardMaterial color={isSelected ? "#B45309" : "#654321"} />
            </Box>
            {[
              [-0.7, -0.95],
              [0.7, -0.95],
              [-0.7, 0.95],
              [0.7, 0.95],
            ].map((pos, i) => (
              <Cylinder key={i} args={[0.04, 0.04, 0.15]} position={[pos[0], 0.075, pos[1]]} {...commonProps}>
                <meshStandardMaterial color={isSelected ? "#B45309" : "#654321"} />
              </Cylinder>
            ))}
          </group>
        )
      default:
        return (
          <group>
            {clickBox}
            <Box args={[0.5, 0.5, 0.5]} {...commonProps}>
              <meshStandardMaterial color={isSelected ? "#3B82F6" : "#CBD5E0"} />
            </Box>
          </group>
        )
    }
  }

  return (
    <>
      <group ref={groupRef} position={item.position} rotation={item.rotation} scale={item.scale} onClick={handleClick}>
        {renderGeometry()}
      </group>

      {isSelected && isReady && (
        <TransformControls
          ref={transformRef}
          object={groupRef.current!}
          mode={transformMode}
          size={1.5}
          showX={true}
          showY={false}
          showZ={true}
          enabled={true}
          space="world"
        />
      )}
    </>
  )
}

function FurnitureObjects({
  items,
  selectedId,
  onSelect,
  onMove,
  onRotate,
  transformMode,
  collisionDetector,
}: FurnitureObjectsProps & { collisionDetector?: CollisionDetector }) {
  return (
    <>
      {items.map((item) => (
        <FurnitureObject
          key={item.id}
          item={item}
          isSelected={selectedId === item.id}
          onSelect={() => onSelect(item.id)}
          onMove={(pos) => onMove(item.id, pos)}
          onRotate={(rot) => onRotate(item.id, rot)}
          transformMode={transformMode}
          collisionDetector={collisionDetector}
        />
      ))}
    </>
  )
}

export { FurnitureObjects }
