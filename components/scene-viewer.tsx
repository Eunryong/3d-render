"use client"

import { Canvas, useThree } from "@react-three/fiber"
import { OrbitControls, PerspectiveCamera, Grid, Text, Line } from "@react-three/drei"
import { Suspense, useRef, useState, useEffect, useCallback, useMemo } from "react"
import { PLYLoader } from "./ply-loader"
import { FurnitureObjects } from "./furniture-objects"
import type { CollisionDetector } from "./collision-detector"
import type { ViewMode } from "./view-controls-panel"
import type { LightingSettings, MeasurementPoint } from "@/app/page"
import * as THREE from "three"

// Convert color temperature (Kelvin) to RGB color
function kelvinToRGB(kelvin: number): THREE.Color {
  const temp = kelvin / 100
  let red, green, blue

  if (temp <= 66) {
    red = 255
    green = Math.min(255, Math.max(0, 99.4708025861 * Math.log(temp) - 161.1195681661))
  } else {
    red = Math.min(255, Math.max(0, 329.698727446 * Math.pow(temp - 60, -0.1332047592)))
    green = Math.min(255, Math.max(0, 288.1221695283 * Math.pow(temp - 60, -0.0755148492)))
  }

  if (temp >= 66) {
    blue = 255
  } else if (temp <= 19) {
    blue = 0
  } else {
    blue = Math.min(255, Math.max(0, 138.5177312231 * Math.log(temp - 10) - 305.0447927307))
  }

  return new THREE.Color(red / 255, green / 255, blue / 255)
}

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
  viewTrigger?: number
  lightingSettings?: LightingSettings
  measurementMode?: boolean
  measurementPoints?: MeasurementPoint[]
  onAddMeasurementPoint?: (point: MeasurementPoint) => void
}

function FurnitureFocusController({
  selectedId,
  furnitureItems,
  collisionDetector,
  viewMode,
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
  viewMode: ViewMode
}) {
  const { camera, controls } = useThree()
  const prevSelectedIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!selectedId || !controls) return
    if (prevSelectedIdRef.current === selectedId) return
    // Skip furniture focus when in top view (e.g., after placing furniture)
    if (viewMode === "top") {
      prevSelectedIdRef.current = selectedId
      return
    }

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
  }, [selectedId, furnitureItems, camera, controls, collisionDetector, viewMode])

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
  viewTrigger,
  collisionDetector,
}: {
  viewMode: ViewMode
  viewTrigger: number
  collisionDetector: CollisionDetector
}) {
  const { camera, controls } = useThree()

  useEffect(() => {
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
        newPosition = new THREE.Vector3(center.x, floorHeight + 1.6, center.z + size.z * 0.2)
        newTarget = new THREE.Vector3(center.x, floorHeight + 1.6, center.z - size.z * 0.3)
        break

      case "thirdPerson":
        // Third person view - inside the space, slightly elevated
        newPosition = new THREE.Vector3(center.x, floorHeight + 2.0, center.z + size.z * 0.25)
        newTarget = new THREE.Vector3(center.x, floorHeight + 1, center.z - size.z * 0.1)
        break

      case "birdEye":
        // Bird's eye view - high angle diagonal, inside space
        const birdHeight = Math.max(size.x, size.z) * 0.6
        newPosition = new THREE.Vector3(
          center.x + size.x * 0.2,
          center.y + birdHeight,
          center.z + size.z * 0.2
        )
        newTarget = center.clone()
        break

      case "default":
      default:
        // Default perspective view - inside the space
        newPosition = new THREE.Vector3(
          center.x + size.x * 0.25,
          floorHeight + size.y * 0.6,
          center.z + size.z * 0.25
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
  }, [viewMode, viewTrigger, camera, controls, collisionDetector])

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
  viewTrigger = 0,
  lightingSettings,
  measurementMode = false,
  measurementPoints = [],
  onAddMeasurementPoint,
}: SceneViewerProps) {
  const [plyMesh, setPlyMesh] = useState<THREE.Mesh | THREE.Group | null>(null)
  const [backgroundTexture, setBackgroundTexture] = useState<THREE.Texture | null>(null)
  const [gridConfig, setGridConfig] = useState({ cellSize: 1, sectionSize: 5, fadeDistance: 30, floorHeight: 0 })

  // Calculate light color from color temperature
  const lightColor = useMemo(() => {
    const temp = lightingSettings?.colorTemperature ?? 4000
    return kelvinToRGB(temp)
  }, [lightingSettings?.colorTemperature])

  const handleMeshLoad = useCallback(
    (meshOrGroup: THREE.Mesh | THREE.Group) => {
      // Prevent duplicate calls for the same mesh
      if (plyMesh === meshOrGroup) return

      console.log("[v0] Background mesh loaded, setting up collision detection")

      // Pass the entire object (Mesh or Group) to collision detector
      // This ensures bounds are calculated from ALL meshes, not just the first one
      collisionDetector.setBackgroundMesh(meshOrGroup)
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
          viewMode={viewMode}
        />
        <ViewModeController viewMode={viewMode} viewTrigger={viewTrigger} collisionDetector={collisionDetector} />

        {/* Background Sphere for images */}
        {backgroundTexture && <BackgroundSphere texture={backgroundTexture} />}

        {/* Lighting - dynamic based on settings */}
        <ambientLight
          intensity={lightingSettings?.ambientIntensity ?? 0.6}
          color={lightColor}
        />
        <directionalLight
          position={[10, 10, 5]}
          intensity={lightingSettings?.directionalIntensity ?? 1.2}
          color={lightColor}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <pointLight
          position={[-10, -10, -5]}
          intensity={(lightingSettings?.ambientIntensity ?? 0.6) * 0.5}
          color={lightColor}
        />

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

        {/* Invisible click plane for deselect and measurement */}
        <mesh
          position={[0, gridConfig.floorHeight - 0.01, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          onClick={(e) => {
            e.stopPropagation()
            if (measurementMode && onAddMeasurementPoint) {
              const point = e.point
              onAddMeasurementPoint({
                id: `measurement-${Date.now()}`,
                position: [point.x, point.y, point.z],
              })
            } else {
              onSelectFurniture(null)
            }
          }}
        >
          <planeGeometry args={[200, 200]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>

        {/* Measurement Points and Lines */}
        {measurementPoints.length > 0 && (
          <>
            {/* Render measurement points */}
            {measurementPoints.map((point, index) => (
              <mesh key={point.id} position={point.position}>
                <sphereGeometry args={[0.05, 16, 16]} />
                <meshBasicMaterial color={index === 0 ? "#22c55e" : "#3b82f6"} />
              </mesh>
            ))}

            {/* Render lines between points */}
            {measurementPoints.length >= 2 && (
              <Line
                points={measurementPoints.map((p) => p.position)}
                color="#3b82f6"
                lineWidth={2}
              />
            )}

            {/* Render distance labels between consecutive points */}
            {measurementPoints.length >= 2 &&
              measurementPoints.slice(1).map((point, index) => {
                const prevPoint = measurementPoints[index]
                const midX = (prevPoint.position[0] + point.position[0]) / 2
                const midY = (prevPoint.position[1] + point.position[1]) / 2 + 0.15
                const midZ = (prevPoint.position[2] + point.position[2]) / 2
                const distance = Math.sqrt(
                  Math.pow(point.position[0] - prevPoint.position[0], 2) +
                    Math.pow(point.position[1] - prevPoint.position[1], 2) +
                    Math.pow(point.position[2] - prevPoint.position[2], 2),
                )
                return (
                  <Text
                    key={`label-${index}`}
                    position={[midX, midY, midZ]}
                    fontSize={0.12}
                    color="#3b82f6"
                    anchorX="center"
                    anchorY="middle"
                    outlineWidth={0.01}
                    outlineColor="white"
                  >
                    {distance.toFixed(2)}m
                  </Text>
                )
              })}
          </>
        )}

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
