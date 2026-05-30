# 808Tix Design System v2

## Purpose

This document defines the visual and UX rules for 808Tix.

The image:

`/docs/design/808Tix_UI_Source_of_Truth.png`

is the visual source of truth.

When implementing UI:

* Match the mockup.
* Do not invent alternate layouts.
* Do not substitute generic dashboard patterns.
* If uncertain, copy the mockup rather than improvising.

---

# Product Personality

808Tix is not:

* Eventbrite
* Ticketmaster
* Generic SaaS
* Crypto/Web3 software

808Tix should feel like:

* DICE
* Resident Advisor
* Apple Wallet
* Linear

combined with a nightlife and live-event aesthetic.

Keywords:

* Dark
* Premium
* Mobile-first
* Fast
* Operational
* Modern
* Minimal

---

# Design Principles

## Mobile First

Every screen should be designed for a phone first.

Desktop layouts may expand content but should not introduce entirely different experiences.

---

## Event Artwork Is First-Class

Event artwork is not decoration.

Event artwork should appear throughout the platform:

* Discovery
* Ticket Detail
* Transfer
* Ticket Receipt
* Organizer Event Detail
* Scanner

Artwork helps each event feel unique.

---

## Tickets Are Invitations

Tickets should not feel like PDFs.

Tickets should feel like invitations to an experience.

Ticket screens should prioritize:

1. Event artwork
2. Event name
3. Date / venue
4. QR code
5. Actions

---

## Operational Clarity

Organizer tools and scanner tools prioritize speed over decoration.

Door staff should be able to understand screen state instantly.

Examples:

* Green = valid
* Red = invalid
* Large counts
* Large buttons
* Minimal text

---

# Color System

## Background

Primary Background

#080808

Secondary Surface

#141414

Card Surface

#1A1A1A

Divider

#222222

---

## Fan Experience Colors

Primary Purple

#A25BFF

Primary Pink

#FF2D78

Used for:

* Discovery
* Ticket Screens
* Fan Experiences
* Event Branding

---

## Organizer / Operations Colors

Operations Green

#39FF14

Used for:

* Create
* Issue
* Check In
* Scanner
* Success States

---

## Error Colors

Error Red

#FF3B3B

Warning Amber

#FFB020

---

# Typography

Font Family

Inter

Weights:

* Bold
* Semibold
* Medium
* Regular

Avoid thin weights.

---

## Typography Hierarchy

Screen Titles

32–40px

Section Titles

20–24px

Body

14–16px

Supporting Labels

11–13px

Use fewer, larger elements instead of many small elements.

---

# Layout Rules

## Spacing

Base Unit

8px

Preferred spacing:

* 8
* 16
* 24
* 32

Avoid arbitrary spacing values.

---

## Radius

Cards

16px

Buttons

14px

Inputs

12px

---

# Buttons

## Primary

Filled

Operations Green

Large

High Contrast

---

## Secondary

Dark Surface

Light Border

---

## Destructive

Red

Used sparingly

---

# Discovery Screens

Use large event cards.

Each card should contain:

* Artwork
* Event Name
* Venue
* Date

Avoid list-heavy layouts.

---

# Ticket Screens

Prioritize:

1. Artwork
2. Event Information
3. QR Code

Actions should be secondary.

---

# Organizer Dashboard

Show:

* Events
* Passes Issued
* Checked In
* Check-In Rate

Prioritize quick operational awareness.

Avoid dense tables.

---

# Scanner

Scanner should feel like equipment.

Requirements:

* Full-screen camera
* Visible scan frame
* Event name
* Check-in count
* Immediate feedback

Avoid complex menus.

Avoid excessive text.

---

# Forbidden

Do not use:

* White backgrounds
* Green text on white backgrounds
* Generic admin dashboards
* Default browser styling
* Tiny typography
* Dense spreadsheets
* Multi-column mobile layouts
* Corporate SaaS aesthetics

---

# Implementation Rule

When implementing UI:

Reference:

`/docs/design/808Tix_UI_Source_of_Truth.png`

If a screen differs significantly from the mockup:

The mockup wins.
