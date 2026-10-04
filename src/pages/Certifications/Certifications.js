import { certifications } from '../../portfolio'
import './Certifications.css'

const Certifications = () => {
  if (!certifications.length) return null

  return (
    <section className='section certifications'>
      <h2 className='section__title'>Certifications</h2>

      <ul className='certifications__list'>
        {certifications.map((certification) => (
          <li
            key={certification}
            className='certifications__list-item btn btn--plain'
          >
            {certification}
          </li>
        ))}
      </ul>
    </section>
  )
}

export default Certifications
