import { create } from 'zustand'
import type { User, Connection } from '../types'

interface AuthState {
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  setAuth: (user, token) => {
    localStorage.setItem('token', token)
    set({ user, token })
  },
  clearAuth: () => {
    localStorage.removeItem('token')
    set({ user: null, token: null })
  }
}))

interface AppState {
  darkMode: boolean
  selectedConnection: Connection | null
  toggleDarkMode: () => void
  setSelectedConnection: (conn: Connection | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  darkMode: localStorage.getItem('darkMode') === 'true',
  selectedConnection: null,
  toggleDarkMode: () => set((state) => {
    const newMode = !state.darkMode
    localStorage.setItem('darkMode', String(newMode))
    document.documentElement.classList.toggle('dark', newMode)
    return { darkMode: newMode }
  }),
  setSelectedConnection: (conn) => set({ selectedConnection: conn })
}))
