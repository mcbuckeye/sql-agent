import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { 
  Database, 
  MessageSquare, 
  History, 
  LogOut, 
  Moon, 
  Sun,
  Home,
  Menu,
  X
} from 'lucide-react'
import { useAuthStore, useAppStore } from '../lib/store'
import { authApi } from '../lib/api'
import clsx from 'clsx'

const navItems = [
  { path: '/', icon: Home, label: 'Dashboard' },
  { path: '/connections', icon: Database, label: 'Connections' },
  { path: '/query', icon: MessageSquare, label: 'Query' },
  { path: '/history', icon: History, label: 'History' }
]

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, clearAuth } = useAuthStore()
  const { darkMode, toggleDarkMode } = useAppStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = async () => {
    try {
      await authApi.logout()
    } finally {
      clearAuth()
      navigate('/login')
    }
  }

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <Database className="w-5 h-5 text-indigo-500" />
          <span className="sql-highlight">SQL Agent</span>
        </h1>
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg hover:bg-[var(--bg-primary)] transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        'fixed md:static inset-y-0 left-0 z-50 w-64 border-r border-[var(--border-color)] bg-[var(--bg-secondary)] flex flex-col transform transition-transform duration-200 ease-in-out',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      )}>
        <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Database className="w-6 h-6 text-indigo-500" />
            <span className="sql-highlight">SQL Agent</span>
          </h1>
          <button
            onClick={closeSidebar}
            className="md:hidden p-2 rounded-lg hover:bg-[var(--bg-primary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ path, icon: Icon, label }) => (
            <Link
              key={path}
              to={path}
              onClick={closeSidebar}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                location.pathname === path
                  ? 'bg-indigo-500/10 text-indigo-500'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]'
              )}
            >
              <Icon className="w-5 h-5" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-[var(--border-color)] space-y-2">
          <button
            onClick={toggleDarkMode}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)] transition-colors"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>

        {user && (
          <div className="p-4 border-t border-[var(--border-color)]">
            <p className="text-sm text-[var(--text-secondary)] truncate">{user.email}</p>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
