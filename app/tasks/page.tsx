'use client'

import { useEffect, useState } from 'react'
import { supabase, type Metric, type TaskWithPriority, type TaskScore } from '@/lib/supabase'

const SPRINT_POINTS_OPTIONS = [1, 2, 3, 5, 8, 13, 21]
const SCORE_OPTIONS = [1, 3, 5]

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskWithPriority[]>([])
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [taskScores, setTaskScores] = useState<Record<string, Record<string, number>>>({})
  const [loading, setLoading] = useState(true)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskLink, setNewTaskLink] = useState('')
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [editingLink, setEditingLink] = useState<Record<string, boolean>>({})
  const [linkInputs, setLinkInputs] = useState<Record<string, string>>({})
  
  // Track pending changes (not yet saved to DB)
  const [pendingTaskChanges, setPendingTaskChanges] = useState<Record<string, Partial<TaskWithPriority>>>({})
  const [pendingScoreChanges, setPendingScoreChanges] = useState<Record<string, Record<string, number>>>({})
  const [localTaskTitles, setLocalTaskTitles] = useState<Record<string, string>>({})

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Load active metrics ordered by sort_order
      const { data: metricsData, error: metricsError } = await supabase
        .from('metrics')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (metricsError) throw metricsError
      setMetrics(metricsData || [])

      // Load tasks with computed priorities using RPC function
      const { data: tasksData, error: tasksError } = await supabase
        .rpc('get_task_priorities')

      let finalTasksData: TaskWithPriority[] = []
      if (tasksError) {
        // Fallback: try querying the view directly
        const { data: viewData, error: viewError } = await supabase
          .from('task_priorities')
          .select('*')
          .order('gate', { ascending: false })
          .order('priority', { ascending: false })
          .order('created_at', { ascending: false })
        
        if (viewError) throw viewError
        finalTasksData = viewData || []
        setTasks(finalTasksData)
      } else {
        finalTasksData = tasksData || []
        setTasks(finalTasksData)
      }

      // Load all task scores
      const { data: scoresData, error: scoresError } = await supabase
        .from('task_scores')
        .select('*')

      if (scoresError) throw scoresError

      // Organize scores by task_id -> metric_id
      const scoresMap: Record<string, Record<string, number>> = {}
      scoresData?.forEach((score: TaskScore) => {
        if (!scoresMap[score.task_id]) {
          scoresMap[score.task_id] = {}
        }
        scoresMap[score.task_id][score.metric_id] = score.score
      })
      setTaskScores(scoresMap)

      // Initialize local task titles
      const titlesMap: Record<string, string> = {}
      finalTasksData.forEach((task: TaskWithPriority) => {
        titlesMap[task.id] = task.title
      })
      setLocalTaskTitles(titlesMap)

      // Clear pending changes after reload
      setPendingTaskChanges({})
      setPendingScoreChanges({})

      setLoading(false)
    } catch (error) {
      console.error('Error loading data:', error)
      setLoading(false)
    }
  }

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({ 
          title: newTaskTitle.trim(), 
          gate: false, 
          sprint_points: 1,
          link: newTaskLink.trim() || null
        })
        .select()
        .single()

      if (error) throw error
      setNewTaskTitle('')
      setNewTaskLink('')
      setShowLinkInput(false)
      await loadData()
    } catch (error) {
      console.error('Error adding task:', error)
      alert('Failed to add task')
    }
  }

  const handleLinkClick = (task: TaskWithPriority, e: React.MouseEvent) => {
    e.stopPropagation()
    if (task.link) {
      // If link exists, open it in new tab
      window.open(task.link, '_blank')
    }
  }

  const handleLinkEdit = (taskId: string, currentLink: string | null) => {
    setEditingLink({ ...editingLink, [taskId]: true })
    setLinkInputs({ ...linkInputs, [taskId]: currentLink || '' })
  }

  const handleLinkSave = (taskId: string) => {
    const linkValue = linkInputs[taskId]?.trim() || null
    handleUpdateTask(taskId, 'link', linkValue)
    setEditingLink({ ...editingLink, [taskId]: false })
  }

  const handleLinkCancel = (taskId: string) => {
    setEditingLink({ ...editingLink, [taskId]: false })
    setLinkInputs({ ...linkInputs, [taskId]: '' })
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)

      if (error) throw error
      await loadData()
    } catch (error) {
      console.error('Error deleting task:', error)
      alert('Failed to delete task')
    }
  }

  const handleUpdateTask = (taskId: string, field: string, value: any) => {
    // Store pending change locally (don't save to DB yet)
    setPendingTaskChanges(prev => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        [field]: value
      }
    }))
  }

  const handleUpdateScore = (taskId: string, metricId: string, score: number) => {
    // Store pending score change locally (don't save to DB yet)
    setPendingScoreChanges(prev => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        [metricId]: score
      }
    }))
  }

  const handleUpdateTitle = (taskId: string, value: string) => {
    setLocalTaskTitles(prev => ({
      ...prev,
      [taskId]: value
    }))
    handleUpdateTask(taskId, 'title', value)
  }

  const handleConfirmChanges = async (taskId: string) => {
    try {
      // Save all pending task changes
      const taskChanges = pendingTaskChanges[taskId]
      if (taskChanges && Object.keys(taskChanges).length > 0) {
        const { error: taskError } = await supabase
          .from('tasks')
          .update(taskChanges)
          .eq('id', taskId)

        if (taskError) throw taskError
      }

      // Save all pending score changes for this task
      const scoreChanges = pendingScoreChanges[taskId]
      if (scoreChanges) {
        const scoreUpdates = Object.entries(scoreChanges).map(([metricId, score]) => ({
          task_id: taskId,
          metric_id: metricId,
          score: score,
        }))

        for (const update of scoreUpdates) {
          const { error: scoreError } = await supabase
            .from('task_scores')
            .upsert(update, {
              onConflict: 'task_id,metric_id'
            })

          if (scoreError) throw scoreError
        }
      }

      // Reload data to get updated priorities and re-sort
      await loadData()
    } catch (error) {
      console.error('Error confirming changes:', error)
      alert('Failed to save changes')
    }
  }

  const hasPendingChanges = (taskId: string): boolean => {
    const hasTaskChanges = pendingTaskChanges[taskId] && Object.keys(pendingTaskChanges[taskId]).length > 0
    const hasScoreChanges = pendingScoreChanges[taskId] && Object.keys(pendingScoreChanges[taskId]).length > 0
    return hasTaskChanges || hasScoreChanges
  }

  const getScore = (taskId: string, metricId: string): number => {
    // Return pending score if exists, otherwise return saved score
    if (pendingScoreChanges[taskId]?.[metricId] !== undefined) {
      return pendingScoreChanges[taskId][metricId]
    }
    return taskScores[taskId]?.[metricId] || 0
  }

  const getTaskValue = (task: TaskWithPriority): TaskWithPriority => {
    // Return task with pending changes applied for display
    const pending = pendingTaskChanges[task.id] || {}
    const pendingScores = pendingScoreChanges[task.id] || {}
    
    // Calculate value and priority based on current state (pending + saved)
    let value = 0
    metrics.forEach(metric => {
      const score = getScore(task.id, metric.id)
      value += score * Number(metric.coefficient)
    })

    const sprintPoints = pending.sprint_points !== undefined ? pending.sprint_points : task.sprint_points
    const priority = sprintPoints > 0 ? value / sprintPoints : 0

    return {
      ...task,
      ...pending,
      title: localTaskTitles[task.id] || task.title,
      value,
      priority,
    }
  }

  const isTaskPrioritized = (taskId: string): boolean => {
    // A task is prioritized if all metrics have scores > 0
    return metrics.every(metric => {
      const score = getScore(taskId, metric.id)
      return score > 0
    })
  }

  const separateTasks = () => {
    const prioritized: TaskWithPriority[] = []
    const unprioritized: TaskWithPriority[] = []

    tasks.forEach(task => {
      const displayTask = getTaskValue(task)
      if (isTaskPrioritized(task.id)) {
        prioritized.push(displayTask)
      } else {
        unprioritized.push(displayTask)
      }
    })

    // Sort prioritized tasks by gate then priority
    prioritized.sort((a, b) => {
      if (a.gate !== b.gate) return b.gate ? 1 : -1
      if (a.priority !== b.priority) return b.priority - a.priority
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    // Sort unprioritized by creation date (newest first)
    unprioritized.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    return { prioritized, unprioritized }
  }

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Tasks</h2>
        </div>
        <div className="flex flex-col gap-2 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex gap-2 items-start">
            <textarea
              value={newTaskTitle}
              onChange={(e) => {
                setNewTaskTitle(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = e.target.scrollHeight + 'px'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleAddTask()
                }
              }}
              placeholder="New task title"
              rows={1}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-hidden"
              style={{ minHeight: '38px' }}
            />
            <button
              onClick={() => setShowLinkInput(!showLinkInput)}
              className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Add link"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </button>
            <button
              onClick={handleAddTask}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Add Task
            </button>
          </div>
          {showLinkInput && (
            <div className="flex gap-2">
              <input
                type="url"
                value={newTaskLink}
                onChange={(e) => setNewTaskLink(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
                placeholder="ClickUp link (optional)"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        {(() => {
          const { prioritized, unprioritized } = separateTasks()
          
          const renderTaskRow = (task: TaskWithPriority, originalTask: TaskWithPriority) => {
            const hasChanges = hasPendingChanges(originalTask.id)
            
            return (
              <tr 
                key={originalTask.id} 
                className={`hover:bg-gray-50 ${hasChanges ? 'bg-yellow-50 border-l-4 border-l-yellow-400' : ''}`}
              >
                <td className="px-4 py-3">
                  <textarea
                    value={localTaskTitles[originalTask.id] || originalTask.title}
                    onChange={(e) => {
                      handleUpdateTitle(originalTask.id, e.target.value)
                      e.target.style.height = 'auto'
                      e.target.style.height = e.target.scrollHeight + 'px'
                    }}
                    className="w-full min-w-[200px] px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-hidden"
                    rows={1}
                    style={{ minHeight: '32px' }}
                  />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {editingLink[originalTask.id] ? (
                    <div className="flex gap-1 items-center">
                      <input
                        type="url"
                        value={linkInputs[originalTask.id] || ''}
                        onChange={(e) => setLinkInputs({ ...linkInputs, [originalTask.id]: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleLinkSave(originalTask.id)
                          } else if (e.key === 'Escape') {
                            handleLinkCancel(originalTask.id)
                          }
                        }}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter URL"
                        autoFocus
                      />
                      <button
                        onClick={() => handleLinkSave(originalTask.id)}
                        className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                        title="Save"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => handleLinkCancel(originalTask.id)}
                        className="px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                        title="Cancel"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {originalTask.link ? (
                        <a
                          href={originalTask.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => handleLinkClick(originalTask, e)}
                          className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          <span className="text-xs">Open</span>
                        </a>
                      ) : null}
                      <button
                        onClick={() => handleLinkEdit(originalTask.id, originalTask.link)}
                        className="px-2 py-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
                        title={originalTask.link ? 'Edit link' : 'Add link'}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={originalTask.link ? "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" : "M12 4v16m8-8H4"} />
                        </svg>
                      </button>
                    </div>
                  )}
                </td>
                {metrics.map((metric) => (
                  <td key={metric.id} className="px-4 py-3 whitespace-nowrap">
                    <select
                      value={getScore(originalTask.id, metric.id)}
                      onChange={(e) => handleUpdateScore(originalTask.id, metric.id, parseInt(e.target.value))}
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="0">-</option>
                      {SCORE_OPTIONS.map((score) => (
                        <option key={score} value={score}>
                          {score}
                        </option>
                      ))}
                    </select>
                  </td>
                ))}
                <td className="px-4 py-3 whitespace-nowrap">
                  <select
                    value={(pendingTaskChanges[originalTask.id]?.gate !== undefined 
                      ? pendingTaskChanges[originalTask.id].gate 
                      : originalTask.gate) ? 'Yes' : 'No'}
                    onChange={(e) => handleUpdateTask(originalTask.id, 'gate', e.target.value === 'Yes')}
                    className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                  {task.value.toFixed(2)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <select
                    value={pendingTaskChanges[originalTask.id]?.sprint_points !== undefined
                      ? pendingTaskChanges[originalTask.id].sprint_points
                      : originalTask.sprint_points}
                    onChange={(e) => handleUpdateTask(originalTask.id, 'sprint_points', parseInt(e.target.value))}
                    className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {SPRINT_POINTS_OPTIONS.map((points) => (
                      <option key={points} value={points}>
                        {points}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                  {task.priority.toFixed(2)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <button
                    onClick={() => handleDeleteTask(originalTask.id)}
                    className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    Delete
                  </button>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {hasChanges ? (
                    <button
                      onClick={() => handleConfirmChanges(originalTask.id)}
                      className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center gap-1"
                      title="Confirm and save changes"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Save
                    </button>
                  ) : (
                    <span className="text-gray-400 text-sm">-</span>
                  )}
                </td>
              </tr>
            )
          }

          return (
            <>
              {/* Prioritized Tasks Section */}
              {prioritized.length > 0 && (
                <>
                  <div className="mb-4 mt-6">
                    <h3 className="text-lg font-semibold text-gray-800">Prioritized Tasks</h3>
                    <p className="text-sm text-gray-600">Tasks with all metrics evaluated</p>
                  </div>
                  <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm mb-8">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                          Task
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                          Link
                        </th>
                        {metrics.map((metric) => (
                          <th key={metric.id} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                            {metric.name}
                          </th>
                        ))}
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                          Gate
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                          Value
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                          Sprint Points
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                          Priority
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                          Actions
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                          Confirm
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {prioritized.map((displayTask) => {
                        const originalTask = tasks.find(t => t.id === displayTask.id)!
                        return renderTaskRow(displayTask, originalTask)
                      })}
                    </tbody>
                  </table>
                </>
              )}

              {/* Unprioritized Tasks Section */}
              {unprioritized.length > 0 && (
                <>
                  <div className="mb-4 mt-6 border-t-2 border-gray-300 pt-6">
                    <h3 className="text-lg font-semibold text-gray-800">Unprioritized Tasks</h3>
                    <p className="text-sm text-gray-600">Tasks awaiting evaluation - fill all metrics to prioritize</p>
                  </div>
                  <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                          Task
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                          Link
                        </th>
                        {metrics.map((metric) => (
                          <th key={metric.id} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                            {metric.name}
                          </th>
                        ))}
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                          Gate
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                          Value
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                          Sprint Points
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                          Priority
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                          Actions
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                          Confirm
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {unprioritized.map((displayTask) => {
                        const originalTask = tasks.find(t => t.id === displayTask.id)!
                        return renderTaskRow(displayTask, originalTask)
                      })}
                    </tbody>
                  </table>
                </>
              )}

              {tasks.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No tasks yet. Create one above!
                </div>
              )}
            </>
          )
        })()}
      </div>
    </div>
  )
}

