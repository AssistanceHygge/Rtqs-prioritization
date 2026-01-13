'use client'

import { useEffect, useState } from 'react'
import { supabase, type EpicWithPriority, type Story } from '@/lib/supabase'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line } from 'recharts'

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4']

// Centralized bucket definitions
const PRIORITY_BUCKETS = [
  { name: '0-1', min: 0, max: 1 },
  { name: '1-2', min: 1, max: 2 },
  { name: '2-3', min: 2, max: 3 },
  { name: '3-5', min: 3, max: 5 },
  { name: '5+', min: 5, max: Infinity },
]

const VALUE_BUCKETS = [
  { name: '0-10', min: 0, max: 10 },
  { name: '11-20', min: 11, max: 20 },
  { name: '21-30', min: 21, max: 30 },
  { name: '31-35', min: 31, max: 35 },
  { name: '36-40', min: 36, max: 40 },
  { name: '40+', min: 40, max: Infinity },
]

const STORY_POSITION_BUCKETS = [
  { name: '1st', min: 0, max: 1 },
  { name: '2nd', min: 1, max: 2 },
  { name: '3rd', min: 2, max: 3 },
  { name: '4th+', min: 3, max: Infinity },
]

export default function AnalyticsPage() {
  const [epics, setEpics] = useState<EpicWithPriority[]>([])
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedView, setSelectedView] = useState<string>('priority')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
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
      setStories(storiesData || [])

      setLoading(false)
    } catch (error) {
      console.error('Error loading data:', error)
      setLoading(false)
    }
  }

  // Helper to bucket by priority
  const bucketByPriority = (epics: EpicWithPriority[]) => {
    const buckets = PRIORITY_BUCKETS.map(bucket => ({
      ...bucket,
      epics: [] as EpicWithPriority[],
    }))

    epics.forEach(epic => {
      const priority = Number(epic.priority)
      const bucket = buckets.find(b => priority >= b.min && priority < b.max)
      if (bucket) bucket.epics.push(epic)
    })

    return buckets
  }

  // Helper to bucket by value
  const bucketByValue = (epics: EpicWithPriority[]) => {
    const buckets = VALUE_BUCKETS.map(bucket => ({
      ...bucket,
      epics: [] as EpicWithPriority[],
    }))

    epics.forEach(epic => {
      const value = Number(epic.value)
      const bucket = buckets.find(b => value >= b.min && value < b.max)
      if (bucket) bucket.epics.push(epic)
    })

    return buckets
  }

  // A) Priority Range vs Total Epic Value
  const getPriorityVsValue = () => {
    const prioritizedEpics = epics.filter(e => e.r > 0 && e.t > 0 && e.q > 0 && e.s > 0 && e.total_sprint_points > 0)
    const buckets = bucketByPriority(prioritizedEpics)

    return buckets.map(bucket => ({
      name: bucket.name,
      totalValue: bucket.epics.reduce((sum, e) => sum + Number(e.value), 0),
      epicCount: bucket.epics.length,
    })).filter(b => b.epicCount > 0)
  }

  // B) Priority Range vs Total Epic Sprint Points
  const getPriorityVsSprintPoints = () => {
    const prioritizedEpics = epics.filter(e => e.r > 0 && e.t > 0 && e.q > 0 && e.s > 0 && e.total_sprint_points > 0)
    const buckets = bucketByPriority(prioritizedEpics)

    return buckets.map(bucket => ({
      name: bucket.name,
      totalSprintPoints: bucket.epics.reduce((sum, e) => sum + e.total_sprint_points, 0),
      epicCount: bucket.epics.length,
    })).filter(b => b.epicCount > 0)
  }

  // C) Story ranking inside epics vs story sprint points
  const getStoryPositionVsSprintPoints = () => {
    const buckets = STORY_POSITION_BUCKETS.map(bucket => ({
      ...bucket,
      stories: [] as Story[],
    }))

    stories.forEach(story => {
      const bucket = buckets.find(b => story.order_index >= b.min && story.order_index < b.max)
      if (bucket) bucket.stories.push(story)
    })

    return buckets.map(bucket => ({
      name: bucket.name,
      avgSprintPoints: bucket.stories.length > 0
        ? bucket.stories.reduce((sum, s) => sum + s.sprint_points, 0) / bucket.stories.length
        : 0,
      sumSprintPoints: bucket.stories.reduce((sum, s) => sum + s.sprint_points, 0),
      storyCount: bucket.stories.length,
    })).filter(b => b.storyCount > 0)
  }

  // D) Value Range vs #Epics and Avg Story Points
  const getValueRangeVsEpics = () => {
    const prioritizedEpics = epics.filter(e => e.r > 0 && e.t > 0 && e.q > 0 && e.s > 0)
    const buckets = bucketByValue(prioritizedEpics)

    return buckets.map(bucket => {
      const epicIds = bucket.epics.map(e => e.id)
      const bucketStories = stories.filter(s => epicIds.includes(s.epic_id))
      const avgSprintPoints = bucketStories.length > 0
        ? bucketStories.reduce((sum, s) => sum + s.sprint_points, 0) / bucketStories.length
        : 0

      return {
        name: bucket.name,
        epicCount: bucket.epics.length,
        avgSprintPoints: avgSprintPoints,
      }
    }).filter(b => b.epicCount > 0)
  }

  // E) R/T/Q/S Contribution Overview
  const getRTQSContribution = () => {
    const prioritizedEpics = epics.filter(e => e.r > 0 && e.t > 0 && e.q > 0 && e.s > 0)
    
    return [
      {
        name: 'R',
        total: prioritizedEpics.reduce((sum, e) => sum + e.r, 0),
        avg: prioritizedEpics.length > 0
          ? prioritizedEpics.reduce((sum, e) => sum + e.r, 0) / prioritizedEpics.length
          : 0,
      },
      {
        name: 'T',
        total: prioritizedEpics.reduce((sum, e) => sum + e.t, 0),
        avg: prioritizedEpics.length > 0
          ? prioritizedEpics.reduce((sum, e) => sum + e.t, 0) / prioritizedEpics.length
          : 0,
      },
      {
        name: 'Q',
        total: prioritizedEpics.reduce((sum, e) => sum + e.q, 0),
        avg: prioritizedEpics.length > 0
          ? prioritizedEpics.reduce((sum, e) => sum + e.q, 0) / prioritizedEpics.length
          : 0,
      },
      {
        name: 'S',
        total: prioritizedEpics.reduce((sum, e) => sum + e.s, 0),
        avg: prioritizedEpics.length > 0
          ? prioritizedEpics.reduce((sum, e) => sum + e.s, 0) / prioritizedEpics.length
          : 0,
      },
    ]
  }

  // F) Dimension vs Priority
  const getDimensionVsPriority = () => {
    const prioritizedEpics = epics.filter(e => e.r > 0 && e.t > 0 && e.q > 0 && e.s > 0 && e.total_sprint_points > 0)
    const buckets = bucketByPriority(prioritizedEpics)

    return buckets.map(bucket => {
      if (bucket.epics.length === 0) return null
      
      return {
        name: bucket.name,
        avgR: bucket.epics.reduce((sum, e) => sum + e.r, 0) / bucket.epics.length,
        avgT: bucket.epics.reduce((sum, e) => sum + e.t, 0) / bucket.epics.length,
        avgQ: bucket.epics.reduce((sum, e) => sum + e.q, 0) / bucket.epics.length,
        avgS: bucket.epics.reduce((sum, e) => sum + e.s, 0) / bucket.epics.length,
        epicCount: bucket.epics.length,
      }
    }).filter(b => b !== null && b.epicCount > 0)
  }

  // G) Gate Concentration
  const getGateConcentration = () => {
    const prioritizedEpics = epics.filter(e => e.r > 0 && e.t > 0 && e.q > 0 && e.s > 0 && e.total_sprint_points > 0)
    const buckets = bucketByPriority(prioritizedEpics)

    return buckets.map(bucket => {
      const epicIds = bucket.epics.map(e => e.id)
      const bucketStories = stories.filter(s => epicIds.includes(s.epic_id))
      const gateStories = bucketStories.filter(s => s.gate)
      const totalStories = bucketStories.length
      const gatePercent = totalStories > 0 ? (gateStories.length / totalStories) * 100 : 0

      return {
        name: bucket.name,
        totalGateStories: gateStories.length,
        gatePercent: gatePercent,
        totalStories: totalStories,
      }
    }).filter(b => b.totalStories > 0)
  }

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>
  }

  const prioritizedEpics = epics.filter(e => e.r > 0 && e.t > 0 && e.q > 0 && e.s > 0 && e.total_sprint_points > 0)

  if (prioritizedEpics.length === 0) {
    return (
      <div className="px-4 py-6">
        <h2 className="text-2xl font-bold mb-6">Analytics</h2>
        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 text-center">
          <p className="text-gray-500 text-lg">No data yet</p>
          <p className="text-gray-400 text-sm mt-2">Add epics with RTQS scores to see analytics</p>
        </div>
      </div>
    )
  }

  const priorityVsValue = getPriorityVsValue()
  const priorityVsSprintPoints = getPriorityVsSprintPoints()
  const storyPositionVsSprintPoints = getStoryPositionVsSprintPoints()
  const valueRangeVsEpics = getValueRangeVsEpics()
  const rtqsContribution = getRTQSContribution()
  const dimensionVsPriority = getDimensionVsPriority()
  const gateConcentration = getGateConcentration()

  return (
    <div className="px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Analytics</h2>
        <select
          value={selectedView}
          onChange={(e) => setSelectedView(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="priority">Priority Analysis</option>
          <option value="value">Value Analysis</option>
          <option value="stories">Story Analysis</option>
          <option value="dimensions">RTQS Dimensions</option>
          <option value="gates">Gate Analysis</option>
        </select>
      </div>

      {selectedView === 'priority' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">A) Priority Range vs Total Epic Value</h3>
            <p className="text-sm text-gray-600 mb-4">Where does most value sit across priority bands?</p>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={priorityVsValue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" label={{ value: 'Priority Range', position: 'insideBottom', offset: -5 }} />
                <YAxis label={{ value: 'Total Value', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="totalValue" fill="#3b82f6" name="Total Value" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">B) Priority Range vs Total Epic Sprint Points</h3>
            <p className="text-sm text-gray-600 mb-4">Where is most of the work located?</p>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={priorityVsSprintPoints}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" label={{ value: 'Priority Range', position: 'insideBottom', offset: -5 }} />
                <YAxis label={{ value: 'Total Sprint Points', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="totalSprintPoints" fill="#10b981" name="Total Sprint Points" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {selectedView === 'value' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">D) Value Range vs #Epics and Avg Story Points</h3>
            <p className="text-sm text-gray-600 mb-4">How many epics sit in each value band and how heavy are their stories?</p>
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={valueRangeVsEpics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" label={{ value: 'Value Range', position: 'insideBottom', offset: -5 }} />
                <YAxis yAxisId="left" label={{ value: 'Epic Count', angle: -90, position: 'insideLeft' }} />
                <YAxis yAxisId="right" orientation="right" label={{ value: 'Avg Sprint Points', angle: 90, position: 'insideRight' }} />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="epicCount" fill="#3b82f6" name="Epic Count" />
                <Line yAxisId="right" type="monotone" dataKey="avgSprintPoints" stroke="#f59e0b" name="Avg Sprint Points" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {selectedView === 'stories' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">C) Story Position vs Sprint Points</h3>
            <p className="text-sm text-gray-600 mb-4">Are we putting large stories early or late inside epics?</p>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={storyPositionVsSprintPoints}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" label={{ value: 'Story Position in Epic', position: 'insideBottom', offset: -5 }} />
                <YAxis label={{ value: 'Sprint Points', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="avgSprintPoints" fill="#8b5cf6" name="Avg Sprint Points" />
                <Bar dataKey="sumSprintPoints" fill="#ec4899" name="Total Sprint Points" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {selectedView === 'dimensions' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">E) R/T/Q/S Contribution Overview</h3>
            <p className="text-sm text-gray-600 mb-4">Are we over-weighting one dimension?</p>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={rtqsContribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis label={{ value: 'Total Score', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" fill="#3b82f6" name="Total Score" />
                <Bar dataKey="avg" fill="#10b981" name="Average Score" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">F) Dimension vs Priority</h3>
            <p className="text-sm text-gray-600 mb-4">What tends to drive high priority?</p>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={dimensionVsPriority}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" label={{ value: 'Priority Range', position: 'insideBottom', offset: -5 }} />
                <YAxis label={{ value: 'Average Score', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="avgR" fill="#ef4444" name="Avg R" />
                <Bar dataKey="avgT" fill="#3b82f6" name="Avg T" />
                <Bar dataKey="avgQ" fill="#10b981" name="Avg Q" />
                <Bar dataKey="avgS" fill="#f59e0b" name="Avg S" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {selectedView === 'gates' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">G) Gate Concentration</h3>
            <p className="text-sm text-gray-600 mb-4">Where are release risks?</p>
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={gateConcentration}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" label={{ value: 'Priority Range', position: 'insideBottom', offset: -5 }} />
                <YAxis yAxisId="left" label={{ value: 'Gate Stories', angle: -90, position: 'insideLeft' }} />
                <YAxis yAxisId="right" orientation="right" label={{ value: 'Gate %', angle: 90, position: 'insideRight' }} />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="totalGateStories" fill="#ef4444" name="Total Gate Stories" />
                <Line yAxisId="right" type="monotone" dataKey="gatePercent" stroke="#f59e0b" name="Gate %" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
