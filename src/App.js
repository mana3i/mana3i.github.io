import { useContext, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ThemeContext } from './contexts/theme'
import Header from './components/Header/Header'
import ScrollToTop from './components/ScrollToTop/ScrollToTop'
import Home from './pages/Home/Home'
import Projects from './pages/Projects/Projects'
import ProjectDetails from './pages/ProjectDetails/ProjectDetails'
import Certifications from './pages/Certifications/Certifications'
import About from './pages/About/About'
import './App.css'

const ScrollToTopOnNavigate = () => {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return null
}

const App = () => {
  const [{ themeName }] = useContext(ThemeContext)

  return (
    <div id='top' className={`${themeName} app`}>
      <Header />

      <main>
        <ScrollToTopOnNavigate />

        <Routes>
          <Route path='/' element={<Home />} />
          <Route path='/projects' element={<Projects />} />
          <Route path='/projects/:id' element={<ProjectDetails />} />
          <Route path='/certifications' element={<Certifications />} />
          <Route path='/about' element={<About />} />
          <Route path='*' element={<Navigate to='/' replace />} />
        </Routes>
      </main>

      <ScrollToTop />
    </div>
  )
}

export default App
