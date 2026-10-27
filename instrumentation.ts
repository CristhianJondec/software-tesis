/**
 * Next.js instrumentation hook: runs once when the server starts.
 * Only the Node.js runtime touches the database (lib/system-logs/console-capture.ts).
 */
export async function register() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;
    const { installConsoleErrorCapture } = await import('@/lib/system-logs/console-capture');
    installConsoleErrorCapture();
}
