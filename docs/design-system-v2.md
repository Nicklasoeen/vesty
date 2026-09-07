# Vesty Design System v2

Source of truth: `apps/mobile/assets/rebrand/vesty-design-system-v2-source-of-truth.html`.

Logos: `vesty-logo-rb.svg` (wordmark) and `vesty-icon-rb.svg` (mark). Do not invent a placeholder V.

This pass establishes the token layer, shared primitives, and Home. Club, Invest, Activity, and Settings are not redesigned here.

Light mode is the approved direction. Dark mode remains a functional fallback; V2 dark visual polish comes later.

## Colors

| Token | Light | Role |
| --- | --- | --- |
| `accent` | `#12384A` | Vesty blue — brand, primary buttons, active nav |
| `accentDeep` | `#0B2D3D` | Deep blue |
| `mint` | `#22C59A` | Performance line and selected range |
| `mintSoft` | `#DFF7EF` | Positive / selected fills, Investment Day icon |
| `background` | `#F7F9F8` | Screen |
| `surface` | `#FFFFFF` | Cards |
| `textPrimary` | `#102B3A` | Ink |
| `textSecondary` | `#778995` | Muted |
| `border` | `#E4ECE9` | Hairlines |
| `positive` | `#17B67E` | Gain |
| `negative` | `#D95E63` | Loss |

Mint is not a second brand color. Do not use it for large chrome or as a default fill.

## Typography

Use semantic `AppText` roles. Do not one-off font sizes on Home.

| Role | Use |
| --- | --- |
| `display` | Primary portfolio value |
| `hero` | Greeting |
| `title` | Card title (club name) |
| `subtitle` | Section title (Your Clubs) |
| `value` | Gain / return line |
| `statValue` | Column figures |
| `label` | Card eyebrow (“Your portfolio”) — sentence case |
| `supporting` | Captions, member counts, helper copy |
| `statLabel` | Column captions, compact legend, range pills |
| `eyebrow` | Rare uppercase only — not ordinary Home labels |

Hierarchy should stay understated: display > value > statValue > label/supporting > statLabel.

## Spacing

`4 / 8 / 12 / 16 / 24 / 32 / 40` (`xs` → `xxxl`). Prefer compact hierarchy over huge padding.

## Radius

Existing `sm/md/lg` stay for older screens. Home cards use `xl` (22). Pills use `full`.

## Shadows

`shadows.card`: `0 2 / 10`, 6% `#0F2F40`. No glass, no stacked elevation, no neon glow.

## Avatars

- Real profile photo when available
- Initials fallback
- Never Bitmoji, never generic cartoon faces
- Stacks overlap; max 3 photos + `+N`

## Cards

White surface, 1px border, one subtle shadow, restrained radius. Not every section is a card.

## Home hierarchy

1. Header — photo left, rebrand wordmark (`vesty-logo-rb.svg`) center, bell right
2. Greeting — `Hei, {first name}` plus “Invest smarter, together.”
3. Personal portfolio
4. Pinned / default club
5. Next Investment Day
6. Your Clubs
7. Bottom navigation

Home answers “How are my investments doing?” Club answers “How is this group doing?”

## Pinned club

- One featured club on Home
- One club is auto-featured
- Several clubs: future Club-screen pin, until then selected/default club
- Opening another club from Your Clubs must not change the Home pin in-session
- No strategy / package label
- Stats are horizontal at the bottom: Group value · Your stake · All-time return
- Group value stays `—`; V1 authenticated APIs do not expose a club-wide monetary aggregate

## Your Clubs

Compact cards. Member photos are the identity. No globe/leaf emojis, stock covers, or category art. Pinned club is filtered out when possible. Subtle deterministic tints only.

## Chart

Mint value line, light mint fill, muted invested reference. Range control sits **below** the chart: 1M · 3M · 6M · 1Y · All.

## Bottom nav

Home · Club · **+** · Invest · Activity. `+` is an action, not a route. Light surface, Vesty-blue active state and center button. Do not rename to Explore / Portfolio / You.

## Anti-patterns

- Generic stock imagery for clubs
- Emoji club identities by default
- Bitmoji
- Gradient-heavy fintech UI
- Glassmorphism
- Every-section-is-a-card
- Huge padding
- Fake / demo financial data on curated Home
- Random color usage
- Presenting modelled quantity as actual holdings
