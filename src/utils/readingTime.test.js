import readingTime from './readingTime'

describe('readingTime', () => {
  it('returns null without markdown', () => {
    expect(readingTime(undefined)).toBeNull()
    expect(readingTime('')).toBeNull()
  })

  it('counts words and rounds to the nearest minute', () => {
    const markdown = Array(400).fill('word').join(' ')

    expect(readingTime(markdown)).toBe('2 mins read')
  })

  it('returns at least one minute for very short content', () => {
    expect(readingTime('Just a few words here')).toBe('1 min read')
  })

  it('ignores code blocks, inline code, images and link targets', () => {
    const markdown = `
\`\`\`
${Array(600).fill('code').join(' ')}
\`\`\`

${Array(200).fill('word').join(' ')}

\`inline code\`

![diagram](some%20image.png)

[link text](https://example.com)
`

    expect(readingTime(markdown)).toBe('1 min read')
  })
})
