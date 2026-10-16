import { OutageFeedProvider } from '@/hooks/useOutageFeed';
import { OperatorShell } from '@/components/operator/OperatorShell';
import { ReportLogProvider } from '@/components/operator/ReportLog';
import { OperationsProvider } from '@/lib/operations';
import { getDb } from '@/lib/db/client';
import { requireOperator } from '@/server/guards';
import { loadOrg } from '@/server/operations';

export const metadata = { title: 'EEDC operations · VoltIq' };

export default async function OperatorLayout({ children }: { children: React.ReactNode }) {
  const me = await requireOperator();
  // The real roster, signed in as the real staff member — no demo "acting as".
  const org = await loadOrg(getDb(), me);
  return (
    <OperationsProvider initial={org}>
      <OutageFeedProvider>
        <ReportLogProvider>
          <OperatorShell>{children}</OperatorShell>
        </ReportLogProvider>
      </OutageFeedProvider>
    </OperationsProvider>
  );
}
