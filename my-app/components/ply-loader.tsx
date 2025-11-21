'use client'

import { useState, useEffect, useRef } from 'react'
import { PLYLoader as ThreePLYLoader } from 'three-stdlib'
import * as THREE from 'three'
import { Html } from '@react-three/drei'

interface PLYLoaderProps {
  file: File
  onMeshLoad?: (mesh: THREE.Mesh) => void
}

function LoadingIndicator({ progress }: { progress: number }) {
  return (
    <Html center>
      <div className="bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm p-8 rounded-lg border border-gray-200 dark:border-gray-800 shadow-2xl min-w-[300px]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 border-4 border-gray-200 dark:border-gray-800 rounded-full" />
            <div 
              className="absolute inset-0 border-4 border-blue-600 dark:border-blue-500 border-t-transparent rounded-full animate-spin"
              style={{ animationDuration: '0.8s' }}
            />
          </div>
          <div className="text-center space-y-2">
            <p className="text-lg font-semibold text-gray-950 dark:text-gray-50">PLY 모델 로딩 중</p>
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

export function PLYLoader({ file, onMeshLoad }: PLYLoaderProps) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const urlRef = useRef<string>('')

  useEffect(() => {
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
          await new Promise(resolve => {
            setTimeout(() => {
              loadedGeometry.computeVertexNormals()
              resolve(true)
            }, 0)
          })
        }

        setProgress(90)

        // Center the geometry first
        loadedGeometry.center()

        // Compute bounding box to get the size
        loadedGeometry.computeBoundingBox()
        const boundingBox = loadedGeometry.boundingBox!
        const size = new THREE.Vector3()
        boundingBox.getSize(size)

        // Calculate scale factor to fit model into a normalized space (e.g., 20 units)
        const maxDim = Math.max(size.x, size.y, size.z)
        const targetSize = 20 // Target maximum dimension in scene units
        const scaleFactor = targetSize / maxDim

        // Scale the geometry
        loadedGeometry.scale(scaleFactor, scaleFactor, scaleFactor)

        console.log('[PLY] Normalized model:', { originalSize: size.toArray(), maxDim, scaleFactor, targetSize })

        setProgress(100)
        setGeometry(loadedGeometry)
        
      } catch (err) {
        console.error('PLY loading error:', err)
        setError('PLY 파일 로드 중 오류가 발생했습니다.')
      }
    }

    loadPLY()

    // Cleanup
    return () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current)
      }
      if (geometry) {
        geometry.dispose()
      }
    }
  }, [file])

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

  if (!geometry) {
    return <LoadingIndicator progress={progress} />
  }

  // Check if geometry has vertex colors
  const hasVertexColors = geometry.attributes.color !== undefined

  return (
    <mesh ref={meshRef} geometry={geometry} receiveShadow>
      <meshStandardMaterial
        color={hasVertexColors ? "#ffffff" : "#e0e0e0"}
        vertexColors={hasVertexColors}
        side={THREE.DoubleSide}
        roughness={0.8}
        metalness={0.2}
      />
    </mesh>
  )
}
