# 808Tix June 10 MVP Build Spec

## Goal

Build a mobile-first event pass and QR check-in system for one real-world comped event.

The MVP should answer:

> Can 808Tix replace guest lists, clipboards, and Eventbrite check-in lists with mobile passes and QR validation?

This is not yet a full ticketing marketplace.

## Core MVP Flow

1. Organizer creates an event.
2. Organizer issues mobile passes to guests.
3. Guests receive/open their pass on mobile.
4. Guest shows QR code at the door.
5. Door staff scans QR.
6. System marks pass as checked in.
7. Duplicate scans show “Already Used.”

## Tech Stack

* Expo
* React Native
* TypeScript
* Supabase
* Postgres
* Supabase Auth
* NativeWind if styling is added now

## Do Not Build Yet

* Payments
* Stripe
* Resale
* Transfers
* Blockchain
* Wallets
* NFTs
* Loyalty
* Seating maps
* Social features
* Multi-event discovery marketplace

## User Roles

### Organizer

Can:

* create events
* issue passes
* view event stats
* access scanner mode

### Scanner

Can:

* scan passes
* validate tickets
* check guests in

### Guest

Can:

* open pass link
* view event details
* show QR code

## Required Screens

### Organizer Dashboard

Shows:

* upcoming event
* total passes issued
* checked-in count
* quick actions

### Create Event

Fields:

* event name
* venue name
* event date
* start time
* event image optional
* description optional

### Issue Passes

Organizer can create passes manually:

* guest name
* guest email optional
* guest phone optional
* pass type

CSV upload can wait unless easy.

### Pass View

Guest sees:

* event name
* venue
* date/time
* guest name
* pass type
* large QR code

No login required for first MVP if pass URL has secure token.

### Scanner

Camera-first screen.

Scan results:

* VALID
* ALREADY USED
* INVALID
* WRONG EVENT

Scanner UI should be extremely simple and high contrast.

## Product Rules

* Mobile-first only.
* Keep flows simple.
* Use “pass” or “ticket” language.
* Do not use crypto language.
* Database is source of truth.
* Blockchain comes later.
* Preserve working functionality.
* Do not add extra features without explicit approval.

## Visual Direction

* Dark mode base.
* Purple/pink accents for guest/fan screens.
* Neon green accents for organizer/scanner screens.
* Minimal, premium, nightlife-friendly.
* Scanner should be brutally simple.

## MVP Success Criteria

The MVP is successful if:

* A real event can be created.
* Passes can be issued to guests.
* Guests can open mobile passes.
* Door staff can scan passes.
* Duplicate entry is prevented.
* Check-in counts update correctly.
