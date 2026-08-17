"use client";

import { useEffect, useMemo, useState } from "react";
import type { PracticeDay } from "./practice-data";
import { summarizePracticeWindow } from "./practice-metrics";

type Payload = { data: PracticeDay[]; totalHours: number; live: boolean; checkedAt: string | null };
const DAY = 86_400_000;

function iso(date: Date) { return date.toISOString().slice(0, 10); }
function localDate(value: string) { return new Date(`${value}T12:00:00`); }
function level(minutes: number) { return minutes === 0 ? 0 : minutes < 60 ? 1 : minutes < 120 ? 2 : minutes < 180 ? 3 : 4; }
function duration(minutes: number) { const rounded = Math.round(minutes); const h = Math.floor(rounded / 60); const m = rounded % 60; return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`; }

function RangeChart({ values, format, labels }: { values: [number, number, number]; format: (value: number) => string; labels: [string, string, string] }) {
  return (
    <div className="range-chart" role="img" aria-label={`${labels[0]} ${format(values[0])}, ${labels[1]} ${format(values[1])}, ${labels[2]} ${format(values[2])}`}>
      <div className="range-values">{values.map((value, index) => <b key={labels[index]}>{format(value)}</b>)}</div>
      <div className="range-line" aria-hidden="true"><i /><i /><i /></div>
      <div className="range-labels">{labels.map(label => <small key={label}>{label}</small>)}</div>
    </div>
  );
}

export default function ActivityDashboard({ initial }: { initial: PracticeDay[] }) {
  const [payload, setPayload] = useState<Payload>({ data: initial, totalHours: 562.85, live: false, checkedAt: null });
  const [selected, setSelected] = useState<PracticeDay | null>(null);
  const [popover, setPopover] = useState<{ label: string; x: number; y: number } | null>(null);

  useEffect(() => {
    const refresh = () => fetch("/api/practice", { cache: "no-store" }).then(r => r.json()).then(setPayload).catch(() => undefined);
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const view = useMemo(() => {
    const map = new Map(payload.data.map(day => [day.date, day.minutes]));
    const end = new Date(); end.setHours(12, 0, 0, 0);
    const summary = summarizePracticeWindow(payload.data, iso(end));
    const start = new Date(end.getTime() - 364 * DAY);
    start.setDate(start.getDate() - start.getDay());
    const cells: Array<{ date: string; minutes: number; inRange: boolean }> = [];
    for (let d = new Date(start); d <= end; d = new Date(d.getTime() + DAY)) {
      const key = iso(d); cells.push({ date: key, minutes: map.get(key) || 0, inRange: d >= new Date(end.getTime() - 364 * DAY) });
    }
    while (cells.length % 7) { const d = new Date(localDate(cells[cells.length - 1].date).getTime() + DAY); cells.push({ date: iso(d), minutes: 0, inRange: false }); }
    const weeks = cells.length / 7;
    const months: Array<{ label: string; column: number }> = [];
    let previous = "";
    cells.forEach((cell, index) => {
      if (index % 7 !== 0) return;
      const d = localDate(cell.date); const name = d.toLocaleString("en-US", { month: "short" });
      if (name !== previous) { months.push({ label: name, column: Math.floor(index / 7) + 1 }); previous = name; }
    });
    return { cells, weeks, months, summary };
  }, [payload]);

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#activity" aria-label="Practice activity home"><span>PA</span> Practice Activity: Travis Huff</a>
        <a className="sheet-link" href="https://docs.google.com/spreadsheets/d/1oR05zGWqdEKNy1smZL2tV0WTp2uSknmo9p5riec1y7g/edit" target="_blank" rel="noreferrer">Open source sheet ↗</a>
      </header>
      <section className="activity-card" id="activity">
        <div className="card-head">
          <div><h2>Daily practice</h2><p>Color intensity represents total minutes practiced.</p></div>
          <div className="card-status"><span>{payload.data[0]?.date.slice(0,4)}—{new Date().getFullYear()}</span><div className={`sync ${payload.live ? "is-live" : ""}`}><i />{payload.live ? "Live · refreshes every minute" : "Snapshot · sheet access is restricted"}</div></div>
        </div>
        <div className="chart-scroll">
          <div className="chart" style={{ "--weeks": view.weeks } as React.CSSProperties}>
            <div className="month-labels">{view.months.map((month, i) => <span key={`${month.label}-${i}`} style={{ gridColumn: month.column }}>{month.label}</span>)}</div>
            <div className="day-labels"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div>
            <div className="heatmap">
              {view.cells.map(cell => {
                const label = `${localDate(cell.date).toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" })}: ${cell.minutes ? duration(cell.minutes) : "No practice"}`;
                const showPopover = (target: HTMLButtonElement) => { const rect = target.getBoundingClientRect(); setPopover({ label, x: rect.left + rect.width / 2, y: rect.top }); };
                return <button key={cell.date} className={`cell level-${level(cell.minutes)} ${cell.inRange ? "" : "outside"}`} aria-label={label} onMouseEnter={event => showPopover(event.currentTarget)} onMouseLeave={() => setPopover(null)} onFocus={event => showPopover(event.currentTarget)} onBlur={() => setPopover(null)} onClick={() => setSelected({ date: cell.date, minutes: cell.minutes })} />;
              })}
            </div>
          </div>
        </div>
        {popover && <div className="cell-popover" style={{ left: popover.x, top: popover.y }} role="tooltip">{popover.label}</div>}
        <div className="card-foot"><p>{selected ? <><b>{localDate(selected.date).toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" })}</b><span>{selected.minutes ? duration(selected.minutes) : "No practice recorded"}</span></> : <span>Select a day to see its total</span>}</p><div className="legend"><span>Less</span>{[0,1,2,3,4].map(n => <i key={n} className={`cell level-${n}`} />)}<span>More</span></div></div>
      </section>
      <section className="stats" aria-label="Practice summary">
        <article className="total-card"><span>Total practice time</span><strong>{payload.totalHours.toFixed(2)}<small> hours</small></strong></article>
        <article className="range-card"><span>Daily practice range</span><RangeChart values={[view.summary.daily.minimum, view.summary.daily.average, view.summary.daily.maximum]} format={duration} labels={["Shortest", "Average", "Longest"]} /></article>
        <article className="range-card"><span>Practice streaks</span><RangeChart values={[view.summary.streaks.minimum, view.summary.streaks.average, view.summary.streaks.maximum]} format={value => `${Number.isInteger(value) ? value : value.toFixed(1)}d`} labels={["Shortest", "Average", "Longest"]} /></article>
        <article className="split-card">
          <span>365-day activity</span>
          <div className="split-values"><strong>{view.summary.practiceDays}<small> practiced</small></strong><strong>{view.summary.daysOff}<small> off</small></strong></div>
          <div className="split-bar" role="img" aria-label={`${view.summary.practiceDays} practice days and ${view.summary.daysOff} days off, 365 days total`}>
            <i className="practiced" style={{ width: `${view.summary.practiceDays / 365 * 100}%` }} />
            <i className="off" style={{ width: `${view.summary.daysOff / 365 * 100}%` }} />
          </div>
          <div className="split-legend"><small><i className="practiced" />Practice days</small><small><i className="off" />Days off</small><small>365 total</small></div>
        </article>
      </section>
      <footer>{payload.checkedAt ? `Source checked ${new Date(payload.checkedAt).toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit" })}` : "Checking source…"}</footer>
    </main>
  );
}
