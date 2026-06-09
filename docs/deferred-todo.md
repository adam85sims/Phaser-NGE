# Phaser NGE — Deferred Nice-to-Haves

Features identified during the VN UX review but deferred to focus on core improvements first.

## Node Types
- **Timed choice** — choice node that auto-selects after a timer (add tension)
- **Jump / Call Scene node** — jump to another scene mid-graph (not just from end nodes)
- **Random node** — pick a random branch from weighted options
- **Text input node** — player types name, answers puzzles

## Audio
- **Music fade in/out** — smooth audio transitions instead of instant stop/start
- **Voice acting** — `.ogg` clips attached to dialogue nodes

## Content & Extras
- **Gallery / unlockables system** — CG gallery, scene select, extras for completed games
- **Dialogue branching statistics** — track which choices players made

## Editor UX
- **Node comments** — add notes to nodes for writer reference
- **Scene tags / labels** — filter nodes by tag (e.g. "chapter1", "romance_route")
- **Scene preview** — "play this scene" button inside the editor

## Variable System
- **Variable increment in choices** — add `"addFlag"` / `"delta"` on choice options (currently only `setFlag`/`setValue`)
- **Subroutine / macro nodes** — reusable node groups (standard "enter room" sequence)

## System Architecture
- **Multi-project support** — expand the editor and engine to support saving and loading multiple independent projects into `data/projects/<name>/` instead of a single root `data/` folder.
