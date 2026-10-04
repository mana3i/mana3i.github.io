import { render, screen } from '@testing-library/react'
import Certifications from './Certifications'

describe('Certifications', () => {
  it('renders the section title', () => {
    render(<Certifications />)

    expect(
      screen.getByRole('heading', { name: 'Certifications' })
    ).toBeInTheDocument()
  })

  it('renders the name, issuer and validity dates of every certification', () => {
    render(<Certifications />)

    expect(
      screen.getByRole('heading', {
        name: /AWS Certified Solutions Architect/i,
      })
    ).toBeInTheDocument()
    expect(screen.getByText('Amazon Web Services (AWS)')).toBeInTheDocument()
    expect(
      screen.getByText(/Issued: 2026-08-14 · Valid until: 2029-08-14/)
    ).toBeInTheDocument()

    expect(
      screen.getByRole('heading', {
        name: /HashiCorp Certified: Terraform Associate/i,
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText('IBM Professional Certification')
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Issued: 2026-09-26 · Valid until: 2028-09-26/)
    ).toBeInTheDocument()
  })

  it('renders the badge image for every certification', () => {
    render(<Certifications />)

    const awsBadge = screen.getByAltText(
      /AWS Certified Solutions Architect.*badge/i
    )
    const terraformBadge = screen.getByAltText(
      /HashiCorp Certified.*badge/i
    )

    expect(awsBadge).toHaveAttribute(
      'src',
      '/certifications/certifs/AWS-SAA.png'
    )
    expect(terraformBadge).toHaveAttribute(
      'src',
      '/certifications/certifs/hashicorp-terraform.png'
    )
  })

  it('links every certification to its credential page', () => {
    render(<Certifications />)

    const credentialLinks = screen.getAllByRole('link', {
      name: 'view certification',
    })

    expect(credentialLinks).toHaveLength(2)
    expect(credentialLinks[0]).toHaveAttribute(
      'href',
      'https://www.credly.com/badges/7e93e7ce-1af2-4c8e-9c64-43a278e023d9/linked_in_profile'
    )
    expect(credentialLinks[1]).toHaveAttribute(
      'href',
      'https://www.credly.com/badges/c8518210-f8c0-4ad5-8f45-98f2f4708d86/linked_in_profile'
    )
    credentialLinks.forEach((link) =>
      expect(link).toHaveAttribute('target', '_blank')
    )
  })
})