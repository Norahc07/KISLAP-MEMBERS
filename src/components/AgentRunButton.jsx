import { useState } from 'react'
import { Bot, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { errorMessage } from '../lib/constants'
import { runAgent } from '../lib/agentsApi'

export default function AgentRunButton({
  agentId,
  label = 'Ask agent',
  triggerSource = 'page',
  input = {},
  className = 'btn btn-soft',
}) {
  const { isAdmin, canAccessPage, canDo } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [running, setRunning] = useState(false)
  const allowed = isAdmin || (canAccessPage('agents') && canDo('agents_run'))

  if (!allowed) return null
  if (agentId === 'youth_insights' && !isAdmin) return null

  async function handleClick() {
    setRunning(true)
    try {
      const finished = await runAgent(agentId, { triggerSource, input })
      toast.success(finished?.summary ? 'Agent digest ready.' : 'Agent finished.')
      navigate('/office')
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setRunning(false)
    }
  }

  return (
    <button type="button" className={className} onClick={handleClick} disabled={running}>
      {running ? <Loader2 size={16} className="spin" /> : <Bot size={16} />}
      {running ? 'Running…' : label}
    </button>
  )
}
