import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { Alert, Btn, C, Card, PageHeader, StatusBadge } from '../components/ui'

interface Experiment {
  id: string
  name: string
  agent_ids: string[]
  task_ids: string[]
  runs_per_combo: number
  status: string
  created_at: string
}

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [error, setError] = useState<string | null>(null)

  const fetchData = () => {
    fetch('/api/experiments')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(setExperiments)
      .catch(e => setError(e.message))
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [])

  const deleteExperiment = async (e: Experiment) => {
    if (!confirm(`Delete "${e.name}" and all its runs?`)) return
    await fetch(`/api/experiments/${e.id}`, { method: 'DELETE' })
    setExperiments(prev => prev.filter(x => x.id !== e.id))
  }

  return (
    <>
      <NavBar />
      <div className="page">
        <PageHeader
          title="Experiments"
          subtitle="Each experiment runs a matrix of agents × tasks and scores the results."
          actions={
            <Link to="/experiments/new" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 6, fontSize: 13, fontWeight: 500,
              background: C.blue600, color: '#fff', textDecoration: 'none',
            }}>
              ▶ New Experiment
            </Link>
          }
        />

        {error && <Alert message={error} />}

        <Card>
          {experiments.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: C.gray400 }}>
              No experiments yet.{' '}
              <Link to="/experiments/new">Run your first one.</Link>
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="c">Status</th>
                  <th className="r">Agents</th>
                  <th className="r">Tasks</th>
                  <th className="r">Runs/combo</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {experiments.map(e => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 500 }}>
                      <Link to={`/experiments/${e.id}`} style={{ color: C.gray900 }}>{e.name}</Link>
                    </td>
                    <td className="c"><StatusBadge status={e.status} /></td>
                    <td className="r" style={{ color: C.gray500 }}>{e.agent_ids.length}</td>
                    <td className="r" style={{ color: C.gray500 }}>{e.task_ids.length}</td>
                    <td className="r" style={{ color: C.gray500 }}>{e.runs_per_combo}</td>
                    <td style={{ color: C.gray400, fontSize: 13 }}>
                      {new Date(e.created_at).toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: 16 }}>
                      <Btn variant="ghost" onClick={() => deleteExperiment(e)}
                        style={{ color: C.gray300, padding: '4px 8px' }}>
                        ✕
                      </Btn>
                    </td>
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
