import { useEffect, useState } from 'react'
import type { TerminalLogEntry } from '../../types/l402'

interface TerminalLineProps {
  entry: TerminalLogEntry
}

export default function TerminalLine({ entry }: TerminalLineProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30)
    return () => clearTimeout(t)
  }, [])

  const isInput = entry.status === 'INPUT'
  const isError = entry.status === 'FAIL'

  const containerClass = isInput ? 'justify-end' : 'justify-start'
  const bubbleClass = isInput
    ? 'bg-terminal-green/15 border-terminal-green/35 text-white'
    : isError
      ? 'bg-red-500/12 border-red-500/40 text-red-200'
      : 'bg-white/5 border-white/10 text-gray-100'

  return (
    <div
      className={`flex ${containerClass} py-1.5 transition-all duration-200 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
      }`}
    >
      <div
        className={`max-w-[88%] md:max-w-[78%] rounded-2xl px-3.5 py-2.5 border font-sans text-sm leading-relaxed shadow-[0_6px_20px_rgba(0,0,0,0.25)] ${bubbleClass}`}
      >
        <p className="whitespace-pre-wrap break-words">{entry.message}</p>
      </div>
    </div>
  )
}
