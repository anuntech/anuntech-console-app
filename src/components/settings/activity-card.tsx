import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SectionTitle } from "@/components/console/page-header";
import { ActivityHeatmap } from "@/components/ui/activity-heatmap";
import type { ActivityDay } from "@/lib/account/activity";

/** The person's year in the Console: one square per day, darker on busier days. Only they see it. */
export function ActivityCard({ days }: { days: ActivityDay[] }) {
  return (
    <Card>
      <CardHeader>
        <SectionTitle title="Atividade" />
      </CardHeader>
      <CardContent>
        <ActivityHeatmap days={days} label="Suas interações no Console nos últimos 12 meses" period="nos últimos 12 meses" />
      </CardContent>
    </Card>
  );
}
