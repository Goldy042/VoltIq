import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckIcon, ImageIcon, XIcon } from 'lucide-react';
import { PinMap } from './PinMap';
import { TextField } from '../ui/TextField';
import { Button } from '../ui/Button';
import { citizenProfile } from '../../data/citizen';

interface ReportOutageModalProps {
  open: boolean;
  onClose: () => void;
  onSubmitted: (report: {location: string;startedAt: string;note?: string;}) => void;
}

function nowLocalValue() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function ReportOutageModal({ open, onClose, onSubmitted }: ReportOutageModalProps) {
  const [location, setLocation] = useState(citizenProfile.address);
  const [startedAt, setStartedAt] = useState(nowLocalValue());
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [phase, setPhase] = useState<'form' | 'sending' | 'done'>('form');
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setPhase('form');
      setNote('');
      setPhoto(null);
      setStartedAt(nowLocalValue());
      setLocation(citizenProfile.address);
    }
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setPhase('sending');
    window.setTimeout(() => {
      setPhase('done');
      onSubmitted({
        location,
        startedAt: new Date(startedAt).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        }),
        note: note.trim() || undefined
      });
    }, 700);
  };

  return (
    <AnimatePresence>
      {open &&
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-start sm:justify-end">
          <motion.div
          className="absolute inset-0 bg-ink/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          onClick={onClose} />
        

          <motion.div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-title"
          className="relative flex max-h-[92vh] w-full flex-col overflow-y-auto border-t border-line bg-canvas sm:m-6 sm:max-h-[calc(100vh-3rem)] sm:max-w-[30rem] sm:border"
          style={{ borderRadius: 'var(--radius-sm)' }}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}>
          
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-canvas px-5 py-4">
              <p
              id="report-title"
              className="font-body text-2xs uppercase tracking-wide text-ink-faint">
              
                {phase === 'done' ? 'Report received' : 'Report an outage'}
              </p>
              <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-m-1 p-1 text-ink-faint transition-colors duration-150 ease-out hover:text-ink">
              
                <XIcon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>

            {phase === 'done' ?
          <div className="px-5 py-8 sm:px-6">
                <span
              className="flex h-9 w-9 items-center justify-center border"
              style={{
                borderColor: 'var(--status-stable)',
                borderRadius: 'var(--radius-sm)'
              }}>
              
                  <CheckIcon
                className="h-4 w-4"
                strokeWidth={1.75}
                style={{ color: 'var(--status-stable)' }}
                aria-hidden="true" />
              
                </span>
                <h2 className="mt-6 max-w-[18ch] font-display text-2xl font-semibold leading-snug tracking-tight text-ink">
                  Your report has been added to the map.
                </h2>
                <p className="mt-4 max-w-[44ch] font-body text-sm leading-body text-ink-muted">
                  Nine other reports on {citizenProfile.feeder} are being read
                  together with yours. If the model confirms a fault, a crew is
                  dispatched and you'll see the status change here.
                </p>
                <dl className="mt-6 divide-y divide-line border-y border-line font-body text-sm">
                  <div className="flex justify-between gap-4 py-3">
                    <dt className="text-ink-faint">Location</dt>
                    <dd className="text-right text-ink">{location}</dd>
                  </div>
                  <div className="flex justify-between gap-4 py-3">
                    <dt className="text-ink-faint">Started</dt>
                    <dd className="text-right tabular-nums text-ink">
                      {new Date(startedAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                    </dd>
                  </div>
                </dl>
                <Button onClick={onClose} full size="lg" className="mt-8">
                  Back to dashboard
                </Button>
              </div> :

          <form onSubmit={submit} className="space-y-7 px-5 py-6 sm:px-6">
                <div>
                  <p className="font-body text-2xs uppercase tracking-wide text-ink-faint">
                    Location
                  </p>
                  <div className="mt-2">
                    <PinMap className="h-44" />
                  </div>
                  <TextField
                label="Address"
                className="mt-4"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                hint="Auto-filled from your profile — drag the pin or edit to correct it." />
              
                </div>

                <TextField
              label="When did it start?"
              type="datetime-local"
              value={startedAt}
              max={nowLocalValue()}
              onChange={(e) => setStartedAt(e.target.value)} />
            

                <div>
                  <label
                htmlFor="report-note"
                className="block font-body text-2xs uppercase tracking-wide text-ink-faint">
                
                    What did you notice? (optional)
                  </label>
                  <textarea
                id="report-note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="A bang from the pole, flickering lights, the whole street dark…"
                className="mt-2 w-full resize-none border-b bg-transparent px-0 py-3 font-body text-base text-ink placeholder:text-ink-faint focus:outline-none"
                style={{ borderColor: 'var(--line-strong)' }} />
              
                </div>

                <div>
                  <p className="font-body text-2xs uppercase tracking-wide text-ink-faint">
                    Photo (optional)
                  </p>
                  <label
                className="mt-2 flex cursor-pointer items-center gap-3 border border-line px-4 py-3 font-body text-sm text-ink-muted transition-colors duration-150 ease-out hover:border-ink hover:text-ink"
                style={{ borderRadius: 'var(--radius-sm)' }}>
                
                    <ImageIcon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                    {photo ?? 'Add a photo of what you can see'}
                    <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => setPhoto(e.target.files?.[0]?.name ?? null)} />
                
                  </label>
                </div>

                <Button
              type="submit"
              size="lg"
              full
              disabled={phase === 'sending'}>
              
                  {phase === 'sending' ? 'Sending…' : 'Submit report'}
                </Button>
                <p className="font-body text-xs leading-body text-ink-faint">
                  Reports are shared with the distribution company. Your exact
                  address is never shown on the public map.
                </p>
              </form>
          }
          </motion.div>
        </div>
      }
    </AnimatePresence>);

}