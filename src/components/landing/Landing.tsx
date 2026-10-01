'use client';

import React, { useState } from 'react';
import { LandingNav } from './LandingNav';
import { Story } from './story/Story';
import { Outro } from './Outro';

export function Landing() {
  const [day, setDay] = useState(false);
  return (
    <div className="min-h-dvh bg-canvas">
      <LandingNav tone={day ? 'day' : 'night'} />
      <main>
        <Story onDaylight={setDay} />
        <Outro />
      </main>
    </div>
  );
}
