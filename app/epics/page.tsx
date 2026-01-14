'use client'

import { useEffect, useState } from 'react'
import { supabase, type EpicWithPriority, type Story } from '@/lib/supabase'
import StoryTitleTooltip from '@/components/StoryTitleTooltip'

const SPRINT_POINTS_OPTIONS = [1, 2, 3, 5, 8, 13, 21]
const SCORE_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export default function EpicsPage() {
  const [epics, setEpics] = useState<EpicWithPriority[]>([])
  const [stories, setStories] = useState<Record<string, Story[]>>({})
  const [loading, setLoading] = useState(true)
  const [newEpicTitle, setNewEpicTitle] = useState('')
  const [newEpicLink, setNewEpicLink] = useState('')
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set())
  const [editingLink, setEditingLink] = useState<Record<string, boolean>>({})
  const [linkInputs, setLinkInputs] = useState<Record<string, string>>({})
  const [metrics, setMetrics] = useState<Record<string, number>>({ R: 1.0, T: 1.0, Q: 1.0, S: 1.0 })
  
  // Track pending changes at epic level
  const [pendingEpicChanges, setPendingEpicChanges] = useState<Record<string, Partial<EpicWithPriority>>>({})
  const [localEpicTitles, setLocalEpicTitles] = useState<Record<string, string>>({})

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Load metrics coefficients
      const { data: metricsData, error: metricsError } = await supabase
        .from('metrics')
        .select('*')
        .eq('is_active', true)

      if (!metricsError && metricsData) {
        const metricsMap: Record<string, number> = { R: 1.0, T: 1.0, Q: 1.0, S: 1.0 }
        metricsData.forEach(m => {
          metricsMap[m.name] = Number(m.coefficient)
        })
        setMetrics(metricsMap)
      }

      // Load epics with computed priorities
      const { data: epicsData, error: epicsError } = await supabase
        .from('epic_priorities')
        .select('*')
        .order('priority', { ascending: false })
        .order('updated_at', { ascending: false })

      if (epicsError) throw epicsError
      setEpics(epicsData || [])

      // Load all stories
      const { data: storiesData, error: storiesError } = await supabase
        .from('stories')
        .select('*')
        .order('epic_id', { ascending: true })
        .order('order_index', { ascending: true })

      if (storiesError) throw storiesError

      // Group stories by epic_id
      const storiesByEpic: Record<string, Story[]> = {}
      storiesData?.forEach((story: Story) => {
        if (!storiesByEpic[story.epic_id]) {
          storiesByEpic[story.epic_id] = []
        }
        storiesByEpic[story.epic_id].push(story)
      })
      setStories(storiesByEpic)

      // Initialize local epic titles
      const titlesMap: Record<string, string> = {}
      epicsData?.forEach((epic: EpicWithPriority) => {
        titlesMap[epic.id] = epic.title
      })
      setLocalEpicTitles(titlesMap)

      // Clear pending changes after reload
      setPendingEpicChanges({})

      setLoading(false)
    } catch (error) {
      console.error('Error loading data:', error)
      setLoading(false)
    }
  }

  const handleAddEpic = async () => {
    if (!newEpicTitle.trim()) return

    try {
      const { data, error } = await supabase
        .from('epics')
        .insert({ 
          title: newEpicTitle.trim(), 
          link: newEpicLink.trim() || null,
          is_confirmed: false
        })
        .select()
        .single()

      if (error) throw error
      setNewEpicTitle('')
      setNewEpicLink('')
      setShowLinkInput(false)
      await loadData()
    } catch (error) {
      console.error('Error adding epic:', error)
      alert('Failed to add epic')
    }
  }

  const handleDeleteEpic = async (epicId: string) => {
    if (!confirm('Are you sure you want to delete this epic? All stories will be deleted too.')) return

    try {
      const { error } = await supabase
        .from('epics')
        .delete()
        .eq('id', epicId)

      if (error) throw error
      await loadData()
    } catch (error) {
      console.error('Error deleting epic:', error)
      alert('Failed to delete epic')
    }
  }

  const handleUpdateEpic = (epicId: string, field: string, value: any) => {
    setPendingEpicChanges(prev => ({
      ...prev,
      [epicId]: {
        ...prev[epicId],
        [field]: value
      }
    }))
  }

  const handleUpdateEpicTitle = (epicId: string, value: string) => {
    setLocalEpicTitles(prev => ({
      ...prev,
      [epicId]: value
    }))
    handleUpdateEpic(epicId, 'title', value)
  }

  const handleConfirmEpicChanges = async (epicId: string) => {
    try {
      const changes = pendingEpicChanges[epicId] || {}
      const titleChange = localEpicTitles[epicId]
      
      // Build update object
      const updateData: any = {
        is_confirmed: true
      }
      
      // Include title if it was changed
      if (titleChange && titleChange !== epics.find(e => e.id === epicId)?.title) {
        updateData.title = titleChange
      }
      
      // Include other changes (r, t, q, s, link, etc.)
      Object.keys(changes).forEach(key => {
        if (key !== 'title') {
          updateData[key] = changes[key as keyof typeof changes]
        }
      })
      
      // Only update if there are actual changes
      if (Object.keys(updateData).length > 1 || (updateData.title && updateData.title !== epics.find(e => e.id === epicId)?.title)) {
        const { error, data } = await supabase
          .from('epics')
          .update(updateData)
          .eq('id', epicId)
          .select()

        if (error) {
          console.error('Supabase error:', error)
          throw new Error(error.message || 'Database error occurred')
        }
      }

      await loadData()
    } catch (error: any) {
      console.error('Error confirming epic changes:', error)
      const errorMessage = error?.message || error?.toString() || 'Unknown error occurred'
      alert(`Failed to save changes: ${errorMessage}`)
    }
  }

  const handleAddStory = async (epicId: string) => {
    try {
      const epicStories = stories[epicId] || []
      const maxOrder = epicStories.length > 0 
        ? Math.max(...epicStories.map(s => s.order_index))
        : -1

      const { error } = await supabase
        .from('stories')
        .insert({
          epic_id: epicId,
          title: 'New Story',
          sprint_points: 1,
          gate: false,
          order_index: maxOrder + 1
        })

      if (error) throw error
      await loadData()
    } catch (error) {
      console.error('Error adding story:', error)
      alert('Failed to add story')
    }
  }

  const handleUpdateStory = async (storyId: string, field: string, value: any) => {
    try {
      const { error } = await supabase
        .from('stories')
        .update({ [field]: value })
        .eq('id', storyId)

      if (error) throw error
      await loadData()
    } catch (error) {
      console.error('Error updating story:', error)
      alert('Failed to update story')
    }
  }

  const handleDeleteStory = async (storyId: string, epicId: string) => {
    if (!confirm('Are you sure you want to delete this story?')) return

    try {
      const { error } = await supabase
        .from('stories')
        .delete()
        .eq('id', storyId)

      if (error) throw error
      await loadData()
    } catch (error) {
      console.error('Error deleting story:', error)
      alert('Failed to delete story')
    }
  }

  const handleMoveStory = async (storyId: string, epicId: string, direction: 'up' | 'down') => {
    const epicStories = [...(stories[epicId] || [])].sort((a, b) => a.order_index - b.order_index)
    const currentIndex = epicStories.findIndex(s => s.id === storyId)
    if (currentIndex === -1) return

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= epicStories.length) return

    const currentStory = epicStories[currentIndex]
    const targetStory = epicStories[newIndex]

    try {
      // Swap order_index values
      await supabase
        .from('stories')
        .update({ order_index: targetStory.order_index })
        .eq('id', currentStory.id)

      await supabase
        .from('stories')
        .update({ order_index: currentStory.order_index })
        .eq('id', targetStory.id)

      await loadData()
    } catch (error) {
      console.error('Error moving story:', error)
      alert('Failed to move story')
    }
  }

  const toggleEpicExpansion = (epicId: string) => {
    setExpandedEpics(prev => {
      const newSet = new Set(prev)
      if (newSet.has(epicId)) {
        newSet.delete(epicId)
      } else {
        newSet.add(epicId)
      }
      return newSet
    })
  }

  const getEpicValue = (epic: EpicWithPriority): EpicWithPriority => {
    const pending = pendingEpicChanges[epic.id] || {}
    const r = pending.r !== undefined ? pending.r : epic.r
    const t = pending.t !== undefined ? pending.t : epic.t
    const q = pending.q !== undefined ? pending.q : epic.q
    const s = pending.s !== undefined ? pending.s : epic.s
    
    // Use metrics coefficients for weighted value
    const value = (r * metrics.R) + (t * metrics.T) + (q * metrics.Q) + (s * metrics.S)
    const totalSprintPoints = epic.total_sprint_points
    const priority = totalSprintPoints > 0 ? value / totalSprintPoints : 0

    return {
      ...epic,
      ...pending,
      title: localEpicTitles[epic.id] || epic.title,
      r,
      t,
      q,
      s,
      value,
      priority,
    }
  }

  const isEpicPrioritized = (epic: EpicWithPriority): boolean => {
    // Use saved values only for determining if epic is prioritized (not pending changes)
    return epic.r > 0 && epic.t > 0 && epic.q > 0 && epic.s > 0 && epic.total_sprint_points > 0
  }

  const hasPendingChanges = (epicId: string): boolean => {
    return pendingEpicChanges[epicId] && Object.keys(pendingEpicChanges[epicId]).length > 0
  }

  const separateEpics = () => {
    const prioritized: EpicWithPriority[] = []
    const unprioritized: EpicWithPriority[] = []

    // Use original epic data (from DB) for sorting, not pending changes
    epics.forEach(epic => {
      // Check if epic is prioritized using SAVED values only
      const isPrioritized = epic.r > 0 && epic.t > 0 && epic.q > 0 && epic.s > 0 && epic.total_sprint_points > 0
      
      if (isPrioritized) {
        prioritized.push(epic) // Use original epic for sorting
      } else {
        unprioritized.push(epic) // Use original epic for sorting
      }
    })

    // Sort using SAVED priority values only (not pending changes)
    prioritized.sort((a, b) => {
      const priorityA = Number(a.priority)
      const priorityB = Number(b.priority)
      if (priorityA !== priorityB) return priorityB - priorityA
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })

    unprioritized.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    return { prioritized, unprioritized }
  }

  const handleLinkEdit = (epicId: string, currentLink: string | null) => {
    setEditingLink({ ...editingLink, [epicId]: true })
    setLinkInputs({ ...linkInputs, [epicId]: currentLink || '' })
  }

  const handleLinkSave = (epicId: string) => {
    const linkValue = linkInputs[epicId]?.trim() || null
    handleUpdateEpic(epicId, 'link', linkValue)
    setEditingLink({ ...editingLink, [epicId]: false })
  }

  const handleLinkCancel = (epicId: string) => {
    setEditingLink({ ...editingLink, [epicId]: false })
    setLinkInputs({ ...linkInputs, [epicId]: '' })
  }

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>
  }

  const { prioritized, unprioritized } = separateEpics()

  const renderEpicRow = (epic: EpicWithPriority, isExpanded: boolean) => {
    const hasChanges = hasPendingChanges(epic.id)
    const epicStories = stories[epic.id] || []
    // Use getEpicValue for display (shows pending changes), but sorting uses original epic
    const displayEpic = getEpicValue(epic)

    return (
      <>
        <tr 
          key={epic.id} 
          className={`hover:bg-gray-50 ${hasChanges ? 'bg-yellow-50 border-l-4 border-l-yellow-400' : ''}`}
        >
          <td className="px-4 py-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleEpicExpansion(epic.id)}
                className="text-gray-600 hover:text-gray-800"
              >
                {isExpanded ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </button>
              <textarea
                value={localEpicTitles[epic.id] || epic.title}
                onChange={(e) => {
                  handleUpdateEpicTitle(epic.id, e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = e.target.scrollHeight + 'px'
                }}
                className="flex-1 min-w-[200px] px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-hidden"
                rows={1}
                style={{ minHeight: '32px' }}
              />
            </div>
          </td>
          <td className="px-4 py-3 whitespace-nowrap">
            {editingLink[epic.id] ? (
              <div className="flex gap-1 items-center">
                <input
                  type="url"
                  value={linkInputs[epic.id] || ''}
                  onChange={(e) => setLinkInputs({ ...linkInputs, [epic.id]: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleLinkSave(epic.id)
                    } else if (e.key === 'Escape') {
                      handleLinkCancel(epic.id)
                    }
                  }}
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter URL"
                  autoFocus
                />
                <button
                  onClick={() => handleLinkSave(epic.id)}
                  className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                >
                  ✓
                </button>
                <button
                  onClick={() => handleLinkCancel(epic.id)}
                  className="px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {epic.link ? (
                  <a
                    href={epic.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <span className="text-xs">Open</span>
                  </a>
                ) : null}
                <button
                  onClick={() => handleLinkEdit(epic.id, epic.link)}
                  className="px-2 py-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
                  title={epic.link ? 'Edit link' : 'Add link'}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={epic.link ? "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" : "M12 4v16m8-8H4"} />
                  </svg>
                </button>
              </div>
            )}
          </td>
          <td className="px-4 py-3 whitespace-nowrap">
            <select
              value={pendingEpicChanges[epic.id]?.r !== undefined ? pendingEpicChanges[epic.id].r : epic.r}
              onChange={(e) => handleUpdateEpic(epic.id, 'r', parseInt(e.target.value))}
              className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="0">-</option>
              {SCORE_OPTIONS.filter(score => score > 0).map((score) => (
                <option key={score} value={score}>{score}</option>
              ))}
            </select>
          </td>
          <td className="px-4 py-3 whitespace-nowrap">
            <select
              value={pendingEpicChanges[epic.id]?.t !== undefined ? pendingEpicChanges[epic.id].t : epic.t}
              onChange={(e) => handleUpdateEpic(epic.id, 't', parseInt(e.target.value))}
              className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="0">-</option>
              {SCORE_OPTIONS.filter(score => score > 0).map((score) => (
                <option key={score} value={score}>{score}</option>
              ))}
            </select>
          </td>
          <td className="px-4 py-3 whitespace-nowrap">
            <select
              value={pendingEpicChanges[epic.id]?.q !== undefined ? pendingEpicChanges[epic.id].q : epic.q}
              onChange={(e) => handleUpdateEpic(epic.id, 'q', parseInt(e.target.value))}
              className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="0">-</option>
              {SCORE_OPTIONS.filter(score => score > 0).map((score) => (
                <option key={score} value={score}>{score}</option>
              ))}
            </select>
          </td>
          <td className="px-4 py-3 whitespace-nowrap">
            <select
              value={pendingEpicChanges[epic.id]?.s !== undefined ? pendingEpicChanges[epic.id].s : epic.s}
              onChange={(e) => handleUpdateEpic(epic.id, 's', parseInt(e.target.value))}
              className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="0">-</option>
              {SCORE_OPTIONS.filter(score => score > 0).map((score) => (
                <option key={score} value={score}>{score}</option>
              ))}
            </select>
          </td>
          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
            {displayEpic.value}
          </td>
          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
            {epic.total_sprint_points}
          </td>
          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
            {displayEpic.priority.toFixed(2)}
          </td>
          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
            {epic.gate_count || 0}
          </td>
          <td className="px-4 py-3 whitespace-nowrap">
            <button
              onClick={() => handleDeleteEpic(epic.id)}
              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Delete
            </button>
          </td>
          <td className="px-4 py-3 whitespace-nowrap">
            {hasChanges ? (
              <button
                onClick={() => handleConfirmEpicChanges(epic.id)}
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
        {isExpanded && epicStories.map((story, index) => (
          <tr key={story.id} className={`bg-gray-50 ${story.gate ? 'border-l-4 border-l-yellow-400' : ''}`}>
            <td className="px-4 py-2">
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => handleMoveStory(story.id, epic.id, 'up')}
                    disabled={index === 0}
                    className="px-1 py-0.5 text-xs bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => handleMoveStory(story.id, epic.id, 'down')}
                    disabled={index === epicStories.length - 1}
                    className="px-1 py-0.5 text-xs bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Move down"
                  >
                    ↓
                  </button>
                </div>
                <StoryTitleTooltip title={story.title}>
                  <input
                    type="text"
                    value={story.title}
                    onChange={(e) => handleUpdateStory(story.id, 'title', e.target.value)}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </StoryTitleTooltip>
              </div>
            </td>
            <td className="px-4 py-2 whitespace-nowrap">
              {story.link ? (
                <a
                  href={story.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Open
                </a>
              ) : (
                <span className="text-gray-400 text-sm">-</span>
              )}
            </td>
            <td colSpan={4} className="px-4 py-2 text-center text-gray-400 text-sm">-</td>
            <td className="px-4 py-2 whitespace-nowrap">
              <select
                value={story.sprint_points}
                onChange={(e) => handleUpdateStory(story.id, 'sprint_points', parseInt(e.target.value))}
                className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SPRINT_POINTS_OPTIONS.map((points) => (
                  <option key={points} value={points}>{points}</option>
                ))}
              </select>
            </td>
            <td className="px-4 py-2 whitespace-nowrap">
              <select
                value={story.gate ? 'Yes' : 'No'}
                onChange={(e) => handleUpdateStory(story.id, 'gate', e.target.value === 'Yes')}
                className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </td>
            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-400">-</td>
            <td className="px-4 py-2 whitespace-nowrap">
              <button
                onClick={() => handleDeleteStory(story.id, epic.id)}
                className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
              >
                Delete
              </button>
            </td>
            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-400">-</td>
          </tr>
        ))}
        {isExpanded && (
          <tr className="bg-gray-50">
            <td colSpan={12} className="px-4 py-2">
              <button
                onClick={() => handleAddStory(epic.id)}
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                + Add Story to Epic
              </button>
            </td>
          </tr>
        )}
      </>
    )
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Epics</h2>
        </div>
        <div className="flex flex-col gap-2 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex gap-2 items-start">
            <textarea
              value={newEpicTitle}
              onChange={(e) => {
                setNewEpicTitle(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = e.target.scrollHeight + 'px'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleAddEpic()
                }
              }}
              placeholder="New epic title"
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
              onClick={handleAddEpic}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Add Epic
            </button>
          </div>
          {showLinkInput && (
            <div className="flex gap-2">
              <input
                type="url"
                value={newEpicLink}
                onChange={(e) => setNewEpicLink(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddEpic()}
                placeholder="ClickUp link (optional)"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        {prioritized.length > 0 && (
          <>
            <div className="mb-4 mt-6">
              <h3 className="text-lg font-semibold text-gray-800">Prioritized Epics</h3>
              <p className="text-sm text-gray-600">Epics with all RTQS scores and stories</p>
            </div>
            <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm mb-8">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Epic</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Link</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">R</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">T</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Q</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">S</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Value</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Total SP</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Gates</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Actions</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Confirm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {prioritized.map(epic => renderEpicRow(epic, expandedEpics.has(epic.id)))}
              </tbody>
            </table>
          </>
        )}

        {unprioritized.length > 0 && (
          <>
            <div className="mb-4 mt-6 border-t-2 border-gray-300 pt-6">
              <h3 className="text-lg font-semibold text-gray-800">Unprioritized Epics</h3>
              <p className="text-sm text-gray-600">Epics awaiting RTQS scores or stories</p>
            </div>
            <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Epic</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Link</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">R</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">T</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Q</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">S</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Value</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Total SP</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Gates</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Actions</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Confirm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {unprioritized.map(epic => renderEpicRow(epic, expandedEpics.has(epic.id)))}
              </tbody>
            </table>
          </>
        )}

        {epics.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No epics yet. Create one above!
          </div>
        )}
      </div>
    </div>
  )
}

