import React, { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useUserStore } from './store'
import MainLayout from './layouts/MainLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import OrderList from './pages/OrderList'
import OrderDetail from './pages/OrderDetail'
import CreateOrder from './pages/CreateOrder'
import DesignList from './pages/DesignList'
import ProductionList from './pages/ProductionList'
import QualityList from './pages/QualityList'
import ComplaintList from './pages/ComplaintList'
import NotificationList from './pages/NotificationList'

const PrivateRoute = ({ children }) => {
  const token = useUserStore(state => state.token)
  const location = useLocation()

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}

function App() {
  const token = useUserStore(state => state.token)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (token && location.pathname === '/login') {
      navigate('/dashboard', { replace: true })
    }
  }, [token, location.pathname, navigate])

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="orders" element={<OrderList />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="create-order" element={<CreateOrder />} />
        <Route path="designs" element={<DesignList />} />
        <Route path="productions" element={<ProductionList />} />
        <Route path="quality" element={<QualityList />} />
        <Route path="complaints" element={<ComplaintList />} />
        <Route path="notifications" element={<NotificationList />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
