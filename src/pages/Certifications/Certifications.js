import LaunchIcon from '@material-ui/icons/Launch'
import { certifications } from '../../portfolio'
import './Certifications.css'

const Certifications = () => {
  if (!certifications.length) return null

  const sortedCertifications = [...certifications].sort(
    (a, b) => new Date(b.issuedDate) - new Date(a.issuedDate)
  )

  return (
    <section className='section certifications'>
      <h2 className='section__title'>Certifications</h2>

      <ul className='certifications__list'>
        {sortedCertifications.map((certification) => (
          <li key={certification.name} className='certifications__list-item'>
            <img
              src={
                certification.imagePath.startsWith('http')
                  ? certification.imagePath
                  : `${process.env.PUBLIC_URL}${certification.imagePath}`
              }
              alt={`${certification.name} badge`}
              className='certifications__image'
            />

            <div className='certifications__details'>
              <div className='certifications__title-row'>
                <h3 className='certifications__name'>{certification.name}</h3>

                <a
                  href={certification.url}
                  aria-label='view certification'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='link link--icon certifications__credential'
                >
                  <LaunchIcon />
                </a>
              </div>

              <p className='certifications__issuer'>{certification.issuedBy}</p>

              <p className='certifications__dates'>
                Issued: {certification.issuedDate} · Valid until:{' '}
                {certification.validUntil}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default Certifications
