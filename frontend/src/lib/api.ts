import axios from 'axios'
import type { 
  Connection, 
  ConnectionCreate, 
  Schema, 
  AskResponse, 
  QueryHistory,
  QueryResult,
  ChartSuggestion
} from '../types'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth
export const authApi = {
  login: async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password })
    return res.data
  },
  logout: async () => {
    await api.post('/auth/logout')
    localStorage.removeItem('token')
  },
  me: async () => {
    const res = await api.get('/auth/me')
    return res.data
  }
}

// Connections
export const connectionsApi = {
  list: async (): Promise<Connection[]> => {
    const res = await api.get('/connections')
    return res.data
  },
  create: async (data: ConnectionCreate): Promise<Connection> => {
    const res = await api.post('/connections', data)
    return res.data
  },
  update: async (id: number, data: Partial<ConnectionCreate>): Promise<Connection> => {
    const res = await api.put(`/connections/${id}`, data)
    return res.data
  },
  delete: async (id: number) => {
    await api.delete(`/connections/${id}`)
  },
  test: async (id: number) => {
    const res = await api.post(`/connections/${id}/test`)
    return res.data
  },
  getSchema: async (id: number): Promise<Schema> => {
    const res = await api.get(`/connections/${id}/schema`)
    return res.data
  },
  refreshSchema: async (id: number): Promise<Schema> => {
    const res = await api.post(`/connections/${id}/refresh-schema`)
    return res.data
  },
  previewTable: async (connectionId: number, tableName: string) => {
    const res = await api.get(`/connections/${connectionId}/tables/${tableName}/preview`)
    return res.data
  }
}

// Query
export const queryApi = {
  generate: async (connectionId: number, naturalLanguage: string) => {
    const res = await api.post('/query/generate', {
      connection_id: connectionId,
      natural_language: naturalLanguage
    })
    return res.data
  },
  execute: async (connectionId: number, sql: string): Promise<QueryResult> => {
    const res = await api.post('/query/execute', {
      connection_id: connectionId,
      sql
    })
    return res.data
  },
  ask: async (connectionId: number, naturalLanguage: string, autoExecute: boolean = true, parameters?: Record<string, any>): Promise<AskResponse> => {
    const res = await api.post('/query/ask', {
      connection_id: connectionId,
      natural_language: naturalLanguage,
      auto_execute: autoExecute,
      parameters
    })
    return res.data
  },
  
  detectParameters: async (connectionId: number, naturalLanguage: string): Promise<{
    needs_parameters: boolean
    parameters: Array<{
      name: string
      label: string
      type: string
      description?: string
      default?: any
      required: boolean
      options?: string[]
    }>
    clarification?: string
  }> => {
    const res = await api.post('/query/detect-parameters', {
      connection_id: connectionId,
      natural_language: naturalLanguage
    })
    return res.data
  },
  history: async (connectionId?: number, limit: number = 50): Promise<QueryHistory[]> => {
    const params = new URLSearchParams()
    if (connectionId) params.append('connection_id', connectionId.toString())
    params.append('limit', limit.toString())
    const res = await api.get(`/query/history?${params}`)
    return res.data
  },
  toggleFavorite: async (historyId: number) => {
    const res = await api.put(`/query/history/${historyId}/favorite`)
    return res.data
  },
  suggestions: async (connectionId: number): Promise<string[]> => {
    const res = await api.get(`/query/suggestions?connection_id=${connectionId}`)
    return res.data.suggestions
  },

  submitFeedback: async (data: {
    connection_id: number
    natural_language: string
    original_sql: string
    corrected_sql: string
  }) => {
    const res = await api.post('/query/feedback', data)
    return res.data
  }
}

// Visualizations
export const vizApi = {
  suggest: async (columns: string[], sampleData: any[][]): Promise<ChartSuggestion[]> => {
    const res = await api.post('/visualize/suggest', {
      columns,
      sample_data: sampleData
    })
    return res.data.suggestions
  }
}

export default api
