import { render } from '@testing-library/react'
import CodeBlock from './CodeBlock'

describe('CodeBlock', () => {
  it('highlights a known language', () => {
    const { container } = render(
      <CodeBlock>
        <code className='lang-bash'>if true; then echo hello; fi</code>
      </CodeBlock>
    )

    expect(container.querySelector('code.language-bash')).toBeInTheDocument()
    expect(container.querySelector('.token.keyword')).toBeInTheDocument()
  })

  it('renders plain text for an unknown language', () => {
    const { container } = render(
      <CodeBlock>
        <code className='lang-unknown'>some text</code>
      </CodeBlock>
    )

    expect(container.querySelector('code.language-unknown')).toBeInTheDocument()
    expect(container.querySelector('.token')).not.toBeInTheDocument()
    expect(container.textContent).toBe('some text')
  })

  it('renders plain text when no language is given', () => {
    const { container } = render(
      <CodeBlock>
        <code>plain tree</code>
      </CodeBlock>
    )

    expect(container.querySelector('.token')).not.toBeInTheDocument()
    expect(container.textContent).toBe('plain tree')
  })
})
