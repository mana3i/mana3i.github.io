import { render, screen } from '@testing-library/react'
import Home from './Home'

describe('Home', () => {
  it('renders the name, role and description', () => {
    render(<Home />)

    expect(
      screen.getByRole('heading', { name: /Amine Manai/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /DevOps Engineer/i })
    ).toBeInTheDocument()
    expect(screen.getByText(/Adipisicing sit fugit/i)).toBeInTheDocument()
  })

  it('renders the profile picture with the name as alt text', () => {
    render(<Home />)

    expect(screen.getByAltText(/Amine Manai/i)).toHaveAttribute(
      'src',
      '/images/amine.jpg'
    )
  })
})