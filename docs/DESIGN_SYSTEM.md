# 808Tix Design System (June 10 MVP)

Lightweight UI rules for Cursor and contributors. **Mobile-first, dark, nightlife-operational** — not corporate SaaS, not crypto/web3.

Reference implementation tokens live in `src/constants/theme.ts`. Extend that file when adding new shared tokens; keep this doc in sync.

---

## Product visual identity

**What 808Tix should feel like**

- A **door-ready utility** for independent events: fast check-in, clear passes, zero clutter.
- **Nightlife / live experience** energy: dark base, confident accents, high legibility in low light.
- **Premium but minimal**: generous spacing, strong hierarchy, no decorative chrome.

**What it is not**

- Generic B2B dashboard (pale gray cards, blue primary buttons, dense tables).
- Web3 / NFT aesthetic (gradients, hex grids, wallet iconography, “mint” language).
- Desktop-first admin panels with sidebars and multi-column grids.

**Voice (UI copy)**

- Use: Pass, Ticket, Check-In, Verified, Event, Guest.
- Avoid: NFT, Mint, Wallet, Gas, Token, Blockchain.

---

## Color tokens

### Base (all surfaces)

Use **dark mode as default** for MVP screens.

| Token | Hex | Usage |
|-------|-----|--------|
| `background` | `#000000` | Screen background |
| `backgroundElement` | `#212225` | Cards, form panels, grouped sections |
| `backgroundSelected` | `#2E3135` | Pressed rows, subtle highlights |
| `text` | `#FFFFFF` | Primary copy |
| `textSecondary` | `#B0B4BA` | Labels, meta, hints |
| `border` | `#2A2A2A` | Card borders, dividers |
| `borderSubtle` | `#333333` | Inputs, light separators |
| `error` | `#FF6B6B` | Validation, failed scan |
| `inputBackground` | `#111111` | Text fields |

### Fan / pass (guest-facing)

Purple/pink accent family. **Used for primary actions across guest and organizer flows** in this MVP.

| Token | Hex | Usage |
|-------|-----|--------|
| `fanAccent` | `#C77DFF` | Primary actions, links, QR frame hints |
| `fanAccentBright` | `#FF6AD5` | Secondary accent, gradients (sparingly) |
| `fanAccentMuted` | `#9B5DE5` | Badges, subtle borders |

### Organizer / operations

Neon green accent family. **Used for selective organizer UI states** (e.g. success-adjacent cues, borders/pills) while primary CTAs in organizer flows use the purple/pink family (`fan.primary`).

| Token | Hex | Usage |
|-------|-----|--------|
| `organizerAccent` | `#39FF14` | Selective UI accents (status pills, success-adjacent cues, borders) |
| `organizerAccentTextOn` | `#000000` | Label text on filled green buttons |

Code constant today: `OrganizerAccent` in `theme.ts`.

### Scanner (door mode)

Same accent as organizer (`#39FF14`) for consistency at the door, but **layout and typography differ** — see Scanner results below. Background may go **true black** (`#000000`) full screen.

### Semantic scan results (scanner only)

High contrast, full-bleed states. Text **large**, **centered**, **minimal**.

| Result | Background | Text | Notes |
|--------|------------|------|--------|
| **VALID** | `#39FF14` | `#000000` | Single word or short phrase |
| **ALREADY USED** | `#FFB020` | `#000000` | Warning, not error |
| **INVALID** | `#FF3B3B` | `#FFFFFF` | |
| **WRONG EVENT** | `#FF3B3B` | `#FFFFFF` | |
| **VOIDED** | `#2E3135` | `#B0B4BA` | Muted |

---

## Fan vs organizer delineation

| Area | Accent | Typical screens |
|------|--------|-----------------|
| **Fan** | Purple / pink | Pass view, public pass link, guest-facing event snippet |
| **Organizer** | Purple / pink (primary) + neon green (selective) | Login (organizer), dashboard, create event, issue passes |
| **Scanner** | Neon green + result colors | Camera scan, full-screen result |

**Rules**

1. Primary organizer CTAs use purple/pink (`fan.primary`); neon green is for selective UI accents.
2. Never use organizer green as the primary accent on guest pass screens.
3. Scanner may use green for VALID only; use semantic table for other outcomes.
4. Shared neutrals (background, text, cards) are allowed on all surfaces.

---

## Typography

**Font stack:** System sans (React Native default / `Fonts.sans` in `theme.ts`). No custom font files for MVP.

| Role | Size | Weight | Use |
|------|------|--------|-----|
| **Screen title** | 28–32 | 600 | “808Tix”, event name on pass |
| **Section title** | 16 | 700, uppercase optional | “Upcoming Events”, ops sections |
| **Body** | 16 | 500 | Descriptions, form labels |
| **Body emphasis** | 16–18 | 600 | Guest name, event title on cards |
| **Meta** | 14 | 500 | Venue, date, email, counts |
| **Caption** | 12 | 600 | Status pills, scanner hints |
| **Scanner result** | 40–56 | 700 | VALID / ALREADY USED / etc. |

**Rules**

- Prefer **short headings**; one idea per line on mobile.
- **Sentence case** for buttons (“Create Event”, not “CREATE EVENT” except scanner results).
- Uppercase only for small section labels or scanner outcomes.
- Avoid long paragraphs on operational screens.

---

## Spacing

Use the `Spacing` scale from `theme.ts`:

| Token | px |
|-------|-----|
| `half` | 2 |
| `one` | 4 |
| `two` | 8 |
| `three` | 16 |
| `four` | 24 |
| `five` | 32 |
| `six` | 64 |

**Layout rhythm**

- Screen horizontal padding: **`Spacing.four` (24)**.
- Between major sections: **`Spacing.three`–`four` (16–24)**.
- Inside cards: **`Spacing.three` (16)**.
- Between label and input: **`Spacing.two` (8)**.
- Touch targets: **minimum 44pt** height for buttons and list rows.

**Max width**

- `MaxContentWidth` (800): center content on web; **still single-column** — do not add side-by-side columns at wider widths for MVP.

---

## Buttons

### Primary (filled)

| Context | Fill | Text |
|---------|------|------|
| Organizer | `organizerAccent` | `organizerAccentTextOn` |
| Fan | `fanAccent` | `#FFFFFF` |

- Border radius: **`Spacing.two` (8)**.
- Vertical padding: **`Spacing.three` (16)**.
- Font: 16, weight 700.
- Pressed: opacity **0.85**.
- Disabled: opacity **0.6**.

### Secondary (outline)

- Border: 1px accent color (green or fan purple).
- Background: transparent.
- Text: accent color.
- Same radius and min height as primary.

### Tertiary / text

- No border; accent-colored label (e.g. Sign out).
- Use for low-emphasis actions.

### Do not

- Gradient buttons (except rare fan pass hero — defer for MVP).
- Rounded-full pill buttons everywhere.
- Multiple primary buttons competing on one screen.

---

## Cards

**Default event / pass / list card**

- Background: `backgroundElement` or transparent with border.
- Border: 1px `border`; optional **3px left border** in role accent (organizer green on ops cards).
- Radius: **`Spacing.three` (16)**.
- Padding: **`Spacing.three`–`four`**.

**Empty / loading state card**

- Same border as default; centered content.
- Title 18 / 600; supporting text `textSecondary`.

**Pass card (fan)**

- Dark card; QR is the hero — largest element.
- Purple/pink accent on pass type or status chip only.

---

## Forms and inputs

- Background: `inputBackground` (`#111`).
- Border: 1px `borderSubtle`.
- Radius: **`Spacing.two` (8)**.
- Text: `#FFFFFF`; placeholder: `#666666`.
- Label: `smallBold` / 14 / 700, margin above field **`Spacing.one`–`two`**.
- Error text: `error`, below field.

**Rules**

- One column; full-width fields on mobile.
- No inline multi-field rows on phone widths.
- Show errors inline; avoid modal-only validation for MVP.

---

## Scanner result styles

Scanner is **not** a normal screen — it is a **status instrument**.

- Full viewport; no tabs, no chrome, no cards during result.
- Camera view: minimal overlay; large scan target if needed.
- On result: **full-screen color block** per semantic table above.
- Primary message: **one or two words** (VALID, ALREADY USED, INVALID, WRONG EVENT).
- Optional subline: guest name or event — **secondary size only**, high contrast.
- Auto-dismiss or single “Scan again” — defer animation polish for MVP.

---

## Mobile-first layout rules

1. **Single column** for all MVP flows.
2. **Safe areas** respected (`SafeAreaView`); account for home indicator on iOS.
3. **Scroll** for long content (`ScrollView`); do not shrink type to fit viewport.
4. **Thumb zone**: primary actions in lower half when possible (scanner excepted).
5. **Web**: same mobile layout centered at `MaxContentWidth` — not a expanded desktop grid.
6. **No** persistent side navigation, data tables with horizontal scroll, or split-pane layouts for MVP.

---

## What NOT to do visually

- Light mode as default for guest or organizer MVP screens.
- Blue `#007AFF`-style default iOS link color as brand primary.
- Illustrations, mascots, or stock “concert crowd” hero images on ops screens.
- Crypto wallets, chain badges, hexagon frames, or neon gradient meshes.
- Dense dashboard widgets, chart junk, or “analytics” cards before MVP needs them.
- Desktop multi-column forms, hover-only interactions, or tiny click targets.
- Competing accent colors on one screen (green + purple primary CTAs together).
- All-caps body copy; emoji in operational UI (optional on marketing later).
- Modals stacked on modals for core flows.

---

## Implementation checklist (for new screens)

- [ ] Identified audience: **fan**, **organizer**, or **scanner**.
- [ ] Used correct accent family (purple/pink vs green).
- [ ] Dark base + `ThemedView` / `ThemedText` where applicable.
- [ ] Spacing from `Spacing` scale; padding `four` on screen edges.
- [ ] One primary CTA per view.
- [ ] Loading and empty states styled as cards, not blank screens.
- [ ] Copy follows pass/ticket language, not crypto language.

---

## Related docs

- `docs/808Tix_MVP_Build_Spec.md` — product scope
- `.cursorrules` — engineering and UI summary
- `src/constants/theme.ts` — code tokens today


# Screen Hierarchy & Navigation

## Navigation Philosophy

Users should always know:

1. Where they are
2. What they can do next
3. How to get back

Navigation should feel obvious without training.

## Fan Navigation (Future)

Primary Tabs:

* Discover
* Wallet
* Profile

Rules:

* Maximum 4 primary tabs
* Wallet is the default destination after ticket purchase
* Fan flows should prioritize speed and simplicity
* Avoid deep menu structures

## Organizer Navigation

Primary Tabs:

* Dashboard
* Events
* Scanner

Rules:

* Maximum 4 primary tabs
* Dashboard is home
* Scanner should always be accessible within one tap
* Critical event operations should be reachable within three taps

## Navigation Rules

* Mobile-first only
* Prefer shallow navigation
* Avoid nested stacks deeper than 2 levels when possible
* Every screen must have a clear primary action
* Avoid modal-heavy workflows
* Prefer dedicated screens over stacked modal flows

---

# Design Principles

## Principle 1: Fast Beats Clever

Users are trying to run events.

Never sacrifice speed for novelty.

---

## Principle 2: Operational Clarity Beats Visual Flair

The UI should help users complete tasks.

Decoration is secondary.

---

## Principle 3: Every Screen Answers One Question

Users should immediately understand:

"What do I do next?"

If that answer is unclear, simplify the screen.

---

## Principle 4: Minimize Typing

Prefer:

* Scanning
* Tapping
* Selecting
* Sharing

Over manual data entry whenever possible.

---

## Principle 5: Thumb-First Design

Assume one-handed phone usage.

Primary actions should be easily reachable.

---

## Principle 6: Show Only What Matters

Do not overwhelm users with options.

Progressive disclosure is preferred.

---

## Principle 7: Trust Through Simplicity

Ticket buyers should never need to understand:

* Blockchain
* Wallets
* Crypto
* Smart contracts

The technology should be invisible.

---

## Principle 8: Build for the Door

Every feature should support one of three outcomes:

* Sell a ticket
* Deliver a ticket
* Validate a ticket

Everything else is secondary.
