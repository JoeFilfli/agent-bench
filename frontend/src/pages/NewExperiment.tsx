import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { Alert, Btn, C, Card, CategoryBadge, Field, PageHeader, TypeBadge, inputStyle } from '../components/ui'

interface Agent { id: string; name: string; graph_config: Record<string, unknown> }
interface Task  { id: string; name: string; category: string; scoring_fn: string }

export default function NewExperiment() {
  const navigate = useNavigate()
  const [agents, setAgents] = useState<Agent[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set())
  const [selectedTasks, setSelectedTasks]   = useState<Set<string>>(new Set())
  const [name, setName] = useState('')
  const [runsPerCombo, setRunsPerCombo] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/agents').then(r => r.json()).then(setAgents)
    fetch('/api/tasks').then(r => r.json()).then(setTasks)
  }, [])

  const toggle = (id: string, set: Set<string>, setter: (s: Set<string>) => void) => {
    const next = new Set(set)
    next.has(id) ? next.delete(id) : next.add(id)
    setter(next)
  }

  const toggleAllTasks = (catTasks: Task[]) => {
    const ids = catTasks.map(t => t.id)
    const allSelected = ids.every(id => selectedTasks.has(id))
    const next = new Set(selectedTasks)
    ids.forEach(id => allSelected ? next.delete(id) : next.add(id))
    setSelectedTasks(next)
  }

  const totalRuns = selectedAgents.size * selectedTasks.size * runsPerCombo

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedAgents.size === 0 || selectedTasks.size === 0) {
      setError('Select at least one agent and one task.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || 'Experiment',
          agent_ids: Array.from(selectedAgents),
          task_ids: Array.from(selectedTasks),
          runs_per_combo: runsPerCombo,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
      const data = await res.json()
      navigate(`/experiments/${data.experiment_id}`)
    } catch (e) {
      setError((e as Error).message)
      setSubmitting(false)
    }
  }

  const grouped: Record<string, Task[]> = {}
  for (const t of tasks) {
    if (!grouped[t.category]) grouped[t.category] = []
    grouped[t.category].push(t)
  }

  const selCard = (selected: boolean): React.CSSProperties => ({
    border: `1px solid ${selected ? C.blue600 : C.gray200}`,
    borderRadius: 6, padding: '10px 14px',
    marginBottom: 6, display: 'flex', alignItems: 'flex-start', gap: 10,
    cursor: 'pointer', background: selected ? C.blue50 : '#fff',
    transition: 'all 0.12s',
  })

  return (
    <>
      <NavBar />
      <div className="page" style={{ maxWidth: 1100 }}>
        <PageHeader
          title="New Experiment"
          subtitle="Select agents and tasks to benchmark. Results stream live as they complete."
        />

        {error && <Alert message={error} />}

        <form onSubmit={handleSubmit}>
          <Card style={{ padding: 24, marginBottom: 24 }}>
            <Field label="Experiment name">
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Experiment"
                style={{ ...inputStyle, maxWidth: 480 }}
                className="inp"
              />
            </Field>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
            {/* Agents */}
            <Card style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ fontSize: 15, fontWeight: 600, color: C.gray900 }}>Agents</h2>
                <span style={{ fontSize: 13, color: C.gray400 }}>{selectedAgents.size} selected</span>
              </div>

              {agents.length === 0 ? (
                <p style={{ color: C.gray400, fontSize: 14 }}>
                  No agents yet. <a href="/agents">Create one first.</a>
                </p>
              ) : agents.map(a => {
                const selected = selectedAgents.has(a.id)
                return (
                  <div key={a.id} onClick={() => toggle(a.id, selectedAgents, setSelectedAgents)}
                    style={selCard(selected)}>
                    <div style={{
                      width: 16, height: 16, borderRadius: 4, marginTop: 1, flexShrink: 0,
                      border: `2px solid ${selected ? C.blue600 : C.gray300}`,
                      background: selected ? C.blue600 : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {selected && <span style={{ color: '#fff', fontSize: 10, lineHeight: 1 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, color: C.gray900, marginBottom: 4 }}>{a.name}</div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <TypeBadge type={String(a.graph_config.type)} />
                        <span style={{ fontSize: 12, color: C.gray400, fontFamily: 'var(--mono)' }}>
                          {String(a.graph_config.model ?? '—')}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </Card>

            {/* Tasks */}
            <Card style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ fontSize: 15, fontWeight: 600, color: C.gray900 }}>Tasks</h2>
                <span style={{ fontSize: 13, color: C.gray400 }}>{selectedTasks.size} selected</span>
              </div>

              {Object.entries(grouped).sort().map(([category, catTasks]) => {
                const allSelected = catTasks.every(t => selectedTasks.has(t.id))
                return (
                  <div key={category} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <CategoryBadge category={category} />
                      <button type="button" onClick={() => toggleAllTasks(catTasks)}
                        style={{
                          fontSize: 12, color: C.blue600, background: 'none',
                          border: 'none', cursor: 'pointer', padding: 0, fontWeight: 500,
                        }}>
                        {allSelected ? 'deselect all' : 'select all'}
                      </button>
                    </div>
                    {catTasks.map(t => {
                      const selected = selectedTasks.has(t.id)
                      return (
                        <div key={t.id} onClick={() => toggle(t.id, selectedTasks, setSelectedTasks)}
                          style={selCard(selected)}>
                          <div style={{
                            width: 16, height: 16, borderRadius: 4, marginTop: 1, flexShrink: 0,
                            border: `2px solid ${selected ? C.blue600 : C.gray300}`,
                            background: selected ? C.blue600 : '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {selected && <span style={{ color: '#fff', fontSize: 10, lineHeight: 1 }}>✓</span>}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 500, color: C.gray900, marginBottom: 2 }}>{t.name}</div>
                            <span style={{
                              fontSize: 11, color: C.gray400,
                              fontFamily: 'var(--mono)',
                            }}>{t.scoring_fn}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </Card>
          </div>

          {/* Footer bar */}
          <Card style={{ padding: '16px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: C.gray700 }}>
                <span style={{ fontWeight: 500 }}>Runs per combination</span>
                <input
                  type="number" min={1} max={20} value={runsPerCombo}
                  onChange={e => setRunsPerCombo(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ ...inputStyle, width: 72 }}
                  className="inp"
                />
              </label>

              {totalRuns > 0 && (
                <span style={{ fontSize: 13, color: C.gray500 }}>
                  <strong style={{ color: C.gray900 }}>{totalRuns}</strong> total runs
                  &nbsp;({selectedAgents.size} agents × {selectedTasks.size} tasks × {runsPerCombo})
                </span>
              )}

              <div style={{ marginLeft: 'auto' }}>
                <Btn
                  type="submit"
                  variant="primary"
                  disabled={submitting || selectedAgents.size === 0 || selectedTasks.size === 0}
                  style={{ padding: '9px 20px', fontSize: 14 }}
                >
                  {submitting ? 'Launching…' : `▶ Run ${totalRuns > 0 ? totalRuns : ''} eval${totalRuns !== 1 ? 's' : ''}`}
                </Btn>
              </div>
            </div>
          </Card>
        </form>
      </div>
    </>
  )
}
