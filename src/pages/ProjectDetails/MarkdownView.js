import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Markdown from 'markdown-to-jsx'

const textOf = (node) => {
  if (node === null || node === undefined) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (node.props && node.props.children) return textOf(node.props.children)
  return ''
}

const slugify = (text) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s/g, '-')

const MarkdownHeading = ({ children }) => (
  <h2 id={slugify(textOf(children))}>{children}</h2>
)

const MarkdownImage = ({ assets, src, alt }) => (
  <img
    src={src.startsWith('http') ? src : assets[decodeURIComponent(src)] || src}
    alt={alt}
  />
)

const MarkdownLink = ({ href, children }) => {
  const handleClick = (event) => {
    if (href && href.startsWith('#')) {
      event.preventDefault()
      const target = document.getElementById(href.slice(1))
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <a href={href} onClick={handleClick}>
      {children}
    </a>
  )
}

const MarkdownView = ({ content }) => {
  const contentRef = useRef(null)
  const itemRefs = useRef([])
  const [toc, setToc] = useState([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [marker, setMarker] = useState(null)

  useEffect(() => {
    const container = contentRef.current
    if (!container) return undefined

    const headings = Array.from(container.querySelectorAll('h2[id]')).filter(
      (heading) => heading.textContent.trim() !== 'Table of Contents'
    )

    setToc(
      headings.map((heading) => ({
        id: heading.id,
        text: heading.textContent,
      }))
    )

    return undefined
  }, [content])

  useEffect(() => {
    if (!toc.length) return undefined

    const updateActive = () => {
      const headings = toc
        .map((item) => document.getElementById(item.id))
        .filter(Boolean)
      const offset = 120
      let index = 0

      headings.forEach((heading, headingIndex) => {
        if (heading.getBoundingClientRect().top <= offset) index = headingIndex
      })

      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2
      ) {
        index = headings.length - 1
      }

      setActiveIndex(index)
    }

    updateActive()
    window.addEventListener('scroll', updateActive, { passive: true })
    window.addEventListener('resize', updateActive)

    return () => {
      window.removeEventListener('scroll', updateActive)
      window.removeEventListener('resize', updateActive)
    }
  }, [toc])

  useEffect(() => {
    const activeItem = itemRefs.current[activeIndex]
    if (activeItem) {
      setMarker({ top: activeItem.offsetTop, height: activeItem.offsetHeight })
    }
  }, [activeIndex, toc])

  const overrides = useMemo(
    () => ({
      h2: { component: MarkdownHeading },
      img: { component: MarkdownImage, props: { assets: content.assets } },
      a: { component: MarkdownLink },
    }),
    [content.assets]
  )

  const scrollToSection = (event, headingId) => {
    event.preventDefault()
    const target = document.getElementById(headingId)
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section className='section project-details'>
      <Link to='/projects' className='link project-details__back'>
        &larr; Back to projects
      </Link>

      <div className='docs'>
        <article className='docs__content' ref={contentRef}>
          <Markdown options={{ overrides }}>{content.markdown}</Markdown>
        </article>

        <aside className='docs__sidebar'>
          <p className='docs__sidebar-title'>On this page</p>

          <div className='docs__toc-wrap'>
            {marker && (
              <span
                className='docs__toc-marker'
                style={{ top: marker.top, height: marker.height }}
              />
            )}

            <ul className='docs__toc'>
              {toc.map((item, index) => (
                <li
                  key={item.id}
                  ref={(element) => {
                    itemRefs.current[index] = element
                  }}
                  className='docs__toc-item'
                >
                  <a
                    href={`#${item.id}`}
                    onClick={(event) => scrollToSection(event, item.id)}
                    className={
                      index === activeIndex
                        ? 'docs__toc-link docs__toc-link--active'
                        : 'docs__toc-link'
                    }
                  >
                    {item.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </section>
  )
}

export default MarkdownView
