'use client'

import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Grid } from '@react-three/drei'
import { Suspense, useRef, useState, useEffect } from 'react'
import { PLYLoader } from './ply-loader'
import { FurnitureObjects } from './furniture-objects'
import { CollisionDetector } from './collision-detector'
import * as THREE from 'three'

interface SceneViewerProps {
  plyFile: File | null
  furnitureItems: Array<{
    id: string
    type: string
    position: [number, number, number]
    rotation: [number, number, number]
    scale: number
  }>
  selectedId: string | null
  onSelectFurniture: (id: string | null) => void
  onMoveFurniture: (id: string, position: [number, number, number]) => void
  onRotateFurniture: (id: string, rotation: [number, number, number]) => void
  transformMode: 'translate' | 'rotate' | 'scale'
  collisionDetector: CollisionDetector
  backgroundType?: 'color' | 'image'
  backgroundValue?: string
  floorOrientation?: 'Y' | 'X' | 'Z'
}

function FurnitureFocusController({
  selectedId,
  furnitureItems
}: {
  selectedId: string | null
  furnitureItems: Array<{
    id: string
    type: string
    position: [number, number, number]
    rotation: [number, number, number]
    scale: number
  }>
}) {
  const { camera, controls } = useThree()
  const prevSelectedIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!selectedId || !controls) return
    if (prevSelectedIdRef.current === selectedId) return

    const furniture = furnitureItems.find(item => item.id === selectedId)
    if (!furniture) return

    const orbitControls = controls as any
    const targetPos = new THREE.Vector3(...furniture.position)

    // Calculate appropriate distance based on furniture type
    let distance = 5
    if (furniture.type === 'chair') distance = 3
    if (furniture.type === 'table') distance = 4
    if (furniture.type === 'sofa') distance = 5
    if (furniture.type === 'lamp') distance = 3
    if (furniture.type === 'bed') distance = 6

    // Smoothly move camera to look at furniture
    const currentTarget = orbitControls.target.clone()
    const currentPosition = camera.position.clone()

    // Calculate new camera position (slightly elevated and offset)
    const offset = new THREE.Vector3(
      distance * 0.7,
      distance * 0.5,
      distance * 0.7
    )
    const newPosition = targetPos.clone().add(offset)

    // Animate camera movement
    const startTime = Date.now()
    const duration = 800 // ms

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Easing function (ease-in-out)
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2

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

  }, [selectedId, furnitureItems, camera, controls])

  return null
}

function CameraController({ plyMesh, collisionDetector }: { plyMesh: THREE.Mesh | null, collisionDetector: CollisionDetector }) {
  const { camera, controls } = useThree()
  const lastMeshRef = useRef<THREE.Mesh | null>(null)

  useEffect(() => {
    // Adjust camera every time a new mesh is loaded
    if (plyMesh && plyMesh !== lastMeshRef.current) {
      // Get the adjusted bounding box (cut at raycasted floor height)
      const adjustedBox = collisionDetector.getAdjustedBoundingBox()
      const box = adjustedBox || new THREE.Box3().setFromObject(plyMesh)

      const center = new THREE.Vector3()
      const size = new THREE.Vector3()
      box.getCenter(center)
      box.getSize(size)

      // Position camera near the floor (bottom of the adjusted bounding box)
      camera.position.set(
        center.x,
        box.min.y + size.y * 0.2, // Near the floor, slightly above
        center.z + size.z * 0.3  // Slightly forward
      )

      // Point camera at center
      if (controls) {
        const orbitControls = controls as any
        orbitControls.target.copy(center)

        // Constrain camera distance to stay within bounds
        orbitControls.minDistance = 0.5
        orbitControls.maxDistance = Math.min(size.x, size.y, size.z) * 0.8

        // Limit vertical rotation to prevent going through floor/ceiling
        orbitControls.maxPolarAngle = Math.PI * 0.95 // Can't look straight down
        orbitControls.minPolarAngle = Math.PI * 0.05 // Can't look straight up

        orbitControls.update()
      }

      lastMeshRef.current = plyMesh
      console.log('[Camera] Constrained camera to adjusted interior:', {
        center: center.toArray(),
        size: size.toArray(),
        cameraPosition: camera.position.toArray(),
        floorHeight: collisionDetector.getFloorHeight()
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plyMesh, camera, controls])

  // Prevent camera from going through walls - optimized with throttling
  useEffect(() => {
    if (!plyMesh || !controls) return

    const orbitControls = controls as any

    // Get the adjusted bounding box (cut at raycasted floor height)
    const adjustedBox = collisionDetector.getAdjustedBoundingBox()
    const box = adjustedBox ? adjustedBox.clone() : new THREE.Box3().setFromObject(plyMesh)

    // Expand the box slightly inward to create a margin
    const margin = 0.5
    box.min.addScalar(margin)
    box.max.addScalar(-margin)

    let lastCheckTime = 0
    const throttleDelay = 50 // Check only every 50ms for better performance

    const onUpdate = () => {
      const now = Date.now()
      if (now - lastCheckTime < throttleDelay) return
      lastCheckTime = now

      // Simple bounding box check - much faster than raycasting
      if (!box.containsPoint(camera.position)) {
        camera.position.clamp(box.min, box.max)
      }
    }

    orbitControls.addEventListener('change', onUpdate)

    return () => {
      orbitControls.removeEventListener('change', onUpdate)
    }
  }, [plyMesh, camera, controls])

  return null
}

function BackgroundSphere({ texture }: { texture: THREE.Texture | null }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [rotation, setRotation] = useState(0)

  // Allow user to rotate background with keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setRotation((r) => r - 0.1)
      } else if (e.key === 'ArrowRight') {
        setRotation((r) => r + 0.1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
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
  backgroundType = 'color',
  backgroundValue = '#f5f5f5',
  floorOrientation = 'Y',
}: SceneViewerProps) {
  const [plyMesh, setPlyMesh] = useState<THREE.Mesh | null>(null)
  const [backgroundTexture, setBackgroundTexture] = useState<THREE.Texture | null>(null)
  const [gridConfig, setGridConfig] = useState({ cellSize: 1, sectionSize: 5, fadeDistance: 30, floorHeight: 0 })

  const handleMeshLoad = (mesh: THREE.Mesh) => {
    console.log('[v0] Background mesh loaded, setting up collision detection')
    collisionDetector.setBackgroundMesh(mesh)
    setPlyMesh(mesh)

    // Since PLY is now normalized to ~20 units, use fixed grid settings
    // Grid optimized for 20-unit normalized space
    const cellSize = 1 // 1 unit cells
    const sectionSize = 5 // 5x5 cell sections
    const fadeDistance = 30 // Fade at 30 units
    const floorHeight = collisionDetector.getFloorHeight() || 0

    setGridConfig({ cellSize, sectionSize, fadeDistance, floorHeight })
    console.log('[Grid] Set fixed grid for normalized space:', { cellSize, sectionSize, fadeDistance, floorHeight })
  }

  // Load background texture when image is selected
  useEffect(() => {
    if (backgroundType === 'image' && backgroundValue) {
      const textureLoader = new THREE.TextureLoader()
      textureLoader.load(backgroundValue, (texture) => {
        setBackgroundTexture(texture)
      })
    } else {
      setBackgroundTexture(null)
    }
  }, [backgroundType, backgroundValue])

  const backgroundColor = backgroundType === 'color' ? backgroundValue : '#000000'

  return (
    <div className="w-full h-screen bg-muted/30 pointer-events-none">
      <Canvas shadows className="pointer-events-auto" style={{ background: backgroundColor }}>
        <PerspectiveCamera makeDefault position={[5, 5, 5]} />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.05}
          enableZoom={true}
          zoomSpeed={0.3}
          enablePan={true}
          mouseButtons={{
            LEFT: 0,   // Rotate
            MIDDLE: 1, // Zoom
            RIGHT: 2   // Pan
          }}
        />
        <CameraController plyMesh={plyMesh} collisionDetector={collisionDetector} />
        <FurnitureFocusController selectedId={selectedId} furnitureItems={furnitureItems} />

        {/* Background Sphere for images */}
        {backgroundTexture && <BackgroundSphere texture={backgroundTexture} />}

        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[10, 10, 5]}
          intensity={1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <pointLight position={[-10, -10, -5]} intensity={0.3} />
        
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
            position={[0, 0, 0]}
            rotation={
              floorOrientation === 'Y' ? [-Math.PI / 2, 0, 0] :
              floorOrientation === 'X' ? [0, 0, -Math.PI / 2] :
              [0, 0, 0] // Z orientation
            }
            receiveShadow
            onClick={(e) => {
              e.stopPropagation()
              onSelectFurniture(null)
            }}
          >
            <planeGeometry args={[50, 50]} />
            <meshStandardMaterial
              color="#e5e5e5"
              roughness={0.8}
              metalness={0.2}
            />
          </mesh>
        )}

        {/* Invisible click plane to deselect */}
        <mesh
          position={[0, -0.01, 0]}
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
          onSelect={onSelectFurniture}
          onMove={onMoveFurniture}
          onRotate={onRotateFurniture}
          transformMode={transformMode}
          collisionDetector={collisionDetector}
        />
      </Canvas>
    </div>
  )
}
