import { Link } from 'react-router-dom'
import { home } from '../../portfolio'
import Navbar from '../Navbar/Navbar'
import './Header.css'

const Header = () => {
  const { name } = home

  return (
    <header className='header center'>
      <h3>
        <Link to='/' className='link'>
          {name}
        </Link>
      </h3>
      <Navbar />
    </header>
  )
}

export default Header
