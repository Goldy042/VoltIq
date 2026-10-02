import { OutageFeedProvider } from '@/hooks/useOutageFeed';
import { OperatorShell } from '@/components/operator/OperatorShell';
import { ReportLogProvider } from '@/components/operator/ReportLog';

export const metadata = { title: 'EEDC operations · VoltIq' };

export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <OutageFeedProvider>
      <ReportLogProvider>
        <OperatorShell>{children}</OperatorShell>
      </ReportLogProvider>
    </OutageFeedProvider>
  );
}
