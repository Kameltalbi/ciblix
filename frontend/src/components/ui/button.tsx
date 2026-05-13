import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold tracking-tight transition-smooth disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-sm hover:bg-[#1184f7] hover:shadow-glow active:scale-[0.99]',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl',
        outline:
          'border border-brand-soft/80 bg-white text-brand-accent hover:bg-[#BED6F6]/35 hover:border-brand-soft hover:text-brand-accent',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-[#e8f0fb]',
        ghost: 'hover:bg-accent/80 hover:text-accent-foreground rounded-xl',
        link: 'text-brand-accent underline-offset-4 hover:underline rounded-none shadow-none h-auto px-0 py-0 font-semibold',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-lg px-3 text-xs',
        lg: 'h-11 rounded-2xl px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = 'Button';
