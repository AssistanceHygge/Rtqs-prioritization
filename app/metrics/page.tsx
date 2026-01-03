'use client'

import { useEffect, useState } from 'react'
import { supabase, type Metric } from '@/lib/supabase'

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newMetric, setNewMetric] = useState({ name: '', coefficient: 1.0, sort_order: 0 })

  useEffect(() => {
    loadMetrics()
  }, [])

  const loadMetrics = async () => {
    try {
      const { data, error } = await supabase
        .from('metrics')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw error
      setMetrics(data || [])
      setLoading(false)
    } catch (error) {
      console.error('Error loading metrics:', error)
      setLoading(false)
    }
  }

  const handleAddMetric = async () => {
    if (!newMetric.name.trim()) {
      alert('Please enter a metric name')
      return
    }

    const metricName = newMetric.name.trim().toUpperCase()
    if (!['R', 'T', 'Q', 'S'].includes(metricName)) {
      alert('Only R, T, Q, or S metrics are allowed')
      return
    }

    // Find the max sort_order and add 1
    const maxSortOrder = metrics.length > 0 
      ? Math.max(...metrics.map(m => m.sort_order))
      : 0

    try {
      const { error } = await supabase
        .from('metrics')
        .insert({
          name: metricName,
          coefficient: newMetric.coefficient,
          sort_order: maxSortOrder + 1,
          is_active: true,
        })

      if (error) throw error
      setNewMetric({ name: '', coefficient: 1.0, sort_order: 0 })
      await loadMetrics()
    } catch (error: any) {
      console.error('Error adding metric:', error)
      if (error.code === '23505') {
        alert('A metric with this name already exists')
      } else {
        alert('Failed to add metric')
      }
    }
  }

  const handleUpdateMetric = async (id: string, field: string, value: any) => {
    try {
      const { error } = await supabase
        .from('metrics')
        .update({ [field]: value })
        .eq('id', id)

      if (error) throw error
      await loadMetrics()
    } catch (error) {
      console.error('Error updating metric:', error)
      alert('Failed to update metric')
    }
  }

  const handleDeleteMetric = async (id: string) => {
    if (!confirm('Are you sure you want to delete this metric? This will remove all scores for this metric.')) return

    try {
      const { error } = await supabase
        .from('metrics')
        .delete()
        .eq('id', id)

      if (error) throw error
      await loadMetrics()
    } catch (error) {
      console.error('Error deleting metric:', error)
      alert('Failed to delete metric')
    }
  }

  const handleDeactivateMetric = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('metrics')
        .update({ is_active: !isActive })
        .eq('id', id)

      if (error) throw error
      await loadMetrics()
    } catch (error) {
      console.error('Error deactivating metric:', error)
      alert('Failed to update metric')
    }
  }

  const handleMoveMetric = async (id: string, direction: 'up' | 'down') => {
    const index = metrics.findIndex(m => m.id === id)
    if (index === -1) return

    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= metrics.length) return

    const currentMetric = metrics[index]
    const targetMetric = metrics[newIndex]

    try {
      // Swap sort_order values
      await supabase
        .from('metrics')
        .update({ sort_order: targetMetric.sort_order })
        .eq('id', currentMetric.id)

      await supabase
        .from('metrics')
        .update({ sort_order: currentMetric.sort_order })
        .eq('id', targetMetric.id)

      await loadMetrics()
    } catch (error) {
      console.error('Error moving metric:', error)
      alert('Failed to move metric')
    }
  }

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>
  }

  return (
    <div className="px-4 py-6">
      <h2 className="text-2xl font-bold mb-6">Metrics</h2>

      {/* Add new metric form */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
        <h3 className="text-lg font-semibold mb-4">Add New Metric</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name (R, T, Q, or S)
            </label>
            <select
              value={newMetric.name}
              onChange={(e) => setNewMetric({ ...newMetric, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select metric</option>
              <option value="R">R</option>
              <option value="T">T</option>
              <option value="Q">Q</option>
              <option value="S">S</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Coefficient
            </label>
            <input
              type="number"
              step="0.1"
              value={newMetric.coefficient}
              onChange={(e) => setNewMetric({ ...newMetric, coefficient: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleAddMetric}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Add Metric
            </button>
          </div>
        </div>
      </div>

      {/* Metrics table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Order
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Coefficient
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {metrics.map((metric, index) => (
              <tr
                key={metric.id}
                className={!metric.is_active ? 'bg-gray-100 opacity-60' : ''}
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleMoveMetric(metric.id, 'up')}
                      disabled={index === 0}
                      className="px-2 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      ↑
                    </button>
                    <span className="text-sm font-medium text-gray-900">{metric.sort_order}</span>
                    <button
                      onClick={() => handleMoveMetric(metric.id, 'down')}
                      disabled={index === metrics.length - 1}
                      className="px-2 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      ↓
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {editingId === metric.id ? (
                    <input
                      type="text"
                      value={metric.name}
                      onChange={(e) => handleUpdateMetric(metric.id, 'name', e.target.value)}
                      onBlur={() => setEditingId(null)}
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                  ) : (
                    <span
                      className="text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600"
                      onClick={() => setEditingId(metric.id)}
                    >
                      {metric.name}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <input
                    type="number"
                    step="0.1"
                    value={metric.coefficient}
                    onChange={(e) => handleUpdateMetric(metric.id, 'coefficient', parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <button
                    onClick={() => handleDeactivateMetric(metric.id, metric.is_active)}
                    className={`px-3 py-1 rounded text-sm font-medium ${
                      metric.is_active
                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    {metric.is_active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <button
                    onClick={() => handleDeleteMetric(metric.id)}
                    className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {metrics.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No metrics yet. Add one above!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        <p><strong>Note:</strong> Only R, T, Q, and S metrics are supported. Changing a coefficient will automatically update epic values and priorities. Epic value = (R × R_coeff) + (T × T_coeff) + (Q × Q_coeff) + (S × S_coeff).</p>
      </div>
    </div>
  )
}

