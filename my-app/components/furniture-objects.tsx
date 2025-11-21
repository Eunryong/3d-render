'use client'

import { useRef, useEffect, useState } from 'react'
import { TransformControls } from '@react-three/drei'
import { Box, Sphere, Cylinder } from '@react-three/drei'
import * as THREE from 'three'
import { CollisionDetector } from './collision-detector'
import { ModelLoader } from './model-loader'

interface FurnitureItem {
  id: string
  type: string
  position: [number, number, number]
  rotation: [number, number, number]
  scale: number
  modelUrl?: string
  modelType?: 'glb' | 'obj'
}

interface FurnitureObjectsProps {
  items: FurnitureItem[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onMove: (id: string, position: [number, number, number]) => void
  onRotate: (id: string, rotation: [number, number, number]) => void
  transformMode: 'translate' | 'rotate' | 'scale'
  collisionDetector?: CollisionDetector
  gridSnap?: number // Grid snap size in units (e.g., 0.1 = 10cm)
}

// Grid snap utility function
function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize
}

function FurnitureObject({
  item,
  isSelected,
  onSelect,
  onMove,
  onRotate,
  onScale,
  transformMode,
  collisionDetector,
  gridSnap = 0.1, // Default 10cm grid
}: {
  item: FurnitureItem
  isSelected: boolean
  onSelect: () => void
  onMove: (position: [number, number, number]) => void
  onRotate: (rotation: [number, number, number]) => void
  onScale: (scale: number) => void
  transformMode: 'translate' | 'rotate' | 'scale'
  collisionDetector?: CollisionDetector
  gridSnap?: number
}) {
  const groupRef = useRef<THREE.Group>(null)
  const transformRef = useRef<any>(null)
  const previousValidPosition = useRef<[number, number, number]>(item.position)
  const previousValidRotation = useRef<[number, number, number]>(item.rotation)
  const [isColliding, setIsColliding] = useState(false)
  const isDragging = useRef(false)

  // Store valid position when item changes (from parent state)
  useEffect(() => {
    previousValidPosition.current = item.position
    previousValidRotation.current = item.rotation
  }, [item.position, item.rotation])

  useEffect(() => {
    const controls = transformRef.current
    if (controls) {
      const handleDraggingChanged = (event: any) => {
        isDragging.current = event.value

        if (event.value) {
          // Drag started - disable orbit controls
          const orbitControls = controls.object?.parent?.parent?.__r3f?.handlers?.orbitControls
          if (orbitControls) orbitControls.enabled = false
        } else {
          // Drag ended - enable orbit controls
          const orbitControls = controls.object?.parent?.parent?.__r3f?.handlers?.orbitControls
          if (orbitControls) orbitControls.enabled = true

          // If colliding when drag ends, revert to previous valid position
          if (isColliding && groupRef.current) {
            groupRef.current.position.set(...previousValidPosition.current)
            groupRef.current.rotation.set(...previousValidRotation.current)
            onMove(previousValidPosition.current)
            onRotate(previousValidRotation.current)
            setIsColliding(false)
          } else if (groupRef.current) {
            // Save current position as valid
            const pos = groupRef.current.position
            const rot = groupRef.current.rotation
            previousValidPosition.current = [pos.x, pos.y, pos.z]
            previousValidRotation.current = [rot.x, rot.y, rot.z]
          }
        }
      }

      controls.addEventListener('dragging-changed', handleDraggingChanged)
      return () => {
        controls.removeEventListener('dragging-changed', handleDraggingChanged)
      }
    }
  }, [isSelected, isColliding, onMove, onRotate])

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

  // Get color based on collision state
  const getColor = (normalColor: string, selectedColor: string) => {
    if (isColliding) return "#EF4444" // Red when colliding
    return isSelected ? selectedColor : normalColor
  }

  // Render different furniture types
  const renderGeometry = () => {
    const commonProps = {
      castShadow: true,
      receiveShadow: true,
    }

    if (item.modelUrl && item.modelType) {
      return <ModelLoader url={item.modelUrl} type={item.modelType} />
    }

    switch (item.type) {
      case 'chair':
        return (
          <group>
            {/* Seat */}
            <Box args={[0.8, 0.15, 0.8]} position={[0, 0.5, 0]} {...commonProps}>
              <meshStandardMaterial color={getColor("#8B4513", "#D97706")} />
            </Box>
            {/* Back */}
            <Box args={[0.8, 0.9, 0.15]} position={[0, 1.0, -0.325]} {...commonProps}>
              <meshStandardMaterial color={getColor("#8B4513", "#D97706")} />
            </Box>
            {/* Legs */}
            {[[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]].map((pos, i) => (
              <Cylinder key={i} args={[0.08, 0.08, 0.5]} position={[pos[0], 0.25, pos[1]]} {...commonProps}>
                <meshStandardMaterial color={getColor("#654321", "#B45309")} />
              </Cylinder>
            ))}
          </group>
        )
      case 'table':
        return (
          <group>
            {/* Top */}
            <Box args={[2.5, 0.15, 1.5]} position={[0, 0.75, 0]} {...commonProps}>
              <meshStandardMaterial color={getColor("#A0522D", "#D97706")} />
            </Box>
            {/* Legs */}
            {[[-1.1, -0.65], [1.1, -0.65], [-1.1, 0.65], [1.1, 0.65]].map((pos, i) => (
              <Cylinder key={i} args={[0.08, 0.08, 0.7]} position={[pos[0], 0.35, pos[1]]} {...commonProps}>
                <meshStandardMaterial color={getColor("#654321", "#B45309")} />
              </Cylinder>
            ))}
          </group>
        )
      case 'sofa':
        return (
          <group>
            {/* Seat */}
            <Box args={[3.0, 0.7, 1.2]} position={[0, 0.5, 0]} {...commonProps}>
              <meshStandardMaterial color={getColor("#4A5568", "#3B82F6")} />
            </Box>
            {/* Back */}
            <Box args={[3.0, 1.2, 0.3]} position={[0, 1.2, -0.45]} {...commonProps}>
              <meshStandardMaterial color={getColor("#4A5568", "#3B82F6")} />
            </Box>
            {/* Arms */}
            {[-1.35, 1.35].map((x, i) => (
              <Box key={i} args={[0.3, 0.9, 1.2]} position={[x, 0.7, 0]} {...commonProps}>
                <meshStandardMaterial color={getColor("#4A5568", "#3B82F6")} />
              </Box>
            ))}
          </group>
        )
      case 'lamp':
        return (
          <group>
            {/* Base */}
            <Cylinder args={[0.3, 0.3, 0.08]} position={[0, 0.04, 0]} {...commonProps}>
              <meshStandardMaterial color={getColor("#2D3748", "#1E40AF")} />
            </Cylinder>
            {/* Pole */}
            <Cylinder args={[0.05, 0.05, 2.0]} position={[0, 1.1, 0]} {...commonProps}>
              <meshStandardMaterial color={getColor("#2D3748", "#1E40AF")} />
            </Cylinder>
            {/* Shade */}
            <Cylinder args={[0.4, 0.3, 0.5]} position={[0, 2.3, 0]} {...commonProps}>
              <meshStandardMaterial
                color={isColliding ? "#EF4444" : "#FBD38D"}
                emissive={isColliding ? "#EF4444" : "#FBD38D"}
                emissiveIntensity={0.3}
              />
            </Cylinder>
            <pointLight position={[0, 2.0, 0]} intensity={0.8} distance={7} />
          </group>
        )
      case 'bed':
        return (
          <group>
            {/* Mattress */}
            <Box args={[2.5, 0.5, 3.5]} position={[0, 0.45, 0]} {...commonProps}>
              <meshStandardMaterial color={getColor("#E5E7EB", "#EF4444")} />
            </Box>
            {/* Headboard */}
            <Box args={[2.5, 1.2, 0.2]} position={[0, 0.9, -1.65]} {...commonProps}>
              <meshStandardMaterial color={getColor("#9CA3AF", "#DC2626")} />
            </Box>
            {/* Frame */}
            <Box args={[2.6, 0.2, 3.6]} position={[0, 0.1, 0]} {...commonProps}>
              <meshStandardMaterial color={getColor("#6B7280", "#B91C1C")} />
            </Box>
            {/* Legs */}
            {[[-1.2, -1.7], [1.2, -1.7], [-1.2, 1.7], [1.2, 1.7]].map((pos, i) => (
              <Cylinder key={i} args={[0.08, 0.08, 0.4]} position={[pos[0], 0, pos[1]]} {...commonProps}>
                <meshStandardMaterial color={getColor("#4B5563", "#991B1B")} />
              </Cylinder>
            ))}
          </group>
        )
      default:
        return (
          <Box args={[0.5, 0.5, 0.5]} {...commonProps}>
            <meshStandardMaterial color={getColor("#CBD5E0", "#3B82F6")} />
          </Box>
        )
    }
  }

  return (
    <>
      <group
        ref={groupRef}
        position={item.position}
        rotation={item.rotation}
        scale={item.scale}
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
        }}
      >
        {renderGeometry()}
      </group>

      {isSelected && groupRef.current && (
        <TransformControls
          ref={transformRef}
          object={groupRef.current}
          mode={transformMode}
          onObjectChange={() => {
            if (groupRef.current) {
              const pos = groupRef.current.position
              const rot = groupRef.current.rotation
              const scl = groupRef.current.scale

              // Apply grid snapping for translate mode
              if (transformMode === 'translate' && gridSnap > 0) {
                pos.x = snapToGrid(pos.x, gridSnap)
                pos.z = snapToGrid(pos.z, gridSnap)
                groupRef.current.position.x = pos.x
                groupRef.current.position.z = pos.z
              }

              if (collisionDetector) {
                // Floor constraint
                const floorHeight = collisionDetector.getFloorHeight() ?? 0
                const box = new THREE.Box3().setFromObject(groupRef.current)
                const minY = box.min.y

                if (minY < floorHeight) {
                  const correction = floorHeight - minY
                  pos.y = pos.y + correction + 0.01
                  groupRef.current.position.y = pos.y
                }

                // Check collision with other furniture
                const updatedBox = new THREE.Box3().setFromObject(groupRef.current)
                const hasCollision = collisionDetector.checkCollision(item.id, updatedBox)

                // Update collision state for visual feedback
                setIsColliding(hasCollision)

                // Always update the bounding box in collision detector
                if (!hasCollision) {
                  collisionDetector.registerFurniture(item.id, updatedBox)
                }
              }

              // Always update position/rotation for smooth dragging
              onMove([pos.x, pos.y, pos.z])
              onRotate([rot.x, rot.y, rot.z])
              onScale((scl.x + scl.y + scl.z) / 3)
            }
          }}
        />
      )}
    </>
  )
}

export function FurnitureObjects({
  items,
  selectedId,
  onSelect,
  onMove,
  onRotate,
  transformMode,
  collisionDetector,
  gridSnap = 0.1
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
          onScale={(scale) => {
            // This will be handled through the parent component
          }}
          transformMode={transformMode}
          collisionDetector={collisionDetector}
          gridSnap={gridSnap}
        />
      ))}
    </>
  )
}
