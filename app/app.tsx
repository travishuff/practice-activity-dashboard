import { useEffect, useState } from "react";
import ActivityDashboard from "./activity-dashboard";
import type { PracticePayload } from "./practice-sheet";
import SetupWizard from "./setup-wizard";

type AppState =
  | { view: "loading" }
  | { view: "setup"; sheetUrl?: string; error?: string | null; canCancel?: false }
  | { view: "dashboard"; payload: PracticePayload }
  | { view: "change-sheet"; payload: PracticePayload; sheetUrl?: string };

export default function App() {
  const [state, setState] = useState<AppState>({ view: "loading" });

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const status = await window.practiceAPI.getSetupStatus();
        if (!active) return;
        if (!status.configured) {
          setState({ view: "setup" });
          return;
        }

        const result = await window.practiceAPI.getPracticeData();
        if (!active) return;
        if (result.ok) {
          setState({ view: "dashboard", payload: result.payload });
        } else {
          setState({
            view: "setup",
            sheetUrl: status.sheetUrl ?? undefined,
            error: result.error.message,
          });
        }
      } catch {
        if (active) {
          setState({
            view: "setup",
            error: "Practice Activity could not load its saved setup.",
          });
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  if (state.view === "loading") {
    return (
      <main className="loading-shell">
        <div className="setup-brand" aria-hidden="true">PA</div>
        <p>Opening Practice Activity…</p>
      </main>
    );
  }

  if (state.view === "setup") {
    return (
      <SetupWizard
        initialUrl={state.sheetUrl}
        initialError={state.error}
        onComplete={payload => setState({ view: "dashboard", payload })}
      />
    );
  }

  if (state.view === "change-sheet") {
    return (
      <SetupWizard
        initialUrl={state.sheetUrl}
        canCancel
        onCancel={() => setState({ view: "dashboard", payload: state.payload })}
        onComplete={payload => setState({ view: "dashboard", payload })}
      />
    );
  }

  return (
    <ActivityDashboard
      initialPayload={state.payload}
      onChangeSheet={async () => {
        const status = await window.practiceAPI.getSetupStatus();
        setState({
          view: "change-sheet",
          payload: state.payload,
          sheetUrl: status.sheetUrl ?? undefined,
        });
      }}
    />
  );
}
