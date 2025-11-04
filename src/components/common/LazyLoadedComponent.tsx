import React, { Suspense } from 'react';
import { LoadingSpinner } from '@/utils/dynamicImports';
import type { ButtonProps } from '@/components/ui/button';

// Lazy-loaded components
const Button = React.lazy(() => import('@/components/ui/button').then(module => ({ default: module.Button })));
const Card = React.lazy(() => import('@/components/ui/card').then(module => ({ default: module.Card })));
const Dialog = React.lazy(() => import('@/components/ui/dialog').then(module => ({ default: module.Dialog })));

interface LazyLoadedComponentProps {
  buttonProps?: ButtonProps;
  cardProps?: React.ComponentProps<typeof Card>;
  dialogProps?: React.ComponentProps<typeof Dialog>;
}

export const LazyLoadedComponent: React.FC<LazyLoadedComponentProps> = ({
  buttonProps,
  cardProps,
  dialogProps
}) => {
  return (
    <div className="space-y-4">
      <Suspense fallback={<LoadingSpinner />}>
        <Button {...buttonProps} />
      </Suspense>
      <Suspense fallback={<LoadingSpinner />}>
        <Card {...cardProps} />
      </Suspense>
      <Suspense fallback={<LoadingSpinner />}>
        <Dialog {...dialogProps} />
      </Suspense>
    </div>
  );
}; 