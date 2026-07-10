'use client';

import { useFormStatus } from 'react-dom';

interface SubmitButtonProps {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  'data-testid'?: string;
}

// Disables itself while the enclosing form's action is pending, so a fast
// double-click can't submit the same form twice (e.g. duplicate rows).
export default function SubmitButton({ children, pendingText, className, ...rest }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={className} {...rest}>
      {pending ? pendingText || '...' : children}
    </button>
  );
}
