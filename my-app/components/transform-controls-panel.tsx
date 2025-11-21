'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Move, RotateCw, Maximize2 } from 'lucide-react'

interface TransformControlsPanelProps {
  mode: 'translate' | 'rotate' | 'scale'
  onModeChange: (mode: 'translate' | 'rotate' | 'scale') => void
  selectedId: string | null
}

export function TransformControlsPanel({
  mode,
  onModeChange,
  selectedId,
}: TransformControlsPanelProps) {
  if (!selectedId) return null

  return (
    <Card className="absolute top-4 left-1/2 -translate-x-1/2 p-2 flex gap-2 bg-card/95 backdrop-blur-sm z-50 pointer-events-auto">
      <Button
        size="sm"
        variant={mode === 'translate' ? 'default' : 'outline'}
        onClick={() => {
          console.log('[v0] Translate button clicked')
          onModeChange('translate')
        }}
        className="gap-2"
      >
        <Move className="w-4 h-4" />
        이동
      </Button>
      <Button
        size="sm"
        variant={mode === 'rotate' ? 'default' : 'outline'}
        onClick={() => {
          console.log('[v0] Rotate button clicked')
          onModeChange('rotate')
        }}
        className="gap-2"
      >
        <RotateCw className="w-4 h-4" />
        회전
      </Button>
      <Button
        size="sm"
        variant={mode === 'scale' ? 'default' : 'outline'}
        onClick={() => {
          console.log('[v0] Scale button clicked')
          onModeChange('scale')
        }}
        className="gap-2"
      >
        <Maximize2 className="w-4 h-4" />
        크기
      </Button>
    </Card>
  )
}
