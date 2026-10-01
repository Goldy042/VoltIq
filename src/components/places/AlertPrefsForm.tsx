'use client';

import React from 'react';
import { BellRingIcon, CheckCircle2Icon, MailIcon, MessageCircleIcon, MoonIcon, SmartphoneIcon, SparklesIcon, TruckIcon } from 'lucide-react';
import { Switch } from '@/components/ui/Switch';
import type { AlertPrefs } from '@/lib/profile';

interface AlertPrefsFormProps {
  value: AlertPrefs;
  onChange: (next: AlertPrefs) => void;
}

/** How and about what we contact someone — shared by onboarding and profile. */
export function AlertPrefsForm({ value, onChange }: AlertPrefsFormProps) {
  const set = (key: keyof AlertPrefs) => (checked: boolean) => onChange({ ...value, [key]: checked });
  const noChannel = !value.email && !value.sms && !value.push && !value.whatsapp;

  return (
    <div className="space-y-6">
      <section aria-labelledby="channels-title">
        <h3 id="channels-title" className="px-3 font-body text-xs font-semibold uppercase tracking-wide text-ink-faint">
          How to reach you
        </h3>
        <div className="mt-1">
          <Switch
            icon={<MailIcon className="h-5 w-5" />}
            label="Email"
            hint="Free, and keeps a record of every alert."
            checked={value.email}
            onChange={set('email')}
          />
          <Switch
            icon={<BellRingIcon className="h-5 w-5" />}
            label="App notifications"
            hint="Instant and free while you have data."
            checked={value.push}
            onChange={set('push')}
          />
          <Switch
            icon={<SmartphoneIcon className="h-5 w-5" />}
            label="SMS for urgent forecasts"
            hint="Reaches you without data. Needs a phone number on your profile."
            checked={value.sms}
            onChange={set('sms')}
          />
          <Switch
            icon={<MessageCircleIcon className="h-5 w-5" />}
            label="WhatsApp"
            hint="Updates in your WhatsApp chats."
            checked={value.whatsapp}
            onChange={set('whatsapp')}
          />
        </div>
        {noChannel && (
          <p role="alert" className="mt-2 px-3 font-body text-xs text-status-low">
            With every channel off, you won’t hear about outages before they happen.
          </p>
        )}
      </section>

      <section aria-labelledby="topics-title">
        <h3 id="topics-title" className="px-3 font-body text-xs font-semibold uppercase tracking-wide text-ink-faint">
          What to tell you
        </h3>
        <div className="mt-1">
          <Switch
            icon={<SparklesIcon className="h-5 w-5" />}
            label="Outage forecasts"
            hint="A warning a few hours before the AI expects your light to go."
            checked={value.forecasts}
            onChange={set('forecasts')}
          />
          <Switch
            icon={<TruckIcon className="h-5 w-5" />}
            label="Repair updates"
            hint="When EEDC confirms a fault near you and sends a crew."
            checked={value.repairs}
            onChange={set('repairs')}
          />
          <Switch
            icon={<CheckCircle2Icon className="h-5 w-5" />}
            label="Light restored"
            hint="The moment supply comes back at your places."
            checked={value.restored}
            onChange={set('restored')}
          />
          <Switch
            icon={<MoonIcon className="h-5 w-5" />}
            label="Quiet at night"
            hint="No alerts from 10 PM to 6 AM, except light restored."
            checked={value.quietHours}
            onChange={set('quietHours')}
          />
        </div>
      </section>
    </div>
  );
}
