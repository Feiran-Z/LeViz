# Project Overview: LeViz

> **Audience:** AI agents and collaborators working on this project.
> **Purpose of this document:** Explain *what* we are building, *who* it is for, and *why*. It contains no technical or implementation details. For architecture and stack, see the separate technical brief.

---

## 1. The Problem

Teachers plan lessons every day, and much of that planning is spatial. A Harkness discussion needs chairs in a circle. A debate needs two sides facing each other. Station rotations need distinct pods with different prompts at each. A gallery walk needs work anchored to the walls. A mock trial needs a judge, a jury, and counsel in specific positions.

Most tools force teachers to choose between two disconnected worlds:

- **Seating chart apps** let you drag desks around, but they treat the layout as an isolated artifact. There is nowhere to attach the discussion questions, the station instructions, or the activity's purpose.
- **Lesson planning tools** let you write structured plans — objectives, openings, closures, exit tickets — but they have no spatial canvas at all.

So teachers end up with a seating chart in one app, a lesson plan document in another, and a roster spreadsheet in a third. The spatial thinking and the pedagogical thinking never live in the same place.

---

## 2. What We Are Building

A web-based **visual lesson planner - LeViz** that unifies both halves.

A lesson is an ordered sequence of **segments**. Some segments are pure text — an opening "Do Now," a debrief prompt, an exit ticket. Others are **spatial** — a classroom layout for a specific activity, where the teacher places furniture and stations on a canvas, attaches notes to each location, and assigns students.

The central idea is that **a classroom layout is not a standalone seating chart. It is a part of the lesson that carries meaning.** The discussion prompt for Station A lives on Station A. The debate motion lives on the podium. The roster is not a separate document — it is attached to the layout, and students can be dragged onto specific seats or grouped automatically.

Everything a teacher needs to plan and run one class period lives in a single, coherent document.

---

## 3. Who It Is For

**Classroom teachers** — primarily middle and high school — who plan activity-based lessons and think spatially about their rooms. They are comfortable with drag-and-drop tools but are not designers. They value speed and clarity over visual polish.

**Scope:** This is an internal tool for a **single school or department** — roughly 50 to 150 teachers. It is not a commercial, multi-school product. It is designed to be deployed and maintained by one technically inclined person (a teacher, a department head, or a school IT staffer), not by a dedicated engineering team.

This scope shapes every product decision. We favor simplicity, low operating cost, and ease of handoff over scale, extensibility, and enterprise features.

---

## 4. What a Teacher Can Do

### Build a lesson as a flow of segments

A teacher creates a lesson and adds segments in order: an opening activity, then a Harkness discussion, then a debrief, then an exit ticket. Each segment has an optional time estimate, and the lesson shows a running total against the class period length — so the teacher can see at a glance whether the plan fits.

### Design a classroom layout for an activity

Inside a layout segment, the teacher places furniture and stations on a canvas: desks, round tables, stations, podiums, wall anchors, chairs, and the teacher's own position. They can move, resize, and arrange these freely. The tool offers starting templates for common activities — Harkness, debate, mock trial, group discussion, gallery walk, station rotation, free-for-all — but templates are always editable, never locked.

### Attach notes to specific locations

Each station or seat can carry its own note — the discussion prompt for that station, the role for that position in a mock trial, the instruction for that gallery-walk stop. The activity as a whole can also carry general instructions. This is what distinguishes the tool from a seating chart: **the layout is annotated, not just arranged.**

### Maintain a roster and assign students

The teacher keeps a roster with names, optional tags (for example, "strong reader" or "needs front-row"), and optional pairings (students who should work together, or should not). Then they either:

- **Drag students onto specific seats or stations** one at a time, with the tool warning if a station is full or if a pairing constraint is broken, or
- **Generate groups automatically** — either a plain random shuffle, or a shuffle that tries to respect the teacher's constraints and reports any it could not satisfy.

Either way, the result is a layout that knows who is where.

### Plan the text-only parts of the lesson

Openings, direct instruction notes, debrief questions, and exit tickets are simple rich-text segments. They do not need a canvas. They sit in the same flow as the layout segments so the whole lesson reads as one plan.

### Design the engagement in each segment

Every segment — text or layout — carries the planner's **designed level of engagement** for three dimensions: cognitive, behavioral, and affective. Each dimension is set to low, medium, or high. This is a planning annotation, not an observation or a score.

For a layout segment, the segment-level design applies to the activity as a whole. Each station starts at that level and can be adjusted individually, so a station rotation can ask for more affective engagement at one stop without changing the rest. Adjusted stations are called out in the lesson overview and printout.

The overview also plots all three dimensions across the lesson's planned minutes as a step chart, so the planner can see the lesson's engagement profile at a glance. The chart follows the activity-level design; station adjustments remain listed beneath each layout segment.

### Save, reopen, and share lessons

Lessons persist and can be reopened and edited on any device the teacher logs into. Lessons can be exported to a file for backup or sharing with a colleague, and imported back in.

---

## 5. What Success Looks Like

A teacher opens the planner the evening before class, builds a fifty-minute lesson with an opening, two activities laid out spatially with station notes, and an exit ticket — and closes the laptop in under fifteen minutes, confident the plan is complete and the room will work.

The next morning, they pull it up on the classroom computer and run the lesson from it.

The measure of success is not so much about visual polish or feature count. It is **whether a teacher reaches for this tool instead of a word processor and a napkin sketch.**

---

## 6. What This Project Is Not

Clarity about non-goals matters as much as clarity about goals.

- **Not a real-time collaboration tool.** Two teachers will not edit the same lesson simultaneously. Sharing happens through export, or through each teacher keeping their own copy.
- **Not a full word processor.** Text segments support basic formatting — bold, italics, lists, links, headings — nothing more. This is a planning tool, not a document editor.
- **Not a lesson marketplace or social platform.** There is no public sharing, no discovery, no ratings. Lessons are private to their author unless explicitly exported.
- **Not a multi-school or commercial product.** One deployment serves one school. There is no tenant separation, no billing, no onboarding funnel.
- **Not mobile-first.** The primary device is a laptop or desktop. It should be usable on a tablet, but designing for a phone is out of scope.
- **Not an AI content generator.** The tool helps a teacher visualize and organize their own plan. It does not write lessons.
- **Not a native app.** It is a website.
- **Not a student-facing tool.** Students never log in. It is a planning instrument for the teacher.

---

## 7. Guiding Principles

1. **The layout carries meaning.** Every spatial decision should support annotation and assignment. Furniture placement alone is not the point.
2. **One document, one flow.** Roster, layout, and text belong together in a single lesson. Never force the teacher to switch between disconnected modes.
3. **Templates are starting points, never cages.** Every built-in layout is fully editable, and every activity type can be built from scratch.
4. **Fast beats polished.** A teacher planning at night has limited patience. Interactions should feel immediate and forgiving, with undo always available.
5. **Constraints are advisory, not blocking.** When the tool cannot satisfy a teacher's pairing rules, it should say so clearly and offer the best available arrangement — never refuse to proceed.
6. **Simple to run, simple to hand off.** This tool will be maintained by one person at a school. Deployment, backups, and upgrades must be simple enough that a non-specialist can manage them.
7. **Teacher data is private by default.** A teacher's lessons are visible only to that teacher unless they deliberately export and share them.

---

## 8. Activity Types in Scope

The tool should comfortably support, at minimum, these classroom activities:

| Activity | Spatial character |
|---|---|
| Harkness discussion | A single circle of chairs with the teacher outside |
| Debate | Two opposing clusters facing each other, with a speaking position |
| Mock trial | Judge, jury, and counsel in distinct positions |
| Group discussion | Several small table clusters |
| Gallery walk | Work anchored around the room's perimeter, students moving between |
| Station rotation | Several distinct stations, each with its own prompt and assigned group |
| Free-for-all games | Open floor, movable furniture, whole-class participation |

The tool should also allow a **custom** activity — a blank canvas the teacher arranges freely.

---

## 9. Open Product Questions

These are unresolved product decisions, not technical ones. They should be settled before building the relevant feature.

1. **Per-lesson roster or shared class roster?** Should a teacher re-enter student names for every lesson, or maintain one roster per class that many lessons draw from? The simpler answer is per-lesson; the more convenient answer is shared. Decide based on how teachers actually behave.
2. **How are teacher accounts created?** Should an administrator create accounts, or should teachers sign themselves up with an invite code? The former fits a small school; the latter lowers friction.
3. **Should department heads see others' lessons?** Strict privacy per teacher is the default. If department heads need read access for coaching or review, that is a deliberate product decision with privacy implications.
4. **How much visual fidelity do teachers need for their room?** Is a generic grid sufficient, or do teachers want to place their layout over a photo of their actual classroom? The second is more work and may not be worth it.

---

## 10. Where to Find Technical Details

This document is intentionally non-technical. For implementation decisions — the chosen frameworks, the data model, the deployment model, the phase plan — see the separate **technical brief** for this project. That document is the source of truth for *how*; this one is the source of truth for *what* and *why*.

If the two documents ever conflict on product intent, this document wins, and the technical brief should be updated.

---

*End of document.*