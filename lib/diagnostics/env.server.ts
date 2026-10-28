import 'server-only';

/**
 * Environment variables the app reads, for the "Variables de entorno" section
 * of /admin/diagnostico. Values are never rendered with the page: a secret is
 * revealed one at a time through `revealEnvVar` (admin-only, logged).
 *
 * Platform variables (Vercel, AWS Lambda...) are listed by name only and can
 * never be revealed: some of them are the platform's own credentials.
 */

export interface AppEnvVar {
    name: string;
    purpose: string;
    secret: boolean;
    required: boolean;
}

export const APP_ENV_VARS: readonly AppEnvVar[] = [
    { name: 'DATABASE_URL', purpose: 'Base de datos', secret: true, required: true },
    { name: 'BETTER_AUTH_SECRET', purpose: 'Inicio de sesión', secret: true, required: true },
    { name: 'BETTER_AUTH_URL', purpose: 'Dominio del inicio de sesión (opcional)', secret: false, required: false },
    { name: 'ADMIN_EMAIL', purpose: 'Acceso al panel de admin', secret: false, required: true },
    { name: 'METRICS_OWNER_EMAILS', purpose: 'Acceso a /metrics (opcional)', secret: false, required: false },
    { name: 'GEMINI_API_KEY', purpose: 'Embeddings y juez del informe', secret: true, required: true },
    { name: 'GEMINI_JUDGE_MODEL', purpose: 'Reemplaza el modelo del juez (opcional)', secret: false, required: false },
    { name: 'VAPI_PRIVATE_API_KEY', purpose: 'Motivo de fin y costo de las llamadas; diagnóstico', secret: true, required: true },
    { name: 'VAPI_SERVER_SECRET', purpose: 'Secreto del servidor de Vapi (opcional)', secret: true, required: false },
    { name: 'NEXT_PUBLIC_VAPI_API_KEY', purpose: 'Iniciar la llamada de voz en el navegador', secret: true, required: true },
    { name: 'NEXT_PUBLIC_ASSISTANT_ID', purpose: 'Assistant de Vapi', secret: false, required: true },
    { name: 'NEXT_PUBLIC_BASE_URL', purpose: 'Dominio de la app', secret: false, required: true },
    { name: 'R2_ACCOUNT_ID', purpose: 'Almacenamiento de PDFs', secret: false, required: true },
    { name: 'R2_ACCESS_KEY_ID', purpose: 'Almacenamiento de PDFs', secret: true, required: true },
    { name: 'R2_SECRET_ACCESS_KEY', purpose: 'Almacenamiento de PDFs', secret: true, required: true },
    { name: 'R2_BUCKET_NAME', purpose: 'Almacenamiento de PDFs', secret: false, required: true },
    { name: 'GOOGLE_CLIENT_ID', purpose: 'Inicio de sesión con Google (opcional)', secret: false, required: false },
    { name: 'GOOGLE_CLIENT_SECRET', purpose: 'Inicio de sesión con Google (opcional)', secret: true, required: false },
    { name: 'ELEVENLABS_API_KEY', purpose: 'Voz alternativa (opcional)', secret: true, required: false },
];

const PLATFORM_PREFIXES = ['VERCEL', 'AWS_', 'LAMBDA_', 'NOW_', 'TURBO_', 'NX_', 'npm_', '__NEXT', 'NEXT_RUNTIME'];
const PLATFORM_NAMES = new Set([
    'PATH', 'HOME', 'PWD', 'OLDPWD', 'SHLVL', 'HOSTNAME', 'LANG', 'TZ', 'TERM', 'USER', 'SHELL', '_',
    'NODE_ENV', 'NODE_OPTIONS', 'NODE_PATH', 'PORT', 'LD_LIBRARY_PATH', 'CI', 'NEXT_TELEMETRY_DISABLED',
    'NEXT_DEPLOYMENT_ID', 'ENABLE_VC_BUILD', 'TMPDIR', 'XDG_CONFIG_HOME', 'COREPACK_ENABLE_STRICT',
]);

function isPlatformVar(name: string): boolean {
    return PLATFORM_NAMES.has(name) || PLATFORM_PREFIXES.some((prefix) => name.startsWith(prefix));
}

export interface EnvVarStatus {
    name: string;
    purpose: string;
    secret: boolean;
    required: boolean;
    set: boolean;
    /** Full value for non-secrets; last four characters for secrets. */
    preview: string | null;
    length: number;
}

function preview(value: string, secret: boolean): string {
    if (!secret) return value;
    return value.length > 8 ? `••••${value.slice(-4)}` : '••••';
}

export function listEnvironment(): { app: EnvVarStatus[]; other: string[] } {
    const known = new Set(APP_ENV_VARS.map((variable) => variable.name));
    const app = APP_ENV_VARS.map((variable) => {
        const value = process.env[variable.name] ?? '';
        return {
            ...variable,
            set: value.trim() !== '',
            preview: value.trim() ? preview(value, variable.secret) : null,
            length: value.length,
        };
    });
    const other = Object.keys(process.env)
        .filter((name) => !known.has(name) && !isPlatformVar(name))
        .sort();
    return { app, other };
}

/** Whether the admin may reveal this variable: app variables and non-platform extras only. */
export function canRevealEnvVar(name: string): boolean {
    if (typeof name !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return false;
    if (APP_ENV_VARS.some((variable) => variable.name === name)) return true;
    return name in process.env && !isPlatformVar(name);
}
