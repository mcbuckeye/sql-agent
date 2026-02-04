import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Database, MessageSquare, History, Plus, ArrowRight } from 'lucide-react'
import { connectionsApi, queryApi } from '../lib/api'
import { LoadingSpinner } from '../components/LoadingSpinner'
import type { Connection, QueryHistory } from '../types'

export function DashboardPage() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [recentQueries, setRecentQueries] = useState<QueryHistory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [conns, history] = await Promise.all([
          connectionsApi.list(),
          queryApi.history(undefined, 5)
        ])
        setConnections(conns)
        setRecentQueries(history)
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-indigo-500/10">
              <Database className="w-6 h-6 text-indigo-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{connections.length}</p>
              <p className="text-[var(--text-secondary)] text-sm">Connections</p>
            </div>
          </div>
        </div>

        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-purple-500/10">
              <MessageSquare className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{recentQueries.length}</p>
              <p className="text-[var(--text-secondary)] text-sm">Recent Queries</p>
            </div>
          </div>
        </div>

        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-green-500/10">
              <History className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {recentQueries.filter(q => q.status === 'success').length}
              </p>
              <p className="text-[var(--text-secondary)] text-sm">Successful Queries</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Link
          to="/connections"
          className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-6 hover:border-indigo-500 transition-colors group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-indigo-500/10 group-hover:bg-indigo-500/20 transition-colors">
                <Plus className="w-6 h-6 text-indigo-500" />
              </div>
              <div>
                <h3 className="font-semibold">Add Connection</h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  Connect to PostgreSQL, MySQL, SQLite, or MSSQL
                </p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-[var(--text-secondary)] group-hover:text-indigo-500 transition-colors" />
          </div>
        </Link>

        <Link
          to="/query"
          className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-6 hover:border-purple-500 transition-colors group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                <MessageSquare className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <h3 className="font-semibold">New Query</h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  Ask questions in natural language
                </p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-[var(--text-secondary)] group-hover:text-purple-500 transition-colors" />
          </div>
        </Link>
      </div>

      {/* Connections */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Your Connections</h2>
          <Link
            to="/connections"
            className="text-sm text-indigo-500 hover:underline"
          >
            View all
          </Link>
        </div>

        {connections.length === 0 ? (
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-8 text-center">
            <Database className="w-12 h-12 mx-auto mb-4 text-[var(--text-secondary)]" />
            <p className="text-[var(--text-secondary)] mb-4">No connections yet</p>
            <Link
              to="/connections"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Connection
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {connections.slice(0, 3).map((conn) => (
              <Link
                key={conn.id}
                to={`/query?connection=${conn.id}`}
                className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-4 hover:border-indigo-500 transition-colors"
              >
                <div className="flex items-center gap-3 mb-2">
                  <Database className="w-5 h-5 text-indigo-500" />
                  <span className="font-medium">{conn.name}</span>
                </div>
                <div className="text-sm text-[var(--text-secondary)]">
                  <span className="uppercase">{conn.db_type}</span>
                  {conn.host && ` • ${conn.host}`}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent Queries */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Queries</h2>
          <Link
            to="/history"
            className="text-sm text-indigo-500 hover:underline"
          >
            View all
          </Link>
        </div>

        {recentQueries.length === 0 ? (
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-8 text-center">
            <History className="w-12 h-12 mx-auto mb-4 text-[var(--text-secondary)]" />
            <p className="text-[var(--text-secondary)]">No queries yet</p>
          </div>
        ) : (
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl overflow-hidden">
            {recentQueries.map((query, index) => (
              <div
                key={query.id}
                className={`p-4 ${index !== recentQueries.length - 1 ? 'border-b border-[var(--border-color)]' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {query.natural_language_query || query.generated_sql}
                    </p>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">
                      {new Date(query.executed_at).toLocaleString()}
                      {query.execution_time_ms && ` • ${query.execution_time_ms}ms`}
                      {query.row_count !== null && ` • ${query.row_count} rows`}
                    </p>
                  </div>
                  <span
                    className={`ml-2 px-2 py-1 text-xs rounded-full ${
                      query.status === 'success'
                        ? 'bg-green-500/10 text-green-500'
                        : 'bg-red-500/10 text-red-500'
                    }`}
                  >
                    {query.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
