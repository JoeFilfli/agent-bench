import { useParams } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import NavBar from '../components/NavBar'
import { C, Card, PageHeader, StatusBadge } from '../components/ui'
import { useRunStream } from '../hooks/useRunStream'

export default function RunMonitor() {
  const { id } = useParams<{ id: string }>()
  const { events, connected, isDone, scores } = useRunStream(id ?? '')

  const status = isDone
    ? events.some(e => e.status === 'failed') ? 'failed' : 'done'
    : connected ? 'running' : 'pending'

  return (
    <>
      <NavBar />
      <div className="page">
        <PageHeader
          title="Run Monitor"
          subtitle={`run: ${id}`}
          actions={<StatusBadge status={status} />}
        />

        {scores.length > 0 && (
          <Card style={{ padding: 24, marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.gray500, marginBottom: 16, letterSpacing: '0.06em' }}>
              SCORE OVER TIME
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={scores}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.gray100} />
                <XAxis dataKey="step" tick={{ fontSize: 12, fill: C.gray400 }}
                  label={{ value: 'event', position: 'insideBottom', offset: -2, fontSize: 12 }} />
                <YAxis domain={[0, 1]} tick={{ fontSize: 12, fill: C.gray400 }} />
                <Tooltip contentStyle={{ borderRadius: 6, border: `1px solid ${C.gray200}`, fontSize: 13 }} />
                <Line type="monotone" dataKey="score" stroke={C.blue600} dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}

        <Card>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.gray100}`, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.gray700 }}>Event log</span>
            <span style={{ fontSize: 13, color: C.gray400 }}>{events.length} events</span>
          </div>
          <div style={{
            background: C.gray900, color: '#e5e7eb',
            padding: '14px 16px', borderRadius: '0 0 8px 8px',
            maxHeight: 420, overflowY: 'auto',
            fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.7,
          }}>
            {events.length === 0 && !isDone && (
              <span style={{ color: C.gray500 }}>Waiting for events…</span>
            )}
            {events.map((e, i) => (
              <div key={i} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)`, paddingBottom: 2 }}>
                <span style={{ color: C.gray500 }}>{String(i + 1).padStart(3, '0')} </span>
                {JSON.stringify(e)}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}
