'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart3, ChevronDown, History, LineChart, LogOut, ShieldCheck, Target } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';

import { Button } from '@/components/ui/button';
import { signOut, useSession } from '@/lib/auth-client';
import { landingPathFor, type StudyGroup } from '@/lib/study/groups';
import { cn } from '@/lib/utils';

const interventionNavItems = [
    { label: 'Biblioteca', href: '/' },
    { label: 'Agregar', href: '/books/new' },
];

interface NavbarProps {
    showMetrics?: boolean;
    showAdmin?: boolean;
    studyGroup?: StudyGroup | null;
    /** Researchers and the experimental arm. The control arm never sees the agent. */
    hasInterventionAccess?: boolean;
}

/**
 * The navigation is the visible half of the study-group gate: a control
 * participant is never shown a link to the intervention, so they never have to
 * be bounced off one. The enforcing half lives server-side in
 * `lib/study/access`; this only decides what is worth offering.
 */
const Navbar = ({
    showMetrics = false,
    showAdmin = false,
    studyGroup = null,
    hasInterventionAccess = false,
}: NavbarProps) => {
    const pathName = usePathname();
    const router = useRouter();
    const { data: session, isPending } = useSession();
    const user = session?.user;
    const isParticipant = Boolean(studyGroup) || hasInterventionAccess;
    const navItems = user
        ? hasInterventionAccess
            ? interventionNavItems
            : []
        : interventionNavItems;
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
                <Link
                    href={user ? landingPathFor(hasInterventionAccess ? 'experimental' : studyGroup) : '/'}
                    className="flex gap-2 items-center"
                    aria-label="Ir al inicio de Investfied"
                >
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

                    {isParticipant && (
                        <>
                            <Link
                                href="/materiales"
                                className={cn(
                                    'nav-link-base',
                                    pathName.startsWith('/materiales') ? 'nav-link-active' : 'text-black hover:opacity-70',
                                )}
                            >
                                Materiales
                            </Link>
                            <Link
                                href="/surveys"
                                className={cn(
                                    'nav-link-base',
                                    pathName.startsWith('/surveys') ? 'nav-link-active' : 'text-black hover:opacity-70',
                                )}
                            >
                                Encuestas
                            </Link>
                        </>
                    )}

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

                                        {hasInterventionAccess && (
                                            <>
                                                <DropdownMenu.Item asChild>
                                                    <Link href="/history" className="profile-menu-item">
                                                        <History className="size-4" />
                                                        Historial
                                                    </Link>
                                                </DropdownMenu.Item>

                                                <DropdownMenu.Item asChild>
                                                    <Link href="/preparacion" className="profile-menu-item">
                                                        <Target className="size-4" />
                                                        Mapa de preparación
                                                    </Link>
                                                </DropdownMenu.Item>

                                                <DropdownMenu.Item asChild>
                                                    <Link href="/progreso" className="profile-menu-item">
                                                        <LineChart className="size-4" />
                                                        Mi progreso
                                                    </Link>
                                                </DropdownMenu.Item>
                                            </>
                                        )}

                                        {showMetrics && (
                                            <DropdownMenu.Item asChild>
                                                <Link href="/metrics" className="profile-menu-item">
                                                    <BarChart3 className="size-4" />
                                                    Métricas y revisión PR
                                                </Link>
                                            </DropdownMenu.Item>
                                        )}

                                        {showAdmin && (
                                            <DropdownMenu.Item asChild>
                                                <Link href="/admin" className="profile-menu-item">
                                                    <ShieldCheck className="size-4" />
                                                    Usuarios y encuestas
                                                </Link>
                                            </DropdownMenu.Item>
                                        )}

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
