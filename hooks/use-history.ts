"use client"

import { useState, useCallback, useRef } from "react"

interface HistoryState<T> {
  past: T[]
  present: T
  future: T[]
}

export function useHistory<T>(initialState: T, maxHistory = 50) {
  const [history, setHistory] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: [],
  })

  // Track if the last action was from undo/redo to avoid double recording
  const isUndoRedoAction = useRef(false)

  const canUndo = history.past.length > 0
  const canRedo = history.future.length > 0

  const set = useCallback(
    (newState: T | ((prev: T) => T)) => {
      setHistory((prev) => {
        const nextState = typeof newState === "function" ? (newState as (prev: T) => T)(prev.present) : newState

        // Skip if the state hasn't changed
        if (JSON.stringify(nextState) === JSON.stringify(prev.present)) {
          return prev
        }

        // Skip recording if this is from an undo/redo action
        if (isUndoRedoAction.current) {
          isUndoRedoAction.current = false
          return { ...prev, present: nextState }
        }

        // Limit history size
        const newPast = [...prev.past, prev.present].slice(-maxHistory)

        return {
          past: newPast,
          present: nextState,
          future: [], // Clear future when new action is taken
        }
      })
    },
    [maxHistory],
  )

  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.past.length === 0) return prev

      const newPast = prev.past.slice(0, -1)
      const previousState = prev.past[prev.past.length - 1]

      isUndoRedoAction.current = true

      return {
        past: newPast,
        present: previousState,
        future: [prev.present, ...prev.future],
      }
    })
  }, [])

  const redo = useCallback(() => {
    setHistory((prev) => {
      if (prev.future.length === 0) return prev

      const [nextState, ...newFuture] = prev.future

      isUndoRedoAction.current = true

      return {
        past: [...prev.past, prev.present],
        present: nextState,
        future: newFuture,
      }
    })
  }, [])

  const reset = useCallback((newState: T) => {
    setHistory({
      past: [],
      present: newState,
      future: [],
    })
  }, [])

  return {
    state: history.present,
    set,
    undo,
    redo,
    reset,
    canUndo,
    canRedo,
  }
}
