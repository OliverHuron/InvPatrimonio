import React from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import '../styles/layout.css'

const Layout = () => {
  return (
    <div className="siaf-app">
      <Sidebar />
      <div className="siaf-main-area">
        <Topbar />
        <main className="siaf-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout
