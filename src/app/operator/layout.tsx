import { OutageFeedProvider } from '@/hooks/useOutageFeed';
import { OperatorShell } from '@/components/operator/OperatorShell';
import { ReportLogProvider } from '@/components/operator/ReportLog';
import { requireOperator } from '@/server/guards';

export const metadata = { title: 'EEDC operations · VoltIq' };

export default async function OperatorLayout({ children }: { children: React.ReactNode }) {
  await requireOperator();
  return (
    <OutageFeedProvider>
      <ReportLogProvider>
        <OperatorShell>{children}</OperatorShell>
      </ReportLogProvider>
    </OutageFeedProvider>
  );
}
