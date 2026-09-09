import React, { useCallback, useRef, useState } from 'react';

interface PinMapProps {
  /** Called with the pin position as percentages of the frame. */
  onChange?: (pos: {x: number;y: number;}) => void;
  className?: string;
}

/** Minimal map fragment with a keyboard- and pointer-draggable outage pin. */
export function PinMap({ onChange, className = 'h-48' }: PinMapProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ x: 52, y: 46 });
  const [dragging, setDragging] = useState(false);

  const move = useCallback(
    (clientX: number, clientY: number) => {
      const frame = frameRef.current;
      if (!frame) return;
      const rect = frame.getBoundingClientRect();
      const next = {
        x: Math.min(96, Math.max(4, (clientX - rect.left) / rect.width * 100)),
        y: Math.min(92, Math.max(8, (clientY - rect.top) / rect.height * 100))
      };
      setPos(next);
      onChange?.(next);
    },
    [onChange]
  );

  const nudge = (dx: number, dy: number) => {
    setPos((prev) => {
      const next = {
        x: Math.min(96, Math.max(4, prev.x + dx)),
        y: Math.min(92, Math.max(8, prev.y + dy))
      };
      onChange?.(next);
      return next;
    });
  };

  return (
    <div
      ref={frameRef}
      className={`relative w-full touch-none overflow-hidden border border-line bg-sunken ${className}`}
      style={{ borderRadius: 'var(--radius-sm)' }}
      onPointerMove={(e) => dragging && move(e.clientX, e.clientY)}
      onPointerUp={() => setDragging(false)}
      onPointerLeave={() => setDragging(false)}>
      
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true">
        
        {Array.from({ length: 9 }).map((_, i) =>
        <line
          key={`v${i}`}
          x1={i * 12.5}
          y1="0"
          x2={i * 12.5}
          y2="100"
          stroke="var(--line)"
          strokeWidth="0.2" />

        )}
        {Array.from({ length: 7 }).map((_, i) =>
        <line
          key={`h${i}`}
          x1="0"
          y1={i * 16.6}
          x2="100"
          y2={i * 16.6}
          stroke="var(--line)"
          strokeWidth="0.2" />

        )}
        <path
          d="M0 62 L30 58 L52 46 L78 40 L100 44"
          fill="none"
          stroke="var(--line-strong)"
          strokeWidth="0.5" />
        
      </svg>

      <button
        type="button"
        aria-label="Outage location pin. Drag, or use the arrow keys to adjust."
        className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab focus-visible:outline-none active:cursor-grabbing"
        style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
        }}
        onPointerUp={(e) => {
          e.currentTarget.releasePointerCapture(e.pointerId);
          setDragging(false);
        }}
        onPointerMove={(e) => dragging && move(e.clientX, e.clientY)}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 6 : 2;
          if (e.key === 'ArrowLeft') nudge(-step, 0);
          if (e.key === 'ArrowRight') nudge(step, 0);
          if (e.key === 'ArrowUp') nudge(0, -step);
          if (e.key === 'ArrowDown') nudge(0, step);
        }}>
        
        <span className="relative flex items-center justify-center">
          <span
            className="absolute h-6 w-6 rounded-full"
            style={{
              backgroundColor: 'var(--status-reported)',
              opacity: dragging ? 0.3 : 0.16
            }} />
          
          <span
            className="relative h-[11px] w-[11px] rounded-full border-2"
            style={{
              backgroundColor: 'var(--status-reported)',
              borderColor: 'var(--surface)'
            }} />
          
        </span>
      </button>

      <p className="absolute bottom-2 left-3 font-body text-2xs uppercase tracking-wide text-ink-faint">
        Drag the pin to the affected spot
      </p>
    </div>);

}