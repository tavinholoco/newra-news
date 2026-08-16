import { Card, CardContent } from '@/components/ui/card';

interface MetricCardProps {
  label: string;
  value: string | number;
  hint?: string;
}

export function MetricCard({ label, value, hint }: MetricCardProps) {
  return (
    <Card className='h-full gap-2'>
      <CardContent>
        <p className='text-xs font-medium uppercase tracking-wider text-muted-foreground'>
          {label}
        </p>
        <p className='font-display mt-1 text-2xl font-bold text-foreground sm:text-3xl'>
          {value}
        </p>
        {hint && <p className='mt-1 text-xs text-muted-foreground'>{hint}</p>}
      </CardContent>
    </Card>
  );
}
