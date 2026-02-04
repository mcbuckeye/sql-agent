import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  History as HistoryIcon, 
  Star, 
  StarOff,
  Play,
  Copy,
  Check,
  Filter
} from 'lucide-react'
import { queryApi, connectionsApi } from '../lib/api'
import { LoadingSpinner } from '../components/LoadingSpinner'
import type { QueryHistory, Connection } from '../types'
import clsx from 'clsx'

export function HistoryPage() {
  const navigate = useNavigate()
  const [history, setHistory] = useState<QueryHistory[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<{
    connectionId?: number
    onlyFavorites: boolean
    status?: string
  }>({
    onlyFavorites: false
  })
  const [copiedId, setCopiedId] = useState<number | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [historyData, connectionsData] = await Promise.all([
        queryApi.history(undefined, 100),
        connectionsApi.list()
      ])
      setHistory(historyData)
      setConnections(connectionsData)
    } catch (err) {
      console.error('Failed to fetch data:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleFavorite = async (id: number) => {
    try {
      const result = await queryApi.toggleFavorite(id)
      setHistory(history.map(h => 
        h.id === id ? { ...h, is_favorite: result.is_favorite } : h
      ))
    } catch (err) {
      console.error('Failed to toggle favorite:', err)
    }
  }

  const copySQL = async (sql: string, id: number) => {
    await navigator.clipboard.writeText(sql)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const runQuery = (query: QueryHistory) => {
    navigate(`/query?connection=${query.connection_id}`, {
      state: { query: query.natural_language_query || query.generated_sql }
    })
  }

  const getConnectionName = (connectionId: number) => {
    return connections.find(c => c.id === connectionId)?.name || 'Unknown'
  }

  const filteredHistory = history.filter(h => {
    if (filter.connectionId && h.connection_id !== filter.connectionId) return false
    if (filter.onlyFavorites && !h.is_favorite) return false
    if (filter.status && h.status !== filter.status) return false
    return true
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Query History</h1>
        
        {/* Filters */}
        <div className="flex items-center gap-3">
          <select
            value={filter.connectionId || ''}
            onChange={(e) => setFilter({
              ...filter,
              connectionId: e.target.value ? parseInt(e.target.value) : undefined
            })}
            className="px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Connections</option>
            {connections.map(conn => (
              <option key={conn.id} value={conn.id}>{conn.name}</option>
            ))}
          </select>

          <select
            value={filter.status || ''}
            onChange={(e) => setFilter({
              ...filter,
              status: e.target.value || undefined
            })}
            className="px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Status</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
          </select>

          <button
            onClick={() => setFilter({ ...filter, onlyFavorites: !filter.onlyFavorites })}
            className={clsx(
              'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors',
              filter.onlyFavorites
                ? 'border-yellow-500 bg-yellow-500/10 text-yellow-500'
                : 'border-[var(--border-color)] hover:bg-[var(--bg-secondary)]'
            )}
          >
            <Star className="w-4 h-4" />
            <span className="text-sm">Favorites</span>
          </button>
        </div>
      </div>

      {filteredHistory.length === 0 ? (
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-12 text-center">
          <HistoryIcon className="w-16 h-16 mx-auto mb-4 text-[var(--text-secondary)]" />
          <h2 className="text-xl font-semibold mb-2">
            {filter.onlyFavorites ? 'No favorite queries' : 'No queries yet'}
          </h2>
          <p className="text-[var(--text-secondary)]">
            {filter.onlyFavorites
              ? 'Star some queries to see them here'
              : 'Your query history will appear here'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredHistory.map((query) => (
            <div
              key={query.id}
              className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  {query.natural_language_query && (
                    <p className="font-medium mb-1">{query.natural_language_query}</p>
                  )}
                  <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <span>{getConnectionName(query.connection_id)}</span>
                    <span>•</span>
                    <span>{new Date(query.executed_at).toLocaleString()}</span>
                    {query.execution_time_ms && (
                      <>
                        <span>•</span>
                        <span>{query.execution_time_ms}ms</span>
                      </>
                    )}
                    {query.row_count !== null && (
                      <>
                        <span>•</span>
                        <span>{query.row_count} rows</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 ml-4">
                  <span
                    className={clsx(
                      'px-2 py-1 text-xs rounded-full',
                      query.status === 'success'
                        ? 'bg-green-500/10 text-green-500'
                        : 'bg-red-500/10 text-red-500'
                    )}
                  >
                    {query.status}
                  </span>
                </div>
              </div>

              {query.generated_sql && (
                <div className="bg-[var(--bg-primary)] rounded-lg p-3 mb-3 overflow-x-auto">
                  <pre className="text-sm">
                    <code>{query.generated_sql}</code>
                  </pre>
                </div>
              )}

              {query.error_message && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-3 text-sm text-red-500">
                  {query.error_message}
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleFavorite(query.id)}
                  className={clsx(
                    'p-2 rounded-lg transition-colors',
                    query.is_favorite
                      ? 'text-yellow-500 hover:bg-yellow-500/10'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]'
                  )}
                  title={query.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  {query.is_favorite ? (
                    <Star className="w-4 h-4 fill-current" />
                  ) : (
                    <StarOff className="w-4 h-4" />
                  )}
                </button>

                {query.generated_sql && (
                  <button
                    onClick={() => copySQL(query.generated_sql!, query.id)}
                    className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] transition-colors"
                    title="Copy SQL"
                  >
                    {copiedId === query.id ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                )}

                <button
                  onClick={() => runQuery(query)}
                  className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] hover:text-indigo-500 transition-colors"
                  title="Run again"
                >
                  <Play className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
