"use client"

import { useState, useEffect, useRef } from "react"
import { PLYLoader as ThreePLYLoader } from "three-stdlib"
import { GLTFLoader } from "three-stdlib"
import * as THREE from "three"
import { Html } from "@react-three/drei"

interface PLYLoaderProps {
  file: File
  onMeshLoad?: (mesh: THREE.Mesh | THREE.Group) => void
  color?: string
  onClick?: (event: any) => void
  onPointerDown?: (event: any) => void
}

function LoadingIndicator({ progress, fileType }: { progress: number; fileType: string }) {
  return (
    <Html center>
      <div className="bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm p-8 rounded-lg border border-gray-200 dark:border-gray-800 shadow-2xl min-w-[300px]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 border-4 border-gray-200 dark:border-gray-800 rounded-full" />
            <div
              className="absolute inset-0 border-4 border-blue-600 dark:border-blue-500 border-t-transparent rounded-full animate-spin"
              style={{ animationDuration: "0.8s" }}
            />
          </div>
          <div className="text-center space-y-2">
            <p className="text-lg font-semibold text-gray-950 dark:text-gray-50">{fileType} 모델 로딩 중</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">잠시만 기다려주세요...</p>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-blue-600 dark:bg-blue-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs font-mono text-gray-600 dark:text-gray-400">{Math.round(progress)}%</p>
        </div>
      </div>
    </Html>
  )
}

export function PLYLoader({ file, onMeshLoad, color = "#e0e0e0", onClick, onPointerDown }: PLYLoaderProps) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null)
  const [model, setModel] = useState<THREE.Group | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [fileType, setFileType] = useState<"PLY" | "GLB">("PLY")
  const meshRef = useRef<THREE.Mesh>(null)
  const groupRef = useRef<THREE.Group>(null)
  const urlRef = useRef<string>("")

  useEffect(() => {
    const fileExtension = file.name.split(".").pop()?.toLowerCase()

    if (fileExtension === "glb" || fileExtension === "gltf") {
      setFileType("GLB")
      loadGLB()
    } else if (fileExtension === "ply") {
      setFileType("PLY")
      loadPLY()
    } else {
      setError("지원하지 않는 파일 형식입니다. PLY 또는 GLB 파일을 사용해주세요.")
    }

    return () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current)
      }
      if (geometry) {
        geometry.dispose()
      }
    }
  }, [file])

  const loadGLB = async () => {
    try {
      setProgress(10)

      const url = URL.createObjectURL(file)
      urlRef.current = url
      setProgress(20)

      const loader = new GLTFLoader()

      loader.load(
        url,
        (gltf) => {
          setProgress(70)

          const group = gltf.scene
          group.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.receiveShadow = true
              child.castShadow = true
            }
          })

          // Center X and Z, but move Y so that lowest point is at Y=0
          const box = new THREE.Box3().setFromObject(group)
          const centerX = (box.min.x + box.max.x) / 2
          const centerZ = (box.min.z + box.max.z) / 2
          const minY = box.min.y
          group.position.set(-centerX, -minY, -centerZ)

          setProgress(100)
          setModel(group)

          if (onMeshLoad) {
            onMeshLoad(group)
          }
        },
        (progressEvent) => {
          if (progressEvent.lengthComputable) {
            const percentComplete = (progressEvent.loaded / progressEvent.total) * 70 + 20
            setProgress(percentComplete)
          }
        },
        (error) => {
          console.error("GLB loading error:", error)
          setError("GLB 파일 로드 중 오류가 발생했습니다.")
        },
      )
    } catch (err) {
      console.error("GLB loading error:", err)
      setError("GLB 파일 로드 중 오류가 발생했습니다.")
    }
  }

  const loadPLY = async () => {
    try {
      setProgress(10)

      const url = URL.createObjectURL(file)
      urlRef.current = url
      setProgress(20)

      const loader = new ThreePLYLoader()

      const arrayBuffer = await file.arrayBuffer()
      setProgress(40)

      const loadedGeometry = await new Promise<THREE.BufferGeometry>((resolve, reject) => {
        try {
          const geo = loader.parse(arrayBuffer)
          setProgress(70)
          resolve(geo)
        } catch (err) {
          reject(err)
        }
      })

      setProgress(80)

      if (!loadedGeometry.attributes.normal) {
        await new Promise((resolve) => {
          setTimeout(() => {
            loadedGeometry.computeVertexNormals()
            resolve(true)
          }, 0)
        })
      }

      setProgress(90)

      // Center X and Z, but move Y so that lowest point is at Y=0
      loadedGeometry.computeBoundingBox()
      const bbox = loadedGeometry.boundingBox
      if (bbox) {
        const centerX = (bbox.min.x + bbox.max.x) / 2
        const centerZ = (bbox.min.z + bbox.max.z) / 2
        const minY = bbox.min.y
        // Translate: center X/Z, and shift Y so min.y becomes 0
        loadedGeometry.translate(-centerX, -minY, -centerZ)
      }

      setProgress(100)
      setGeometry(loadedGeometry)
    } catch (err) {
      console.error("PLY loading error:", err)
      setError("PLY 파일 로드 중 오류가 발생했습니다.")
    }
  }

  useEffect(() => {
    if (meshRef.current && geometry && onMeshLoad) {
      onMeshLoad(meshRef.current)
    }
  }, [geometry, onMeshLoad])

  if (error) {
    return (
      <Html center>
        <div className="bg-red-50 dark:bg-red-950/30 p-6 rounded-lg border border-red-200 dark:border-red-800">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      </Html>
    )
  }

  if (model) {
    return <primitive ref={groupRef} object={model} onClick={onClick} onPointerDown={onPointerDown} />
  }

  if (!geometry) {
    return <LoadingIndicator progress={progress} fileType={fileType} />
  }

  return (
    <mesh ref={meshRef} geometry={geometry} receiveShadow onClick={onClick} onPointerDown={onPointerDown}>
      <meshStandardMaterial color={color} side={THREE.DoubleSide} roughness={0.8} metalness={0.2} />
    </mesh>
  )
}
