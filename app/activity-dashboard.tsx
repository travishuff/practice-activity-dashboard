"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  calendarDate,
  calendarDateKey,
  DAY,
  formatCalendarDate,
  localCalendarDateKey,
} from "./calendar-date";
import { formatRefreshedAt } from "./refresh-status";
import { summarizePracticePeriod } from "./practice-metrics";
import type { PracticePayload } from "./practice-sheet";
import { practiceActivityTitle } from "./user-name";
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

function DurationValue({ minutes }: { minutes: number }) {
  const parts = durationParts(minutes);
  return (
    <>
      {parts.hours > 0 && <>{parts.hours} <span className="duration-unit">{parts.hours === 1 ? "hour" : "hours"}</span></>}
      {parts.hours > 0 && parts.minutes > 0 && " "}
      {(parts.minutes > 0 || !parts.hours) && <>{parts.minutes} <span className="duration-unit">{parts.minutes === 1 ? "minute" : "minutes"}</span></>}
    </>
  );
}

function dayText(value: number) {
  const amount = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${amount} ${value === 1 ? "day" : "days"}`;
}

function DayValue({ value }: { value: number }) {
  const amount = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return <>{amount} <span className="duration-unit">{value === 1 ? "day" : "days"}</span></>;
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
    // Re-arm after each rollover rather than using a fixed 24h interval, so a
    // DST shift or a slept machine cannot drift the boundary.
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
  initialPayload,
  userName,
  onChangeSheet,
}: {
  initialPayload: PracticePayload;
  userName: string | null;
  onChangeSheet: () => void | Promise<void>;
}) {
  const today = useToday();
  const [payload, setPayload] = useState<PracticePayload>(initialPayload);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [popover, setPopover] = useState<{ date: string; state: string; minutes: number | null; items: string[]; x: number; y: number } | null>(null);
  const appTitle = practiceActivityTitle(userName);

  useEffect(() => {
    document.title = appTitle;
  }, [appTitle]);

  const refresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const result = await window.practiceAPI.getPracticeData();
      if (result.ok) {
        setPayload(result.payload);
      } else {
        setPayload(current => ({ ...current, live: false, error: result.error }));
      }
    } catch {
      setPayload(current => ({
        ...current,
        live: false,
        error: { code: "refresh_failed", message: "Data refresh failed" },
      }));
    } finally {
      setIsRefreshing(false);
    }
  };

  const view = useMemo(() => {
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
  }, [payload.data, payload.periodStart, today]);
  const selected = selectedDate
    ? view.summary.days.find(day => day.date === selectedDate) ?? null
    : null;

  const refreshLabel = isRefreshing
    ? "Refreshing…"
    : payload.error
      ? "Try again"
      : payload.warnings.length
        ? `Refresh · ${payload.warnings.length} sheet ${payload.warnings.length === 1 ? "issue" : "issues"}`
        : "Refresh";
  const refreshTitle = payload.error?.message
    ?? (payload.warnings.length ? payload.warnings.join("\n") : "Refresh practice data from Google Sheets");

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#activity" aria-label={`${appTitle} home`}>
          <span className="brand-mark" aria-hidden="true">PA</span>
          <span className="brand-title" title={appTitle}>{appTitle}</span>
        </a>
        <button className="settings-button" type="button" onClick={() => void onChangeSheet()} disabled={isRefreshing}>
          Change Practice Log
        </button>
      </header>
      <section className="activity-card" id="activity">
        <div className="card-head">
          <div><h2>Daily practice</h2><p>Color intensity represents total minutes practiced.</p></div>
          <div className="card-status"><span>{view.summary.days[0].date.slice(0,4)}—{view.summary.days[view.summary.days.length - 1].date.slice(0,4)}</span><button className="refresh-button" type="button" onClick={() => void refresh()} disabled={isRefreshing} aria-busy={isRefreshing} title={refreshTitle}><i className={isRefreshing ? "is-spinning" : ""} aria-hidden="true">↻</i>{refreshLabel}</button></div>
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
        <article className="range-card">
            <span>Daily practice time <small className="range-title-note">(including 0 minutes for days off)</small></span>
            <RangeChart values={[view.summary.daily.minimum, view.summary.daily.average, view.summary.daily.maximum]} format={durationText} renderValue={value => <DurationValue minutes={value} />} labels={["Shortest", "Average", "Longest"]} />
          </article>
        <article className="range-card">
            <span>Practice streaks</span>
            <RangeChart values={[view.summary.streaks.minimum, view.summary.streaks.average, view.summary.streaks.maximum]} format={dayText} renderValue={value => <DayValue value={value} />} labels={["Shortest", "Average", "Longest"]} />
          </article>
      </section>
      <footer>
        <span>{formatRefreshedAt(payload.checkedAt, payload.live)}</span>
        <small>Practice Activity v{APP_VERSION}</small>
      </footer>
    </main>
  );
}
