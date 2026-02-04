import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Database, 
  Plus, 
  Trash2, 
  Edit, 
  TestTube2, 
  RefreshCw,
  Check,
  X,
  ExternalLink
} from 'lucide-react'
import { connectionsApi } from '../lib/api'
import { Modal } from '../components/Modal'
import { LoadingSpinner } from '../components/LoadingSpinner'
import type { Connection, ConnectionCreate } from '../types'

const DB_TYPES = [
  { value: 'postgres', label: 'PostgreSQL', defaultPort: 5432 },
  { value: 'mysql', label: 'MySQL', defaultPort: 3306 },
  { value: 'sqlite', label: 'SQLite', defaultPort: null },
  { value: 'mssql', label: 'SQL Server', defaultPort: 1433 }
]

export function ConnectionsPage() {
  const navigate = useNavigate()
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null)
  const [testResults, setTestResults] = useState<Record<number, { success: boolean; message: string }>>({})
  const [testing, setTesting] = useState<number | null>(null)

  const [formData, setFormData] = useState<ConnectionCreate>({
    name: '',
    db_type: 'postgres',
    host: '',
    port: 5432,
    database_name: '',
    username: '',
    password: '',
    ssl_enabled: false,
    is_readonly: true
  })

  useEffect(() => {
    fetchConnections()
  }, [])

  const fetchConnections = async () => {
    try {
      const data = await connectionsApi.list()
      setConnections(data)
    } catch (err) {
      console.error('Failed to fetch connections:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDbTypeChange = (dbType: string) => {
    const type = DB_TYPES.find(t => t.value === dbType)
    setFormData({
      ...formData,
      db_type: dbType,
      port: type?.defaultPort || undefined
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingConnection) {
        await connectionsApi.update(editingConnection.id, formData)
      } else {
        await connectionsApi.create(formData)
      }
      setShowModal(false)
      setEditingConnection(null)
      resetForm()
      fetchConnections()
    } catch (err) {
      console.error('Failed to save connection:', err)
    }
  }

  const handleEdit = (conn: Connection) => {
    setEditingConnection(conn)
    setFormData({
      name: conn.name,
      db_type: conn.db_type,
      host: conn.host || '',
      port: conn.port || undefined,
      database_name: conn.database_name || '',
      username: conn.username || '',
      password: '',
      ssl_enabled: conn.ssl_enabled,
      is_readonly: conn.is_readonly
    })
    setShowModal(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this connection?')) return
    try {
      await connectionsApi.delete(id)
      fetchConnections()
    } catch (err) {
      console.error('Failed to delete connection:', err)
    }
  }

  const handleTest = async (id: number) => {
    setTesting(id)
    try {
      const result = await connectionsApi.test(id)
      setTestResults({ ...testResults, [id]: result })
    } catch (err: any) {
      setTestResults({
        ...testResults,
        [id]: { success: false, message: err.response?.data?.detail || 'Test failed' }
      })
    } finally {
      setTesting(null)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      db_type: 'postgres',
      host: '',
      port: 5432,
      database_name: '',
      username: '',
      password: '',
      ssl_enabled: false,
      is_readonly: true
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Database Connections</h1>
        <button
          onClick={() => {
            setEditingConnection(null)
            resetForm()
            setShowModal(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Connection
        </button>
      </div>

      {connections.length === 0 ? (
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-12 text-center">
          <Database className="w-16 h-16 mx-auto mb-4 text-[var(--text-secondary)]" />
          <h2 className="text-xl font-semibold mb-2">No connections yet</h2>
          <p className="text-[var(--text-secondary)] mb-6">
            Add a database connection to start querying with natural language
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Connection
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {connections.map((conn) => (
            <div
              key={conn.id}
              className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-indigo-500/10">
                    <Database className="w-6 h-6 text-indigo-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{conn.name}</h3>
                    <p className="text-sm text-[var(--text-secondary)]">
                      <span className="uppercase">{conn.db_type}</span>
                      {conn.host && ` • ${conn.host}:${conn.port}`}
                      {conn.database_name && ` • ${conn.database_name}`}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {conn.is_readonly && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500">
                          Read-only
                        </span>
                      )}
                      {conn.ssl_enabled && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">
                          SSL
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/query?connection=${conn.id}`)}
                    className="p-2 rounded-lg hover:bg-[var(--bg-primary)] transition-colors text-[var(--text-secondary)] hover:text-indigo-500"
                    title="Query"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleTest(conn.id)}
                    disabled={testing === conn.id}
                    className="p-2 rounded-lg hover:bg-[var(--bg-primary)] transition-colors text-[var(--text-secondary)] hover:text-indigo-500"
                    title="Test Connection"
                  >
                    {testing === conn.id ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <TestTube2 className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleEdit(conn)}
                    className="p-2 rounded-lg hover:bg-[var(--bg-primary)] transition-colors text-[var(--text-secondary)] hover:text-indigo-500"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(conn.id)}
                    className="p-2 rounded-lg hover:bg-[var(--bg-primary)] transition-colors text-[var(--text-secondary)] hover:text-red-500"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {testResults[conn.id] && (
                <div
                  className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
                    testResults[conn.id].success
                      ? 'bg-green-500/10 text-green-500'
                      : 'bg-red-500/10 text-red-500'
                  }`}
                >
                  {testResults[conn.id].success ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                  {testResults[conn.id].message}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          setEditingConnection(null)
          resetForm()
        }}
        title={editingConnection ? 'Edit Connection' : 'Add Connection'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="My Database"
              required
              className="w-full px-4 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Database Type</label>
            <select
              value={formData.db_type}
              onChange={(e) => handleDbTypeChange(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {DB_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {formData.db_type !== 'sqlite' ? (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-2">Host</label>
                  <input
                    type="text"
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    placeholder="localhost"
                    className="w-full px-4 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Port</label>
                  <input
                    type="number"
                    value={formData.port || ''}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || undefined })}
                    className="w-full px-4 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Database Name</label>
                <input
                  type="text"
                  value={formData.database_name}
                  onChange={(e) => setFormData({ ...formData, database_name: e.target.value })}
                  placeholder="mydb"
                  className="w-full px-4 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Username</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="user"
                    className="w-full px-4 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Password</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingConnection ? '(unchanged)' : '••••••••'}
                    className="w-full px-4 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-2">Database Path</label>
              <input
                type="text"
                value={formData.database_name}
                onChange={(e) => setFormData({ ...formData, database_name: e.target.value })}
                placeholder="/path/to/database.db"
                className="w-full px-4 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.ssl_enabled}
                onChange={(e) => setFormData({ ...formData, ssl_enabled: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">SSL Enabled</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_readonly}
                onChange={(e) => setFormData({ ...formData, is_readonly: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Read-only</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowModal(false)
                setEditingConnection(null)
                resetForm()
              }}
              className="px-4 py-2 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
            >
              {editingConnection ? 'Save Changes' : 'Add Connection'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
