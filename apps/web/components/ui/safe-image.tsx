'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { ImageProps } from 'next/image';
import type { ReactNode } from 'react';

interface SafeImageProps extends Omit<ImageProps, 'onError'> {
  fallback: ReactNode;
}

export function SafeImage({ fallback, alt, ...imageProps }: SafeImageProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) return <>{fallback}</>;

  return <Image alt={alt} {...imageProps} onError={() => setHasError(true)} />;
}
