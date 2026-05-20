import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import NavBar from '../components/NavBar'
import {
  AGENT_COLORS, Alert, Btn, C, Card, PageHeader,
  ScoreChip, StatCard, StatusBadge, TaskBadge,
} from '../components/ui'

interface EvalRun {
  id: string
  agent_id: string
  task_id: string
  status: string
  input_used: Record<string, unknown>
  output: string | null
  score: number | null
  latency_ms: number | null
  tokens_used: number | null
  cost_usd: number | null
  error: string | null
  reasoning_steps: unknown[]
  created_at: string
  completed_at: string | null
}

interface Task {
  id: string; name: string; category: string
  metadata: { rubric?: string; inputs?: Record<string, unknown>[] }
}

interface Experiment {
  id: string; name: string; agent_ids: string[]; task_ids: string[]
  runs_per_combo: number; status: string; created_at: string
}
interface ExperimentDetail { experiment: Experiment; runs: EvalRun[] }

export default function Experiment() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData]           = useState<ExperimentDetail | null>(null)
  const [agentNames, setAgentNames] = useState<Record<string, string>>({})
  const [taskNames, setTaskNames]   = useState<Record<string, string>>({})
  const [tasks, setTasks]            = useState<Record<string, Task>>({})
  const [expanded, setExpanded]     = useState<Set<string>>(new Set())
  const [error, setError]           = useState<string | null>(null)

  const fetchData = () => {
    fetch(`/api/experiments/${id}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(setData)
      .catch(e => setError(e.message))
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 3000)
    return () => clearInterval(interval)
  }, [id])

  useEffect(() => {
    fetch('/api/agents').then(r => r.json()).then(agents => {
      const map: Record<string, string> = {}
      for (const a of agents) map[a.id] = a.name
      setAgentNames(map)
    })
    fetch('/api/tasks').then(r => r.json()).then((allTasks: Task[]) => {
      const nameMap: Record<string, string> = {}
      const taskMap: Record<string, Task> = {}
      for (const t of allTasks) { nameMap[t.id] = t.name; taskMap[t.id] = t }
      setTaskNames(nameMap)
      setTasks(taskMap)
    })
  }, [])

  const toggle = (runId: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(runId) ? next.delete(runId) : next.add(runId)
      return next
    })
  }

  const deleteExperiment = async () => {
    if (!confirm(`Delete "${data?.experiment.name}" and all its runs?`)) return
    await fetch(`/api/experiments/${id}`, { method: 'DELETE' })
    navigate('/experiments')
  }

  if (error) return <><NavBar /><div className="page"><Alert message={error} /></div></>
  if (!data) return <><NavBar /><div className="page" style={{ color: C.gray400 }}>Loading…</div></>

  const { experiment, runs } = data
  const doneRuns    = runs.filter(r => r.status === 'done')
  const scoredRuns  = doneRuns.filter(r => r.score !== null)
  const totalCost   = runs.reduce((s, r) => s + (r.cost_usd ?? 0), 0)
  const avgLatencyMs = doneRuns.length > 0
    ? doneRuns.reduce((s, r) => s + (r.latency_ms ?? 0), 0) / doneRuns.length : 0
  const avgScore = scoredRuns.length > 0
    ? scoredRuns.reduce((s, r) => s + r.score!, 0) / scoredRuns.length : null
  const progressPct = runs.length > 0 ? Math.round(doneRuns.length / runs.length * 100) : 0

  const agentStats = experiment.agent_ids.map((aid, i) => {
    const ar = runs.filter(r => r.agent_id === aid)
    const ad = ar.filter(r => r.status === 'done')
    const as_ = ad.filter(r => r.score !== null)
    return {
      id: aid,
      name: agentNames[aid] ?? aid.slice(0, 8) + '…',
      color: AGENT_COLORS[i % AGENT_COLORS.length],
      total: ar.length, done: ad.length,
      avgScore: as_.length > 0 ? as_.reduce((s, r) => s + r.score!, 0) / as_.length : null,
      avgLatency: ad.length > 0 ? ad.reduce((s, r) => s + (r.latency_ms ?? 0), 0) / ad.length / 1000 : 0,
      totalCost: ar.reduce((s, r) => s + (r.cost_usd ?? 0), 0),
    }
  })

  return (
    <>
      <NavBar />
      <div className="page">
        <PageHeader
          title={experiment.name}
          back={<Link to="/experiments" style={{ fontSize: 13, color: C.gray500 }}>← Experiments</Link>}
          actions={
            <>
              <StatusBadge status={experiment.status} />
              <Btn variant="danger" onClick={deleteExperiment} style={{ fontSize: 13 }}>
                Delete
              </Btn>
            </>
          }
        />

        {/* Task chips */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {experiment.task_ids.map(tid => (
            <TaskBadge key={tid} name={taskNames[tid] ?? tid.slice(0, 8) + '…'} />
          ))}
        </div>
        <p style={{ fontSize: 13, color: C.gray400, marginBottom: 24 }}>
          {new Date(experiment.created_at).toLocaleString()}
          &nbsp;·&nbsp;{experiment.agent_ids.length} agent{experiment.agent_ids.length !== 1 ? 's' : ''}
          &nbsp;·&nbsp;{experiment.runs_per_combo} run{experiment.runs_per_combo !== 1 ? 's' : ''}/combo
        </p>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
          <StatCard label="Runs done" value={`${doneRuns.length} / ${runs.length}`} />
          {avgScore !== null && <StatCard label="Avg score" value={`${(avgScore * 100).toFixed(1)}%`} />}
          <StatCard label="Total cost" value={`$${totalCost.toFixed(4)}`} />
          {avgLatencyMs > 0 && <StatCard label="Avg latency" value={`${(avgLatencyMs / 1000).toFixed(1)}s`} />}
        </div>

        {/* Scoring criteria */}
        {experiment.task_ids.some(tid => tasks[tid]?.metadata?.rubric) && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: C.gray900 }}>
              Scoring Criteria
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {experiment.task_ids.map(tid => {
                const task = tasks[tid]
                if (!task?.metadata?.rubric) return null
                return (
                  <Card key={tid} style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <TaskBadge name={task.name} />
                      <span style={{ fontSize: 13, color: C.gray500, lineHeight: 1.5 }}>
                        {task.metadata.rubric}
                      </span>
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {/* Progress bar */}
        {experiment.status !== 'done' && runs.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, color: C.gray500, marginBottom: 6 }}>
              Progress — {doneRuns.length}/{runs.length} ({progressPct}%)
            </div>
            <div style={{ background: C.gray200, borderRadius: 9999, height: 6 }}>
              <div style={{
                background: C.blue600, height: '100%', borderRadius: 9999,
                width: `${progressPct}%`, transition: 'width 0.5s',
              }} />
            </div>
          </div>
        )}

        {/* Agent comparison */}
        {experiment.agent_ids.length > 1 && (
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: C.gray900 }}>
              Agent Comparison
            </h2>
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <Card style={{ flex: '1 1 360px' }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th className="r">Done</th>
                      <th className="r">Avg Score</th>
                      <th className="r">Avg Latency</th>
                      <th className="r">Total Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentStats.map(a => (
                      <tr key={a.id}>
                        <td>
                          <span style={{
                            display: 'inline-block', width: 8, height: 8,
                            borderRadius: '50%', background: a.color, marginRight: 8,
                          }} />
                          <span style={{ fontWeight: 500 }}>{a.name}</span>
                        </td>
                        <td className="r" style={{ color: C.gray500 }}>{a.done}/{a.total}</td>
                        <td className="r">
                          {a.avgScore !== null ? <ScoreChip score={a.avgScore} /> : <span style={{ color: C.gray300 }}>—</span>}
                        </td>
                        <td className="r" style={{ color: C.gray500 }}>
                          {a.avgLatency > 0 ? `${a.avgLatency.toFixed(1)}s` : '—'}
                        </td>
                        <td className="r" style={{ color: C.gray500 }}>${a.totalCost.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              <Card style={{ padding: 20, flex: '0 0 300px' }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: C.gray500, marginBottom: 12 }}>
                  AVG SCORE BY AGENT
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={agentStats.map(a => ({ name: a.name, score: a.avgScore !== null ? Math.round(a.avgScore * 100) : 0, color: a.color }))}
                    margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.gray500 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: C.gray500 }} unit="%" />
                    <Tooltip formatter={(v) => `${v}%`} contentStyle={{ borderRadius: 6, border: `1px solid ${C.gray200}`, fontSize: 13 }} />
                    <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                      {agentStats.map((a, i) => <Cell key={i} fill={a.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </div>
        )}

        {/* Runs */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: C.gray900 }}>
            Runs <span style={{ color: C.gray400, fontWeight: 400, fontSize: 14 }}>({runs.length})</span>
          </h2>
        </div>

        <Card>
          {runs.map((run, idx) => {
            const isOpen = expanded.has(run.id)
            const agentIdx = experiment.agent_ids.indexOf(run.agent_id)
            const agentColor = AGENT_COLORS[agentIdx % AGENT_COLORS.length]

            return (
              <div key={run.id} style={{ borderBottom: idx < runs.length - 1 ? `1px solid ${C.gray100}` : 'none' }}>
                <div
                  onClick={() => toggle(run.id)}
                  style={{
                    padding: '12px 16px', cursor: 'pointer',
                    display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
                    background: isOpen ? C.gray50 : '#fff',
                  }}
                >
                  <span style={{ color: C.gray300, fontSize: 13, minWidth: 28 }}>#{idx + 1}</span>

                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: agentColor, flexShrink: 0,
                  }} />

                  <span style={{ fontWeight: 500, color: C.gray900, minWidth: 140, fontSize: 14 }}>
                    {agentNames[run.agent_id] ?? run.agent_id.slice(0, 8)}
                  </span>

                  <TaskBadge name={taskNames[run.task_id] ?? run.task_id.slice(0, 8)} />

                  <StatusBadge status={run.status} />

                  {run.score !== null && <ScoreChip score={run.score} />}

                  {run.latency_ms != null && (
                    <span style={{ fontSize: 13, color: C.gray400 }}>{(run.latency_ms / 1000).toFixed(1)}s</span>
                  )}
                  {run.cost_usd != null && (
                    <span style={{ fontSize: 13, color: C.gray400 }}>${run.cost_usd.toFixed(4)}</span>
                  )}
                  {run.tokens_used != null && (
                    <span style={{ fontSize: 12, color: C.gray300 }}>{run.tokens_used} tok</span>
                  )}

                  <span style={{ marginLeft: 'auto', color: C.gray300, fontSize: 12 }}>
                    {isOpen ? '▲' : '▼'}
                  </span>
                </div>

                {isOpen && (
                  <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${C.gray100}` }}>
                    {(() => {
                      const expectedOutput = run.input_used?.expected_output as string | undefined
                      const inputWithout = { ...run.input_used }
                      delete inputWithout.expected_output
                      const cols = expectedOutput ? 3 : 2
                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16, marginTop: 16 }}>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: C.gray400, marginBottom: 6, letterSpacing: '0.06em' }}>INPUT</div>
                            <pre className="codeblock">{JSON.stringify(inputWithout, null, 2)}</pre>
                          </div>
                          {expectedOutput && (
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: C.blue600, marginBottom: 6, letterSpacing: '0.06em' }}>EXPECTED</div>
                              <pre className="codeblock" style={{ borderColor: C.blue600, background: '#eff6ff' }}>{expectedOutput}</pre>
                            </div>
                          )}
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: C.gray400, marginBottom: 6, letterSpacing: '0.06em' }}>OUTPUT</div>
                            <pre className="codeblock">{run.output ?? '(no output yet)'}</pre>
                          </div>
                        </div>
                      )
                    })()}

                    {run.error && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#b91c1c', marginBottom: 6, letterSpacing: '0.06em' }}>
                          ERROR
                        </div>
                        <pre className="codeblock error">{run.error}</pre>
                      </div>
                    )}

                    {run.reasoning_steps.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: C.gray400, marginBottom: 6, letterSpacing: '0.06em' }}>
                          REASONING STEPS ({run.reasoning_steps.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {run.reasoning_steps.map((step, i) => (
                            <pre key={i} className="codeblock">
                              {typeof step === 'string' ? step : JSON.stringify(step, null, 2)}
                            </pre>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ marginTop: 12, fontSize: 12, color: C.gray400, display: 'flex', gap: 20 }}>
                      <span>Started: {new Date(run.created_at).toLocaleTimeString()}</span>
                      {run.completed_at && (
                        <span>Completed: {new Date(run.completed_at).toLocaleTimeString()}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </Card>
      </div>
    </>
  )
}
