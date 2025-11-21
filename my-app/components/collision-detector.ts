import * as THREE from 'three'

export class CollisionDetector {
  private backgroundMesh: THREE.Mesh | null = null
  private furnitureObjects: Map<string, THREE.Box3> = new Map()
  private raycaster = new THREE.Raycaster() // Still needed for floor snapping
  private nextPlacementOffset = 0
  private cachedFloorHeight: number | null = null

  setBackgroundMesh(mesh: THREE.Mesh) {
    this.backgroundMesh = mesh
    // Calculate floor height once when mesh is set
    this.cachedFloorHeight = this.calculateFloorHeight()
  }

  private calculateFloorHeight(): number | null {
    if (!this.backgroundMesh) return null

    const box = new THREE.Box3().setFromObject(this.backgroundMesh)
    const center = new THREE.Vector3()
    box.getCenter(center)

    // Raycast from below upwards at the center to find the floor
    const rayOrigin = new THREE.Vector3(center.x, box.min.y - 10, center.z)
    this.raycaster.set(rayOrigin, new THREE.Vector3(0, 1, 0))

    const intersects = this.raycaster.intersectObject(this.backgroundMesh, true)

    if (intersects.length > 0) {
      return intersects[0].point.y
    }

    // Fallback to bounding box minimum
    return box.min.y
  }

  getBackgroundMesh(): THREE.Mesh | null {
    return this.backgroundMesh
  }

  getBackgroundCenter(): THREE.Vector3 | null {
    if (!this.backgroundMesh) return null

    const box = new THREE.Box3().setFromObject(this.backgroundMesh)

    // Use the raycasted floor height as the minimum Y boundary
    if (this.cachedFloorHeight !== null) {
      box.min.y = this.cachedFloorHeight
    }

    const center = new THREE.Vector3()
    box.getCenter(center)
    return center
  }

  getAdjustedBoundingBox(): THREE.Box3 | null {
    if (!this.backgroundMesh) return null

    const box = new THREE.Box3().setFromObject(this.backgroundMesh)

    // Cut the bounding box at the raycasted floor height
    if (this.cachedFloorHeight !== null) {
      box.min.y = this.cachedFloorHeight
    }

    return box
  }

  getFloorHeight(): number | null {
    // Return the cached floor height calculated by raycasting
    return this.cachedFloorHeight
  }

  registerFurniture(id: string, box: THREE.Box3) {
    this.furnitureObjects.set(id, box.clone())
  }

  unregisterFurniture(id: string) {
    this.furnitureObjects.delete(id)
  }

  checkCollision(furnitureId: string, furnitureBox: THREE.Box3): boolean {
    // Only check collision with other furniture, not with background walls
    // since camera constraints prevent furniture from going through walls
    return this.checkFurnitureCollision(furnitureId, furnitureBox)
  }

  private checkFurnitureCollision(currentFurnitureId: string, furnitureBox: THREE.Box3): boolean {
    for (const [id, box] of this.furnitureObjects.entries()) {
      if (id === currentFurnitureId) continue

      if (furnitureBox.intersectsBox(box)) {
        return true
      }
    }
    return false
  }

  snapToFloor(position: THREE.Vector3): number | null {
    if (!this.backgroundMesh) return null

    // Raycast from below upwards to find the floor inside the mesh
    const box = new THREE.Box3().setFromObject(this.backgroundMesh)
    const rayOrigin = new THREE.Vector3(position.x, box.min.y - 10, position.z)
    this.raycaster.set(rayOrigin, new THREE.Vector3(0, 1, 0)) // Shoot upwards

    const intersects = this.raycaster.intersectObject(this.backgroundMesh, true)

    // Find the first intersection (bottom/floor surface when shooting upwards)
    if (intersects.length > 0) {
      return intersects[0].point.y
    }

    return null
  }

  findValidPosition(furnitureSize: THREE.Vector3): THREE.Vector3 | null {
    if (!this.backgroundMesh) {
      return new THREE.Vector3(0, furnitureSize.y / 2 + 0.5, 0)
    }

    const backgroundBox = new THREE.Box3().setFromObject(this.backgroundMesh)
    const backgroundCenter = new THREE.Vector3()
    const backgroundSize = new THREE.Vector3()
    backgroundBox.getCenter(backgroundCenter)
    backgroundBox.getSize(backgroundSize)

    // Generate candidate positions in a spiral pattern
    const candidatePositions: THREE.Vector3[] = []
    const baseOffset = Math.max(backgroundSize.x, backgroundSize.z) / 2 + 1
    const spacing = Math.max(furnitureSize.x, furnitureSize.z) + 0.8

    // Create a grid of positions around the background
    for (let ring = 0; ring < 5; ring++) {
      const radius = baseOffset + ring * spacing
      const pointsInRing = 8 + ring * 4
      
      for (let i = 0; i < pointsInRing; i++) {
        const angle = (i / pointsInRing) * Math.PI * 2
        const x = backgroundCenter.x + Math.cos(angle) * radius
        const z = backgroundCenter.z + Math.sin(angle) * radius
        const y = furnitureSize.y / 2 + 0.1
        
        candidatePositions.push(new THREE.Vector3(x, y, z))
      }
    }

    // Also try positions on top
    candidatePositions.push(
      new THREE.Vector3(
        backgroundCenter.x,
        backgroundBox.max.y + furnitureSize.y / 2 + 0.1,
        backgroundCenter.z
      )
    )

    // Test each candidate position with padding
    const padding = 0.3
    const paddedSize = new THREE.Vector3(
      furnitureSize.x + padding,
      furnitureSize.y + padding,
      furnitureSize.z + padding
    )

    for (const pos of candidatePositions) {
      const testBox = new THREE.Box3().setFromCenterAndSize(pos, paddedSize)

      // Check if this position collides with any existing furniture
      let hasCollision = false
      for (const [id, box] of this.furnitureObjects.entries()) {
        if (testBox.intersectsBox(box)) {
          hasCollision = true
          break
        }
      }

      // If no collision, try to snap to floor and return
      if (!hasCollision) {
        const floorY = this.snapToFloor(pos)
        if (floorY !== null) {
          return new THREE.Vector3(pos.x, floorY + furnitureSize.y / 2 + 0.05, pos.z)
        }
        return pos
      }
    }

    // Fallback: stack on top of highest furniture
    let maxY = backgroundBox.max.y
    for (const [id, box] of this.furnitureObjects.entries()) {
      if (box.max.y > maxY) {
        maxY = box.max.y
      }
    }
    
    const stackedY = maxY + furnitureSize.y / 2 + 0.3
    this.nextPlacementOffset += spacing
    
    return new THREE.Vector3(
      backgroundCenter.x + (this.nextPlacementOffset % 3) - 1,
      stackedY,
      backgroundCenter.z + Math.floor(this.nextPlacementOffset / 3) - 1
    )
  }
}
