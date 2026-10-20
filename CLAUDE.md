# CLAUDE.md — PNW Employment Portal (retired)

**This repository is retired. Don't build here.**

The portal was the first employer-and-worker app for Proven National Workers (February to
October 2026). On 2026-10-13 it was rebuilt into **Hewn**, a full bookkeeping and payroll app:

- **Where the work goes now:** [PNWBNW/hewn](https://github.com/PNWBNW/hewn). Read its
  `CLAUDE.md`, `BUILD_PLAN.md` and `PROGRESS.md` before doing anything.
- **What survived:** the portal's libraries (hashing, wallet, adapters, tax engine, record
  scanners) moved into `hewn/packages/` by `archive/salvage/salvage.py`, then changed there.
  They are owned by Hewn now; nothing here is the source of truth any more.
- **What didn't:** the screens. Hewn has its own, built from what bookkeepers do, not from the
  portal's pages.
- **The Leo programs** were never here; they live in
  [PNWBNW/pnw_mvp_v2](https://github.com/PNWBNW/pnw_mvp_v2).

This checkout stays as history: how the first private payroll ran on testnet (2026-04-10), the
manifest and handshake designs, the generative credential art. The old session context is kept
unchanged at [`docs/archive/CLAUDE_2026-04.md`](docs/archive/CLAUDE_2026-04.md) for the record;
its instructions no longer apply.

If you're a person or an agent who landed here by mistake: close this and open Hewn.
