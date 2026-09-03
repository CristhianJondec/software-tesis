'use client';

import Link from "next/link";
import Image from "next/image";
import {usePathname, useRouter} from "next/navigation";
import {useSession, signOut} from "@/lib/auth-client";
import {cn} from "@/lib/utils";
import {Button} from "@/components/ui/button";

const navItems = [
    { label: "Biblioteca", href: "/" },
    { label: "Agregar", href: "/books/new" },
    { label: "Precios", href: "/subscriptions" },
]

const Navbar = () => {
    const pathName = usePathname();
    const router = useRouter();
    const { data: session, isPending } = useSession();
    const user = session?.user;

    const handleSignOut = async () => {
        await signOut();
        router.push('/');
        router.refresh();
    };

    return (
        <header className="w-full fixed z-50 bg-(--bg-primary)">
            <div className="wrapper navbar-height py-4 flex justify-between items-center">
                <Link href="/" className="flex gap-0.5 items-center">
                    <Image src="/assets/logo.png" alt="Tesified" width={42} height={26} />
                    <span className="logo-text">Tesified</span>
                </Link>

                <nav className="w-fit flex gap-7.5 items-center">
                    {navItems.map(({ label, href }) => {
                        const isActive = pathName === href || (href !== '/' && pathName.startsWith(href));

                        return (
                            <Link href={href} key={label} className={cn('nav-link-base', isActive ? 'nav-link-active' : 'text-black hover:opacity-70')}>
                                {label}
                            </Link>
                        )
                    })}

                    <div className="flex gap-3 items-center">
                        {!isPending && !user && (
                            <Button variant="outline" asChild>
                                <Link href="/sign-in">Iniciar sesión</Link>
                            </Button>
                        )}
                        {user && (
                            <div className="nav-user-link flex items-center gap-3">
                                <Link href="/subscriptions" className="nav-user-name">
                                    {user.name || user.email}
                                </Link>
                                <Button variant="ghost" size="sm" onClick={handleSignOut}>
                                    Cerrar sesión
                                </Button>
                            </div>
                        )}
                    </div>
                </nav>
            </div>
        </header>
    )
}

export default Navbar
