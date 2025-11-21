'use client'

import { useRef, useEffect } from 'react'
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
}: {
  item: FurnitureItem
  isSelected: boolean
  onSelect: () => void
  onMove: (position: [number, number, number]) => void
  onRotate: (rotation: [number, number, number]) => void
  onScale: (scale: number) => void
  transformMode: 'translate' | 'rotate' | 'scale'
  collisionDetector?: CollisionDetector
}) {
  const groupRef = useRef<THREE.Group>(null)
  const transformRef = useRef<any>(null)
  const previousValidPosition = useRef<[number, number, number]>(item.position)

  useEffect(() => {
    const controls = transformRef.current
    if (controls) {
      const handleDragStart = () => {
        const orbitControls = controls.object?.parent?.parent?.__r3f?.handlers?.orbitControls
        if (orbitControls) orbitControls.enabled = false
      }
      const handleDragEnd = () => {
        const orbitControls = controls.object?.parent?.parent?.__r3f?.handlers?.orbitControls
        if (orbitControls) orbitControls.enabled = true
      }
      
      controls.addEventListener('dragging-changed', (event: any) => {
        if (event.value) {
          handleDragStart()
        } else {
          handleDragEnd()
        }
      })
    }
  }, [isSelected])

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
              <meshStandardMaterial color={isSelected ? "#D97706" : "#8B4513"} />
            </Box>
            {/* Back */}
            <Box args={[0.8, 0.9, 0.15]} position={[0, 1.0, -0.325]} {...commonProps}>
              <meshStandardMaterial color={isSelected ? "#D97706" : "#8B4513"} />
            </Box>
            {/* Legs */}
            {[[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]].map((pos, i) => (
              <Cylinder key={i} args={[0.08, 0.08, 0.5]} position={[pos[0], 0.25, pos[1]]} {...commonProps}>
                <meshStandardMaterial color={isSelected ? "#B45309" : "#654321"} />
              </Cylinder>
            ))}
          </group>
        )
      case 'table':
        return (
          <group>
            {/* Top */}
            <Box args={[2.5, 0.15, 1.5]} position={[0, 0.75, 0]} {...commonProps}>
              <meshStandardMaterial color={isSelected ? "#D97706" : "#A0522D"} />
            </Box>
            {/* Legs */}
            {[[-1.1, -0.65], [1.1, -0.65], [-1.1, 0.65], [1.1, 0.65]].map((pos, i) => (
              <Cylinder key={i} args={[0.08, 0.08, 0.7]} position={[pos[0], 0.35, pos[1]]} {...commonProps}>
                <meshStandardMaterial color={isSelected ? "#B45309" : "#654321"} />
              </Cylinder>
            ))}
          </group>
        )
      case 'sofa':
        return (
          <group>
            {/* Seat */}
            <Box args={[3.0, 0.7, 1.2]} position={[0, 0.5, 0]} {...commonProps}>
              <meshStandardMaterial color={isSelected ? "#3B82F6" : "#4A5568"} />
            </Box>
            {/* Back */}
            <Box args={[3.0, 1.2, 0.3]} position={[0, 1.2, -0.45]} {...commonProps}>
              <meshStandardMaterial color={isSelected ? "#3B82F6" : "#4A5568"} />
            </Box>
            {/* Arms */}
            {[-1.35, 1.35].map((x, i) => (
              <Box key={i} args={[0.3, 0.9, 1.2]} position={[x, 0.7, 0]} {...commonProps}>
                <meshStandardMaterial color={isSelected ? "#3B82F6" : "#4A5568"} />
              </Box>
            ))}
          </group>
        )
      case 'lamp':
        return (
          <group>
            {/* Base */}
            <Cylinder args={[0.3, 0.3, 0.08]} position={[0, 0.04, 0]} {...commonProps}>
              <meshStandardMaterial color={isSelected ? "#1E40AF" : "#2D3748"} />
            </Cylinder>
            {/* Pole */}
            <Cylinder args={[0.05, 0.05, 2.0]} position={[0, 1.1, 0]} {...commonProps}>
              <meshStandardMaterial color={isSelected ? "#1E40AF" : "#2D3748"} />
            </Cylinder>
            {/* Shade */}
            <Cylinder args={[0.4, 0.3, 0.5]} position={[0, 2.3, 0]} {...commonProps}>
              <meshStandardMaterial color="#FBD38D" emissive="#FBD38D" emissiveIntensity={0.3} />
            </Cylinder>
            <pointLight position={[0, 2.0, 0]} intensity={0.8} distance={7} />
          </group>
        )
      case 'bed':
        return (
          <group>
            {/* Mattress */}
            <Box args={[2.5, 0.5, 3.5]} position={[0, 0.45, 0]} {...commonProps}>
              <meshStandardMaterial color={isSelected ? "#EF4444" : "#E5E7EB"} />
            </Box>
            {/* Headboard */}
            <Box args={[2.5, 1.2, 0.2]} position={[0, 0.9, -1.65]} {...commonProps}>
              <meshStandardMaterial color={isSelected ? "#DC2626" : "#9CA3AF"} />
            </Box>
            {/* Frame */}
            <Box args={[2.6, 0.2, 3.6]} position={[0, 0.1, 0]} {...commonProps}>
              <meshStandardMaterial color={isSelected ? "#B91C1C" : "#6B7280"} />
            </Box>
            {/* Legs */}
            {[[-1.2, -1.7], [1.2, -1.7], [-1.2, 1.7], [1.2, 1.7]].map((pos, i) => (
              <Cylinder key={i} args={[0.08, 0.08, 0.4]} position={[pos[0], 0, pos[1]]} {...commonProps}>
                <meshStandardMaterial color={isSelected ? "#991B1B" : "#4B5563"} />
              </Cylinder>
            ))}
          </group>
        )
      default:
        return (
          <Box args={[0.5, 0.5, 0.5]} {...commonProps}>
            <meshStandardMaterial color={isSelected ? "#3B82F6" : "#CBD5E0"} />
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

              if (collisionDetector) {
                // Use bounding box to prevent going below floor (much faster than raycasting)
                const floorHeight = collisionDetector.getFloorHeight()
                if (floorHeight !== null) {
                  const box = new THREE.Box3().setFromObject(groupRef.current)
                  const minY = box.min.y

                  // If furniture bottom is below floor, snap it back to floor
                  if (minY < floorHeight) {
                    const currentHeight = pos.y
                    const correction = floorHeight - minY
                    pos.y = currentHeight + correction + 0.01 // Small offset to keep above floor
                    groupRef.current.position.y = pos.y
                  }
                }

                const box = new THREE.Box3().setFromObject(groupRef.current)
                const hasCollision = collisionDetector.checkCollision(item.id, box)

                if (hasCollision) {
                  groupRef.current.position.set(...previousValidPosition.current)
                  return
                }

                previousValidPosition.current = [pos.x, pos.y, pos.z]
                collisionDetector.registerFurniture(item.id, box)
              }

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
  collisionDetector 
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
        />
      ))}
    </>
  )
}
