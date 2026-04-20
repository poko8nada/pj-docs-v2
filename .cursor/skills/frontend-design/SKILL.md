---
name: frontend-design
description: Design and refine frontend interfaces at the depth the user needs — from layout cleanup to full visual redesign with atmosphere. Use this skill when the user asks to build, style, or improve web components, pages, or applications. Supports three levels of design intervention.
---

This skill guides frontend design work at three levels of depth — from quick structural cleanup to full visual redesign with atmosphere and animation. The level determines what you are allowed to change and how much discussion is needed before writing code.

---

## Step 0: Determine the Level

**If the user explicitly specifies a level** (e.g., "lv1", "lv2", "just clean up the spacing", "full redesign"), use that level and proceed.

**If the user does not specify**, ask before doing anything else:

> "What level of design work are you looking for?
>
> - **Lv1** — Fix layout and hierarchy only (spacing, sizing, alignment). No color or font changes.
> - **Lv2** — Full visual redesign: typography, color, layout. I'll ask a few quick questions first.
> - **Lv3** — Everything in Lv2, plus atmosphere, depth, and animation."

Do not write any code until the level is confirmed.

---

## Level 1 — Structure & Hierarchy

**Goal**: Make the existing content clear, readable, and organized.

**What you may change**:

- Spacing and padding between elements
- Font size relationships (relative scale only — no font family changes)
- Alignment and grouping (proximity, visual flow)
- Element sizing and proportion

**What you must NOT change**:

- Font families or font weight choices
- Color palette or theme
- Layout paradigm (e.g., don't switch from a list to a grid)
- Animations or visual effects

**How to think about it**:
Apply the four principles: contrast (size/weight), repetition (consistent patterns), alignment (invisible grid), and proximity (group related things). The goal is not to redesign — it is to reveal the structure that was already intended but not clearly expressed.

---

## Level 2 — Visual Language

**Goal**: Define what this interface _is_ — its personality, audience, and aesthetic point of view — then execute it in typography, color, and spatial composition.

### 2a. Ask First (Required)

Before writing any code, ask the user these questions. Do not skip this step, even if you think the context is clear.

> 1. What problem does this interface solve, and who uses it?
> 2. What's the emotional tone? (e.g., professional, playful, minimal, bold, calm, urgent)
> 3. Any constraints — framework, existing design system, colors to keep?

Wait for the user's response before proceeding.

### 2b. Design Thinking

After the discussion, commit to a clear aesthetic direction before touching code:

- **Tone**: Pick a specific extreme — brutally minimal, maximalist, retro-futuristic, organic, luxury, editorial, brutalist, art deco, soft, utilitarian, etc. Don't pick "modern and clean." Commit.
- **Typography**: Choose fonts that carry the tone. Avoid Inter, Roboto, Arial, Space Grotesk. Pair a distinctive display font with a refined body font. Font choice is the single fastest way to establish personality.
- **Color**: One dominant color, one or two sharp accents. Use CSS variables. Avoid timid, evenly-distributed palettes.
- **Spatial Composition**: Asymmetry, overlap, diagonal flow, generous negative space — or controlled density. Avoid predictable symmetric layouts.

**CRITICAL**: Intentionality over intensity. Refined minimalism and bold maximalism are both valid — what matters is that every choice is deliberate and serves the tone.

### 2c. Implement

Write production-grade code that is:

- Functional and complete
- Cohesive in its aesthetic point of view
- Precise in spacing and typographic detail (Lv1 principles apply here too)

---

## Level 3 — Atmosphere & Memory

**Goal**: Complete Lv2, then ask: _what is the one thing someone will remember about this interface?_ Build that into the surface.

### 3a. Complete Lv2 First

All of Lv2 applies — including the required discussion in step 2a. Do not skip it.

### 3b. Atmosphere Layer

After the visual language is established, add depth and atmosphere:

- **Backgrounds**: Avoid solid colors. Use gradient meshes, noise textures, geometric patterns, layered transparencies, grain overlays — matched to the aesthetic.
- **Depth**: Dramatic shadows, layered elements, parallax, z-axis hierarchy.
- **Details**: Decorative borders, custom cursors, subtle texture, carefully crafted empty space.

### 3c. Motion (Context-Specific)

Animation should feel inevitable for this particular interface — not generic. Ask: does motion _serve the tone_, or is it just decoration?

- **Load**: One well-orchestrated entrance with staggered reveals. More impactful than scattered micro-interactions.
- **Interaction**: Hover states, transitions, and focus states that surprise without distracting.
- **Scroll**: Trigger effects as content enters the viewport when it adds to the narrative.

Prefer CSS-only for HTML. Use the Motion library for React. Match animation complexity to the aesthetic — a brutalist design should move bluntly; a luxury design should move slowly.

### 3d. The Memorable Detail

Every Lv3 implementation should have one thing that couldn't exist in any other context — a detail that is specific to _this_ interface's purpose, audience, and tone. It doesn't have to be large. It has to be intentional.

---

## Always

- Never use purple gradients on white backgrounds.
- Never default to the same fonts across generations (Inter, Roboto, Space Grotesk).
- Never produce cookie-cutter layouts that could belong to any project.
- Vary between light and dark themes; vary aesthetic directions; vary structural approaches.
- Match implementation complexity to the aesthetic vision. Elegance in minimalism requires as much craft as maximalist excess.
