'use client'

import { useEffect, useState, useRef } from 'react'
import { useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three-stdlib'
import { OBJLoader } from 'three-stdlib'
import * as THREE from 'three'

interface ModelLoaderProps {
  url: string
  type: 'glb' | 'obj'
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
}

export function ModelLoader({ url, type, position = [0, 0, 0], rotation = [0, 0, 0], scale = 1 }: ModelLoaderProps) {
  const meshRef = useRef<THREE.Group>(null)
  const [model, setModel] = useState<THREE.Group | THREE.Object3D | null>(null)

  useEffect(() => {
    const loadModel = async () => {
      try {
        if (type === 'glb') {
          const loader = new GLTFLoader()
          loader.load(url, (gltf) => {
            const scene = gltf.scene
            scene.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                child.castShadow = true
                child.receiveShadow = true
              }
            })
            setModel(scene)
          })
        } else if (type === 'obj') {
          const loader = new OBJLoader()
          loader.load(url, (obj) => {
            obj.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                child.castShadow = true
                child.receiveShadow = true
                const mesh = child as THREE.Mesh
                if (!mesh.material) {
                  mesh.material = new THREE.MeshStandardMaterial({ color: 0x8B4513 })
                }
              }
            })
            setModel(obj)
          })
        }
      } catch (error) {
        console.error('Failed to load model:', error)
      }
    }

    loadModel()
  }, [url, type])

  if (!model) {
    return (
      <mesh position={position}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="#cccccc" />
      </mesh>
    )
  }

  return (
    <group ref={meshRef} position={position} rotation={rotation} scale={scale}>
      <primitive object={model} />
    </group>
  )
}
