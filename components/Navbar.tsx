'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, History, LogOut } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';

import { Button } from '@/components/ui/button';
import { signOut, useSession } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

const navItems = [
    { label: 'Biblioteca', href: '/' },
    { label: 'Agregar', href: '/books/new' },
];

const Navbar = () => {
    const pathName = usePathname();
    const router = useRouter();
    const { data: session, isPending } = useSession();
    const user = session?.user;
    const userLabel = user?.name?.trim() || user?.email?.trim() || 'Usuario';
    const userInitial = userLabel.charAt(0).toUpperCase();

    const handleSignOut = async () => {
        await signOut();
        router.push('/');
        router.refresh();
    };

    return (
        <header className="w-full fixed z-50 bg-(--bg-primary)">
            <div className="wrapper navbar-height py-4 flex justify-between items-center">
                <Link href="/" className="flex gap-2 items-center" aria-label="Ir a la biblioteca de Investfied">
                    <Image src="/assets/logo.png" alt="" width={42} height={26} />
                    <span className="logo-text">Investfied</span>
                </Link>

                <nav className="w-fit flex gap-3 sm:gap-7.5 items-center" aria-label="Navegación principal">
                    {navItems.map(({ label, href }) => {
                        const isActive = pathName === href || (href !== '/' && pathName.startsWith(href));

                        return (
                            <Link
                                href={href}
                                key={label}
                                className={cn(
                                    'nav-link-base',
                                    isActive ? 'nav-link-active' : 'text-black hover:opacity-70',
                                )}
                            >
                                {label}
                            </Link>
                        );
                    })}

                    <div className="flex items-center">
                        {!isPending && !user && (
                            <Button variant="outline" asChild>
                                <Link href="/sign-in">Iniciar sesión</Link>
                            </Button>
                        )}

                        {user && (
                            <DropdownMenu.Root>
                                <DropdownMenu.Trigger asChild>
                                    <button type="button" className="profile-trigger" aria-label="Abrir menú de perfil">
                                        <span className="profile-avatar" aria-hidden="true">{userInitial}</span>
                                        <ChevronDown className="size-4 hidden sm:block" aria-hidden="true" />
                                    </button>
                                </DropdownMenu.Trigger>

                                <DropdownMenu.Portal>
                                    <DropdownMenu.Content align="end" sideOffset={8} className="profile-menu">
                                        <div className="px-3 py-2">
                                            <p className="text-sm font-semibold text-[#212a3b] truncate">
                                                {user.name?.trim() || 'Mi perfil'}
                                            </p>
                                            <p className="text-xs text-[#3d485e] truncate">{user.email}</p>
                                        </div>

                                        <DropdownMenu.Separator className="h-px bg-[var(--border-subtle)] my-1" />

                                        <DropdownMenu.Item asChild>
                                            <Link href="/history" className="profile-menu-item">
                                                <History className="size-4" />
                                                Historial
                                            </Link>
                                        </DropdownMenu.Item>

                                        <DropdownMenu.Item
                                            className="profile-menu-item text-red-700 focus:text-red-700"
                                            onSelect={handleSignOut}
                                        >
                                            <LogOut className="size-4" />
                                            Cerrar sesión
                                        </DropdownMenu.Item>
                                    </DropdownMenu.Content>
                                </DropdownMenu.Portal>
                            </DropdownMenu.Root>
                        )}
                    </div>
                </nav>
            </div>
        </header>
    );
};

export default Navbar;
