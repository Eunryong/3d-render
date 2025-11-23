"use client"

import { Canvas, useThree } from "@react-three/fiber"
import { OrbitControls, PerspectiveCamera, Grid } from "@react-three/drei"
import { Suspense, useRef, useState, useEffect, useCallback } from "react"
import { PLYLoader } from "./ply-loader"
import { FurnitureObjects } from "./furniture-objects"
import type { CollisionDetector } from "./collision-detector"
import type { ViewMode } from "./view-controls-panel"
import * as THREE from "three"

interface SceneViewerProps {
  plyFile: File | null
  furnitureItems: Array<{
    id: string
    type: string
    position: [number, number, number]
    rotation: [number, number, number]
    scale: number
    modelUrl?: string
    modelType?: "glb" | "obj"
  }>
  selectedId: string | null
  onSelectFurniture: (id: string | null) => void
  onMoveFurniture: (id: string, position: [number, number, number]) => void
  onRotateFurniture: (id: string, rotation: [number, number, number]) => void
  transformMode: "translate" | "rotate"
  collisionDetector: CollisionDetector
  backgroundType?: "color" | "image"
  backgroundValue?: string
  viewMode?: ViewMode
}

function FurnitureFocusController({
  selectedId,
  furnitureItems,
  collisionDetector,
}: {
  selectedId: string | null
  furnitureItems: Array<{
    id: string
    type: string
    position: [number, number, number]
    rotation: [number, number, number]
    scale: number
  }>
  collisionDetector: CollisionDetector
}) {
  const { camera, controls } = useThree()
  const prevSelectedIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!selectedId || !controls) return
    if (prevSelectedIdRef.current === selectedId) return

    const furniture = furnitureItems.find((item) => item.id === selectedId)
    if (!furniture) return

    const orbitControls = controls as any
    const targetPos = new THREE.Vector3(...furniture.position)

    let distance = 5

    // Get space bounds to calculate appropriate distance
    const spaceBounds = collisionDetector.getBackgroundBounds()
    if (spaceBounds) {
      const spaceSize = new THREE.Vector3()
      spaceBounds.getSize(spaceSize)
      const maxSpaceDimension = Math.max(spaceSize.x, spaceSize.y, spaceSize.z)

      // Use space size to determine minimum safe distance (at least 30% of max dimension)
      const minDistanceFromSpace = maxSpaceDimension * 0.3

      // Base distance on furniture type
      if (furniture.type === "chair") distance = 3
      if (furniture.type === "table") distance = 4
      if (furniture.type === "sofa") distance = 5
      if (furniture.type === "lamp") distance = 3
      if (furniture.type === "bed") distance = 6

      // Ensure distance is sufficient to see context, not just walls
      distance = Math.max(distance, minDistanceFromSpace)
    }

    // Smoothly move camera to look at furniture
    const currentTarget = orbitControls.target.clone()
    const currentPosition = camera.position.clone()

    const offset = new THREE.Vector3(distance * 0.6, distance * 0.7, distance * 0.6)
    const newPosition = targetPos.clone().add(offset)

    // Animate camera movement
    const startTime = Date.now()
    const duration = 800 // ms

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Easing function (ease-in-out)
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2

      // Interpolate position and target
      camera.position.lerpVectors(currentPosition, newPosition, eased)
      orbitControls.target.lerpVectors(currentTarget, targetPos, eased)
      orbitControls.update()

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    animate()
    prevSelectedIdRef.current = selectedId
  }, [selectedId, furnitureItems, camera, controls, collisionDetector])

  return null
}

function CameraController({
  plyMesh,
  collisionDetector,
}: { plyMesh: THREE.Mesh | THREE.Group | null; collisionDetector: CollisionDetector }) {
  const { camera, controls } = useThree()
  const lastMeshRef = useRef<THREE.Mesh | THREE.Group | null>(null)

  useEffect(() => {
    if (plyMesh && plyMesh !== lastMeshRef.current) {
      const box = new THREE.Box3().setFromObject(plyMesh)

      const center = new THREE.Vector3()
      const size = new THREE.Vector3()
      box.getCenter(center)
      box.getSize(size)

      // Position camera directly above the center for top view
      const height = Math.max(size.x, size.z) * 0.8 // Adjust height based on horizontal dimensions
      camera.position.set(center.x, center.y + height, center.z)

      // Point camera at center
      if (controls) {
        const orbitControls = controls as any
        orbitControls.target.copy(center)

        const maxDimension = Math.max(size.x, size.y, size.z)
        orbitControls.minDistance = 0.5
        orbitControls.maxDistance = maxDimension * 3

        // Allow full rotation for exploring the space
        orbitControls.maxPolarAngle = Math.PI * 0.98
        orbitControls.minPolarAngle = Math.PI * 0.02

        orbitControls.update()
      }

      lastMeshRef.current = plyMesh
      console.log("[v0] Camera set to top view:", {
        center: center.toArray(),
        size: size.toArray(),
        cameraPosition: camera.position.toArray(),
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plyMesh, camera, controls])

  return null
}

function ViewModeController({
  viewMode,
  collisionDetector,
}: {
  viewMode: ViewMode
  collisionDetector: CollisionDetector
}) {
  const { camera, controls } = useThree()
  const prevViewModeRef = useRef<ViewMode>(viewMode)

  useEffect(() => {
    if (viewMode === prevViewModeRef.current) return

    const bounds = collisionDetector.getBackgroundBounds()
    const floorHeight = collisionDetector.getFloorHeight() ?? 0

    // Default scene center and size
    let center = new THREE.Vector3(0, floorHeight, 0)
    let size = new THREE.Vector3(10, 5, 10)

    if (bounds) {
      const boundsCenter = new THREE.Vector3()
      bounds.getCenter(boundsCenter)
      bounds.getSize(size)
      center = new THREE.Vector3(boundsCenter.x, floorHeight, boundsCenter.z)
    }

    const orbitControls = controls as any
    if (!orbitControls) return

    let newPosition: THREE.Vector3
    let newTarget: THREE.Vector3

    switch (viewMode) {
      case "top":
        // Top-down view
        newPosition = new THREE.Vector3(center.x, center.y + Math.max(size.x, size.z) * 1.2, center.z)
        newTarget = center.clone()
        break

      case "firstPerson":
        // First person view - eye level inside the space
        newPosition = new THREE.Vector3(center.x, floorHeight + 1.6, center.z + size.z * 0.3)
        newTarget = new THREE.Vector3(center.x, floorHeight + 1.6, center.z - size.z * 0.3)
        break

      case "thirdPerson":
        // Third person view - slightly elevated behind
        newPosition = new THREE.Vector3(center.x, floorHeight + 2.5, center.z + size.z * 0.6)
        newTarget = new THREE.Vector3(center.x, floorHeight + 1, center.z)
        break

      case "birdEye":
        // Bird's eye view - high angle diagonal
        const birdHeight = Math.max(size.x, size.z) * 0.8
        newPosition = new THREE.Vector3(
          center.x + size.x * 0.5,
          center.y + birdHeight,
          center.z + size.z * 0.5
        )
        newTarget = center.clone()
        break

      case "default":
      default:
        // Default perspective view
        const defaultDist = Math.max(size.x, size.z) * 0.8
        newPosition = new THREE.Vector3(
          center.x + defaultDist * 0.7,
          center.y + defaultDist * 0.5,
          center.z + defaultDist * 0.7
        )
        newTarget = center.clone()
        break
    }

    // Animate camera transition
    const startPosition = camera.position.clone()
    const startTarget = orbitControls.target.clone()
    const duration = 500
    const startTime = Date.now()

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2

      camera.position.lerpVectors(startPosition, newPosition, eased)
      orbitControls.target.lerpVectors(startTarget, newTarget, eased)
      orbitControls.update()

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    animate()
    prevViewModeRef.current = viewMode
  }, [viewMode, camera, controls, collisionDetector])

  return null
}

function BackgroundSphere({ texture }: { texture: THREE.Texture | null }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [rotation, setRotation] = useState(0)

  // Allow user to rotate background with keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        setRotation((r) => r - 0.1)
      } else if (e.key === "ArrowRight") {
        setRotation((r) => r + 0.1)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  if (!texture) return null

  return (
    <mesh ref={meshRef} rotation={[0, rotation, 0]} scale={[-1, 1, 1]}>
      <sphereGeometry args={[500, 60, 40]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} />
    </mesh>
  )
}

export function SceneViewer({
  plyFile,
  furnitureItems,
  selectedId,
  onSelectFurniture,
  onMoveFurniture,
  onRotateFurniture,
  transformMode,
  collisionDetector,
  backgroundType = "color",
  backgroundValue = "#f5f5f5",
  viewMode = "default",
}: SceneViewerProps) {
  const [plyMesh, setPlyMesh] = useState<THREE.Mesh | THREE.Group | null>(null)
  const [backgroundTexture, setBackgroundTexture] = useState<THREE.Texture | null>(null)
  const [gridConfig, setGridConfig] = useState({ cellSize: 1, sectionSize: 5, fadeDistance: 30, floorHeight: 0 })

  const handleMeshLoad = useCallback(
    (meshOrGroup: THREE.Mesh | THREE.Group) => {
      // Prevent duplicate calls for the same mesh
      if (plyMesh === meshOrGroup) return

      console.log("[v0] Background mesh loaded, setting up collision detection")

      // Get the first mesh from the group if it's a group
      let mesh: THREE.Mesh
      if ((meshOrGroup as THREE.Mesh).isMesh) {
        mesh = meshOrGroup as THREE.Mesh
      } else {
        // Find first mesh in the group
        let foundMesh: THREE.Mesh | null = null
        meshOrGroup.traverse((child) => {
          if (!foundMesh && (child as THREE.Mesh).isMesh) {
            foundMesh = child as THREE.Mesh
          }
        })
        if (foundMesh) {
          mesh = foundMesh
        } else {
          console.warn("No mesh found in group")
          return
        }
      }

      collisionDetector.setBackgroundMesh(mesh)
      setPlyMesh(meshOrGroup)

      // Since PLY is now normalized to ~20 units, use fixed grid settings
      // Grid optimized for 20-unit normalized space
      const cellSize = 1 // 1 unit cells
      const sectionSize = 5 // 5x5 cell sections
      const fadeDistance = 30 // Fade at 30 units
      // Use cachedFloorHeight for consistent floor level (lowest vertex Y for point clouds)
      const floorHeight = collisionDetector.getFloorHeight() ?? 0

      setGridConfig({ cellSize, sectionSize, fadeDistance, floorHeight })
      console.log("[Grid] Set grid floor height:", floorHeight)
    },
    [collisionDetector, plyMesh],
  )

  // Load background texture when image is selected
  useEffect(() => {
    if (backgroundType === "image" && backgroundValue) {
      const textureLoader = new THREE.TextureLoader()
      textureLoader.load(backgroundValue, (texture) => {
        setBackgroundTexture(texture)
      })
    } else {
      setBackgroundTexture(null)
    }
  }, [backgroundType, backgroundValue])

  const backgroundColor = backgroundType === "color" ? backgroundValue : "#000000"

  return (
    <div className="w-full h-screen bg-muted/30 pointer-events-none">
      <Canvas shadows className="pointer-events-auto" gl={{ preserveDrawingBuffer: true }}>
        <color attach="background" args={[backgroundColor]} />
        <PerspectiveCamera makeDefault position={[5, 5, 5]} />
        <OrbitControls makeDefault enableDamping dampingFactor={0.05} enabled={true} />
        <CameraController plyMesh={plyMesh} collisionDetector={collisionDetector} />
        <FurnitureFocusController
          selectedId={selectedId}
          furnitureItems={furnitureItems}
          collisionDetector={collisionDetector}
        />
        <ViewModeController viewMode={viewMode} collisionDetector={collisionDetector} />

        {/* Background Sphere for images */}
        {backgroundTexture && <BackgroundSphere texture={backgroundTexture} />}

        {/* Lighting - brighter for better visibility */}
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[10, 10, 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <pointLight position={[-10, -10, -5]} intensity={0.4} />

        {/* Grid - positioned at the raycasted floor height */}
        <Grid
          position={[0, gridConfig.floorHeight, 0]}
          infiniteGrid
          cellSize={gridConfig.cellSize}
          cellThickness={0.5}
          sectionSize={gridConfig.sectionSize}
          sectionThickness={1}
          fadeDistance={gridConfig.fadeDistance}
          fadeStrength={1}
        />

        {/* Visible Floor Plane - only show when no PLY file */}
        {!plyFile && (
          <mesh
            position={[0, -0.01, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
            onClick={(e) => {
              e.stopPropagation()
              onSelectFurniture(null)
            }}
          >
            <planeGeometry args={[100, 100]} />
            <meshStandardMaterial color="#e5e5e5" />
          </mesh>
        )}

        {/* Invisible click plane to deselect */}
        <mesh
          position={[0, -0.02, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          onClick={(e) => {
            e.stopPropagation()
            onSelectFurniture(null)
          }}
        >
          <planeGeometry args={[100, 100]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>

        {/* PLY Model */}
        <Suspense fallback={null}>
          {plyFile && <PLYLoader file={plyFile} onMeshLoad={handleMeshLoad} />}
        </Suspense>

        <FurnitureObjects
          items={furnitureItems}
          selectedId={selectedId}
          onSelect={(id) => {
            console.log("[v0] Selecting furniture:", id)
            onSelectFurniture(id)
          }}
          onMove={onMoveFurniture}
          onRotate={onRotateFurniture}
          transformMode={transformMode}
          collisionDetector={collisionDetector}
        />
      </Canvas>
    </div>
  )
}
