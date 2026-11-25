import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import {useAuth} from '../auth/AuthContext'
export default function Header() {
  const [open, setOpen] = useState(false);const {user}=useAuth()
  const close = () => setOpen(false)
  return (<header className="header"><div className="container bar">
    <Link to="/" className="logo" onClick={close}>Cauã<span>Viral</span></Link>
    <nav className={open ? 'nav open' : 'nav'}>
      <a href="/#servicos" onClick={close}>Serviços</a><a href="/#exemplos" onClick={close}>Exemplos</a>
      <a href="/#como-funciona" onClick={close}>Como funciona</a><a href="/#faq" onClick={close}>Dúvidas</a>
      <Link to={user?'/cliente':'/entrar'} className="btn small" onClick={close}>{user?'Minha área':'Entrar'}</Link>
    </nav>
    <button className="burger" aria-label="Menu" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
  </div></header>)
}
