import { ReportScreen } from '@/components/screens/ReportScreen';
import type { IssueType } from '@/data/nsukka';

export const metadata = { title: 'Report a problem · VoltIq' };

const issues: IssueType[] = ['no_power', 'low_voltage', 'fluctuating'];

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ issue?: string }> }) {
  const { issue } = await searchParams;
  const initialIssue = issues.find((i) => i === issue);
  return <ReportScreen initialIssue={initialIssue} />;
}
