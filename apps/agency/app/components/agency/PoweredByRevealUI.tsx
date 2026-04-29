interface PoweredByRevealUIProps {
  className?: string;
}

export function PoweredByRevealUI({ className }: PoweredByRevealUIProps) {
  return (
    <a
      href="https://revealui.com"
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 text-xs text-gray-500 hover:text-gray-950 transition-colors ${
        className ?? ''
      }`}
    >
      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
        <title>RevealUI</title>
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z"
          clipRule="evenodd"
        />
      </svg>
      Powered by RevealUI (open source)
    </a>
  );
}
