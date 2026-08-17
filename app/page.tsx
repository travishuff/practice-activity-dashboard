import ActivityDashboard from "./activity-dashboard";
import { snapshot, snapshotTotalHours } from "./practice-data";

export default function Home() {
  return <ActivityDashboard initial={snapshot} initialTotalHours={snapshotTotalHours} />;
}
