# Smart Reply for phpBB

`mundophpbb/smartreply` is a lightweight extension that enhances phpBB's built-in quick reply with:

- contextual reply buttons on each post
- progressive composer expansion
- local draft autosave and restore
- optional lightweight “Replying to …” note
- configurable quick templates / canned replies
- forum-specific quick templates
- quick quote buttons with selected-text support
- lightweight formatting toolbar
- inline preview for common BBCode
- icon-based formatting toolbar
- color BBCode insertion from the quick reply toolbar
- lightweight @mention buttons and toolbar action
- keyboard shortcuts inside the composer
- refined focus and keyboard navigation for contextual actions
- minimal ACP settings

## Requirements

- phpBB 3.3+
- PHP 7.4+
- phpBB quick reply must be enabled globally and in the target forum

## Installation

1. Copy the extension to `ext/mundophpbb/smartreply`
2. In the ACP, go to **Customise > Extensions**
3. Enable **Smart Reply**
4. Optionally configure the extension in **Extensions > Smart Reply**

## Quick templates

Global quick templates are configured in the ACP, one per line, using:

`Label|Message`

Example:

`Need more details|Could you provide more details, {username}?{newline}{newline}Thank you.`

Supported placeholders:

- `{username}`
- `{subject}`
- `{newline}`

## Forum quick templates

You can also define forum-specific quick templates in the ACP, one per line, using:

`forum_id|Label|Message`

You may assign the same quick template to multiple forums:

`2,5|Solved|Glad to hear it worked.`

Forum-specific quick templates are shown before the global templates for that forum.

## Inline preview

The inline preview is intentionally lightweight and client-side. It is meant to give the user a fast rendering of common BBCode while staying inside the quick reply flow. The final post rendering still depends on phpBB itself.

Supported preview elements in this version include:

- `[b]`, `[i]`, `[u]`
- `[quote]`
- `[code]`
- `[url]` and `[url=...]`
- `[list]`
- `[color=...]`
- `[img]` rendered as a safe link placeholder

## Keyboard shortcuts

Supported shortcuts in this version:

- `Ctrl/Cmd+B`
- `Ctrl/Cmd+I`
- `Ctrl/Cmd+U`
- `Ctrl/Cmd+K`
- `Ctrl/Cmd+Shift+Q`
- `Ctrl/Cmd+Shift+M`
- `Ctrl/Cmd+Shift+P`
- `Ctrl/Cmd+Enter`
- `Esc`

## Notes

- Smart Reply uses phpBB's native quick reply as its posting foundation.
- The extension is designed as progressive enhancement: if JavaScript is unavailable, phpBB quick reply keeps working normally.
- If phpBB quick reply is disabled for a forum, Smart Reply stays inactive in that forum.

## Quick quote

Each post can expose a quick quote button. When the user selects text inside a post and clicks the button, Smart Reply inserts a lightweight quote into the composer. If no text is selected, it falls back to the contextual snippet for that post.

## What is new in 1.6.0

- Forum-specific quick templates in the ACP
- Forum-specific templates are shown before global templates
- New upgrade migration for existing installations
- Translation review for the new ACP fields


## New in 1.7.0

- Optional compact toolbar mode in the ACP
- Primary formatting buttons stay visible
- Secondary tools can be expanded or collapsed with a toggle button

## New in 1.8.0

- Lightweight @mention button on each post
- Mention action added to the Smart Reply toolbar
- New keyboard shortcut for mentions (`Ctrl/Cmd+Shift+M`)
- Translation review for the new labels

## New in 1.9.0

- Compact icon-based post actions to reduce button overflow into the `...` menu
- Reply, quick quote and mention actions use smaller icon buttons with accessible labels
- Typing `@` in the composer opens a participant picker based on users already active in the topic
- Arrow keys, `Enter` and `Tab` can be used to select a participant mention


## New in 1.10.0

- More faithful inline preview for nested quotes and lists
- Added preview support for `[s]`, `[color=...]` and `[size=...]`
- Lightweight `@username` highlighting in the inline preview
- Improved quote rendering recursion without affecting the final phpBB post rendering

## New in 1.11.0

- Icon-based formatting toolbar for a more familiar quick-reply feel
- New Color action in the toolbar
- Color BBCode prompt for `[color=...]...[/color]` insertion


## New in 1.13.0

- Topic participant mention picker now shows only the participant name, without avatar
- Participant names in the mention picker use the group color when available
- Kept the compact mention UI aligned with the phpBB-like Smart Reply toolbar


## UX note

The context action now only cancels the reply target for a specific post, while a separate **Clear message** action erases the composer content.


## Latest refinements

- Context label now shows the referenced post number, for example: `Replying to post #5 by Username`.
- The custom color action now opens a native color picker instead of a text prompt.
- Reply, quick quote and mention now use a more polished visual style with clearer per-action identity.

## Stable baseline

Version `1.17.7` is the documented stable quick-reply baseline, keeping the reverted post-button look while adding release-oriented documentation for testing, upgrading and handoff.

## Mini manual

A compact Portuguese manual is available in `MANUAL_pt_br.md`. It covers:

- difference between **Responder**, **Citação rápida** and **Mencionar**
- contextual line, origin post highlight and jump-back behavior
- draft recovery and autosave behavior
- ACP settings that affect the quick reply flow

## New in 1.14.9

- Draft autosave now preserves reply mode, user colour, and cursor position
- Draft restore is more complete after accidental reloads
- Saved draft prompt shows the previous reply context
- Extra save hooks on page hide/unload improve recovery reliability


## Release handoff files

This package now includes extra release-oriented documentation:

- `CHANGELOG.md`
- `UPGRADE_pt_br.md`
- `TESTE_RAPIDO_pt_br.md`

These files are intended to make installation review, update rollout and regression testing easier before freezing the quick reply as a stable baseline.
