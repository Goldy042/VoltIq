import React from 'react';
import Link from 'next/link';

interface AuthShellProps {
  eyebrow: string;
  title: string;
  intro: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

/** Asymmetric auth layout: narrow editorial rail on the left, form off-centre right. */
export function AuthShell({ eyebrow, title, intro, children, footer }: AuthShellProps) {
  return (
    <div className="min-h-screen w-full bg-canvas">
      <div className="mx-auto w-full max-w-[1440px] px-6 md:px-10">
        <header className="flex items-center justify-between border-b border-line py-4">
          <Link
            href="/"
            className="font-display text-lg font-semibold tracking-tight text-ink transition-colors duration-150 ease-out hover:text-accent">
            
            Gridpulse<span className="text-accent">.</span>
          </Link>
          <Link
            href="/"
            className="font-body text-sm text-ink-muted transition-colors duration-150 ease-out hover:text-ink">
            
            Back to site
          </Link>
        </header>

        <div className="grid grid-cols-1 gap-12 pb-16 pt-12 lg:grid-cols-12 lg:gap-8 lg:pt-24">
          <div className="lg:col-span-4">
            <p className="font-body text-2xs uppercase tracking-wide text-ink-faint">
              {eyebrow}
            </p>
            <h1 className="mt-6 max-w-[14ch] font-display text-3xl font-semibold leading-tight tracking-tight text-ink md:text-4xl">
              {title}
            </h1>
            <p className="mt-6 max-w-[40ch] font-body text-base leading-body text-ink-muted">
              {intro}
            </p>
          </div>

          <div className="lg:col-span-5 lg:col-start-7">
            {children}
            <div className="mt-10 border-t border-line pt-6 font-body text-sm text-ink-muted">
              {footer}
            </div>
          </div>
        </div>
      </div>
    </div>);

}