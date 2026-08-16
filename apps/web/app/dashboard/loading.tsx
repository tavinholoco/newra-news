import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';

export default function DashboardLoading() {
  return (
    <div className='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8'>
      <div className='mb-8'>
        <div className='h-9 w-64 animate-pulse rounded-md bg-muted' />
        <div className='mt-3 h-5 w-96 animate-pulse rounded-md bg-muted' />
      </div>
      <DashboardSkeleton />
    </div>
  );
}
