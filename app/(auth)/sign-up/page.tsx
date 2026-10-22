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

const ALLOWED_EMAIL_DOMAIN = '@unitru.edu.pe';

export default function SignUpPage() {
    const router = useRouter();
    const [isPending, setIsPending] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleEmailSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        // Client-side only: the study is limited to UNT institutional accounts.
        if (!email.trim().toLowerCase().endsWith(ALLOWED_EMAIL_DOMAIN)) {
            toast.error(`Usa tu correo institucional (${ALLOWED_EMAIL_DOMAIN}).`);
            return;
        }
        setIsPending(true);
        const { error } = await authClient.signUp.email({ email, password, name });
        setIsPending(false);
        if (error) {
            toast.error(error.message ?? 'Error al registrarse');
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
                <CardTitle className="text-2xl font-serif">Crear cuenta</CardTitle>
                <CardDescription>Empieza a chatear con tus investigaciones</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
                {/* Google sign-up hidden: GOOGLE_CLIENT_ID/SECRET are not configured.
                    The handler and the Better Auth provider stay in place; uncomment to bring it back.
                <Button type="button" variant="outline" onClick={handleGoogle} disabled={isPending}>
                    Continuar con Google
                </Button>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <div className="h-px flex-1 bg-border" />
                    <span>O</span>
                    <div className="h-px flex-1 bg-border" />
                </div>
                */}

                <form onSubmit={handleEmailSignUp} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="name">Nombre</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            disabled={isPending}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="email">Correo electrónico</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder={`usuario${ALLOWED_EMAIL_DOMAIN}`}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={isPending}
                        />
                        <p className="text-xs text-muted-foreground">
                            Se recomienda usar tu correo institucional {ALLOWED_EMAIL_DOMAIN}.
                        </p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="password">Contraseña</Label>
                        <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={8}
                            disabled={isPending}
                        />
                    </div>
                    <Button type="submit" disabled={isPending}>
                        {isPending ? 'Creando cuenta...' : 'Registrarse'}
                    </Button>
                </form>

                <p className="text-sm text-muted-foreground text-center">
                    ¿Ya tienes una cuenta?{' '}
                    <Link href="/sign-in" className="underline">
                        Inicia sesión
                    </Link>
                </p>
            </CardContent>
        </Card>
    );
}
