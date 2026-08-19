import { useState, type FormEvent } from "react";
import type { PracticePayload } from "./practice-sheet";

type SetupWizardProps = {
  initialUrl?: string;
  initialError?: string | null;
  canCancel?: boolean;
  onCancel?: () => void;
  onComplete(payload: PracticePayload): void;
};

export default function SetupWizard({
  initialUrl = "",
  initialError = null,
  canCancel = false,
  onCancel,
  onComplete,
}: SetupWizardProps) {
  const [sheetUrl, setSheetUrl] = useState(initialUrl);
  const [error, setError] = useState<string | null>(initialError);
  const [connecting, setConnecting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setConnecting(true);

    try {
      const result = await window.practiceAPI.configurePracticeLog(sheetUrl);
      if (result.ok) {
        onComplete(result.payload);
      } else {
        setError(result.error.message);
      }
    } catch {
      setError("Practice Activity could not complete setup. Try again.");
    } finally {
      setConnecting(false);
    }
  };

  return (
    <main className="setup-shell">
      <section className="setup-card" aria-labelledby="setup-title">
        <div className="setup-brand" aria-hidden="true">PA</div>
        <p className="eyebrow">First-time setup</p>
        <h1 id="setup-title">Connect your Practice Log</h1>
        <p className="setup-intro">
          Practice Activity reads the Mark Walker <b>Practice Log</b> directly
          from Google Sheets. Make the sheet viewable before connecting it.
        </p>

        <ol className="setup-steps">
          <li><span>1</span><div>Open your Practice Log in Google Sheets.</div></li>
          <li><span>2</span><div>Click <b>Share</b> in the upper-right corner.</div></li>
          <li>
            <span>3</span>
            <div>
              Under <b>General access</b>, choose <b>Anyone with the link</b>.
            </div>
          </li>
          <li>
            <span>4</span>
            <div>Keep the role set to <b>Viewer</b>, then click <b>Copy link</b>.</div>
          </li>
        </ol>

        <div className="privacy-note">
          <b>Privacy note</b>
          Anyone with the link can view the sheet, including practiced items in
          column C. Viewer access does not allow them to edit it.
        </div>

        <button
          className="help-link"
          type="button"
          onClick={() => void window.practiceAPI.openSharingHelp()}
        >
          View Google’s sharing instructions
        </button>

        <form className="setup-form" onSubmit={submit}>
          <label htmlFor="sheet-url">Google Sheets URL</label>
          <input
            id="sheet-url"
            name="sheet-url"
            type="url"
            required
            autoComplete="off"
            placeholder="https://docs.google.com/spreadsheets/d/…"
            value={sheetUrl}
            onChange={event => setSheetUrl(event.target.value)}
            aria-describedby={error ? "setup-error" : "sheet-hint"}
          />
          <small id="sheet-hint">
            Open the correct worksheet tab before copying its URL.
          </small>
          {error && <p className="setup-error" id="setup-error" role="alert">{error}</p>}
          <div className="setup-actions">
            {canCancel && (
              <button className="secondary-button" type="button" onClick={onCancel}>
                Cancel
              </button>
            )}
            <button className="primary-button" type="submit" disabled={connecting}>
              {connecting ? "Testing Practice Log…" : "Connect Practice Log"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
