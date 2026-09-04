import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PLANS, PLAN_LIMITS } from "@/lib/subscription-constants";

const PLAN_ORDER = [PLANS.FREE, PLANS.STANDARD, PLANS.PRO] as const;
const PLAN_LABEL: Record<string, string> = {
    free: 'Gratis',
    standard: 'Estándar',
    pro: 'Pro',
};

export default function SubscriptionsPage() {
  return (
    <div className="container wrapper py-10 pt-24">
      <div className="flex flex-col items-center text-center mb-10">
        <h1 className="text-4xl font-bold font-serif mb-4">Elige Tu Plan</h1>
        <p className="text-muted-foreground max-w-2xl">
          Mejora tu plan para desbloquear más investigaciones, sesiones más largas y funciones avanzadas.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {PLAN_ORDER.map((plan) => {
            const limits = PLAN_LIMITS[plan];
            const isFree = plan === PLANS.FREE;
            return (
                <Card key={plan}>
                    <CardHeader>
                        <CardTitle className="text-2xl font-serif">{PLAN_LABEL[plan]}</CardTitle>
                        <CardDescription>
                            {isFree ? 'Empieza gratis' : `Plan ${PLAN_LABEL[plan]}`}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <ul className="text-sm text-muted-foreground space-y-2">
                            <li>Hasta {limits.maxBooks} investigaciones</li>
                            <li>
                                {limits.maxSessionsPerMonth === Infinity
                                    ? 'Sesiones ilimitadas / mes'
                                    : `${limits.maxSessionsPerMonth} sesiones / mes`}
                            </li>
                            <li>{limits.maxDurationPerSession} min por sesión</li>
                            <li>{limits.hasSessionHistory ? 'Historial de sesiones' : 'Sin historial de sesiones'}</li>
                        </ul>
                        <Button disabled className="mt-auto">
                            {isFree ? 'Plan actual' : 'Próximamente'}
                        </Button>
                    </CardContent>
                </Card>
            );
        })}
      </div>
    </div>
  );
}
