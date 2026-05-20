import { useEffect, useRef, useState } from 'react'

export interface RunEvent {
  status?: string
  run_id?: string
  score?: number
  error?: string
  type?: string
  [key: string]: unknown
}

export interface ScorePoint {
  step: number
  score: number
}

interface UseRunStreamResult {
  events: RunEvent[]
  connected: boolean
  isDone: boolean
  scores: ScorePoint[]
}

export function useRunStream(runId: string): UseRunStreamResult {
  const [events, setEvents] = useState<RunEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!runId) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/runs/${runId}`)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)

    ws.onmessage = (e) => {
      try {
        const event: RunEvent = JSON.parse(e.data)
        if (event.type === 'ping') return
        setEvents((prev) => [...prev, event])
        if (event.status === 'done' || event.status === 'failed') {
          setIsDone(true)
          setConnected(false)
        }
      } catch {
        // ignore malformed frames
      }
    }

    ws.onclose = () => setConnected(false)
    ws.onerror = () => setConnected(false)

    return () => ws.close()
  }, [runId])

  const scores: ScorePoint[] = events
    .filter((e) => e.score !== undefined)
    .map((e, i) => ({ step: i + 1, score: e.score as number }))

  return { events, connected, isDone, scores }
}
