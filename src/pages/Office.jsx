import { useEffect, useMemo, useState } from 'react'
import { Bot, Check, Loader2, Play, RefreshCw, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { errorMessage } from '../lib/constants'
import {
  fetchAgentDefinitions,
  fetchAgentProposals,
  fetchAgentRuns,
  resolveAgentProposal,
  runAgent,
} from '../lib/agentsApi'

function statusLabel(status) {
  switch (status) {
    case 'running':
    case 'queued':
      return 'Busy'
    case 'waiting_approval':
      return 'Needs approval'
    case 'failed':
      return 'Failed'
    case 'done':
      return 'Idle'
    default:
      return status || 'Idle'
  }
}

function statusClass(status) {
  if (status === 'running' || status === 'queued') return 'is-busy'
  if (status === 'waiting_approval') return 'is-waiting'
  if (status === 'failed') return 'is-failed'
  return 'is-idle'
}

export default function Office() {
  const { isAdmin, canDo } = useAuth()
  const toast = useToast()
  const canRun = isAdmin || canDo('agents_run')
  const [agents, setAgents] = useState([])
  const [runs, setRuns] = useState([])
  const [proposals, setProposals] = useState([])
  const [loading, setLoading] = useState(true)
  const [runningId, setRunningId] = useState('')
  const [resolvingId, setResolvingId] = useState('')

  async function load() {
    setLoading(true)
    try {
      const [defs, recentRuns, pending] = await Promise.all([
        fetchAgentDefinitions(),
        fetchAgentRuns(25),
        fetchAgentProposals('pending'),
      ])
      setAgents(defs)
      setRuns(recentRuns)
      setProposals(pending)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const desks = useMemo(() => {
    const latestByAgent = new Map()
    for (const run of runs) {
      if (!latestByAgent.has(run.agent_id)) latestByAgent.set(run.agent_id, run)
    }
    return agents
      .filter((agent) => isAdmin || !agent.admin_only)
      .map((agent) => ({
        ...agent,
        latest: latestByAgent.get(agent.id) || null,
      }))
  }, [agents, runs, isAdmin])

  async function handleRun(agentId) {
    if (!canRun) {
      toast.error('You do not have permission to run agents.')
      return
    }
    setRunningId(agentId)
    try {
      const finished = await runAgent(agentId, { triggerSource: 'office' })
      toast.success(finished?.summary ? 'Agent finished.' : 'Agent run completed.')
      await load()
    } catch (error) {
      toast.error(errorMessage(error))
      await load()
    } finally {
      setRunningId('')
    }
  }

  async function handleResolve(proposalId, status) {
    setResolvingId(proposalId)
    try {
      await resolveAgentProposal(proposalId, status)
      toast.success(status === 'approved' ? 'Proposal approved.' : 'Proposal rejected.')
      await load()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setResolvingId('')
    }
  }

  return (
    <div className="page office-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">AI workforce pilot</p>
          <h1>AI Office</h1>
          <p className="muted">
            Live desks for Membership Ops and Youth Insights. Agents prepare digests and proposals; staff approve before
            anything becomes an official action.
          </p>
        </div>
        <div className="toolbar">
          <button type="button" className="btn btn-soft" onClick={load} disabled={loading}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </header>

      {loading ? (
        <p className="muted">Loading office…</p>
      ) : (
        <>
          <section className="office-desk-grid" aria-label="Agent desks">
            {desks.map((desk) => {
              const status = desk.latest?.status || 'done'
              const busy = runningId === desk.id || status === 'running' || status === 'queued'
              return (
                <article key={desk.id} className={`office-desk ${statusClass(busy ? 'running' : status)}`}>
                  <header>
                    <div className="office-desk-avatar" aria-hidden="true">
                      <Bot size={22} />
                    </div>
                    <div>
                      <h2>{desk.name}</h2>
                      <p className="muted">{desk.desk}</p>
                    </div>
                    <span className={`office-status-chip ${statusClass(busy ? 'running' : status)}`}>
                      {busy ? 'Busy' : statusLabel(status)}
                    </span>
                  </header>
                  <p>{desk.description}</p>
                  {desk.latest?.summary ? <p className="office-desk-summary">{desk.latest.summary}</p> : null}
                  <div className="office-desk-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!canRun || Boolean(runningId)}
                      onClick={() => handleRun(desk.id)}
                    >
                      {runningId === desk.id ? <Loader2 size={16} className="spin" /> : <Play size={16} />}
                      {runningId === desk.id ? 'Running…' : 'Run agent'}
                    </button>
                    {desk.id === 'membership_ops' ? (
                      <Link className="btn btn-soft" to="/tracker">
                        Open Tracker
                      </Link>
                    ) : (
                      <Link className="btn btn-soft" to="/youth/analytics">
                        Open Analytics
                      </Link>
                    )}
                  </div>
                </article>
              )
            })}
          </section>

          <section className="office-panel youth-stat-card">
            <header className="youth-table-heading">
              <div>
                <h2>Pending proposals</h2>
                <p className="muted">Approve or reject agent suggestions. Nothing is applied automatically.</p>
              </div>
            </header>
            {!proposals.length ? (
              <p className="muted">No pending proposals.</p>
            ) : (
              <ul className="office-proposal-list">
                {proposals.map((proposal) => (
                  <li key={proposal.id}>
                    <div>
                      <strong>{proposal.title}</strong>
                      <p className="muted">
                        {proposal.agent_definitions?.name || proposal.agent_id} · {proposal.proposal_type}
                      </p>
                      <p>{proposal.detail}</p>
                    </div>
                    <div className="office-proposal-actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={!canRun || resolvingId === proposal.id}
                        onClick={() => handleResolve(proposal.id, 'approved')}
                      >
                        <Check size={16} /> Approve
                      </button>
                      <button
                        type="button"
                        className="btn btn-soft"
                        disabled={!canRun || resolvingId === proposal.id}
                        onClick={() => handleResolve(proposal.id, 'rejected')}
                      >
                        <X size={16} /> Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="office-panel youth-stat-card">
            <header className="youth-table-heading">
              <div>
                <h2>Activity feed</h2>
                <p className="muted">Recent agent runs across the office.</p>
              </div>
            </header>
            {!runs.length ? (
              <p className="muted">No runs yet. Start with Membership Ops or Youth Insights.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Agent</th>
                      <th>Status</th>
                      <th>Source</th>
                      <th>Summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => (
                      <tr key={run.id}>
                        <td>{new Date(run.created_at).toLocaleString()}</td>
                        <td>{run.agent_definitions?.name || run.agent_id}</td>
                        <td>
                          <span className={`office-status-chip ${statusClass(run.status)}`}>{statusLabel(run.status)}</span>
                        </td>
                        <td>{run.trigger_source}</td>
                        <td>{run.error_message || run.summary || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
