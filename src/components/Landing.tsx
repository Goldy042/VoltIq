"use client";
import React from 'react';
import { Nav } from '../components/Nav';
import { Hero } from '../components/Hero';
import { HowItWorks } from '../components/HowItWorks';
import { LiveMapPreview } from '../components/LiveMapPreview';
import { ForUtilities } from '../components/ForUtilities';
import { ForCitizens } from '../components/ForCitizens';
import { Footer } from '../components/Footer';
import { useSmoothScroll } from '../hooks/useSmoothScroll';

interface LandingProps {
  audience?: 'citizens' | 'utilities';
}

export function Landing({ audience = 'citizens' }: LandingProps) {
  useSmoothScroll();

  return (
    <div className="flex min-h-full w-full flex-col bg-canvas">
      <Nav />
      <main className="flex-1">
        <Hero audience={audience} />
        <HowItWorks />
        <LiveMapPreview />
        <ForUtilities />
        <ForCitizens />
      </main>
      <Footer />
    </div>);

}