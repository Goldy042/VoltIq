import React from 'react';
import { Link } from 'react-router-dom';

const links = [
{ label: 'How it works', href: '#how-it-works', to: null },
{ label: 'Live Map', href: null, to: '/map' },
{ label: 'For Distribution Companies', href: '#utilities', to: null }];


export function Nav() {
  return (
    <header className="w-full border-b border-line bg-canvas">
      <nav
        aria-label="Primary"
        className="mx-auto flex w-full max-w-[1440px] items-center gap-8 px-6 py-4 md:px-10">
        
        <a
          href="#top"
          className="font-display text-lg font-semibold tracking-tight text-ink transition-colors duration-150 ease-out hover:text-accent">
          
          Gridpulse
          <span className="text-accent">.</span>
        </a>

        <ul className="ml-6 hidden items-center gap-8 lg:flex">
          {links.map((link) =>
          <li key={link.label}>
              {link.to ?
            <Link
              to={link.to}
              className="font-body text-sm text-ink-muted transition-colors duration-150 ease-out hover:text-ink">
              
                  {link.label}
                </Link> :

            <a
              href={link.href as string}
              className="font-body text-sm text-ink-muted transition-colors duration-150 ease-out hover:text-ink">
              
                  {link.label}
                </a>
            }
            </li>
          )}
        </ul>

        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/login"
            className="px-3 py-2 font-body text-sm text-ink-muted transition-colors duration-150 ease-out hover:text-ink">
            
            Login
          </Link>
          <Link
            to="/report"
            className="border border-ink bg-ink px-4 py-2 font-body text-sm font-medium text-canvas transition-colors duration-150 ease-out hover:border-accent hover:bg-accent hover:text-accent-on"
            style={{ borderRadius: 'var(--radius-sm)' }}>
            
            Report an Outage
          </Link>
        </div>
      </nav>
    </header>);

}