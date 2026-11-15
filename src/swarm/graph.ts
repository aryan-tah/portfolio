// The two architectures the swarm section morphs between.
//
// "messy" is a deliberately tangled v0 of a Vennbee-like backend: duplicated
// services, a dead replica, a polling fallback nobody turned off. Every messy
// node names the clean node it folds into (`into`). Nodes whose `into` is
// their own id survive the rebuild and move to their clean position.

export type Kind = "client" | "edge" | "svc" | "worker" | "data" | "ext";

export type NodeDef = {
  id: string;
  label: string;
  kind: Kind;
  into: string;
  /** Shown on hover while the graph is still tangled. */
  smell?: string;
  /** Marks a node that is actively hurting the system. */
  hot?: boolean;
};

export type CleanDef = {
  id: string;
  label: string;
  kind: Kind;
  layer: number;
  /** Position within the layer, 0..1. */
  slot: number;
  /** Shown on hover once the rebuild is done. */
  does: string;
};

export const cleanNodes: CleanDef[] = [
  { id: "ios", label: "ios app", kind: "client", layer: 0, slot: 0.36, does: "SwiftUI client. Seven TestFlight builds so far." },
  { id: "web", label: "web", kind: "client", layer: 0, slot: 0.66, does: "Waitlist, referral links and the leaderboard." },
  { id: "gateway", label: "api gateway", kind: "edge", layer: 1, slot: 0.5, does: "NestJS. Auth, rate limits and request validation in one place." },
  { id: "feed", label: "feed", kind: "svc", layer: 2, slot: 0.3, does: "Ranks posts by relevance to your groups. Learns from likes, replies and reposts." },
  { id: "search", label: "search", kind: "svc", layer: 2, slot: 0.1, does: "Hybrid: keyword matching blended with pgvector similarity in one query." },
  { id: "moderation", label: "moderation", kind: "svc", layer: 2, slot: 0.7, does: "Word filter, 41.9K-domain link blocklist, AI scoring for every media type, strikes and appeals." },
  { id: "chat", label: "chat", kind: "svc", layer: 2, slot: 0.5, does: "Socket.IO with Redis pub/sub so any instance can deliver any message." },
  { id: "notify", label: "notify", kind: "svc", layer: 2, slot: 0.9, does: "Push and email from one queue, deduplicated per user." },
  { id: "redis", label: "redis", kind: "data", layer: 3, slot: 0.17, does: "Cache, sessions and pub/sub. One cluster instead of three." },
  { id: "bullmq", label: "bullmq workers", kind: "worker", layer: 3, slot: 0.5, does: "Embeddings, media scoring and feed fan-out, with retries and backoff." },
  { id: "apns", label: "apns", kind: "ext", layer: 3, slot: 0.83, does: "Apple push notifications." },
  { id: "postgres", label: "postgres + pgvector", kind: "data", layer: 4, slot: 0.17, does: "Relational data and embeddings in the same database, so search can join on them." },
  { id: "s3", label: "s3", kind: "data", layer: 4, slot: 0.5, does: "Media, uploaded with presigned URLs." },
  { id: "llm", label: "llm api", kind: "ext", layer: 4, slot: 0.83, does: "Embeddings and moderation scoring." },
];

export const LAYERS = 5;

export const messyNodes: NodeDef[] = [
  { id: "ios", label: "ios-app", kind: "client", into: "ios" },
  { id: "web", label: "waitlist-site", kind: "client", into: "web" },
  { id: "admin", label: "admin-panel", kind: "client", into: "web", smell: "Separate deploy, separate auth, used twice a week." },
  { id: "lb-old", label: "lb-old", kind: "edge", into: "gateway", smell: "A load balancer in front of a single instance." },
  { id: "gateway", label: "api-gateway", kind: "edge", into: "gateway" },
  { id: "api-v0", label: "api-v0", kind: "edge", into: "gateway", hot: true, smell: "The original Express monolith. Half the routes still go through it." },
  { id: "auth", label: "auth-svc", kind: "svc", into: "gateway", smell: "Every request makes an extra network hop just to check a token." },
  { id: "auth-legacy", label: "auth-legacy", kind: "svc", into: "gateway", smell: "Still issues tokens. Nothing validates them." },
  { id: "feed", label: "feed-svc", kind: "svc", into: "feed" },
  { id: "feed-v1", label: "legacy-feed-v1", kind: "svc", into: "feed", hot: true, smell: "Chronological feed kept alive for one screen." },
  { id: "feed-cron", label: "feed-cron", kind: "worker", into: "feed", smell: "Rebuilds every feed every 10 minutes, active or not." },
  { id: "ranker", label: "ranker.py", kind: "worker", into: "feed", smell: "A script on a laptop-sized VM that nobody else can deploy." },
  { id: "search", label: "search-keyword", kind: "svc", into: "search" },
  { id: "search-sem", label: "search-semantic", kind: "svc", into: "search", smell: "Second search service. The client calls both and merges the results itself." },
  { id: "embed", label: "embed-worker", kind: "worker", into: "bullmq", smell: "Its own queue, its own retry logic, no backoff." },
  { id: "moderation", label: "mod-text", kind: "svc", into: "moderation" },
  { id: "mod-image", label: "mod-image", kind: "svc", into: "moderation", smell: "Copy of mod-text with the model name changed." },
  { id: "mod-video", label: "mod-video", kind: "svc", into: "moderation", hot: true, smell: "Downloads the whole video before scoring the first frame." },
  { id: "mod-audio", label: "mod-audio", kind: "svc", into: "moderation", smell: "Copy of mod-video." },
  { id: "words", label: "word-filter", kind: "svc", into: "moderation", smell: "A network call for a string match." },
  { id: "links", label: "link-check", kind: "svc", into: "moderation", smell: "Reloads the 41.9K-domain blocklist on every request." },
  { id: "strikes", label: "strikes-svc", kind: "svc", into: "moderation", smell: "Writes strikes the appeals service cannot read." },
  { id: "appeals", label: "appeals-svc", kind: "svc", into: "moderation", smell: "Reads its own copy of the strikes table." },
  { id: "chat", label: "chat-socket", kind: "svc", into: "chat" },
  { id: "chat-poll", label: "chat-poller", kind: "svc", into: "chat", hot: true, smell: "Polling fallback from before sockets worked. Still polls every 2s." },
  { id: "presence", label: "presence-svc", kind: "svc", into: "chat", smell: "Tracks who is online in its own memory, so it forgets on every deploy." },
  { id: "notify", label: "push-svc", kind: "svc", into: "notify" },
  { id: "email", label: "email-svc", kind: "svc", into: "notify", smell: "Sends the same alert a push already sent." },
  { id: "bullmq", label: "queue-a", kind: "worker", into: "bullmq" },
  { id: "cron", label: "cron-jobs", kind: "worker", into: "bullmq", smell: "Crontab on one box. If it reboots, nothing runs." },
  { id: "postgres", label: "postgres-main", kind: "data", into: "postgres" },
  { id: "replica", label: "pg-replica", kind: "data", into: "postgres", smell: "Replicates every write. Zero reads." },
  { id: "vectordb", label: "vector-db", kind: "data", into: "postgres", smell: "A second database just for embeddings, out of sync with the first." },
  { id: "redis", label: "redis-cache", kind: "data", into: "redis" },
  { id: "redis-2", label: "redis-cache-2", kind: "data", into: "redis", smell: "Same keys as redis-cache, different TTLs." },
  { id: "redis-sess", label: "redis-sessions", kind: "data", into: "redis", smell: "A whole cluster for a few thousand session keys." },
  { id: "s3", label: "s3-media", kind: "data", into: "s3" },
  { id: "llm", label: "llm-api", kind: "ext", into: "llm" },
  { id: "apns", label: "apns", kind: "ext", into: "apns" },
];

type Edge = [string, string];

export const messyEdges: Edge[] = [
  ["ios", "lb-old"], ["ios", "api-v0"], ["ios", "gateway"], ["ios", "search-sem"], ["ios", "chat-poll"],
  ["ios", "chat"], ["ios", "s3"], ["web", "api-v0"], ["web", "auth-legacy"], ["admin", "auth-legacy"],
  ["admin", "postgres"], ["admin", "strikes"], ["lb-old", "api-v0"], ["lb-old", "gateway"],
  ["gateway", "auth"], ["api-v0", "auth"], ["api-v0", "auth-legacy"], ["gateway", "feed"],
  ["api-v0", "feed-v1"], ["gateway", "search"], ["gateway", "moderation"], ["api-v0", "moderation"],
  ["gateway", "chat"], ["api-v0", "notify"], ["feed", "redis"], ["feed", "redis-2"], ["feed", "postgres"],
  ["feed", "ranker"], ["feed-cron", "feed"], ["feed-cron", "postgres"], ["feed-v1", "postgres"],
  ["feed-v1", "redis-2"], ["ranker", "replica"], ["search", "postgres"], ["search", "redis"],
  ["search-sem", "vectordb"], ["search-sem", "llm"], ["embed", "vectordb"], ["embed", "llm"],
  ["embed", "postgres"], ["moderation", "words"], ["moderation", "links"], ["moderation", "llm"],
  ["moderation", "mod-image"], ["mod-image", "llm"], ["mod-image", "s3"], ["mod-video", "s3"],
  ["mod-video", "llm"], ["mod-audio", "s3"], ["mod-audio", "llm"], ["moderation", "strikes"],
  ["strikes", "postgres"], ["appeals", "replica"], ["appeals", "strikes"], ["mod-video", "mod-audio"],
  ["chat", "redis-sess"], ["chat", "postgres"], ["chat", "presence"], ["chat-poll", "postgres"],
  ["presence", "redis"], ["chat", "notify"], ["chat-poll", "notify"], ["notify", "apns"],
  ["notify", "email"], ["email", "postgres"], ["cron", "feed-cron"], ["cron", "email"],
  ["cron", "embed"], ["bullmq", "mod-video"], ["bullmq", "mod-audio"], ["bullmq", "embed"],
  ["postgres", "replica"], ["auth", "redis-sess"], ["auth-legacy", "postgres"], ["auth", "postgres"],
  ["redis", "redis-2"], ["gateway", "api-v0"], ["feed", "search-sem"], ["search", "search-sem"],
];

export const cleanEdges: Edge[] = [
  ["ios", "gateway"], ["web", "gateway"],
  ["gateway", "feed"], ["gateway", "search"], ["gateway", "moderation"], ["gateway", "chat"], ["gateway", "notify"],
  ["feed", "redis"], ["feed", "postgres"], ["feed", "bullmq"],
  ["search", "postgres"], ["search", "redis"],
  ["moderation", "bullmq"],
  ["chat", "redis"], ["chat", "postgres"], ["chat", "bullmq"],
  ["notify", "apns"],
  ["bullmq", "postgres"], ["bullmq", "s3"], ["bullmq", "llm"],
];

/** Request paths that packets travel once the system is clean. */
export const cleanRoutes: string[][] = [
  ["ios", "gateway", "feed", "redis"],
  ["ios", "gateway", "feed", "postgres"],
  ["web", "gateway", "search", "postgres"],
  ["ios", "gateway", "search", "redis"],
  ["ios", "gateway", "moderation", "bullmq", "llm"],
  ["ios", "gateway", "moderation", "bullmq", "s3"],
  ["ios", "gateway", "chat", "redis"],
  ["web", "gateway", "notify", "apns"],
  ["ios", "gateway", "chat", "bullmq", "postgres"],
];

/** What each merge does, in plain words. Shown in the swarm log. */
export const mergeNotes: Record<string, string> = {
  admin: "admin tools move behind gateway auth",
  "lb-old": "one instance does not need a balancer",
  "api-v0": "last routes ported, monolith retired",
  auth: "token check runs in-process",
  "auth-legacy": "dead issuer removed",
  "feed-v1": "chronological mode is a ranking flag now",
  "feed-cron": "feeds build on read, cached",
  ranker: "ranking runs inside feed, deployable",
  "search-sem": "keyword + pgvector in one query",
  embed: "embeddings are a BullMQ job with backoff",
  "mod-image": "one scorer, media type is a parameter",
  "mod-video": "scores sampled frames, streams the rest",
  "mod-audio": "same pipeline as video",
  words: "string match runs in-process",
  links: "blocklist loaded once into a Set",
  strikes: "strikes and appeals share one table",
  appeals: "appeals read the primary",
  "chat-poll": "sockets cover it, poller removed",
  presence: "presence moves to redis",
  email: "one notify queue, deduped per user",
  cron: "schedules are repeatable BullMQ jobs",
  replica: "unused replica dropped",
  vectordb: "embeddings move into postgres",
  "redis-2": "duplicate cache folded in",
  "redis-sess": "sessions share the cluster",
};

// ---------------------------------------------------------------------------
// Graph stats. These are computed from the diagrams above, not typed in.

type Pt = { x: number; y: number };

function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o = (p: Pt, q: Pt, r: Pt) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

/** Counts pairs of edges that cross, ignoring pairs that share an endpoint. */
export function countCrossings(edges: Edge[], pos: (id: string) => Pt | undefined): number {
  let n = 0;
  for (let i = 0; i < edges.length; i++) {
    const [a, b] = edges[i];
    const pa = pos(a), pb = pos(b);
    if (!pa || !pb) continue;
    for (let j = i + 1; j < edges.length; j++) {
      const [c, d] = edges[j];
      if (a === c || a === d || b === c || b === d) continue;
      const pc = pos(c), pd = pos(d);
      if (pc && pd && segmentsCross(pa, pb, pc, pd)) n++;
    }
  }
  return n;
}

/** Mean shortest-path length (in hops) from every client to every data store it can reach. */
export function meanHops(edges: Edge[], clients: string[], stores: string[]): number {
  const adj = new Map<string, string[]>();
  for (const [a, b] of edges) {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a)!.push(b);
  }
  let total = 0, count = 0;
  for (const c of clients) {
    const dist = new Map<string, number>([[c, 0]]);
    const queue = [c];
    while (queue.length) {
      const u = queue.shift()!;
      for (const v of adj.get(u) ?? []) {
        if (!dist.has(v)) {
          dist.set(v, dist.get(u)! + 1);
          queue.push(v);
        }
      }
    }
    for (const s of stores) {
      const d = dist.get(s);
      if (d !== undefined) { total += d; count++; }
    }
  }
  return count ? total / count : 0;
}
