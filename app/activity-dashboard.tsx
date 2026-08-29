"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  calendarDate,
  calendarDateKey,
  DAY,
  formatCalendarDate,
  localCalendarDateKey,
} from "./calendar-date";
import type { PracticeDay } from "./practice-data";
import { summarizePracticePeriod } from "./practice-metrics";
import { formatRefreshedAt } from "./refresh-status";
import {
  ACTIVE_PRACTICE_SOURCE_STORAGE_KEY,
  DEFAULT_PRACTICE_LOG_URL,
  parseSavedPracticeSources,
  PRACTICE_SOURCES_STORAGE_KEY,
  practiceSourceLabel,
  removePracticeSource,
  resolveSavedPracticeSource,
  type PracticeSource,
  upsertPracticeSource,
} from "./practice-sources.ts";
import { normalizePracticeLogUrl, type PracticePayload } from "./practice-sheet";
import { APP_VERSION } from "./version";

function level(minutes: number) { return minutes === 0 ? 0 : minutes < 60 ? 1 : minutes < 120 ? 2 : minutes < 180 ? 3 : 4; }

function durationParts(minutes: number) {
  const rounded = Math.round(minutes);
  return { hours: Math.floor(rounded / 60), minutes: rounded % 60 };
}

function durationText(minutes: number) {
  const parts = durationParts(minutes);
  const hours = parts.hours ? `${parts.hours} ${parts.hours === 1 ? "hour" : "hours"}` : "";
  const remainingMinutes = parts.minutes || !parts.hours
    ? `${parts.minutes} ${parts.minutes === 1 ? "minute" : "minutes"}`
    : "";
  return [hours, remainingMinutes].filter(Boolean).join(" ");
}

function ResponsiveUnit({ full, short, enabled }: { full: string; short: string; enabled: boolean }) {
  if (!enabled) return <span className="duration-unit">{full}</span>;
  return (
    <span className="duration-unit">
      <span className="responsive-unit-long">{full}</span>
      <span className="responsive-unit-short">{short}</span>
    </span>
  );
}

function DurationValue({ minutes, responsiveUnits = false }: { minutes: number; responsiveUnits?: boolean }) {
  const parts = durationParts(minutes);
  return (
    <>
      {parts.hours > 0 && <>{parts.hours} <ResponsiveUnit full={parts.hours === 1 ? "hour" : "hours"} short="h" enabled={responsiveUnits} /></>}
      {parts.hours > 0 && parts.minutes > 0 && " "}
      {(parts.minutes > 0 || !parts.hours) && <>{parts.minutes} <ResponsiveUnit full={parts.minutes === 1 ? "minute" : "minutes"} short="m" enabled={responsiveUnits} /></>}
    </>
  );
}

function dayText(value: number) {
  const amount = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${amount} ${value === 1 ? "day" : "days"}`;
}

function DayValue({ value, responsiveUnits = false }: { value: number; responsiveUnits?: boolean }) {
  const amount = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return <>{amount} <ResponsiveUnit full={value === 1 ? "day" : "days"} short="d" enabled={responsiveUnits} /></>;
}

function isPracticePayload(value: unknown): value is PracticePayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PracticePayload>;
  const validError = candidate.error === null || (
    Boolean(candidate.error)
    && typeof candidate.error?.code === "string"
    && typeof candidate.error?.message === "string"
  );
  return Array.isArray(candidate.data)
    && candidate.data.every(day => (
      day
      && typeof day.date === "string"
      && Number.isFinite(day.minutes)
      && (day.items === undefined || (Array.isArray(day.items) && day.items.every(item => typeof item === "string")))
    ))
    && (candidate.periodStart === null || typeof candidate.periodStart === "string")
    && Number.isFinite(candidate.totalHours)
    && typeof candidate.live === "boolean"
    && (candidate.checkedAt === null || typeof candidate.checkedAt === "string")
    && validError
    && Array.isArray(candidate.warnings)
    && candidate.warnings.every(warning => typeof warning === "string");
}

function RangeChart({ values, format, renderValue, labels }: { values: number[]; format: (value: number, index: number) => string; renderValue?: (value: number, index: number) => ReactNode; labels: string[] }) {
  return (
    <div className="range-chart" role="img" style={{ "--points": values.length } as React.CSSProperties} aria-label={values.map((value, index) => `${labels[index]} ${format(value, index)}`).join(", ")}>
      <div className="range-values">{values.map((value, index) => <b key={labels[index]}>{renderValue ? renderValue(value, index) : format(value, index)}</b>)}</div>
      <div className="range-line" aria-hidden="true">{values.map((_, index) => <i key={labels[index]} />)}</div>
      <div className="range-labels">{labels.map(label => <small key={label}>{label}</small>)}</div>
    </div>
  );
}

function useToday() {
  const [today, setToday] = useState(localCalendarDateKey);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const scheduleRollover = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      timer = setTimeout(() => {
        setToday(localCalendarDateKey());
        scheduleRollover();
      }, midnight.getTime() - now.getTime() + 1_000);
    };

    scheduleRollover();
    return () => clearTimeout(timer);
  }, []);

  return today;
}

export default function ActivityDashboard({
  initial,
  initialPeriodStart,
  initialTotalHours,
}: {
  initial: PracticeDay[];
  initialPeriodStart: string;
  initialTotalHours: number;
}) {
  const today = useToday();
  const [payload, setPayload] = useState<PracticePayload | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshingRef = useRef(false);
  const [sources, setSources] = useState<PracticeSource[]>(() => [{
    url: DEFAULT_PRACTICE_LOG_URL,
    periodStart: initialPeriodStart,
  }]);
  const [activeSourceUrl, setActiveSourceUrl] = useState(DEFAULT_PRACTICE_LOG_URL);
  const [storageReady, setStorageReady] = useState(false);
  const [showSourceForm, setShowSourceForm] = useState(false);
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [popover, setPopover] = useState<{ date: string; state: string; minutes: number | null; items: string[]; x: number; y: number } | null>(null);

  const loadPracticeSource = useCallback(async (requestedUrl: string) => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setIsRefreshing(true);
    setSourceError(null);
    try {
      const normalizedUrl = normalizePracticeLogUrl(requestedUrl);
      const response = await fetch(
        `/api/practice?url=${encodeURIComponent(normalizedUrl)}`,
        { cache: "no-store" },
      );
      const next: unknown = await response.json();
      if (!isPracticePayload(next)) throw new Error("The Practice Log returned an invalid response");
      if (!response.ok || !next.live || !next.periodStart) {
        throw new Error(next.error?.message ?? "The Practice Log could not be loaded");
      }

      setPayload(next);
      setSources(current => upsertPracticeSource(current, {
        url: normalizedUrl,
        periodStart: next.periodStart as string,
      }));
      setActiveSourceUrl(normalizedUrl);
      setSelectedDate(null);
      setPopover(null);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Data refresh failed";
      setSourceError(message);
      setPayload(current => current
        ? {
            ...current,
            live: false,
            error: { code: "refresh_failed", message },
          }
        : {
            data: initial,
            periodStart: initialPeriodStart,
            totalHours: initialTotalHours,
            live: false,
            checkedAt: null,
            error: { code: "refresh_failed", message },
            warnings: [],
          });
      return false;
    } finally {
      refreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, [initial, initialPeriodStart, initialTotalHours]);

  useEffect(() => {
    const fallback = {
      url: DEFAULT_PRACTICE_LOG_URL,
      periodStart: initialPeriodStart,
    };
    let restored = [fallback];
    let selectedUrl = DEFAULT_PRACTICE_LOG_URL;
    try {
      restored = parseSavedPracticeSources(
        window.localStorage.getItem(PRACTICE_SOURCES_STORAGE_KEY),
        fallback,
      );
      selectedUrl = resolveSavedPracticeSource(
        restored,
        window.localStorage.getItem(ACTIVE_PRACTICE_SOURCE_STORAGE_KEY),
        DEFAULT_PRACTICE_LOG_URL,
      );
    } catch {
      // Browser storage is an optional convenience; the default source still works.
    }
    const timer = window.setTimeout(() => {
      setSources(restored);
      setActiveSourceUrl(selectedUrl);
      setStorageReady(true);
      void loadPracticeSource(selectedUrl);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialPeriodStart, loadPracticeSource]);

  useEffect(() => {
    if (!storageReady) return;
    try {
      window.localStorage.setItem(PRACTICE_SOURCES_STORAGE_KEY, JSON.stringify(sources));
      window.localStorage.setItem(ACTIVE_PRACTICE_SOURCE_STORAGE_KEY, activeSourceUrl);
    } catch {
      // Keep the active session working even when local storage is unavailable.
    }
  }, [activeSourceUrl, sources, storageReady]);

  const addPracticeSource = async (event: FormEvent) => {
    event.preventDefault();
    const added = await loadPracticeSource(sourceUrl);
    if (!added) return;
    setSourceUrl("");
    setShowSourceForm(false);
  };

  const removeActiveSource = async () => {
    if (activeSourceUrl === DEFAULT_PRACTICE_LOG_URL || sources.length <= 1) return;

    const activeIndex = sources.findIndex(source => source.url === activeSourceUrl);
    const remaining = removePracticeSource(sources, activeSourceUrl);
    const nextSource = remaining[Math.min(Math.max(activeIndex, 0), remaining.length - 1)]
      ?? remaining[0];
    if (!nextSource) return;

    setSources(remaining);
    setActiveSourceUrl(nextSource.url);
    setSourceError(null);
    await loadPracticeSource(nextSource.url);
  };

  const view = useMemo(() => {
    if (!payload) return null;
    const summary = summarizePracticePeriod(payload.data, { periodStart: payload.periodStart, today });
    const period = new Map(summary.days.map(day => [day.date, day]));
    const periodStart = calendarDate(summary.days[0].date);
    const periodEnd = calendarDate(summary.days[summary.days.length - 1].date);
    const start = new Date(periodStart);
    start.setUTCDate(start.getUTCDate() - start.getUTCDay());
    const cells: Array<{ date: string; minutes: number; items: string[]; inRange: boolean; elapsed: boolean }> = [];
    for (let d = new Date(start); d <= periodEnd; d = new Date(d.getTime() + DAY)) {
      const key = calendarDateKey(d); const day = period.get(key); cells.push({ date: key, minutes: day?.minutes ?? 0, items: day?.items ?? [], inRange: Boolean(day), elapsed: day?.elapsed ?? false });
    }
    while (cells.length % 7) { const d = new Date(calendarDate(cells[cells.length - 1].date).getTime() + DAY); cells.push({ date: calendarDateKey(d), minutes: 0, items: [], inRange: false, elapsed: false }); }
    const weeks = cells.length / 7;
    const months: Array<{ label: string; column: number }> = [];
    const years: Array<{ label: string; column: number }> = [];
    let previousMonth = "";
    let previousYear = "";
    cells.forEach((cell, index) => {
      if (index % 7 !== 0) return;
      const d = calendarDate(cell.date); const name = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
      const column = Math.floor(index / 7) + 1;
      const year = String(d.getUTCFullYear());
      if (name !== previousMonth) { months.push({ label: name, column }); previousMonth = name; }
      if (year !== previousYear) { years.push({ label: year, column }); previousYear = year; }
    });
    return { cells, weeks, months, years, summary };
  }, [payload, today]);
  const selected = selectedDate && view
    ? view.summary.days.find(day => day.date === selectedDate) ?? null
    : null;

  if (!payload || !view) {
    return (
      <main className="loading-shell">
        <div className="setup-brand" aria-hidden="true">PA</div>
        <p>Opening Practice Activity…</p>
      </main>
    );
  }

  const refreshLabel = isRefreshing
    ? "Refreshing…"
    : payload.error
      ? "Try again"
      : payload.warnings.length
        ? `Refresh · ${payload.warnings.length} sheet ${payload.warnings.length === 1 ? "issue" : "issues"}`
        : "Refresh";
  const refreshTitle = payload.error?.message
    ?? (payload.warnings.length ? payload.warnings.join("\n") : "Refresh practice data from Google Sheets");
  const activeSource = sources.find(source => source.url === activeSourceUrl);
  const canRemoveActiveSource = sources.length > 1
    && activeSourceUrl !== DEFAULT_PRACTICE_LOG_URL;
  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#activity" aria-label="Practice activity home"><span className="brand-mark">PA</span><span className="brand-title">Practice Activity: Travis Huff</span></a>
        <div className="source-controls">
          {sources.length > 1 && (
            <label className="source-picker">
              <span>Practice year</span>
              <select
                value={activeSourceUrl}
                onChange={event => void loadPracticeSource(event.target.value)}
                disabled={isRefreshing}
                aria-label="Practice Log date range"
              >
                {sources.map(source => (
                  <option key={source.url} value={source.url}>
                    {practiceSourceLabel(source)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {sources.length > 1 && (
            <button
              className="source-remove"
              type="button"
              onClick={() => void removeActiveSource()}
              disabled={isRefreshing || !canRemoveActiveSource}
              aria-label={canRemoveActiveSource && activeSource
                ? `Remove Practice Log for ${practiceSourceLabel(activeSource)}`
                : "The original Practice Log cannot be removed"}
              title={canRemoveActiveSource && activeSource
                ? `Remove ${practiceSourceLabel(activeSource)}`
                : "The original Practice Log is always available"}
            >
              Remove
            </button>
          )}
          <button
            className="source-button"
            type="button"
            onClick={() => {
              setSourceError(null);
              setShowSourceForm(current => !current);
            }}
            disabled={isRefreshing}
            aria-expanded={showSourceForm}
            aria-controls="practice-source-form"
          >
            <span aria-hidden="true">＋</span> Add Practice Log
          </button>
        </div>
      </header>
      {showSourceForm && (
        <form className="source-panel" id="practice-source-form" onSubmit={event => void addPracticeSource(event)}>
          <div>
            <label htmlFor="practice-log-url">Google Sheets URL</label>
            <p>Add a public Practice Log. Its date range will become the name shown in the selector.</p>
          </div>
          <div className="source-entry">
            <input
              id="practice-log-url"
              type="url"
              required
              autoComplete="off"
              maxLength={2_048}
              placeholder="https://docs.google.com/spreadsheets/d/…"
              value={sourceUrl}
              onChange={event => setSourceUrl(event.target.value)}
              aria-describedby={sourceError ? "practice-source-error" : "practice-source-hint"}
            />
            <button className="source-submit" type="submit" disabled={isRefreshing}>
              {isRefreshing ? "Checking…" : "Add & view"}
            </button>
            <button className="source-cancel" type="button" onClick={() => setShowSourceForm(false)} disabled={isRefreshing}>
              Cancel
            </button>
            {sourceError
              ? <small className="source-error" id="practice-source-error" role="alert">{sourceError}</small>
              : <small id="practice-source-hint">The sheet must be shared as Anyone with the link · Viewer.</small>}
          </div>
        </form>
      )}
      <section className="activity-card" id="activity">
        <div className="card-head">
          <div><h2>Daily practice</h2><p>Color intensity represents total minutes practiced.</p></div>
          <div className="card-status"><span>{view.summary.days[0].date.slice(0,4)}—{view.summary.days[view.summary.days.length - 1].date.slice(0,4)}</span><button className="refresh-button" type="button" onClick={() => void loadPracticeSource(activeSourceUrl)} disabled={isRefreshing} aria-busy={isRefreshing} title={refreshTitle}><i className={isRefreshing ? "is-spinning" : ""} aria-hidden="true">↻</i>{refreshLabel}</button></div>
        </div>
        {payload.error && !isRefreshing && <p className="refresh-error" role="alert">{payload.error.message}</p>}
        <div className="chart-scroll">
          <div className="chart" style={{ "--weeks": view.weeks } as React.CSSProperties}>
            <div className="calendar-labels">
              {view.years.map((year, i) => <b key={`${year.label}-${i}`} className="year-label" style={{ gridColumn: year.column }}>{year.label}</b>)}
              {view.months.map((month, i) => <span key={`${month.label}-${i}`} className="month-label" style={{ gridColumn: month.column }}>{month.label}</span>)}
              {view.years.map((year, i) => <i key={`separator-${year.label}`} className="year-separator" style={{ gridColumn: `${year.column} / ${view.years[i + 1]?.column ?? view.weeks + 1}` }} aria-hidden="true" />)}
            </div>
            <div className="day-labels"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div>
            <div className="heatmap">
              {view.cells.map(cell => {
                const state = !cell.inRange ? "Outside tracking period" : !cell.elapsed ? "Not occurred yet" : cell.minutes ? durationText(cell.minutes) : "No practice";
                const date = formatCalendarDate(cell.date, { weekday:"long", month:"long", day:"numeric", year:"numeric" });
                const label = `${date}: ${state}${cell.items.length ? `. Practiced: ${cell.items.join(", ")}` : ""}`;
                const showPopover = (target: HTMLButtonElement) => { const rect = target.getBoundingClientRect(); setPopover({ date, state, minutes: cell.inRange && cell.elapsed && cell.minutes ? cell.minutes : null, items: cell.items, x: rect.left + rect.width / 2, y: rect.top }); };
                return <button key={cell.date} className={`cell level-${level(cell.minutes)} ${cell.inRange ? cell.elapsed ? "" : "future" : "outside"}`} aria-label={label} disabled={!cell.inRange} onMouseEnter={event => showPopover(event.currentTarget)} onMouseLeave={() => setPopover(null)} onFocus={event => showPopover(event.currentTarget)} onBlur={() => setPopover(null)} onClick={() => setSelectedDate(cell.date)} />;
              })}
            </div>
          </div>
        </div>
        {popover && <div className="cell-popover" style={{ left: popover.x, top: popover.y }} role="tooltip"><b>{popover.date}</b><span>{popover.minutes === null ? popover.state : <DurationValue minutes={popover.minutes} />}</span>{popover.items.length > 0 && <ul>{popover.items.map(item => <li key={item}>{item}</li>)}</ul>}</div>}
        <div className="card-foot"><p>{selected ? <><b>{formatCalendarDate(selected.date, { month:"long", day:"numeric", year:"numeric" })}</b><span>{!selected.elapsed ? "Not occurred yet" : selected.minutes ? <DurationValue minutes={selected.minutes} /> : "No practice recorded"}</span></> : <span>Select a day to see its total</span>}</p><div className="legend"><span>Less</span>{[0,1,2,3,4].map(n => <i key={n} className={`cell level-${n}`} />)}<span>More</span></div></div>
      </section>
      <section className="stats" aria-label="Practice summary">
        <article className="total-card"><span>Total practice time</span><strong><DurationValue minutes={payload.totalHours * 60} /></strong></article>
        <article className="split-card">
          <span>365-day activity</span>
          <div className="split-values"><strong>{view.summary.practiceDays}<small> practiced</small></strong><strong>{view.summary.daysOff}<small> off</small></strong><strong>{view.summary.remainingDays}<small> remaining</small></strong></div>
          <div className="split-bar" role="img" aria-label={`${view.summary.practiceDays} practice days, ${view.summary.daysOff} days off, and ${view.summary.remainingDays} remaining days, 365 days total`}>
            <i className="practiced" style={{ width: `${view.summary.practiceDays / 365 * 100}%` }} />
            <i className="off" style={{ width: `${view.summary.daysOff / 365 * 100}%` }} />
            <i className="future-segment" style={{ width: `${view.summary.remainingDays / 365 * 100}%` }} />
          </div>
          <div className="split-legend"><small><i className="practiced" />Practice days</small><small><i className="off" />Days off</small><small><i className="future-segment" />Remaining</small><small>365 total</small></div>
        </article>
        <article className="range-card"><span>Daily practice time <small className="range-title-note">(including 0 minutes for days off)</small></span><RangeChart values={[view.summary.daily.minimum, view.summary.daily.average, view.summary.daily.maximum]} format={durationText} renderValue={value => <DurationValue minutes={value} responsiveUnits />} labels={["Shortest", "Average", "Longest"]} /></article>
        <article className="range-card"><span>Practice streaks</span><RangeChart values={[view.summary.streaks.minimum, view.summary.streaks.average, view.summary.streaks.maximum]} format={dayText} renderValue={value => <DayValue value={value} responsiveUnits />} labels={["Shortest", "Average", "Longest"]} /></article>
      </section>
      <footer>
        <span>{payload.checkedAt
          ? formatRefreshedAt(payload.checkedAt, payload.live)
          : isRefreshing ? "Refreshing practice data…" : "Refresh unavailable"}</span>
        <small>Practice Activity v{APP_VERSION}</small>
      </footer>
    </main>
  );
}
