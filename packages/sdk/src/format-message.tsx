import React from 'react'

// Lightweight markdown-ish formatter for chat messages.
// Supports: **bold**, \n newlines, - list items. No heavy deps.

export function FormatMessage({ text }: { text: string }) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) {
      elements.push(<br key={`br-${i}`} />)
      continue
    }

    // List item
    if (line.startsWith('- ') || line.startsWith('• ')) {
      elements.push(
        <div key={i} style={{ display: 'flex', gap: 6, marginTop: 2 }}>
          <span style={{ color: '#9ca3af' }}>•</span>
          <span>{formatInline(line.slice(2))}</span>
        </div>,
      )
    } else {
      // Regular line
      if (i > 0 && lines[i - 1].trim()) {
        elements.push(<br key={`br-${i}`} />)
      }
      elements.push(<span key={i}>{formatInline(line)}</span>)
    }
  }

  return <>{elements}</>
}

function formatInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /\*\*(.+?)\*\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    parts.push(
      <strong key={match.index} style={{ fontWeight: 600 }}>
        {match[1]}
      </strong>,
    )
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length > 0 ? parts : [text]
}
