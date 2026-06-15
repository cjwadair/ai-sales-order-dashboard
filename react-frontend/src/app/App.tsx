import { NavLink, Route, Routes } from 'react-router-dom'
import { NotFoundPage } from '../pages/NotFoundPage'
import { OrdersPage } from '../pages/OrdersPage'
import { OrdersIrPage } from '../pages/OrdersIrPage'
import { ChatPage } from '../pages/ChatPage'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDolly, faGauge, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons'
import { ThemeContext } from '../contexts'
import { useEffect, useState } from 'react'

export function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light')

  return (
    <ThemeContext value={{ theme, toggleTheme }}>
      <div className="flex min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        
        <header className="border-r w-24 min-h-screen border-neutral-200 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900">
          <div className="mx-auto flex flex-col max-w-6xl items-center justify-between px-4 pb-4 sm:px-6 lg:px-8">
            <h1 className="text-xl text-neutral-700 font-semibold tracking-tight h-14 flex items-center">Logo</h1>
            <nav className="flex flex-col items-center gap-6 text-base font-medium text-neutral-800 mt-8 dark:text-neutral-400">
              <NavLink
                to="/chat"
                className={({ isActive }) =>`flex flex-col gap-y-1.5 items-center rounded-md px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 ${isActive ? 'hover:text-neutral-900' : 'text-accent-800'}`}
              >
                {({ isActive }) => (
                  <>
                    <FontAwesomeIcon
                      icon={faGauge}
                      className={`text-2xl text-center ${isActive ? 'text-brand-500 hover:text-brand-600' : 'text-accent-800'}`}
                    />
                    <div className={`text-xs`}>Dashboard</div>
                  </>
                )}
              </NavLink>
              <NavLink
                to="/orders"
                className={({ isActive }) =>`flex flex-col gap-y-1.5 items-center w-full rounded-md px-2 py-2 dark:hover:bg-neutral-800 ${isActive ? 'hover:text-neutral-900' : 'text-neutral-700'}`}
              >
                {({ isActive }) => (
                  <>
                    <FontAwesomeIcon
                      icon={faDolly}
                      className={`text-2xl text-center ${isActive ? 'text-brand-500 hover:text-brand-600' : 'text-neutral-700'}`}
                    />
                    <div className={`text-xs`}>Orders</div>
                  </>
                )}
              </NavLink>
              <NavLink
                to="/orders-ir"
                className={({ isActive }) =>`flex flex-col gap-y-1.5 items-center w-full rounded-md px-2 py-2 dark:hover:bg-neutral-800 ${isActive ? 'hover:text-neutral-900' : 'text-neutral-700'}`}
              >
                {({ isActive }) => (
                  <>
                    <FontAwesomeIcon
                      icon={faWandMagicSparkles}
                      className={`text-2xl text-center ${isActive ? 'text-brand-500 hover:text-brand-600' : 'text-neutral-700'}`}
                    />
                    <div className={`text-xs`}>Smart</div>
                  </>
                )}
              </NavLink>
            </nav>
          </div>
        </header>

        <main className="flex-1 min-w-0 w-full">
          <Routes>
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders-ir" element={<OrdersIrPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
      </div>
    </ThemeContext>
  )
}