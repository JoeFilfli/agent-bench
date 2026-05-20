import { useEffect, useState } from 'react'
import NavBar from '../components/NavBar'
import { Alert, C, Card, CategoryBadge, PageHeader } from '../components/ui'

interface Task {
  id: string
  name: string
  category: string
  prompt_template: string
  scoring_fn: string
  metadata: Record<string, unknown>
}

export default function TaskLibrary() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/tasks')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(setTasks)
      .catch(e => setError(e.message))
  }, [])

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const categories = ['all', ...Array.from(new Set(tasks.map(t => t.category))).sort()]
  const visible = filter === 'all' ? tasks : tasks.filter(t => t.category === filter)

  const grouped: Record<string, Task[]> = {}
  for (const t of visible) {
    if (!grouped[t.category]) grouped[t.category] = []
    grouped[t.category].push(t)
  }

  return (
    <>
      <NavBar />
      <div className="page">
        <PageHeader
          title="Task Library"
          subtitle={`${tasks.length} tasks across ${categories.length - 1} categories.`}
        />

        {error && <Alert message={error} />}

        {/* Category filters */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              style={{
                padding: '5px 14px', borderRadius: 9999, fontSize: 13, fontWeight: 500,
                cursor: 'pointer', border: '1px solid',
                background: filter === c ? C.gray900 : '#fff',
                color: filter === c ? '#fff' : C.gray500,
                borderColor: filter === c ? C.gray900 : C.gray200,
                transition: 'all 0.15s',
              } as React.CSSProperties}
            >
              {c}
            </button>
          ))}
        </div>

        {Object.entries(grouped).sort().map(([category, catTasks]) => (
          <div key={category} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <CategoryBadge category={category} />
              <span style={{ fontSize: 13, color: C.gray400 }}>{catTasks.length} tasks</span>
            </div>

            <Card>
              {catTasks.map((task, i) => {
                const isOpen = expanded.has(task.id)
                return (
                  <div key={task.id} style={{ borderBottom: i < catTasks.length - 1 ? `1px solid ${C.gray100}` : 'none' }}>
                    <div
                      onClick={() => toggle(task.id)}
                      style={{
                        padding: '14px 16px', cursor: 'pointer',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        background: isOpen ? C.gray50 : '#fff',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontWeight: 500, color: C.gray900 }}>{task.name}</span>
                        <span style={{
                          fontSize: 11, fontWeight: 500, color: C.gray400,
                          background: C.gray100, padding: '1px 8px', borderRadius: 9999,
                        }}>
                          {task.scoring_fn}
                        </span>
                      </div>
                      <span style={{ color: C.gray400, fontSize: 12 }}>{isOpen ? '▲' : '▼'}</span>
                    </div>

                    {isOpen && (
                      <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${C.gray100}` }}>
                        <div style={{ marginTop: 12, marginBottom: 12 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: C.gray500, marginBottom: 6 }}>
                            PROMPT TEMPLATE
                          </div>
                          <pre className="codeblock">{task.prompt_template}</pre>
                        </div>

                        {(task.metadata.inputs as Record<string, unknown>[] ?? []).length > 0 && (
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 500, color: C.gray500, marginBottom: 6 }}>
                              SAMPLE INPUTS
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {(task.metadata.inputs as Record<string, unknown>[]).map((inp, j) => (
                                <pre key={j} className="codeblock">
                                  {JSON.stringify(inp, null, 2)}
                                </pre>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </Card>
          </div>
        ))}
      </div>
    </>
  )
}
