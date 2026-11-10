# Phase 06: Kid-safe co-op for 1 to 4 players

**Goal:** friends can play together from a room code or link, see each other move and emote, share one notebook and one Milo, and solve puzzles together, on Cloudflare's free tier, with solo always working as the fallback.

Read `CLAUDE.md` and Game Bible section 8. Basic co-op is P0; puzzle roles are P1. This phase can run in a parallel session or worktree after Phase 02 is merged, coordinating with Phase 05 through the puzzle interface (`solo` and `coop` modes).

---

## 1. Architecture

- **Server:** the `Room` Durable Object (PartyServer, SQLite-backed, hibernation on). One room per code. The room is the authority for shared progress; each client is the authority for its own movement.
- **Client:** `partysocket` (auto-reconnect, buffering) in `src/net/`. Protocol types shared between client and worker in one TypeScript file.
- **Routing:** `/parties/room/<code>` for WebSockets; `/api/room` to create a room code.

## 2. Room state (persisted in the Durable Object's SQLite storage)

- Room code, created time, last active time
- Up to 4 players: session id, chosen character, connected flag
- Current world, delivered letters, puzzle states, Milo stage, notebook progress, stamps, notes left in Chapter 4
- Never store anything personal. Photos stay on each player's device.

## 3. Protocol (keep it small)

- `hello` (character request), `welcome` (snapshot of shared state plus players), `player_join`, `player_leave`
- `move` (position on sphere, facing, animation state) sent by clients at up to about 8 Hz **only while moving**, relayed to others; clients interpolate smoothly
- `emote` and `phrase` (ids only, from fixed lists)
- `interact` and `puzzle_event` (validated by the room, then broadcast as new state)
- `world_change` (everyone travels together through the Looking Lamp; late arrivals follow)
- Compact message shapes (short keys or arrays). Batch outgoing state changes per tick.

## 4. Lobby and joining

- **Play together** in the title menu: Create a room or Join with a code. Codes are three kid-safe words plus a number from a curated word list (no names, no slang, nothing that could form something rude when combined). Also a share link with `?room=`.
- Character select shows who took whom; Remi is always available to someone (the story stays Remi's whoever plays them).
- Join any time: in the workshop, or mid-chapter (spawn near the group with a soft light effect). The joiner receives the full snapshot.
- Reconnect after a drop restores the same character.
- Leave room returns to solo with progress kept locally.

## 5. Shared play

- One notebook and one Milo. Discoveries and upgrades belong to everyone, and every player's local save receives them.
- Puzzles from Phase 05 expose co-op roles: holders become players holding pieces steady, extra stations appear when more people are present, and every puzzle still works with any number of players.
- Music: tell the audio director how many friends are present so it adds or removes one instrument layer per friend.
- Presence touches: a gentle chime and toast when someone joins, character name tags only (no usernames), friends shown on the objective arrow as small colored dots with their silhouette icon.

## 6. Safety and privacy (non-negotiable)

- No free text, no voice, no usernames, no profiles, no avatars uploads. Only preset emotes and phrases by id.
- Rooms are private, never listed. Rooms expire after inactivity using a Durable Object alarm (for example 24 hours) and clear their storage.
- Maximum 4 players. Basic rate limiting per connection; drop malformed messages.
- No analytics, no logging of anything about players beyond what is needed to run the room.

## 7. Free-tier budget

- Static assets never touch the Worker, so they cost nothing.
- Keep WebSocket traffic lean: send movement only while moving, at up to about 8 Hz, and nothing when idle. Use hibernation so idle rooms cost no compute.
- If the Durable Object or Worker returns an error (for example a daily free limit), show a kind message ("Co-op is resting right now. You can keep playing solo.") and continue solo.
- Write a short note in DECISIONS.md estimating messages per room-hour and how far the free daily limits stretch.

## 8. Tests

- Playwright with two and then four browser contexts joining the same room against `npm run dev`: assert everyone sees each other, emotes arrive, a delivered letter and a Milo upgrade sync to all, a late joiner gets the full snapshot, and a disconnect and reconnect keep the character.
- Repeat a two-player smoke test against the live Cloudflare URL after deploy.
- Measure messages per second per player while walking and while idle.

## Definition of done

- [ ] Create and join by code or link; character select; late join; reconnect
- [ ] Movement, emotes and phrases feel smooth with interpolation
- [ ] Shared notebook, Milo, letters and puzzle states; local saves receive shared progress
- [ ] Co-op roles in puzzles (P1) and the music layer per friend
- [ ] Safety rules enforced; rooms expire
- [ ] Solo fallback works when the server is unavailable
- [ ] Tests green locally and in production
- [ ] Commit, deploy, update PROGRESS.md
