import { render } from 'react-dom'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { ThemeProvider } from './contexts/theme'
import './index.css'

const { pathname, hash } = window.location

if (pathname !== '/') {
  window.location.replace(`/${hash}`)
}

render(
  <ThemeProvider>
    <HashRouter>
      <App />
    </HashRouter>
  </ThemeProvider>,
  document.getElementById('root')
)
