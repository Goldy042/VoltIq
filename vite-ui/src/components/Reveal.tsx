import React, { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** Seconds of delay before this element resolves. */
  delay?: number;
  /** Stagger direct children instead of animating the wrapper as one block. */
  stagger?: boolean;
  as?: 'div' | 'section' | 'li' | 'footer' | 'header';
}

export function Reveal({
  children,
  className,
  delay = 0,
  stagger = false,
  as: Tag = 'div'
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const targets = stagger ? Array.from(el.children) : [el];

    const ctx = gsap.context(() => {
      gsap.fromTo(
        targets,
        { autoAlpha: 0, y: 18 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.3,
          delay,
          ease: 'power3.out',
          stagger: stagger ? 0.05 : 0,
          scrollTrigger: {
            trigger: el,
            start: 'top 88%',
            once: true
          }
        }
      );
    }, el);

    return () => ctx.revert();
  }, [delay, stagger]);

  return (
    <Tag ref={ref as never} className={className}>
      {children}
    </Tag>);

}