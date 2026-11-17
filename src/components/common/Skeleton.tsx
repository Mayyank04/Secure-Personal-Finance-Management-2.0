import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => {
  return (
    <div
      className={`animate-pulse rounded bg-slate-200/80 ${className}`}
      aria-hidden="true"
    />
  );
};

export const MetricCardSkeleton: React.FC = () => {
  return (
    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-6 w-6 rounded-lg" />
      </div>
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-3 w-40" />
    </div>
  );
};

export const MetricCardsGridSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <MetricCardSkeleton key={i} />
      ))}
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 6,
  columns = 6,
}) => {
  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="p-3.5 flex items-center justify-between gap-4">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3.5 flex-1 max-w-sm" />
            <Skeleton className="h-3.5 w-24 hidden sm:block" />
            <Skeleton className="h-3.5 w-28 hidden md:block" />
            <Skeleton className="h-3.5 w-24 text-right" />
            <Skeleton className="h-6 w-14 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
};

export const ChartCardSkeleton: React.FC<{ height?: string }> = ({ height = 'h-72' }) => {
  return (
    <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div className="space-y-1">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
        <Skeleton className="h-7 w-24 rounded-lg" />
      </div>
      <div className={`w-full ${height} flex items-end gap-3 pt-6 px-2`}>
        {Array.from({ length: 10 }).map((_, i) => {
          const heights = ['h-24', 'h-40', 'h-32', 'h-48', 'h-36', 'h-52', 'h-44', 'h-30', 'h-48', 'h-38'];
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <Skeleton className={`w-full rounded-t-md ${heights[i % heights.length]}`} />
              <Skeleton className="h-2.5 w-6" />
            </div>
          );
        })}
      </div>
    </div>
  );
};
