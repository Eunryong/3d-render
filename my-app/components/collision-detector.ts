import * as THREE from "three"

// Spatial Hash Grid for O(1) collision lookups
class SpatialHash {
  private cellSize: number
  private grid: Map<string, Set<string>> = new Map()
  private objectCells: Map<string, Set<string>> = new Map()

  constructor(cellSize = 2) {
    this.cellSize = cellSize
  }

  private getCellKey(x: number, z: number): string {
    const cellX = Math.floor(x / this.cellSize)
    const cellZ = Math.floor(z / this.cellSize)
    return `${cellX},${cellZ}`
  }

  private getCellsForBox(box: THREE.Box3): string[] {
    const cells: string[] = []
    const minCellX = Math.floor(box.min.x / this.cellSize)
    const maxCellX = Math.floor(box.max.x / this.cellSize)
    const minCellZ = Math.floor(box.min.z / this.cellSize)
    const maxCellZ = Math.floor(box.max.z / this.cellSize)

    for (let x = minCellX; x <= maxCellX; x++) {
      for (let z = minCellZ; z <= maxCellZ; z++) {
        cells.push(`${x},${z}`)
      }
    }
    return cells
  }

  insert(id: string, box: THREE.Box3): void {
    this.remove(id)

    const cells = this.getCellsForBox(box)
    this.objectCells.set(id, new Set(cells))

    for (const cell of cells) {
      if (!this.grid.has(cell)) {
        this.grid.set(cell, new Set())
      }
      this.grid.get(cell)!.add(id)
    }
  }

  remove(id: string): void {
    const cells = this.objectCells.get(id)
    if (cells) {
      for (const cell of cells) {
        this.grid.get(cell)?.delete(id)
      }
      this.objectCells.delete(id)
    }
  }

  query(box: THREE.Box3, excludeId?: string): Set<string> {
    const candidates = new Set<string>()
    const cells = this.getCellsForBox(box)

    for (const cell of cells) {
      const objects = this.grid.get(cell)
      if (objects) {
        for (const id of objects) {
          if (id !== excludeId) {
            candidates.add(id)
          }
        }
      }
    }
    return candidates
  }

  clear(): void {
    this.grid.clear()
    this.objectCells.clear()
  }
}

export class CollisionDetector {
  private backgroundMesh: THREE.Mesh | null = null
  private furnitureObjects: Map<string, THREE.Box3> = new Map()
  private raycaster = new THREE.Raycaster()
  private nextPlacementOffset = 0
  private cachedFloorHeight: number | null = null

  private floorHeightGrid: Map<string, number> = new Map()
  private gridCellSize = 1.0
  private backgroundBounds: THREE.Box3 | null = null

  private spatialHash = new SpatialHash(2)

  private dirtyObjects: Set<string> = new Set()
  private collisionCache: Map<string, boolean> = new Map()

  private lastCheckTime = 0
  private throttleMs = 16

  setBackgroundMesh(mesh: THREE.Mesh) {
    this.backgroundMesh = mesh
    this.backgroundBounds = new THREE.Box3().setFromObject(mesh)

    // Check if mesh has faces (index buffer) for raycasting
    const geometry = mesh.geometry
    const hasIndex = geometry && geometry.index && geometry.index.count > 0
    console.log("[v0] Background mesh set, has faces:", hasIndex, "bounds:", this.backgroundBounds)

    if (hasIndex) {
      // Has faces - use raycasting for floor detection
      this.buildFloorHeightGrid()
      this.cachedFloorHeight = this.calculateDefaultFloorHeight()
    } else {
      // Point cloud - find lowest Y from vertices
      this.cachedFloorHeight = this.findLowestVertexY(geometry)
      console.log("[v0] Point cloud detected, found lowest Y from vertices:", this.cachedFloorHeight)
    }

    // Fallback to bounding box min.y
    if (this.cachedFloorHeight === null && this.backgroundBounds) {
      this.cachedFloorHeight = this.backgroundBounds.min.y
      console.log("[v0] Fallback to bounds min.y:", this.cachedFloorHeight)
    } else {
      console.log("[v0] Floor height set to:", this.cachedFloorHeight)
    }
  }

  private findLowestVertexY(geometry: THREE.BufferGeometry): number | null {
    const positionAttr = geometry.getAttribute("position")
    if (!positionAttr) return null

    let minY = Infinity
    for (let i = 0; i < positionAttr.count; i++) {
      const y = positionAttr.getY(i)
      if (y < minY) {
        minY = y
      }
    }

    return minY === Infinity ? null : minY
  }

  getFloorHeight(): number | null {
    return this.cachedFloorHeight
  }

  getBackgroundMesh(): THREE.Mesh | null {
    return this.backgroundMesh
  }

  getBackgroundBounds(): THREE.Box3 | null {
    return this.backgroundBounds
  }

  getBackgroundCenter(): THREE.Vector3 | null {
    if (!this.backgroundMesh) return null

    const box = new THREE.Box3().setFromObject(this.backgroundMesh)

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

    // Previously: box.min.y = this.cachedFloorHeight
    // Now: Return the full bounding box without clipping

    return box
  }

  private buildFloorHeightGrid(): void {
    if (!this.backgroundMesh || !this.backgroundBounds) return

    this.floorHeightGrid.clear()
    const bounds = this.backgroundBounds
    const cellSize = this.gridCellSize

    const minX = Math.floor(bounds.min.x / cellSize) * cellSize
    const maxX = Math.ceil(bounds.max.x / cellSize) * cellSize
    const minZ = Math.floor(bounds.min.z / cellSize) * cellSize
    const maxZ = Math.ceil(bounds.max.z / cellSize) * cellSize

    let sampledCount = 0
    let totalSamples = 0

    for (let x = minX; x <= maxX; x += cellSize) {
      for (let z = minZ; z <= maxZ; z += cellSize) {
        totalSamples++
        const floorY = this.sampleFloorHeight(x, z)
        if (floorY !== null) {
          const key = this.getGridKey(x, z)
          this.floorHeightGrid.set(key, floorY)
          sampledCount++
        }
      }
    }

    console.log("[v0] Floor sampling: found", sampledCount, "of", totalSamples, "samples")
  }

  private sampleFloorHeight(x: number, z: number): number | null {
    if (!this.backgroundMesh || !this.backgroundBounds) return null

    const bounds = this.backgroundBounds
    const rayOrigin = new THREE.Vector3(x, bounds.max.y + 5, z)
    this.raycaster.set(rayOrigin, new THREE.Vector3(0, -1, 0))
    this.raycaster.far = bounds.max.y - bounds.min.y + 20

    const intersects = this.raycaster.intersectObject(this.backgroundMesh, true)

    if (intersects.length >= 1) {
      intersects.sort((a, b) => a.distance - b.distance)
      return intersects[0].point.y
    }

    return null
  }

  private getGridKey(x: number, z: number): string {
    const cellX = Math.floor(x / this.gridCellSize)
    const cellZ = Math.floor(z / this.gridCellSize)
    return `${cellX},${cellZ}`
  }

  private calculateDefaultFloorHeight(): number | null {
    if (this.floorHeightGrid.size === 0) {
      return this.backgroundBounds?.min.y ?? null
    }

    const heights = Array.from(this.floorHeightGrid.values())
    heights.sort((a, b) => a - b)
    // Use 10th percentile instead of median to get actual floor level
    // This avoids high values from elevated surfaces in the scan
    const floorIndex = Math.floor(heights.length * 0.1)
    return heights[floorIndex]
  }

  registerFurniture(id: string, box: THREE.Box3) {
    const clonedBox = box.clone()
    this.furnitureObjects.set(id, clonedBox)
    this.spatialHash.insert(id, clonedBox)
    this.markDirty(id)
  }

  unregisterFurniture(id: string) {
    this.furnitureObjects.delete(id)
    this.spatialHash.remove(id)
    this.collisionCache.delete(id)
    this.dirtyObjects.delete(id)
  }

  markDirty(id: string) {
    this.dirtyObjects.add(id)
    this.collisionCache.delete(id)

    const box = this.furnitureObjects.get(id)
    if (box) {
      const nearbyIds = this.spatialHash.query(box, id)
      for (const nearbyId of nearbyIds) {
        this.collisionCache.delete(nearbyId)
      }
    }
  }

  checkCollision(furnitureId: string, furnitureBox: THREE.Box3): boolean {
    const now = performance.now()

    if (now - this.lastCheckTime < this.throttleMs && this.collisionCache.has(furnitureId)) {
      return this.collisionCache.get(furnitureId) || false
    }

    this.lastCheckTime = now

    const result = this.checkFurnitureCollisionOptimized(furnitureId, furnitureBox)
    this.collisionCache.set(furnitureId, result)

    return result
  }

  private checkFurnitureCollisionOptimized(currentFurnitureId: string, furnitureBox: THREE.Box3): boolean {
    const candidates = this.spatialHash.query(furnitureBox, currentFurnitureId)

    for (const id of candidates) {
      const box = this.furnitureObjects.get(id)
      if (box && furnitureBox.intersectsBox(box)) {
        return true
      }
    }

    return false
  }

  snapToFloor(position: THREE.Vector3): number | null {
    if (!this.backgroundMesh) return null

    const rayOrigin = new THREE.Vector3(position.x, position.y + 10, position.z)
    this.raycaster.set(rayOrigin, new THREE.Vector3(0, -1, 0))

    const intersects = this.raycaster.intersectObject(this.backgroundMesh, true)

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

    const candidatePositions: THREE.Vector3[] = []
    const baseOffset = Math.max(backgroundSize.x, backgroundSize.z) / 2 + 1
    const spacing = Math.max(furnitureSize.x, furnitureSize.z) + 0.8

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

    candidatePositions.push(
      new THREE.Vector3(backgroundCenter.x, backgroundBox.max.y + furnitureSize.y / 2 + 0.1, backgroundCenter.z),
    )

    const padding = 0.3
    const paddedSize = new THREE.Vector3(
      furnitureSize.x + padding,
      furnitureSize.y + padding,
      furnitureSize.z + padding,
    )

    for (const pos of candidatePositions) {
      const testBox = new THREE.Box3().setFromCenterAndSize(pos, paddedSize)

      let hasCollision = false
      const candidates = this.spatialHash.query(testBox)
      for (const id of candidates) {
        const box = this.furnitureObjects.get(id)
        if (box && testBox.intersectsBox(box)) {
          hasCollision = true
          break
        }
      }

      if (!hasCollision) {
        const floorY = this.snapToFloor(pos)
        if (floorY !== null) {
          return new THREE.Vector3(pos.x, floorY + furnitureSize.y / 2 + 0.05, pos.z)
        }
        return pos
      }
    }

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
      backgroundCenter.z + Math.floor(this.nextPlacementOffset / 3) - 1,
    )
  }

  findValidPositionInside(furnitureSize: THREE.Vector3): THREE.Vector3 | null {
    if (!this.backgroundMesh) {
      return new THREE.Vector3(0, 0, 0)
    }

    const backgroundBox = new THREE.Box3().setFromObject(this.backgroundMesh)
    const backgroundCenter = new THREE.Vector3()
    backgroundBox.getCenter(backgroundCenter)

    // Use backgroundBox.min.y as floor since geometry may be centered
    const floorY = backgroundBox.min.y
    console.log("[v0] findValidPositionInside - using floorY:", floorY, "(backgroundBox.min.y)")

    // First, try the center position (only check furniture collision)
    const centerPos = new THREE.Vector3(backgroundCenter.x, floorY, backgroundCenter.z)
    console.log("[v0] Trying center position:", centerPos.x, centerPos.y, centerPos.z)
    if (this.checkFurnitureOnlyCollision(centerPos, furnitureSize)) {
      return centerPos
    }

    // Simple grid search with limited iterations (max 25 positions)
    const step = Math.max(furnitureSize.x, furnitureSize.z) + 0.5
    const maxIterations = 25
    let iterations = 0

    for (let ring = 1; ring <= 3 && iterations < maxIterations; ring++) {
      const radius = ring * step
      const pointsInRing = 8

      for (let i = 0; i < pointsInRing && iterations < maxIterations; i++) {
        iterations++
        const angle = (i / pointsInRing) * Math.PI * 2
        const x = backgroundCenter.x + Math.cos(angle) * radius
        const z = backgroundCenter.z + Math.sin(angle) * radius

        const testPos = new THREE.Vector3(x, floorY, z)
        if (this.checkFurnitureOnlyCollision(testPos, furnitureSize)) {
          return testPos
        }
      }
    }

    // Fallback: place with offset from center
    const offset = this.furnitureObjects.size * step * 0.3
    return new THREE.Vector3(backgroundCenter.x + offset, floorY, backgroundCenter.z + offset)
  }

  private checkFurnitureOnlyCollision(position: THREE.Vector3, furnitureSize: THREE.Vector3): boolean {
    const testBox = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(position.x, position.y + furnitureSize.y / 2, position.z),
      furnitureSize,
    )

    // Only check collision with existing furniture (fast)
    const candidates = this.spatialHash.query(testBox)
    for (const id of candidates) {
      const box = this.furnitureObjects.get(id)
      if (box && testBox.intersectsBox(box)) {
        return false // Collision with other furniture
      }
    }

    return true // No collision
  }

  getFloorHeightAt(x: number, z: number): number | null {
    // Try to get from the floor height grid first
    const key = this.getGridKey(x, z)
    const gridHeight = this.floorHeightGrid.get(key)

    if (gridHeight !== undefined) {
      return gridHeight
    }

    // If not in grid, sample directly
    const sampledHeight = this.sampleFloorHeight(x, z)
    if (sampledHeight !== null) {
      return sampledHeight
    }

    // Fallback to cached floor height
    return this.cachedFloorHeight
  }

  checkCollisionFull(furnitureId: string, furnitureBox: THREE.Box3): boolean {
    // Check collision with other furniture using spatial hash
    const candidates = this.spatialHash.query(furnitureBox, furnitureId)

    for (const id of candidates) {
      const box = this.furnitureObjects.get(id)
      if (box && furnitureBox.intersectsBox(box)) {
        return true
      }
    }

    // Check if furniture is inside the background mesh bounds
    if (this.backgroundBounds) {
      const center = new THREE.Vector3()
      furnitureBox.getCenter(center)

      // Allow some tolerance for placement
      const tolerance = 0.1
      const expandedBounds = this.backgroundBounds.clone()
      expandedBounds.expandByScalar(tolerance)

      // Check if the furniture center is reasonably within bounds
      // (We don't want to be too strict to allow flexibility)
      if (!expandedBounds.containsPoint(center)) {
        // Only return collision if significantly outside
        const distance = center.distanceTo(
          new THREE.Vector3().copy(center).clamp(this.backgroundBounds.min, this.backgroundBounds.max),
        )
        if (distance > 2.0) {
          return true
        }
      }
    }

    return false
  }
}
