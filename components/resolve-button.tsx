'use client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';

export function ResolveButton({ conflictId }: { conflictId: string }) {
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={async () => {
        const res = await fetch(`/api/conflicts/${conflictId}/resolve`, { method: 'POST' });
        if (res.ok) {
          toast({ title: 'Marked resolved', variant: 'success' });
          router.refresh();
        } else {
          toast({ title: 'Failed', variant: 'destructive' });
        }
      }}
    >
      Mark resolved
    </Button>
  );
}
