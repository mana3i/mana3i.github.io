import { useMemo } from 'react'
import Prism from 'prismjs'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-hcl'
import 'prismjs/components/prism-powershell'
import 'prismjs/components/prism-promql'
import textOf from './textOf'

const renderTokens = (tokens, nextKey) => {
  if (typeof tokens === 'string') return tokens

  return tokens.map((token) => {
    if (typeof token === 'string') return token

    const { type, alias, content } = token
    const aliasClasses = alias
      ? ` ${Array.isArray(alias) ? alias.join(' ') : alias}`
      : ''

    return (
      <span key={nextKey()} className={`token ${type}${aliasClasses}`}>
        {renderTokens(content, nextKey)}
      </span>
    )
  })
}

const CodeBlock = ({ children }) => {
  const codeElement = Array.isArray(children) ? children[0] : children
  const langClass =
    codeElement && codeElement.props ? codeElement.props.className : ''
  const language =
    typeof langClass === 'string' && langClass.startsWith('lang-')
      ? langClass.slice('lang-'.length)
      : ''

  const code = textOf(children)

  const highlighted = useMemo(() => {
    if (!language || !Prism.languages[language]) return null

    let counter = 0
    const nextKey = () => {
      const key = `token-${counter}`
      counter += 1
      return key
    }

    return renderTokens(Prism.tokenize(code, Prism.languages[language]), nextKey)
  }, [language, code])

  return (
    <pre>
      <code className={language ? `language-${language}` : undefined}>
        {highlighted || code}
      </code>
    </pre>
  )
}

export default CodeBlock
