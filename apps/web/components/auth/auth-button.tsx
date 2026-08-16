'use client';

import { signIn, signOut, useSession } from 'next-auth/react';
import { LogIn, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AuthButton() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <Button variant='ghost' size='sm' disabled aria-label='Carregando sessão'>
        <span className='h-4 w-4 animate-pulse rounded-full bg-muted' />
      </Button>
    );
  }

  if (!session?.user) {
    return (
      <Button
        variant='ghost'
        size='sm'
        onClick={() => void signIn()}
        aria-label='Entrar'
      >
        <LogIn className='h-4 w-4' />
        <span className='hidden sm:inline'>Entrar</span>
      </Button>
    );
  }

  const name = session.user.name?.split(' ')[0] ?? session.user.email ?? 'Usuário';

  return (
    <div className='flex items-center gap-1'>
      <span className='hidden items-center gap-1.5 text-sm text-muted-foreground md:flex'>
        <User className='h-4 w-4' />
        <span className='max-w-28 truncate' title={session.user.email ?? name}>
          {name}
        </span>
      </span>
      <Button
        variant='ghost'
        size='sm'
        onClick={() => void signOut()}
        aria-label='Sair'
      >
        <LogOut className='h-4 w-4' />
      </Button>
    </div>
  );
}
