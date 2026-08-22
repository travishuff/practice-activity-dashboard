import { useEffect, useState } from "react";
import ActivityDashboard from "./activity-dashboard";
import type { PracticePayload } from "./practice-sheet";
import SetupWizard from "./setup-wizard";

type AppState =
  | { view: "loading" }
  | { view: "setup"; sheetUrl?: string; userName?: string | null; error?: string | null }
  | { view: "dashboard"; payload: PracticePayload; userName: string | null }
  | { view: "change-sheet"; payload: PracticePayload; sheetUrl?: string; userName: string | null };

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
          setState({
            view: "dashboard",
            payload: result.payload,
            userName: status.userName,
          });
        } else {
          setState({
            view: "setup",
            sheetUrl: status.sheetUrl ?? undefined,
            userName: status.userName,
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
        initialUserName={state.userName}
        initialError={state.error}
        onComplete={(payload, userName) => (
          setState({ view: "dashboard", payload, userName })
        )}
      />
    );
  }

  if (state.view === "change-sheet") {
    return (
      <SetupWizard
        initialUrl={state.sheetUrl}
        initialUserName={state.userName}
        canCancel
        onCancel={() => setState({
          view: "dashboard",
          payload: state.payload,
          userName: state.userName,
        })}
        onComplete={(payload, userName) => (
          setState({ view: "dashboard", payload, userName })
        )}
      />
    );
  }

  return (
    <ActivityDashboard
      initialPayload={state.payload}
      userName={state.userName}
      onChangeSheet={async () => {
        const status = await window.practiceAPI.getSetupStatus();
        setState({
          view: "change-sheet",
          payload: state.payload,
          sheetUrl: status.sheetUrl ?? undefined,
          userName: status.userName,
        });
      }}
    />
  );
}
