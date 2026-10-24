import { StatusPage } from '@/components/app/StatusPage';
import { ButtonLink } from '@/components/ui/Button';

export const metadata = { title: 'Page not found · VoltIq' };

export default function NotFound() {
  return (
    <StatusPage
      code="404"
      title="This page isn’t on the map"
      body="The link may be old or mistyped. Outages that were restored a while ago also drop off the live map."
      actions={
        <>
          <ButtonLink href="/map" size="lg">
            Open the live map
          </ButtonLink>
          <ButtonLink href="/dashboard" size="lg" variant="secondary">
            Go home
          </ButtonLink>
        </>
      }
    />
  );
}
