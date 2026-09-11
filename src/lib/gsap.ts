'use client';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Client components are still server-rendered in the App Router, so this module
// is evaluated on the server too. Registering the plugin there is pointless and
// touches a DOM-shaped registry, so it is guarded and done exactly once here
// rather than repeated at the top of every animated component.
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

export { gsap, ScrollTrigger };
