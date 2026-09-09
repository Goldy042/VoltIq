import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Dashboard } from './pages/Dashboard';
import { LiveMap } from './pages/LiveMap';

interface AppProps {
  /** Coordinated light/dark treatment for the whole system. */
  theme?: 'light' | 'dark';
  /** Framing of the hero eyebrow: community-facing or utility-facing. */
  audience?: 'citizens' | 'utilities';
}

export function App({ theme = 'light', audience = 'citizens' }: AppProps) {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div data-theme={theme} className="min-h-full w-full bg-canvas font-body text-ink">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing audience={audience} />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/report" element={<Dashboard reportOpen />} />
          <Route path="/map" element={<LiveMap view="citizen" />} />
          <Route path="/operations" element={<LiveMap view="operator" />} />
          <Route path="*" element={<Landing audience={audience} />} />
        </Routes>
      </BrowserRouter>
    </div>);

}