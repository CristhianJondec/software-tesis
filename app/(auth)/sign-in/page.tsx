'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SignInPage() {
    const router = useRouter();
    const [isPending, setIsPending] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleEmailSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsPending(true);
        const { error } = await authClient.signIn.email({ email, password });
        setIsPending(false);
        if (error) {
            toast.error(error.message ?? 'Error al iniciar sesión');
            return;
        }
        router.push('/');
        router.refresh();
    };

    const handleGoogle = async () => {
        await authClient.signIn.social({ provider: 'google', callbackURL: '/' });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-2xl font-serif">Iniciar sesión</CardTitle>
                <CardDescription>Bienvenido de vuelta a Investfied</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
                <Button type="button" variant="outline" onClick={handleGoogle} disabled={isPending}>
                    Continuar con Google
                </Button>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <div className="h-px flex-1 bg-border" />
                    <span>O</span>
                    <div className="h-px flex-1 bg-border" />
                </div>

                <form onSubmit={handleEmailSignIn} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="email">Correo electrónico</Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={isPending}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="password">Contraseña</Label>
                        <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={isPending}
                        />
                    </div>
                    <Button type="submit" disabled={isPending}>
                        {isPending ? 'Iniciando sesión...' : 'Iniciar sesión'}
                    </Button>
                </form>

                <p className="text-sm text-muted-foreground text-center">
                    ¿No tienes una cuenta?{' '}
                    <Link href="/sign-up" className="underline">
                        Regístrate
                    </Link>
                </p>
            </CardContent>
        </Card>
    );
}
