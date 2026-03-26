import { useState, useRef, useEffect, type CSSProperties } from 'react'
import { useEngine, type UseEngineConfig } from './use-engine'
import { styles, SPINNER_KEYFRAMES } from './styles'
import { FormatMessage } from './format-message'

export interface SearchBarProps extends UseEngineConfig {
  placeholder?: string
  className?: string
  style?: CSSProperties
}

export function SearchBar({
  placeholder = 'Ask me anything...',
  className,
  style,
  ...engineConfig
}: SearchBarProps) {
  const { messages, loading, error, clarify, query, selectClarifyOption } = useEngine(engineConfig)
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const styleInjected = useRef(false)

  // Inject spinner keyframes once
  useEffect(() => {
    if (styleInjected.current) return
    const style = document.createElement('style')
    style.textContent = SPINNER_KEYFRAMES
    document.head.appendChild(style)
    styleInjected.current = true
  }, [])

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSubmit = () => {
    const trimmed = input.trim()
    if (!trimmed || loading) return
    setInput('')
    setOpen(true)
    query(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  const hasContent = messages.length > 0 || loading || error || clarify

  return (
    <div ref={wrapperRef} style={{ ...styles.overlay, ...style }} className={className}>
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onFocus={() => {
          setFocused(true)
          if (hasContent) setOpen(true)
        }}
        onBlur={() => setFocused(false)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={{
          ...styles.searchBarInput,
          ...(focused ? styles.searchBarInputFocus : {}),
        }}
      />

      {open && hasContent && (
        <div style={{ ...styles.panel, ...styles.dropdownPanel }}>
          <div style={styles.messageList}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={msg.role === 'user' ? styles.messageUser : styles.messageAssistant}
              >
                <FormatMessage text={msg.content} />
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: 'flex-start', padding: '4px 0' }}>
                <div style={styles.spinner} />
              </div>
            )}
          </div>

          {clarify && (
            <div style={styles.clarifyWrapper}>
              <div style={styles.clarifyMessage}>{clarify.message}</div>
              <div style={styles.clarifyOptions}>
                {clarify.options.map((option) => (
                  <ClarifyButton
                    key={option}
                    label={option}
                    onClick={() => selectClarifyOption(option)}
                  />
                ))}
              </div>
            </div>
          )}

          {error && <div style={styles.error}>{error}</div>}
        </div>
      )}
    </div>
  )
}

function ClarifyButton({ label, onClick }: { label: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      style={{ ...styles.clarifyOption, ...(hovered ? styles.clarifyOptionHover : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      {label}
    </button>
  )
}
