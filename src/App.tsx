import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import Header from './components/Header'
import Footer from './components/Footer'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import ServicePage from './pages/ServicePage'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import ClientDashboard from './pages/ClientDashboard'
import ClientProfile from './pages/ClientProfile'
import OrderDetail from './pages/OrderDetail'
export default function App() {
  return (<BrowserRouter><AuthProvider><Header /><main><Routes>
    <Route path="/" element={<Home />} /><Route path="/servicos/:slug" element={<ServicePage />} />
    <Route path="/entrar" element={<Login />} /><Route path="/cadastro" element={<Register />} /><Route path="/recuperar-senha" element={<ForgotPassword />} /><Route path="/nova-senha" element={<ResetPassword />} />
    <Route path="/cliente" element={<ProtectedRoute><ClientDashboard/></ProtectedRoute>} /><Route path="/cliente/perfil" element={<ProtectedRoute><ClientProfile/></ProtectedRoute>} /><Route path="/cliente/pedidos/:id" element={<ProtectedRoute><OrderDetail/></ProtectedRoute>} />
  </Routes></main><Footer /></AuthProvider></BrowserRouter>)
}
