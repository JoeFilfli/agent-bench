import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { Alert, C, Card, PageHeader, ScoreChip } from '../components/ui'

interface LeaderboardEntry {
  agent_id: string
  agent_name: string
  elo_score: number
  win_rate: number
  avg_score: number
  avg_latency_ms: number
  total_runs: number
  total_cost_usd: number
  snapshot_at: string
}

type SortKey = keyof LeaderboardEntry
type SortDir = 'asc' | 'desc'

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [sortKey, setSortKey] = useState<SortKey>('elo_score')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const fetchLeaderboard = () => {
    fetch('/api/leaderboard')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(setEntries)
      .catch(e => setError(e.message))
  }

  useEffect(() => {
    fetchLeaderboard()
    const interval = setInterval(fetchLeaderboard, 5000)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/leaderboard`)
    wsRef.current = ws
    ws.onmessage = () => fetchLeaderboard()
    return () => { clearInterval(interval); ws.close() }
  }, [])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = [...entries].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey]
    if (typeof av === 'number' && typeof bv === 'number')
      return sortDir === 'asc' ? av - bv : bv - av
    return sortDir === 'asc'
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av))
  })

  const SortTh = ({ k, label, align = 'left' }: { k: SortKey; label: string; align?: string }) => (
    <th
      className={align === 'right' ? 'r' : ''}
      onClick={() => toggleSort(k)}
      style={{ cursor: 'pointer', userSelect: 'none' }}
    >
      {label}{' '}
      {sortKey === k && (
        <span style={{ color: C.blue600 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
      )}
    </th>
  )

  return (
    <>
      <NavBar />
      <div className="page">
        <PageHeader
          title="Leaderboard"
          subtitle="Ranked by ELO score. Updates live as experiments complete."
        />

        {error && <Alert message={error} />}

        <Card>
          {sorted.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: C.gray400 }}>
              No agents have completed runs yet.
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 32, paddingRight: 0 }}>#</th>
                  <SortTh k="agent_name" label="Agent" />
                  <SortTh k="elo_score" label="ELO" align="right" />
                  <SortTh k="win_rate" label="Win rate" align="right" />
                  <SortTh k="avg_score" label="Avg score" align="right" />
                  <SortTh k="avg_latency_ms" label="Avg latency" align="right" />
                  <SortTh k="total_runs" label="Runs" align="right" />
                  <SortTh k="total_cost_usd" label="Cost" align="right" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((e, i) => (
                  <tr key={e.agent_id}>
                    <td style={{ color: C.gray400, paddingRight: 0, width: 32 }}>{i + 1}</td>
                    <td style={{ fontWeight: 500 }}>
                      <Link to={`/agents/${e.agent_id}`} style={{ color: C.gray900 }}>
                        {e.agent_name}
                      </Link>
                    </td>
                    <td className="r" style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {e.elo_score.toFixed(1)}
                    </td>
                    <td className="r">{(e.win_rate * 100).toFixed(1)}%</td>
                    <td className="r"><ScoreChip score={e.avg_score} /></td>
                    <td className="r" style={{ color: C.gray500 }}>{e.avg_latency_ms.toFixed(0)} ms</td>
                    <td className="r" style={{ color: C.gray500 }}>{e.total_runs}</td>
                    <td className="r" style={{ color: C.gray500 }}>${e.total_cost_usd.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  )
}
