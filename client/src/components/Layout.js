import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import '../styles/layout.css'

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="siaf-app">
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      <div className="siaf-main-area">
        <Topbar onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
        <main className="siaf-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout
