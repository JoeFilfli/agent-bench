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

const MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']
const TOOLS = ['calculator', 'code_exec', 'web_search']
const AGENT_TYPES = ['react', 'pipeline', 'debate', 'supervisor']

const DEFAULT_REACT = {
  type: 'react', model: 'gpt-4o', temperature: 0.0, system_prompt: '', tools: [] as string[],
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [agentType, setAgentType] = useState('react')
  const [reactCfg, setReactCfg] = useState({ ...DEFAULT_REACT })
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

  const toggleTool = (t: string) =>
    setReactCfg(prev => ({
      ...prev,
      tools: prev.tools.includes(t) ? prev.tools.filter(x => x !== t) : [...prev.tools, t],
    }))

  const buildConfig = (): Record<string, unknown> | null => {
    if (agentType === 'react') return { ...reactCfg }
    try {
      const parsed = JSON.parse(rawJson)
      setJsonError(null)
      return parsed
    } catch (e) {
      setJsonError((e as Error).message)
      return null
    }
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
                <div>
                  <Field label="Name">
                    <input required value={name} onChange={e => setName(e.target.value)}
                      placeholder="e.g. GPT-4o CoT solver" className="inp" style={inputStyle} />
                  </Field>

                  <Field label="Type">
                    <select value={agentType} onChange={e => setAgentType(e.target.value)}
                      className="inp" style={inputStyle}>
                      {AGENT_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </Field>

                  {agentType === 'react' && (
                    <>
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
                    </>
                  )}
                </div>

                <div>
                  {agentType === 'react' ? (
                    <Field label="System Prompt">
                      <textarea rows={8} value={reactCfg.system_prompt}
                        onChange={e => setReactCfg(p => ({ ...p, system_prompt: e.target.value }))}
                        placeholder="e.g. Think step by step before answering."
                        className="inp" style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
                    </Field>
                  ) : (
                    <Field label="graph_config (JSON)">
                      <p style={{ fontSize: 13, color: C.gray500, marginBottom: 8 }}>
                        Paste the full graph_config JSON for {agentType} type.
                      </p>
                      <textarea rows={12} value={rawJson}
                        onChange={e => { setRawJson(e.target.value); setJsonError(null) }}
                        placeholder={`{\n  "type": "${agentType}",\n  ...\n}`}
                        className="inp" style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--mono)', fontSize: 12 }} />
                      {jsonError && (
                        <p style={{ color: C.danger, fontSize: 12, marginTop: 4 }}>JSON error: {jsonError}</p>
                      )}
                    </Field>
                  )}
                </div>
              </div>

              <div style={{ borderTop: `1px solid ${C.gray200}`, marginTop: 8, paddingTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
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
