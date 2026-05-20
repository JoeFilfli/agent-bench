import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import NavBar from '../components/NavBar'
import { AGENT_COLORS, Alert, C, Card, PageHeader } from '../components/ui'

interface CategoryBreakdown {
  category: string
  avg_score: number
  total_runs: number
}

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>()
  const [breakdown, setBreakdown] = useState<CategoryBreakdown[]>([])
  const [agentName, setAgentName] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/leaderboard/${id}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(setBreakdown)
      .catch(e => setError(e.message))

    fetch('/api/agents')
      .then(r => r.json())
      .then((agents: { id: string; name: string }[]) => {
        const a = agents.find(a => a.id === id)
        if (a) setAgentName(a.name)
      })
  }, [id])

  return (
    <>
      <NavBar />
      <div className="page">
        <PageHeader
          title={agentName || 'Agent Detail'}
          subtitle={`ID: ${id}`}
          back={<Link to="/" style={{ fontSize: 13, color: C.gray500 }}>← Leaderboard</Link>}
        />

        {error && <Alert message={error} />}

        {breakdown.length === 0 ? (
          <Card>
            <div style={{ padding: '48px 24px', textAlign: 'center', color: C.gray400 }}>
              No completed runs yet.
            </div>
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
            <Card style={{ padding: 24 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: C.gray900, marginBottom: 20 }}>
                Avg score by category
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={breakdown} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.gray100} />
                  <XAxis dataKey="category" tick={{ fontSize: 12, fill: C.gray500 }} />
                  <YAxis domain={[0, 1]} tick={{ fontSize: 12, fill: C.gray500 }}
                    tickFormatter={v => `${(v * 100).toFixed(0)}%`} />
                  <Tooltip
                    formatter={(v) => typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : v}
                    contentStyle={{ borderRadius: 6, border: `1px solid ${C.gray200}`, fontSize: 13 }}
                  />
                  <Bar dataKey="avg_score" radius={[4, 4, 0, 0]}>
                    {breakdown.map((_, i) => (
                      <Cell key={i} fill={AGENT_COLORS[i % AGENT_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th className="r">Avg Score</th>
                    <th className="r">Runs</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((b, i) => (
                    <tr key={b.category}>
                      <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                          background: AGENT_COLORS[i % AGENT_COLORS.length],
                          display: 'inline-block',
                        }} />
                        {b.category}
                      </td>
                      <td className="r" style={{ fontWeight: 600 }}>
                        {(b.avg_score * 100).toFixed(1)}%
                      </td>
                      <td className="r" style={{ color: C.gray500 }}>{b.total_runs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}
      </div>
    </>
  )
}
