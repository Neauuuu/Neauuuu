// Génère assets/activity-light.svg et assets/activity-dark.svg
// à partir du calendrier de contributions GitHub (contributions privées comprises si l'option est activée).
import { mkdirSync, writeFileSync } from "node:fs";

const LOGIN = process.env.GH_LOGIN || "Neauuuu";
const WEEKS = 26;

async function fetchWeeks() {
  if (process.env.SAMPLE) {
    return Array.from({ length: WEEKS }, (_, i) => ({
      start: new Date(Date.now() - (WEEKS - i) * 7 * 864e5).toISOString().slice(0, 10),
      count: Math.max(0, Math.round(12 + 10 * Math.sin(i / 3) + (i % 5) * 3 - (i < 4 ? 15 : 0))),
    }));
  }
  const query = `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{weeks{contributionDays{date contributionCount}}}}}}`;
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${process.env.GITHUB_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { login: LOGIN } }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  const weeks = json.data.user.contributionsCollection.contributionCalendar.weeks;
  return weeks.slice(-WEEKS).map((w) => ({
    start: w.contributionDays[0].date,
    count: w.contributionDays.reduce((s, d) => s + d.contributionCount, 0),
  }));
}

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

const THEMES = {
  light: { text: "#1F2328", muted: "#6E7781", grid: "#D8DEE4", accent: "#7C5CFF", dot: "#FFFFFF" },
  dark: { text: "#E6EDF3", muted: "#8D96A0", grid: "#30363D", accent: "#A08BFF", dot: "#0D1117" },
};

function render(weeks, t) {
  const W = 840, H = 280, padL = 48, padR = 24, padT = 84, padB = 40;
  const iw = W - padL - padR, ih = H - padT - padB;
  const max = Math.max(4, ...weeks.map((w) => w.count));
  const niceMax = Math.ceil(max / 4) * 4;
  const x = (i) => padL + (i / (weeks.length - 1)) * iw;
  const y = (v) => padT + ih - (v / niceMax) * ih;
  const pts = weeks.map((w, i) => [x(i), y(w.count)]);

  // Courbe lissée (Catmull-Rom -> Bézier)
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${Math.min(c1[1], padT + ih).toFixed(1)} ${c2[0].toFixed(1)},${Math.min(c2[1], padT + ih).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  const area = `${d} L${x(weeks.length - 1).toFixed(1)},${padT + ih} L${padL},${padT + ih} Z`;

  const total = weeks.reduce((s, w) => s + w.count, 0);
  const best = weeks.reduce((a, b) => (b.count > a.count ? b : a));
  const avg = (total / weeks.length).toFixed(1).replace(".", ",");

  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const v = Math.round(niceMax * f), yy = y(v).toFixed(1);
    return `<line x1="${padL}" x2="${W - padR}" y1="${yy}" y2="${yy}" stroke="${t.grid}" stroke-dasharray="${f === 0 ? "0" : "3 5"}"/><text x="${padL - 10}" y="${+yy + 4}" text-anchor="end" class="m">${v}</text>`;
  }).join("");

  let lastMonth = -1, lastIdx = -9;
  const labels = weeks.map((w, i) => {
    const m = new Date(w.start + "T00:00:00Z").getUTCMonth();
    if (m === lastMonth) return "";
    lastMonth = m;
    if (i > weeks.length - 2 || i - lastIdx < 3) return "";
    lastIdx = i;
    return `<text x="${x(i).toFixed(1)}" y="${H - 14}" text-anchor="middle" class="m">${MONTHS[m]}</text>`;
  }).join("");

  const last = pts[pts.length - 1];
  const stat = (lx, label, value) =>
    `<text x="${lx}" y="34" class="m" font-size="12">${label}</text><text x="${lx}" y="58" fill="${t.text}" font-size="20" font-weight="600">${value}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Activité GitHub de ${LOGIN} sur ${WEEKS} semaines : ${total} contributions">
<style>text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}.m{fill:${t.muted};font-size:11px}
.line{stroke-dasharray:2400;stroke-dashoffset:2400;animation:draw 1.8s ease-out forwards}.fade{opacity:0;animation:fade .8s ease-out 1.2s forwards}
@keyframes draw{to{stroke-dashoffset:0}}@keyframes fade{to{opacity:1}}</style>
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.accent}" stop-opacity=".28"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></linearGradient></defs>
<text x="${padL}" y="34" fill="${t.text}" font-size="16" font-weight="600">Activité</text>
<text x="${padL}" y="56" class="m" font-size="12">${WEEKS} dernières semaines · contributions par semaine</text>
${stat(W - padR - 330, "Total", total)}${stat(W - padR - 210, "Moyenne / sem.", avg)}${stat(W - padR - 80, "Record", best.count)}
${grid}${labels}
<path d="${area}" fill="url(#g)" class="fade"/>
<path d="${d}" fill="none" stroke="${t.accent}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="line"/>
<circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="4.5" fill="${t.dot}" stroke="${t.accent}" stroke-width="2.5" class="fade"/>
</svg>`;
}

const weeks = await fetchWeeks();
mkdirSync("assets", { recursive: true });
for (const [name, theme] of Object.entries(THEMES)) {
  writeFileSync(`assets/activity-${name}.svg`, render(weeks, theme));
}
console.log(`OK: ${weeks.length} semaines, ${weeks.reduce((s, w) => s + w.count, 0)} contributions`);
