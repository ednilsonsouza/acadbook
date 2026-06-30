/**
 * ButtonLink — botão que renderiza como <Link> do Next.js.
 * Usa a render prop do @base-ui em vez de asChild (que não existe nesta versão do shadcn/ui).
 */
import Link from 'next/link'
import { Button, buttonVariants } from './button'
import type { VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

interface ButtonLinkProps
  extends VariantProps<typeof buttonVariants> {
  href: string
  className?: string
  children: React.ReactNode
}

export function ButtonLink({ href, variant, size, className, children }: ButtonLinkProps) {
  return (
    <Button
      render={<Link href={href} />}
      variant={variant}
      size={size}
      className={className}
      nativeButton={false}
    >
      {children}
    </Button>
  )
}
