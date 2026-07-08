import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { Alert, Btn, C, Card, Field, PageHeader, TypeBadge, inputStyle } from '../components/ui'

interface Agent {
  id: string
  name: string
  graph_config: Record<string, unknown>
  created_at: string
}

interface SubAgentCfg {
  model: string
  temperature: number
  system_prompt: string
}

interface StageCfg extends SubAgentCfg {
  role: string
}

interface WorkerCfg extends SubAgentCfg {
  role: string
  tools: string[]
}

interface ReactCfg extends SubAgentCfg {
  type: 'react'
  tools: string[]
}

interface PipelineCfg {
  type: 'pipeline'
  agents: StageCfg[]
}

interface DebateCfg {
  type: 'debate'
  rounds: number
  agents: [StageCfg, StageCfg]
  judge: SubAgentCfg
}

interface SupervisorCfg {
  type: 'supervisor'
  orchestrator: SubAgentCfg
  workers: WorkerCfg[]
}

const MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']
const TOOLS = ['calculator', 'code_exec', 'web_search']
const AGENT_TYPES = ['react', 'pipeline', 'debate', 'supervisor']

const DEFAULT_SUBAGENT: SubAgentCfg = { model: 'gpt-4o', temperature: 0.0, system_prompt: '' }

const makeStage = (role: string): StageCfg => ({ role, ...DEFAULT_SUBAGENT })
const makeWorker = (role: string): WorkerCfg => ({ role, ...DEFAULT_SUBAGENT, model: 'gpt-4o-mini', tools: [] })

const DEFAULT_REACT: ReactCfg = { type: 'react', ...DEFAULT_SUBAGENT, tools: [] }
const DEFAULT_PIPELINE: PipelineCfg = { type: 'pipeline', agents: [makeStage('stage_1')] }
const DEFAULT_DEBATE: DebateCfg = {
  type: 'debate',
  rounds: 3,
  agents: [makeStage('proposer'), makeStage('opposer')],
  judge: { ...DEFAULT_SUBAGENT },
}
const DEFAULT_SUPERVISOR: SupervisorCfg = {
  type: 'supervisor',
  orchestrator: { ...DEFAULT_SUBAGENT },
  workers: [makeWorker('worker_1')],
}

// ── Shared sub-agent field group (model / temperature / system prompt / tools) ──
function SubAgentFields({
  cfg, onChange, tools, onToggleTool,
}: {
  cfg: SubAgentCfg
  onChange: (patch: Partial<SubAgentCfg>) => void
  tools?: string[]
  onToggleTool?: (tool: string) => void
}) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Model">
          <select value={cfg.model} onChange={e => onChange({ model: e.target.value })}
            className="inp" style={inputStyle}>
            {MODELS.map(m => <option key={m}>{m}</option>)}
          </select>
        </Field>
        <Field label={`Temperature — ${cfg.temperature}`}>
          <input type="range" min={0} max={1} step={0.1} value={cfg.temperature}
            onChange={e => onChange({ temperature: parseFloat(e.target.value) })}
            style={{ width: '100%', accentColor: C.blue600, marginTop: 10 }} />
        </Field>
      </div>
      <Field label="System Prompt">
        <textarea rows={2} value={cfg.system_prompt}
          onChange={e => onChange({ system_prompt: e.target.value })}
          className="inp" style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
      </Field>
      {onToggleTool && (
        <Field label="Tools">
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {TOOLS.map(t => (
              <label key={t} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                cursor: 'pointer', fontSize: 13, color: C.gray700,
              }}>
                <input type="checkbox" checked={(tools ?? []).includes(t)}
                  onChange={() => onToggleTool(t)} style={{ accentColor: C.blue600 }} />
                {t}
              </label>
            ))}
          </div>
        </Field>
      )}
    </>
  )
}

// ── A titled sub-card used to group one node's config within a builder ──
function SubCard({ title, onRemove, children }: { title: React.ReactNode; onRemove?: () => void; children: React.ReactNode }) {
  return (
    <div style={{ border: `1px solid ${C.gray200}`, borderRadius: 6, padding: 16, marginBottom: 12, background: C.gray50 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.gray700 }}>{title}</div>
        {onRemove && (
          <Btn variant="ghost" onClick={onRemove} style={{ color: C.gray400, padding: '2px 6px' }}>✕</Btn>
        )}
      </div>
      {children}
    </div>
  )
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [agentType, setAgentType] = useState('react')
  const [reactCfg, setReactCfg] = useState<ReactCfg>({ ...DEFAULT_REACT })
  const [pipelineCfg, setPipelineCfg] = useState<PipelineCfg>(DEFAULT_PIPELINE)
  const [debateCfg, setDebateCfg] = useState<DebateCfg>(DEFAULT_DEBATE)
  const [supervisorCfg, setSupervisorCfg] = useState<SupervisorCfg>(DEFAULT_SUPERVISOR)
  const [useAdvancedJson, setUseAdvancedJson] = useState(false)
  const [rawJson, setRawJson] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAgents = () =>
    fetch('/api/agents')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(setAgents)
      .catch(e => setError(e.message))

  useEffect(() => { fetchAgents() }, [])

  const deleteAgent = async (a: Agent) => {
    if (!confirm(`Delete "${a.name}" and all its runs?`)) return
    try {
      const res = await fetch(`/api/agents/${a.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setAgents(prev => prev.filter(x => x.id !== a.id))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const toggleTool = (t: string) =>
    setReactCfg(prev => ({
      ...prev,
      tools: prev.tools.includes(t) ? prev.tools.filter(x => x !== t) : [...prev.tools, t],
    }))

  const changeType = (t: string) => {
    setAgentType(t)
    setUseAdvancedJson(false)
    setJsonError(null)
  }

  const currentStructuredCfg = (): PipelineCfg | DebateCfg | SupervisorCfg =>
    agentType === 'pipeline' ? pipelineCfg : agentType === 'debate' ? debateCfg : supervisorCfg

  const toggleAdvanced = (checked: boolean) => {
    if (checked) setRawJson(JSON.stringify(currentStructuredCfg(), null, 2))
    setUseAdvancedJson(checked)
    setJsonError(null)
  }

  // ── Pipeline builder helpers ──
  const updateStage = (i: number, patch: Partial<StageCfg>) =>
    setPipelineCfg(p => ({ ...p, agents: p.agents.map((a, idx) => idx === i ? { ...a, ...patch } : a) }))
  const addStage = () =>
    setPipelineCfg(p => ({ ...p, agents: [...p.agents, makeStage(`stage_${p.agents.length + 1}`)] }))
  const removeStage = (i: number) =>
    setPipelineCfg(p => ({ ...p, agents: p.agents.filter((_, idx) => idx !== i) }))
  const moveStage = (i: number, dir: -1 | 1) =>
    setPipelineCfg(p => {
      const j = i + dir
      if (j < 0 || j >= p.agents.length) return p
      const next = [...p.agents]
      ;[next[i], next[j]] = [next[j], next[i]]
      return { ...p, agents: next }
    })

  // ── Debate builder helpers ──
  const updateDebateAgent = (i: 0 | 1, patch: Partial<StageCfg>) =>
    setDebateCfg(p => {
      const next: [StageCfg, StageCfg] = [...p.agents]
      next[i] = { ...next[i], ...patch }
      return { ...p, agents: next }
    })
  const updateJudge = (patch: Partial<SubAgentCfg>) =>
    setDebateCfg(p => ({ ...p, judge: { ...p.judge, ...patch } }))

  // ── Supervisor builder helpers ──
  const updateOrchestrator = (patch: Partial<SubAgentCfg>) =>
    setSupervisorCfg(p => ({ ...p, orchestrator: { ...p.orchestrator, ...patch } }))
  const updateWorker = (i: number, patch: Partial<WorkerCfg>) =>
    setSupervisorCfg(p => ({ ...p, workers: p.workers.map((w, idx) => idx === i ? { ...w, ...patch } : w) }))
  const toggleWorkerTool = (i: number, tool: string) =>
    setSupervisorCfg(p => ({
      ...p,
      workers: p.workers.map((w, idx) => idx === i
        ? { ...w, tools: w.tools.includes(tool) ? w.tools.filter(t => t !== tool) : [...w.tools, tool] }
        : w),
    }))
  const addWorker = () =>
    setSupervisorCfg(p => ({ ...p, workers: [...p.workers, makeWorker(`worker_${p.workers.length + 1}`)] }))
  const removeWorker = (i: number) =>
    setSupervisorCfg(p => ({ ...p, workers: p.workers.filter((_, idx) => idx !== i) }))

  const buildConfig = (): Record<string, unknown> | null => {
    if (agentType !== 'react' && useAdvancedJson) {
      try {
        const parsed = JSON.parse(rawJson)
        setJsonError(null)
        return parsed
      } catch (e) {
        setJsonError((e as Error).message)
        return null
      }
    }
    if (agentType === 'react') return { ...reactCfg }
    if (agentType === 'pipeline') return { ...pipelineCfg }
    if (agentType === 'debate') return { ...debateCfg }
    return { ...supervisorCfg }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const config = buildConfig()
    if (!config) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, graph_config: config }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setShowForm(false)
      setName('')
      setReactCfg({ ...DEFAULT_REACT })
      setPipelineCfg(DEFAULT_PIPELINE)
      setDebateCfg(DEFAULT_DEBATE)
      setSupervisorCfg(DEFAULT_SUPERVISOR)
      setUseAdvancedJson(false)
      setRawJson('')
      fetchAgents()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <NavBar />
      <div className="page">
        <PageHeader
          title="Agents"
          subtitle="Configure AI agents to benchmark across your task library."
          actions={
            <Btn variant={showForm ? 'secondary' : 'primary'} onClick={() => setShowForm(v => !v)}>
              {showForm ? 'Cancel' : '+ New Agent'}
            </Btn>
          }
        />

        {error && <Alert message={error} />}

        {showForm && (
          <Card style={{ padding: 24, marginBottom: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, color: C.gray900 }}>
              New Agent
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <Field label="Name">
                  <input required value={name} onChange={e => setName(e.target.value)}
                    placeholder="e.g. GPT-4o CoT solver" className="inp" style={inputStyle} />
                </Field>

                <Field label="Type">
                  <select value={agentType} onChange={e => changeType(e.target.value)}
                    className="inp" style={inputStyle}>
                    {AGENT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </Field>
              </div>

              {agentType !== 'react' && (
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                  fontSize: 13, color: C.gray500, marginBottom: 16,
                }}>
                  <input type="checkbox" checked={useAdvancedJson}
                    onChange={e => toggleAdvanced(e.target.checked)}
                    style={{ accentColor: C.blue600 }} />
                  Advanced: edit graph_config as raw JSON
                </label>
              )}

              {agentType === 'react' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                  <div>
                    <Field label="Model">
                      <select value={reactCfg.model}
                        onChange={e => setReactCfg(p => ({ ...p, model: e.target.value }))}
                        className="inp" style={inputStyle}>
                        {MODELS.map(m => <option key={m}>{m}</option>)}
                      </select>
                    </Field>

                    <Field label={`Temperature — ${reactCfg.temperature}`}>
                      <input type="range" min={0} max={1} step={0.1}
                        value={reactCfg.temperature}
                        onChange={e => setReactCfg(p => ({ ...p, temperature: parseFloat(e.target.value) }))}
                        style={{ width: '100%', accentColor: C.blue600 }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.gray400, marginTop: 2 }}>
                        <span>0 — precise</span><span>1 — creative</span>
                      </div>
                    </Field>

                    <Field label="Tools">
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        {TOOLS.map(t => (
                          <label key={t} style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            cursor: 'pointer', fontSize: 14, color: C.gray700,
                          }}>
                            <input type="checkbox" checked={reactCfg.tools.includes(t)}
                              onChange={() => toggleTool(t)}
                              style={{ accentColor: C.blue600 }} />
                            {t}
                          </label>
                        ))}
                      </div>
                    </Field>
                  </div>

                  <div>
                    <Field label="System Prompt">
                      <textarea rows={8} value={reactCfg.system_prompt}
                        onChange={e => setReactCfg(p => ({ ...p, system_prompt: e.target.value }))}
                        placeholder="e.g. Think step by step before answering."
                        className="inp" style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
                    </Field>
                  </div>
                </div>
              )}

              {agentType !== 'react' && useAdvancedJson && (
                <Field label="graph_config (JSON)">
                  <textarea rows={14} value={rawJson}
                    onChange={e => { setRawJson(e.target.value); setJsonError(null) }}
                    className="inp" style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--mono)', fontSize: 12 }} />
                  {jsonError && (
                    <p style={{ color: C.danger, fontSize: 12, marginTop: 4 }}>JSON error: {jsonError}</p>
                  )}
                </Field>
              )}

              {agentType === 'pipeline' && !useAdvancedJson && (
                <div>
                  <p style={{ fontSize: 13, color: C.gray500, marginBottom: 12 }}>
                    Stages run in order, each one passing its output to the next.
                  </p>
                  {pipelineCfg.agents.map((stage, i) => (
                    <SubCard key={i}
                      title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>Stage {i + 1}</span>
                          <div style={{ display: 'flex', gap: 2 }}>
                            <Btn variant="ghost" onClick={() => moveStage(i, -1)}
                              style={{ padding: '2px 6px', color: i === 0 ? C.gray300 : C.gray500 }}>↑</Btn>
                            <Btn variant="ghost" onClick={() => moveStage(i, 1)}
                              style={{ padding: '2px 6px', color: i === pipelineCfg.agents.length - 1 ? C.gray300 : C.gray500 }}>↓</Btn>
                          </div>
                        </div>
                      }
                      onRemove={pipelineCfg.agents.length > 1 ? () => removeStage(i) : undefined}>
                      <Field label="Role name">
                        <input value={stage.role} onChange={e => updateStage(i, { role: e.target.value })}
                          placeholder="e.g. drafter" className="inp" style={inputStyle} />
                      </Field>
                      <SubAgentFields cfg={stage} onChange={patch => updateStage(i, patch)} />
                    </SubCard>
                  ))}
                  <Btn variant="secondary" onClick={addStage}>+ Add Stage</Btn>
                </div>
              )}

              {agentType === 'debate' && !useAdvancedJson && (
                <div>
                  <Field label={`Rounds — ${debateCfg.rounds}`}>
                    <input type="range" min={1} max={10} step={1} value={debateCfg.rounds}
                      onChange={e => setDebateCfg(p => ({ ...p, rounds: parseInt(e.target.value, 10) }))}
                      style={{ width: '100%', accentColor: C.blue600 }} />
                  </Field>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <SubCard title="Proposer">
                      <SubAgentFields cfg={debateCfg.agents[0]} onChange={patch => updateDebateAgent(0, patch)} />
                    </SubCard>
                    <SubCard title="Opposer">
                      <SubAgentFields cfg={debateCfg.agents[1]} onChange={patch => updateDebateAgent(1, patch)} />
                    </SubCard>
                  </div>
                  <SubCard title="Judge">
                    <SubAgentFields cfg={debateCfg.judge} onChange={updateJudge} />
                  </SubCard>
                </div>
              )}

              {agentType === 'supervisor' && !useAdvancedJson && (
                <div>
                  <SubCard title="Orchestrator">
                    <SubAgentFields cfg={supervisorCfg.orchestrator} onChange={updateOrchestrator} />
                  </SubCard>
                  <p style={{ fontSize: 13, color: C.gray500, margin: '12px 0' }}>
                    The orchestrator delegates to each worker below, then synthesizes their results.
                  </p>
                  {supervisorCfg.workers.map((worker, i) => (
                    <SubCard key={i} title={`Worker ${i + 1}`}
                      onRemove={supervisorCfg.workers.length > 1 ? () => removeWorker(i) : undefined}>
                      <Field label="Role name">
                        <input value={worker.role} onChange={e => updateWorker(i, { role: e.target.value })}
                          placeholder="e.g. researcher" className="inp" style={inputStyle} />
                      </Field>
                      <SubAgentFields cfg={worker} onChange={patch => updateWorker(i, patch)}
                        tools={worker.tools} onToggleTool={t => toggleWorkerTool(i, t)} />
                    </SubCard>
                  ))}
                  <Btn variant="secondary" onClick={addWorker}>+ Add Worker</Btn>
                </div>
              )}

              <div style={{ borderTop: `1px solid ${C.gray200}`, marginTop: 20, paddingTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                <Btn type="submit" variant="primary" disabled={submitting}>
                  {submitting ? 'Creating…' : 'Create Agent'}
                </Btn>
              </div>
            </form>
          </Card>
        )}

        <Card>
          {agents.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: C.gray400 }}>
              No agents yet. Create your first agent above.
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Model</th>
                  <th>Tools</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {agents.map(a => {
                  const cfg = a.graph_config as Record<string, unknown>
                  return (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 500 }}>
                        <Link to={`/agents/${a.id}`} style={{ color: C.gray900 }}>{a.name}</Link>
                      </td>
                      <td><TypeBadge type={String(cfg.type ?? '?')} /></td>
                      <td style={{ color: C.gray500, fontFamily: 'var(--mono)', fontSize: 13 }}>
                        {String(cfg.model ?? '—')}
                      </td>
                      <td style={{ color: C.gray500, fontSize: 13 }}>
                        {((cfg.tools as string[]) ?? []).join(', ') || <span style={{ color: C.gray300 }}>—</span>}
                      </td>
                      <td style={{ color: C.gray400, fontSize: 13 }}>
                        {new Date(a.created_at).toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right', paddingRight: 16 }}>
                        <Btn variant="ghost" onClick={() => deleteAgent(a)}
                          style={{ color: C.gray300, padding: '4px 8px' }}>
                          ✕
                        </Btn>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  )
}
