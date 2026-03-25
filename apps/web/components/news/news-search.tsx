'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface NewsSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function NewsSearch({ value, onChange }: NewsSearchProps) {
  const [local, setLocal] = useState(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const timer = setTimeout(() => onChangeRef.current(local), 400);
    return () => clearTimeout(timer);
  }, [local]);

  return (
    <div className='relative'>
      <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
      <Input
        type='text'
        placeholder='Buscar notícias...'
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        className='pl-9 pr-9'
      />
      {local && (
        <button
          type='button'
          onClick={() => {
            setLocal('');
            onChangeRef.current('');
          }}
          aria-label='Limpar busca'
          className='absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground'
        >
          <X className='h-4 w-4' />
        </button>
      )}
    </div>
  );
}
