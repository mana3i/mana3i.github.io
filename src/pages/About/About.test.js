import { render, screen } from '@testing-library/react'
import About from './About'

describe('About', () => {
  it('renders the section title', () => {
    render(<About />)

    expect(screen.getByRole('heading', { name: 'About' })).toBeInTheDocument()
  })

  it('renders social links with the correct hrefs', () => {
    render(<About />)

    const githubLink = screen.getByRole('link', { name: /GitHub/i })
    const linkedinLink = screen.getByRole('link', { name: /LinkedIn/i })
    const emailLink = screen.getByRole('link', { name: /Email/i })

    expect(githubLink).toHaveAttribute('href', 'https://github.com/mana3i')
    expect(linkedinLink).toHaveAttribute(
      'href',
      'https://www.linkedin.com/in/amine-manai'
    )
    expect(emailLink).toHaveAttribute('href', 'mailto:johnsmith@mail.com')
  })
})