import React from 'react';
import { Reveal } from './Reveal';

const columns = [
{
  heading: 'Platform',
  links: ['How it works', 'Live map', 'Report an outage', 'Prediction model']
},
{
  heading: 'Companies',
  links: ['Partner with us', 'Pilot programme', 'Integrations', 'Status']
},
{
  heading: 'Community',
  links: ['Outage archive', 'Data & privacy', 'Accessibility', 'Press']
}];


const social = ['LinkedIn', 'GitHub', 'Bluesky'];

export function Footer() {
  return (
    <Reveal as="footer" className="w-full bg-canvas">
      <div className="mx-auto w-full max-w-[1440px] px-6 pb-12 pt-24 md:px-10">
        <div className="grid grid-cols-1 gap-12 border-t border-line pt-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="font-display text-lg font-semibold tracking-tight text-ink">
              Gridpulse<span className="text-accent">.</span>
            </p>
            <p className="mt-4 max-w-[34ch] font-body text-sm leading-body text-ink-muted">
              Outage intelligence for Bellhaven County, built with the
              distribution company and the people it serves.
            </p>
            <address className="mt-8 not-italic font-body text-sm text-ink-muted">
              <a
                href="mailto:hello@gridpulse.energy"
                className="transition-colors duration-150 ease-out hover:text-accent">
                
                hello@gridpulse.energy
              </a>
              <br />
              <a
                href="tel:+18005550142"
                className="tabular-nums transition-colors duration-150 ease-out hover:text-accent">
                
                +1 800 555 0142
              </a>
              <br />
              <span className="text-ink-faint">
                14 Foundry Row, Bellhaven
              </span>
            </address>
          </div>

          {columns.map((col) =>
          <nav
            key={col.heading}
            aria-label={col.heading}
            className="lg:col-span-2">
            
              <p className="font-body text-2xs uppercase tracking-wide text-ink-faint">
                {col.heading}
              </p>
              <ul className="mt-6 space-y-3">
                {col.links.map((link) =>
              <li key={link}>
                    <a
                  href="#footer-link"
                  className="font-body text-sm text-ink-muted transition-colors duration-150 ease-out hover:text-ink">
                  
                      {link}
                    </a>
                  </li>
              )}
              </ul>
            </nav>
          )}

          <div className="lg:col-span-2">
            <p className="font-body text-2xs uppercase tracking-wide text-ink-faint">
              Social
            </p>
            <ul className="mt-6 space-y-3">
              {social.map((item) =>
              <li key={item}>
                  <a
                  href="#social"
                  className="font-body text-sm text-ink-muted transition-colors duration-150 ease-out hover:text-ink">
                  
                    {item}
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
          <p className="font-body text-2xs text-ink-faint">
            © 2026 Gridpulse Energy Systems
          </p>
          <ul className="flex items-center gap-8">
            {['Privacy', 'Terms', 'Report a bug'].map((item) =>
            <li key={item}>
                <a
                href="#legal"
                className="font-body text-2xs text-ink-faint transition-colors duration-150 ease-out hover:text-ink">
                
                  {item}
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>
    </Reveal>);

}