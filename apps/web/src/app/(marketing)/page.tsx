import { Button } from '@scoutra/ui';
import { Logo } from '@/components/brand/logo';

export default function Page() {
  return (
    <main className="p-10">
      <Logo />
      <h1 className="t-display mt-6">Test</h1>
      <Button variant="primary">Lancer</Button>
    </main>
  );
}
