import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

// Wrappers das APIs de navegação do Next.js que consideram a configuração de
// roteamento (prefixo de locale): Link/redirect/usePathname/useRouter
// adicionam o locale atual automaticamente.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
