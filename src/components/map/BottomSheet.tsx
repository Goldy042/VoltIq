'use client';

import React, { useEffect, useState } from 'react';
import { animate, motion, useDragControls, useMotionValue, type PanInfo } from 'framer-motion';

export type SheetSnap = 'peek' | 'half' | 'full';

interface BottomSheetProps {
  snap: SheetSnap;
  onSnapChange: (snap: SheetSnap) => void;
  /** Always-visible header; dragging it moves the sheet. */
  header: React.ReactNode;
  children: React.ReactNode;
  /** Visible height in px at the peek snap. */
  peekHeight?: number;
  onVisibleHeight?: (px: number) => void;
}

/** Draggable sheet with three snap points, as in native map apps. */
export function BottomSheet({ snap, onSnapChange, header, children, peekHeight = 168, onVisibleHeight }: BottomSheetProps) {
  const [vh, setVh] = useState(0);
  const controls = useDragControls();
  const y = useMotionValue(10_000);

  useEffect(() => {
    const read = () => setVh(window.innerHeight);
    read();
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, []);

  const height = Math.round(vh * 0.9);
  const visible: Record<SheetSnap, number> = { peek: peekHeight, half: Math.round(vh * 0.52), full: height };
  const offsetFor = (s: SheetSnap) => Math.max(0, height - visible[s]);

  useEffect(() => {
    if (!vh) return;
    animate(y, offsetFor(snap), { type: 'spring', stiffness: 380, damping: 40 });
    onVisibleHeight?.(visible[snap]);
    // offsets derive from vh and snap only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap, vh]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const current = y.get();
    // Project where a flick would land, then pick the nearest snap.
    const projected = current + info.velocity.y * 0.2;
    const order: SheetSnap[] = ['full', 'half', 'peek'];
    const nearest = order.reduce((best, s) =>
      Math.abs(offsetFor(s) - projected) < Math.abs(offsetFor(best) - projected) ? s : best,
    );
    if (nearest === snap) animate(y, offsetFor(snap), { type: 'spring', stiffness: 380, damping: 40 });
    onSnapChange(nearest);
  };

  if (!vh) return null;

  return (
    <motion.section
      aria-label="Outage details"
      className="fixed inset-x-0 bottom-0 z-40 flex flex-col rounded-t-xl bg-surface shadow-float"
      style={{ height, y }}
      drag="y"
      dragControls={controls}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: offsetFor('peek') }}
      dragElastic={0.08}
      onDragEnd={onDragEnd}
    >
      <div
        className="shrink-0 cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={(e) => controls.start(e)}
      >
        <button
          type="button"
          aria-label={snap === 'full' ? 'Collapse panel' : 'Expand panel'}
          onClick={() => onSnapChange(snap === 'full' ? 'peek' : snap === 'peek' ? 'half' : 'full')}
          className="mx-auto flex w-full justify-center pb-1 pt-2.5"
        >
          <span className="h-1.5 w-10 rounded-full bg-line-strong" aria-hidden="true" />
        </button>
        {header}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
        {children}
      </div>
    </motion.section>
  );
}
