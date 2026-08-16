"use client";

import { useEffect, useMemo, useState } from "react";
import type { PracticeDay } from "./practice-data";

type Payload = { data: PracticeDay[]; totalHours: number; live: boolean; checkedAt: string | null };
const DAY = 86_400_000;

function iso(date: Date) { return date.toISOString().slice(0, 10); }
function localDate(value: string) { return new Date(`${value}T12:00:00`); }
function level(minutes: number) { return minutes === 0 ? 0 : minutes < 60 ? 1 : minutes < 120 ? 2 : minutes < 180 ? 3 : 4; }
function duration(minutes: number) { const h = Math.floor(minutes / 60); const m = minutes % 60; return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`; }

export default function ActivityDashboard({ initial }: { initial: PracticeDay[] }) {
  const [payload, setPayload] = useState<Payload>({ data: initial, totalHours: 568.57, live: false, checkedAt: null });
  const [selected, setSelected] = useState<PracticeDay | null>(null);

  useEffect(() => {
    const refresh = () => fetch("/api/practice", { cache: "no-store" }).then(r => r.json()).then(setPayload).catch(() => undefined);
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const view = useMemo(() => {
    const map = new Map(payload.data.map(day => [day.date, day.minutes]));
    const end = new Date(); end.setHours(12, 0, 0, 0);
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
    const visible = payload.data.filter(d => localDate(d.date) >= new Date(end.getTime() - 364 * DAY) && localDate(d.date) <= end);
    const total = visible.reduce((sum, day) => sum + day.minutes, 0);
    const practiced = visible.filter(day => day.minutes > 0);
    const best = practiced.reduce<PracticeDay | null>((top, day) => !top || day.minutes > top.minutes ? day : top, null);
    let streak = 0;
    const sorted = [...practiced].sort((a, b) => b.date.localeCompare(a.date));
    if (sorted.length) { let cursor = localDate(sorted[0].date); for (const day of sorted) { if (day.date === iso(cursor)) { streak++; cursor = new Date(cursor.getTime() - DAY); } else if (localDate(day.date) < cursor) break; } }
    return { cells, weeks, months, total, practiced: practiced.length, best, streak };
  }, [payload]);

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#activity" aria-label="Practice activity home"><span>PA</span> Practice Activity</a>
        <a className="sheet-link" href="https://docs.google.com/spreadsheets/d/1oR05zGWqdEKNy1smZL2tV0WTp2uSknmo9p5riec1y7g/edit" target="_blank" rel="noreferrer">Open source sheet ↗</a>
      </header>
      <section className="hero" id="activity">
        <div><p className="eyebrow">Rolling 365 days</p><h1>Activity</h1><p className="lede">A year of showing up, one practice at a time.</p></div>
        <div className={`sync ${payload.live ? "is-live" : ""}`}><i />{payload.live ? "Live · refreshes every minute" : "Snapshot · sheet access is restricted"}</div>
      </section>
      <section className="stats" aria-label="Practice summary">
        <article><span>Total practice</span><strong>{payload.totalHours.toFixed(2)}<small> hours</small></strong></article>
        <article><span>Practice days</span><strong>{view.practiced}<small> days</small></strong></article>
        <article><span>Latest streak</span><strong>{view.streak}<small> days</small></strong></article>
        <article><span>Longest day</span><strong>{view.best ? duration(view.best.minutes) : "—"}</strong><small>{view.best ? localDate(view.best.date).toLocaleDateString("en-US", { month:"short", day:"numeric" }) : ""}</small></article>
      </section>
      <section className="activity-card">
        <div className="card-head"><div><h2>Daily practice</h2><p>Color intensity represents total minutes practiced.</p></div><span>{payload.data[0]?.date.slice(0,4)}—{new Date().getFullYear()}</span></div>
        <div className="chart-scroll">
          <div className="chart" style={{ "--weeks": view.weeks } as React.CSSProperties}>
            <div className="month-labels">{view.months.map((month, i) => <span key={`${month.label}-${i}`} style={{ gridColumn: month.column }}>{month.label}</span>)}</div>
            <div className="day-labels"><span>Mon</span><span>Wed</span><span>Fri</span></div>
            <div className="heatmap">
              {view.cells.map(cell => {
                const label = `${localDate(cell.date).toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" })}: ${cell.minutes ? duration(cell.minutes) : "No practice"}`;
                return <button key={cell.date} className={`cell level-${level(cell.minutes)} ${cell.inRange ? "" : "outside"}`} aria-label={label} title={label} onClick={() => setSelected({ date: cell.date, minutes: cell.minutes })} />;
              })}
            </div>
          </div>
        </div>
        <div className="card-foot"><p>{selected ? <><b>{localDate(selected.date).toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" })}</b><span>{selected.minutes ? duration(selected.minutes) : "No practice recorded"}</span></> : <span>Select a day to see its total</span>}</p><div className="legend"><span>Less</span>{[0,1,2,3,4].map(n => <i key={n} className={`cell level-${n}`} />)}<span>More</span></div></div>
      </section>
      <footer>{payload.checkedAt ? `Source checked ${new Date(payload.checkedAt).toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit" })}` : "Checking source…"}</footer>
    </main>
  );
}
