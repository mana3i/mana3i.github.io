import { render, screen } from '@testing-library/react'
import Certifications from './Certifications'

describe('Certifications', () => {
  it('renders the section title', () => {
    render(<Certifications />)

    expect(
      screen.getByRole('heading', { name: 'Certifications' })
    ).toBeInTheDocument()
  })

  it('renders every certification', () => {
    render(<Certifications />)

    expect(screen.getByText('Certification 1')).toBeInTheDocument()
    expect(screen.getByText('Certification 2')).toBeInTheDocument()
    expect(screen.getByText('Certification 3')).toBeInTheDocument()
  })
})