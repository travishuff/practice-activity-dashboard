import ActivityDashboard from "./activity-dashboard";
import { snapshot } from "./practice-data";

export default function Home() {
  return <ActivityDashboard initial={snapshot} />;
}
