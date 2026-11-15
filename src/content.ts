// All copy on the site lives here. Edit this file to make the site yours.

export const profile = {
  name: "Aryan Tah",
  role: "Forward Deployed Engineer (Full Stack)",
  location: "Riverside, CA",
  email: "aryan@vennbee.com",
  links: {
    github: "https://github.com/aryan-tah",
    linkedin: "https://www.linkedin.com/in/aryan-tah-8b5916221/",
    x: "https://x.com/aryantah07",
    vennbee: "https://vennbee.com",
  },
};

export type Role = {
  org: string;
  title: string;
  href?: string;
  logo?: string;
  place: string;
  dates: string;
  points: string[];
  stack: string[];
};

export const experience: Role[] = [
  {
    org: "Vennbee",
    title: "Co-founder, Forward Deployed Engineer (Full Stack)",
    href: "https://vennbee.com",
    logo: "./vennbee.png",
    place: "Riverside, CA",
    dates: "Jan 2026 to now",
    points: [
      "A social app that ranks posts by how relevant they are to your groups, not by how viral they are. Two founders, seven TestFlight builds so far.",
      "I own the backend: search, feed, moderation and real-time chat.",
      "Built Forager, Vennbee's search: Google-style queries over a nested social graph. A model parses each query into a validated plan of facts, community scopes, vouches and exclusions; keyword, semantic and facts lanes are fused and reranked by graph proximity.",
      "Forager runs on its own Postgres kept current by logical replication, falls back to the primaries when it lags, and re-checks every result against permissions before it's shown.",
      "Moderation had to pass Apple's rules for user-generated content: a word filter, a 41.9K-domain link blocklist, AI scoring for text, images, video and audio, and strikes with appeals.",
      "The feed learns from likes, replies and reposts. Referral links and a leaderboard brought in 160+ sign-ups in a single day.",
    ],
    stack: ["NestJS", "PostgreSQL", "pgvector", "Redis", "BullMQ", "Socket.IO", "AWS"],
  },
  {
    org: "UCR Information Technology Solutions",
    title: "Student Information System intern",
    place: "Riverside, CA",
    dates: "Nov 2024 to now",
    points: [
      "C# (.NET), SQL and SSIS pipelines that migrate student records, plus automated Canvas account creation for students who fell through the gaps.",
      "Pre-launch testing on UC Wide, a University of California tool for 150,000+ incoming students.",
      "Closed 150+ Canvas incidents in ServiceNow by finding the root cause, not the symptom.",
    ],
    stack: ["C#", ".NET", "SQL", "SSIS", "Canvas API"],
  },
  {
    org: "HexHomes",
    title: "UI developer",
    place: "Riverside, CA",
    dates: "Feb 2024 to May 2024",
    points: [
      "Site for the Gateway Decathlon, an international design-build competition, with Three.js models of sustainable-housing data. Render work cut page latency by 40%.",
    ],
    stack: ["React", "Node.js", "Three.js"],
  },
];

export type Project = {
  name: string;
  line: string;
  detail: string;
  stack: string[];
  year: string;
  href?: string;
  note?: string;
};

export const projects: Project[] = [
  {
    name: "TwoBrains",
    line: "Delete a real fly brain, one neuron at a time.",
    detail:
      "The full FlyWire connectome (139,248 neurons, 2.7M synapses) runs as a spiking network in a browser tab. Delete neurons at random or by strategy and five real circuits get re-tested each time. The escape reflex survives 90% random deletion and still works on 316 neurons. Nothing is trained; the wiring decides.",
    stack: ["Python", "JavaScript"],
    year: "2026",
    href: "https://github.com/aryan-tah/twobrains",
  },
  {
    name: "Foresight",
    line: "Ask about the future in plain English.",
    detail:
      "Claude picks which public data measures the question and fetches it live. Google's TimesFM forecasts it locally. Every forecast is backtested on the spot against a naive baseline, and the score sits under the chart, so you know how far to trust it.",
    stack: ["Python", "FastAPI", "TimesFM", "Claude"],
    year: "2026",
    href: "https://github.com/aryan-tah/foresight",
  },
  {
    name: "Camus",
    line: "Kafka in one Rust binary, backed by R2. Contributor.",
    detail:
      "An open-source broker that speaks the Apache Kafka wire protocol and stores its log in Cloudflare R2, with no JVM or ZooKeeper. I added object-store call and byte counters so R2 request cost is measured instead of estimated, and per-shard WAL metrics so upload lag and a stopped shard can be alerted on (2 merged PRs). I also wrote RFCs for adding brokers without moving partitions by hand and for per-principal quotas, plus issues on a Helm chart, rolling upgrades and restore drills.",
    stack: ["Rust", "Kafka protocol", "Cloudflare R2", "Prometheus"],
    year: "2026",
    href: "https://github.com/nidheesh-m-vakharia/camus",
  },
  {
    name: "Primer",
    line: "Stop paying Claude to rediscover your codebase.",
    detail:
      "A Claude Code skill that maps a project once, with you reviewing each folder, then loads a ~300-token map every session instead of re-reading thousands of tokens of source. Git diffs keep the map current.",
    stack: ["Claude Code", "Markdown"],
    year: "2026",
    href: "https://github.com/aryan-tah/primer",
  },
  {
    name: "HowISay",
    line: "Drafts replies in your voice, not AI's.",
    detail:
      "A Chrome extension that builds a voice profile from a few real replies, including how your tone shifts between a friend, a manager and a stranger, then drafts on LinkedIn, X, GitHub and Gmail. Profiles are encrypted at rest; per-user cost caps live on the server.",
    stack: ["Svelte", "Hono", "Postgres"],
    year: "2026",
    href: "https://github.com/aryan-tah/howisay",
  },
  {
    name: "Ascentio",
    line: "Third place at Citrus Hack, then rebuilt properly.",
    detail:
      "Started as StudyBuddy, a weekend hackathon build where agents write, grade and rewrite LaTeX study guides with RAG memory on Redis and Canvas and Google Calendar sync. We rewrote it as Ascentio; I built the TypeScript inference layer and got request processing under 100ms.",
    stack: ["TypeScript", "Redis", "LLM APIs"],
    year: "2025",
    href: "https://devpost.com/software/studybuddy-znl1g0",
  },
  {
    name: "Unifolio",
    line: "Tailored LaTeX resumes from one job description.",
    detail:
      "Led a team of four and wrote about 95% of the code. It takes your existing experience and a specific job description and produces a properly formatted, tailored LaTeX resume.",
    stack: ["TypeScript", "LaTeX", "LLM APIs"],
    year: "2025",
    href: "https://unifolio-live.vercel.app/dashboard",
  },
  {
    name: "Discord MusicBot",
    line: "Open-source contributor in 10th grade. 3.2K stars.",
    detail:
      "Joined one of GitHub's most popular Discord music bots while teaching myself JavaScript. Contributed search, playback controls and YouTube and Spotify support, and moderated its 4,000-member community. 3.2K stars, 3K forks, 300K+ users.",
    stack: ["Node.js", "discord.js"],
    year: "2021",
    href: "https://github.com/SudhanPlayz/Discord-MusicBot",
  },
  {
    name: "School voting system",
    line: "Four days of paper counting, down to five minutes.",
    detail:
      "My 5,000-student high school had run elections on paper for 15 years. A friend and I replaced it, using only the ~30 lab computers we were allowed, with class-sized voting slots and anonymous ballots. 1,000+ students voted in one day, results for every position were ready in about five minutes, and the school kept using a similar system after we left.",
    stack: ["React", "Node.js", "Firebase"],
    year: "HS",
    href: "https://voting-system-cyan.vercel.app/",
  },
];

export const education = {
  school: "University of California, Riverside",
  degree: "B.S. Computer Science",
  dates: "2023 to 2027",
  focus: "Systems programming, machine learning, software architecture",
  honors: "Dean's Honors List · Achievement Scholarship · Payne Award · AWS Certified Cloud Practitioner",
  offClock: "2131 blitz on Chess.com, 99.7th percentile.",
};

export const stack = {
  languages: ["TypeScript", "Python", "C++", "C#", "SQL"],
  systems: ["Node.js", "NestJS", "PostgreSQL", "pgvector", "Redis", "BullMQ", "Docker", "AWS", "SvelteKit", "React", "Tauri"],
};
