import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { useEffect, useRef } from 'react'

interface TerminalViewProps {
  onData: (data: string) => void
  onResize: (cols: number, rows: number) => void
  terminalRef: React.MutableRefObject<Terminal | null>
}

export default function TerminalView({ onData, onResize, terminalRef }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const onDataRef = useRef(onData)
  const onResizeRef = useRef(onResize)
  const terminalRefStable = useRef(terminalRef)

  // Keep callback refs current without re-running the effect
  onDataRef.current = onData
  onResizeRef.current = onResize
  terminalRefStable.current = terminalRef

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      fontSize: 14,
      theme: {
        background: '#171717', // neutral-900
        foreground: '#e5e5e5', // neutral-200
        cursor: '#ea580c', // orange-600
        selectionBackground: '#404040', // neutral-700
        black: '#171717',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#e5e5e5',
        brightBlack: '#525252',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#fafafa',
      },
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    fitAddonRef.current = fitAddon

    terminal.open(container)

    // Fit after a frame so the container has dimensions
    requestAnimationFrame(() => {
      fitAddon.fit()
      onResizeRef.current(terminal.cols, terminal.rows)
    })

    // Forward user input to SSH
    terminal.onData((data) => onDataRef.current(data))

    // Watch for resize
    terminal.onResize(({ cols, rows }) => {
      onResizeRef.current(cols, rows)
    })

    // ResizeObserver to re-fit when container changes
    const observer = new ResizeObserver(() => {
      fitAddon.fit()
    })
    observer.observe(container)

    terminalRefStable.current.current = terminal

    return () => {
      observer.disconnect()
      terminal.dispose()
      terminalRefStable.current.current = null
      fitAddonRef.current = null
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="h-full w-full rounded-md border border-neutral-800 bg-[#171717] p-1"
    />
  )
}
