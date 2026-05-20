import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import AgentDetail from './pages/AgentDetail'
import AgentsPage from './pages/AgentsPage'
import Experiment from './pages/Experiment'
import ExperimentsPage from './pages/ExperimentsPage'
import Leaderboard from './pages/Leaderboard'
import NewExperiment from './pages/NewExperiment'
import RunMonitor from './pages/RunMonitor'
import TaskLibrary from './pages/TaskLibrary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Leaderboard />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/agents/:id" element={<AgentDetail />} />
        <Route path="/tasks" element={<TaskLibrary />} />
        <Route path="/experiments" element={<ExperimentsPage />} />
        <Route path="/experiments/new" element={<NewExperiment />} />
        <Route path="/experiments/:id" element={<Experiment />} />
        <Route path="/runs/:id" element={<RunMonitor />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
