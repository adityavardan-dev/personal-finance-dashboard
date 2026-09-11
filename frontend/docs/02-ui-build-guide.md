# UI Build Guide

Every component generated must follow the Design System.

Read

docs/01-design-system.md

before generating code.

---

# Tech Stack

Angular 21

Standalone Components

Tailwind CSS

Signals

Latest Angular Control Flow

@for

@if

@switch

No Bootstrap

No Angular Material

No PrimeNG

---

# Styling Rules

Tailwind CSS is the primary styling system.

Use utility classes before writing CSS.

Component CSS should only be used for

Animations

Complex gradients

Unsupported Tailwind behaviour

Never duplicate styles across components.

Avoid component CSS.

Create CSS only if Tailwind cannot achieve the desired result.

---

# Components

Every component must have one responsibility.

Good

HeroCard

Header

Sidebar

BottomNavigation

RecentActivity

TrendChart

Avoid giant components.

---

# Layout

Every screen must render inside AppLayout.

AppLayout owns

Header

Sidebar

Bottom Navigation

Page Content

Dashboard components should never render their own navigation.

---

# Navigation

Mobile

Bottom Navigation

Tablet

Collapsed Sidebar

Desktop

Expanded Sidebar

---
# Responsive Development Order

Every screen must be designed and verified in the following order.

1. Small Mobile
320px

2. Standard Mobile
375px

3. Large Mobile
430px

4. Tablet
768px

5. Desktop
1024px

6. Large Desktop
1440px

A component must be visually complete at one breakpoint before progressing to the next.

Layouts should expand naturally rather than being redesigned between breakpoints.
---

# Responsive Development Workflow
Design and validate every component in the following order.

1. Small Mobile (320px)
2. Standard Mobile (375px)
3. Large Mobile (430px)
4. Tablet (768px)
5. Desktop (1024px)
6. Large Desktop (1440px)

The UI should progressively enhance between breakpoints.

Avoid creating separate layouts unless explicitly defined in the Design System.

The application should feel like one continuous responsive experience.
---

# Code Quality

Reusable

Readable

Accessible

Maintainable

No duplicated markup

No unnecessary wrappers

---

# Dummy Data

Until backend integration

Until backend integration

Use realistic financial data.

Monthly Budget

₹30,000

Spent

₹18,540

Transactions

Coffee

Fuel

Lunch

Shopping

Utilities

This helps maintain realistic UI proportions.

Do not create fake APIs.

---

# Future Integrations

Backend

Authentication

Highcharts

AI

Notifications

CSV Export

OCR

Recurring Expenses

These should plug into existing components without redesigning the UI.

---

# Design Consistency

Never redesign existing components.

Improve them.

Extend them.

Maintain spacing.

Maintain colour system.

Maintain typography.

Maintain component hierarchy.

---

# AI generation rules

Before generating code

Explain the design approach.

↓

List modified files.

↓

Generate code.

↓

Explain why the changes follow the Design System.