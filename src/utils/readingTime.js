const WORDS_PER_MINUTE = 200

const readingTime = (markdown) => {
  if (!markdown) return null

  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*\|?[\s:|-]+\|?\s*$/gm, ' ')
    .replace(/^\s*[-+*]\s+/gm, ' ')
    .replace(/[#>*_|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const words = text ? text.split(' ').filter(Boolean).length : 0
  const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE))

  return `${minutes} ${minutes === 1 ? 'min' : 'mins'} read`
}

export default readingTime
