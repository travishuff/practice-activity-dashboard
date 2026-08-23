import ActivityDashboard from "./activity-dashboard";
import { snapshot, snapshotPeriodStart, snapshotTotalHours } from "./practice-data";

export default function Home() {
  return (
    <ActivityDashboard
      initial={snapshot}
      initialPeriodStart={snapshotPeriodStart}
      initialTotalHours={snapshotTotalHours}
    />
  );
}
