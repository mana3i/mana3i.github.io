import { home } from '../../portfolio'
import './Home.css'

const Home = () => {
  const { name, role, description, picture } = home

  return (
    <section className='section home center'>
      <div className='home__header'>
        {picture && (
          <img
            src={
              picture.startsWith('http')
                ? picture
                : `${process.env.PUBLIC_URL}/images/${picture}`
            }
            alt={name}
            className='home__picture'
          />
        )}

        <div className='home__intro'>
          {name && (
            <h1>
              <span className='home__name'>{name}.</span>
            </h1>
          )}

          {role && <h2 className='home__role'>{role}.</h2>}
          {description && <p className='home__desc'>{description}</p>}
        </div>
      </div>
    </section>
  )
}

export default Home
