// src/components/home/data.ts
export const categories = ["Programming", "Design", "Marketing", "Business"];

export const featured = [
  {
    id: 1,
    title: "Modern JavaScript Essentials",
    level: "Beginner • 12h",
    cover:
      "data:image/svg+xml;utf8," +
      encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='480'>
          <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
            <stop offset='0%' stop-color='#3b82f6'/><stop offset='100%' stop-color='#0ea5e9'/>
          </linearGradient></defs>
          <rect width='100%' height='100%' fill='url(#g)'/>
          <circle cx='140' cy='160' r='80' fill='rgba(255,255,255,.12)'/>
          <circle cx='360' cy='120' r='110' fill='rgba(255,255,255,.1)'/>
          <circle cx='560' cy='220' r='140' fill='rgba(255,255,255,.08)'/>
          <polygon points='380,240 420,270 380,300' fill='white'/>
        </svg>`
      ),
  },
  {
    id: 2,
    title: "UI/UX for Developers",
    level: "Intermediate • 9h",
    cover:
      "data:image/svg+xml;utf8," +
      encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='480'>
          <defs><linearGradient id='g2' x1='0' y1='1' x2='1' y2='0'>
            <stop offset='0%' stop-color='#0f172a'/><stop offset='100%' stop-color='#1f2937'/>
          </linearGradient></defs>
          <rect width='100%' height='100%' fill='url(#g2)'/>
          <circle cx='200' cy='280' r='120' fill='rgba(255,255,255,.10)'/>
          <circle cx='520' cy='180' r='160' fill='rgba(255,255,255,.07)'/>
          <polygon points='395,230 445,260 395,290' fill='white'/>
        </svg>`
      ),
  },
    {
    id: 3,
    title: "Backend APIs with Node",
    level: "Beginner • 8h",
    cover:
      "data:image/svg+xml;utf8," +
      encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='480'>
          <defs><linearGradient id='g3' x1='0' y1='0' x2='1' y2='0'>
            <stop offset='0%' stop-color='#22c55e'/><stop offset='100%' stop-color='#06b6d4'/>
          </linearGradient></defs>
          <rect width='100%' height='100%' fill='url(#g3)'/>
          <circle cx='160' cy='140' r='100' fill='rgba(255,255,255,.10)'/>
          <circle cx='520' cy='260' r='140' fill='rgba(255,255,255,.08)'/>
          <polygon points='360,220 410,250 360,280' fill='white'/>
        </svg>`
      ),
  },
];
