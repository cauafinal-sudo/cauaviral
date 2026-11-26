import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
export default function ProtectedRoute({children}:{children:React.ReactNode}) {
 const {user,loading,configured}=useAuth();const location=useLocation()
 if(loading)return <div className="container sec"><div className="care">Verificando sessão…</div></div>
 if(!configured)return <Navigate to="/entrar?setup=1" replace state={{from:location}}/>
 if(!user)return <Navigate to={`/entrar?redirect=${encodeURIComponent(location.pathname+location.search)}`} replace />
 return <>{children}</>
}
