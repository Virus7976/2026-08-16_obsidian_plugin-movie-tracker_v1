/**
 * What changed, in the user's words rather than the commit's.
 *
 * Reel updates through BRAT, which replaces `main.js` and says nothing. Every
 * release in this file was reported by the person using it — a covered search
 * box, a doubled star, a review with nowhere to go — and each fix arrived
 * silently, so the only way to know whether the thing you reported was done was
 * to go and look for it.
 *
 * Two rules for what goes in here:
 *
 *   It is written for the person who noticed, not for the person who fixed it.
 *   "The magnifier no longer prints over what you type" is checkable in three
 *   seconds. "Unpinned .reel-search-icon from absolute positioning" is not.
 *
 *   Nothing goes in that cannot be seen. A release that only changed the test
 *   rig gets no entry, because an entry that cannot be verified teaches you to
 *   stop reading them.
 *
 * The newest version here must match `manifest.json`; `scripts/preflight.mjs`
 * refuses to publish otherwise. A release with no notes is how a changelog
 * quietly stops being true.
 */

/**
 * Why an item is worth reading.
 *
 * Not a severity. "Fixed" is not lesser than "New" — on this plugin most of
 * what has mattered has been a fix — it is a different question the reader is
 * asking: is this something I can now do, something that got better, or
 * something that had been wrong?
 */
export type ChangeKind = "new" | "better" | "fixed";

export interface Change {
	kind: ChangeKind;
	/** One line, present tense, describing the screen and not the code. */
	text: string;
	/** Optional second line: what it was doing before, if that is the point. */
	note?: string;
}

export interface Release {
	version: string;
	/** ISO date, so it can be formatted in the reader's own locale. */
	date: string;
	/** One sentence. Shown large, and used as the update notice. */
	headline: string;
	changes: Change[];
}

/** Newest first. The order here is the order on screen. */
export const RELEASES: Release[] = [
	{
		version: "0.9.45",
		date: "2026-09-05",
		headline: "Searching an actor or director finds them.",
		changes: [
			{
				kind: "fixed",
				text: "Typing a person's name into Discover now shows the person. Tap them for everything they have been in.",
				note: "TMDB answers a search with people as well as titles, and Discover threw every person away before drawing anything — so a name could only ever match a film *called* that, and “Jake Gyllenhaal” returned an empty screen for a question that had been answered correctly. The odd part is that the machinery behind it was already built and connected to nothing: the filmography sheet, the person lookup, and a search-by-cast query were all sitting there unused.",
			},
			{
				kind: "fixed",
				text: "A person's full name is shown under their photo instead of being cut after the first word.",
				note: "The row reuses the cast strip from a title's page, where a cell is 76px and a name is clipped to one line — fine beside a photograph in a list of a film's cast, useless in a search result, where clipping “Jake Gyllenhaal” to “Jake…” returns the one word you had already typed.",
			},
		],
	},
	{
		version: "0.9.44",
		date: "2026-09-05",
		headline: "Stats packs, instead of leaving holes.",
		changes: [
			{
				kind: "better",
				text: "On a desktop the charts on Stats sit directly under one another instead of leaving gaps where a short chart shares a row with a tall one.",
				note: "They were laid out as a grid, and a grid row is as tall as the tallest thing in it. Measured across eleven charts: 303, 142, 375, 492, 303, 508, 303, 702, 403, 259, 220. The 142 sat in a row 375 tall and left 233px of nothing beneath it, three times over. Most of what looked wrong on this screen was not the charts, it was the space between them.",
			},
			{
				kind: "fixed",
				text: "Highest rated, lowest rated and longest sit in one row.",
				note: "The row was two fixed columns and there are three highlights, so the third dropped underneath and left an empty half-row beside it. The row now divides by however many there are.",
			},
		],
	},
	{
		version: "0.9.43",
		date: "2026-09-05",
		headline: "Discover lines up with the rest of the tabs.",
		changes: [
			{
				kind: "fixed",
				text: "On a desktop, moving between Library and Discover no longer shifts the whole page sideways.",
				note: "Discover's page is centred where every other screen's is left-aligned, so its content sat at 95–1171 against 24–1100 everywhere else — 71px across and 71px wider, on one tab out of six. It is the most visible sort of misalignment because it happens while you are looking at it. Both now measure 24–1100.",
			},
		],
	},
	{
		version: "0.9.42",
		date: "2026-09-05",
		headline: "On a desktop everything on the page starts and ends in the same place.",
		changes: [
			{
				kind: "fixed",
				text: "The posters reach the same right-hand edge as the search box and the filter row above them.",
				note: "A column was capped at 170px, so on a 1280px window the grid's own box ran to 1100 and the posters stopped at 930 — 170px of empty track sitting under a search field that ran the full width. The columns now divide the room instead of ignoring it: six of them, about 168px each, which is within two pixels of the width they already were.",
			},
			{
				kind: "fixed",
				text: "The tab strip starts at the left edge, in line with everything else, instead of floating in the middle of the window.",
				note: "It was capped at 760px with automatic side margins, which centres it — so the tabs sat at 260–1020 while the search field, the filters, the count line and the grid all ran 24–1100. One row out of five, 236px inboard of the other four. The tabs are now their own width at the start of the row, with the strip's rule running behind them.",
			},
		],
	},
	{
		version: "0.9.41",
		date: "2026-09-05",
		headline: "Every control on a desktop is now one size, and a check that says so.",
		changes: [
			{
				kind: "better",
				text: "On a desktop the text fields, the buttons, the facet tabs, the like button, the carousel arrows, the whole settings tab and every sheet are at the same size as the rest of the interface.",
				note: "Each of these was sized for a fingertip by a rule with no condition on it, so the desktop got thumb sizing by default. Measured across all twenty-four screens, 44px controls were still sitting on twelve of them after the chips and tabs had been done by hand. Several were stranger than that: the episode tick is written as 26×26, the link as 32 and the recipe step as 36, and all three were pushed back up to 44 further down the file — the desktop size was already there, nothing was letting it through.",
			},
			{
				kind: "fixed",
				text: "The search box on Library and in Settings is the same height as the controls beside it.",
				note: "It was reported as fixed a release ago and was not. Its wrapper had been given a 30px minimum and duly measured 30 — but the field inside it declares a 44px minimum, and a child's minimum is not something a parent's minimum can overrule. The wrapper had been 44 the whole time.",
			},
			{
				kind: "new",
				text: "The release checks now fail if a control on a desktop is too big, not only if it is too small.",
				note: "The size check only ever asked one of the two questions, so a desktop screen could be entirely at phone scale and still pass. That is how all of the above stayed invisible for as long as it did. It caught fifteen more the moment it existed, on the sheets — and one it could not see at all: a step number that had gone from a 44px circle to a 44×30 oval, because a height check has nothing to say about width.",
			},
		],
	},
	{
		version: "0.9.40",
		date: "2026-09-05",
		headline: "The last of the phone-sized controls come down to desktop size.",
		changes: [
			{
				kind: "better",
				text: "On a desktop the tick and the ⋯ on a list row are the same size as every other control, and their marks sit in the middle of them.",
				note: "They were 44×44 — squares sized for a fingertip — and they are the only controls on Up next, so that screen was still entirely at thumb scale after the rest of the desktop had come down to 30. Taking them in showed something the larger box had been hiding: the mark inside was never centred, sitting 1px from the left edge and 14.6px from the right. Both are fixed. The phone keeps its 44px.",
			},
			{
				kind: "fixed",
				text: "The row of years on Stats sits against the top edge while you scroll, instead of floating a few pixels below it.",
				note: "The same 8px offset that had been fixed on a title's page and in the diary — a pinned element measures from the scroll area's padding edge — and this was the third place it showed up. Measured while scrolling: the gap is now 0.",
			},
		],
	},
	{
		version: "0.9.39",
		date: "2026-09-05",
		headline: "Stats are on the page on a desktop, and pinned headers stay pinned.",
		changes: [
			{
				kind: "better",
				text: "On a desktop the charts on Stats start open, so your numbers are on the page instead of behind eleven chevrons.",
				note: "Collapsing spends taps to buy back screen, which is the right trade on a phone and the wrong one where the room already exists: the page became eleven grey boxes holding one number each, nothing could be compared against anything else, and reading your own statistics cost eleven clicks. They still collapse — only the starting state changed. The phone is untouched.",
			},
			{
				kind: "fixed",
				text: "A pinned header — the bar on a title's page, the month divider in the diary — sits against the top edge instead of hovering a few pixels below it with content sliding through the gap.",
				note: "A sticky element measures its offset from the scroll area's padding edge, and that padding is 8px. So every pinned header settled 8px down and the page kept scrolling through the band it left behind. Probed while scrolling: an 8px gap with the backdrop artwork painted inside it.",
			},
			{
				kind: "fixed",
				text: "The summary line above an open chart no longer sits there as invisible text.",
				note: "It was hidden by being made transparent rather than removed, so it stayed on the page at the exact colour of its own background. Nothing showed this until the charts began opening by default and the contrast check finally had an open one to look at.",
			},
		],
	},
	{
		version: "0.9.38",
		date: "2026-09-05",
		headline: "On a desktop, Reel is built like a tool.",
		changes: [
			{
				kind: "fixed",
				text: "The filter chips are pills again on a desktop, at one height, with space around their labels.",
				note: "The rule that restores a chip's shape after the host theme's button styling is stripped off it was written for the phone and only ever reached the phone. On a desktop pane every chip drew as a square, unpadded box: radii of 0 throughout with a single 999px dropdown sitting among them, and two heights in the same row — 44px and 30px.",
			},
			{
				kind: "fixed",
				text: "The open tab is marked with one line under one word, instead of a rounded outline around it.",
				note: "Nobody chose that outline. The reset that strips the theme's buttons leaves a border in the current colour, and another rule gives tabs a pill radius, so the open tab — whose colour is the accent — drew a rounded accent border on three sides.",
			},
			{
				kind: "fixed",
				text: "Everything on a screen starts and ends at the same place. The search field, the filters, the heading and the posters each used to pick their own.",
				note: "Measured in a 1920px pane: three different left edges at 24, 29 and 403, and two right edges. All of it now runs as one column.",
			},
			{
				kind: "better",
				text: "Controls are sized for a mouse on a desktop: smaller, denser, and closer to the work.",
				note: "44px is the figure for a fingertip. A pointer's minimum is 24px, so holding a mouse-driven pane at thumb size was spending a quarter of the window on chrome. Reel now asks 44px where there is a touchscreen and 28px where there is a cursor, decided by the device and never by the width — a phone in landscape is wide and still has no cursor. The top of the window went from 247px to 174px, which is 73px more of your library on every screen.",
			},
			{
				kind: "better",
				text: "A list's heading is a heading, not a blurred poster with the count written across it.",
				note: "132px of the artwork behind it, blurred, introducing a row of the same artwork. Pleasant on a phone; in the way on a desktop. Now 43px.",
			},
		],
	},
	{
		version: "0.9.37",
		date: "2026-09-05",
		headline: "The desktop layout is tuned for a desktop, and a search keeps going as you scroll.",
		changes: [
			{
				kind: "fixed",
				text: "On a wide pane, the filter chips no longer squash into narrow boxes with their labels spilling out over the edges.",
				note: "A chip is a button, and a button in a flex row is allowed to shrink below its own text where an ordinary element is not. The rule that prevents this was written for the phone and only ever applied there, so every width above it was unprotected. Measured at 900px: all twenty-four genre chips overflowed at once, and 'For you' was given 27px to draw 45px of text.",
			},
			{
				kind: "better",
				text: "On a wide pane the filter chips wrap onto a second row instead of scrolling sideways. The phone keeps its scrolling strip.",
				note: "A strip whose scrollbar is deliberately hidden is easy to swipe and near-unreachable with a mouse, so a genre off the right-hand edge may as well not exist.",
			},
			{
				kind: "fixed",
				text: "Every block on a screen now starts at the same left edge. The filter bar, the heading and the results used to each pick their own.",
				note: "The phone was fixed for this long ago, and its comment named the cause exactly: with blocks of differing intrinsic width, an automatic margin gives each one a different left edge. The desktop still had it. On Discover in a 1920px pane the filter bar was 537px starting at 388px, the head 327px starting at 493px, and the feed 1313px starting at 0.",
			},
			{
				kind: "fixed",
				text: "The back bar on a title's page is a bar again, rather than a small white island floating over the cast.",
				note: "The same cause as the left edges above: it shrank to fit the two words inside it.",
			},
			{
				kind: "new",
				text: "Searching TMDB keeps loading results as you scroll, instead of stopping at the first page.",
				note: "The count under the box said '15 on TMDB' and meant '15 on the first page of TMDB'. It now states both numbers, and pages in the rest as you reach them.",
			},
		],
	},
	{
		version: "0.9.36",
		date: "2026-09-05",
		headline: "The passphrase on your keys can be changed.",
		changes: [
			{
				kind: "new",
				text: "Settings → Reel → Change passphrase re-seals your saved keys under a new passphrase.",
				note: "It asks for the current one first, then the new one twice. The keys themselves don't change, so nothing needs re-issuing at TMDB or anywhere else. Until now the only way to a different passphrase was to delete every key and fetch them all again.",
			},
			{
				kind: "better",
				text: "The change works while the keys are locked, and leaves them unlocked afterwards.",
				note: "The current passphrase is asked for either way — even when the session is already unlocked — because a changed passphrase you didn't choose would lock you out of your own keys for good.",
			},
		],
	},
	{
		version: "0.9.35",
		date: "2026-08-22",
		headline: "The settings screen stops borrowing Obsidian's button styling.",
		changes: [
			{
				kind: "fixed",
				text: "On the desktop, the settings tab no longer renders as a column of grey pills with their labels centred and their text printed across the row below.",
				note: "Reel builds each section header and each feature row as one button, so the whole row can be tapped. A bare button in Obsidian carries a background and a fixed height, and anything taller than one row spilled straight out of it onto whatever came next.",
			},
			{
				kind: "fixed",
				text: "On the phone, each feature's description wraps again instead of being cut off mid-word.",
				note: "Obsidian stops text wrapping inside a button, and that setting reaches every word inside it. The descriptions ran out past the arrow and over the paragraph underneath the list.",
			},
			{
				kind: "fixed",
				text: "With Obsidian's text size turned up, the three buttons under a Discover suggestion wrap onto a second line instead of running off the side of the screen.",
			},
		],
	},
	{
		version: "0.9.34",
		date: "2026-08-22",
		headline: "A walkthrough stops calling itself set up when its last check failed.",
		changes: [
			{
				kind: "fixed",
				text: "A feature's guide no longer shows a green \"Set up\" badge above a line saying the connection failed.",
				note: "The badge was answering \"did I already do this?\" and it still does — it just no longer answers in green when the last check came back an error. Green is the first thing you read, and it was contradicting the sentence underneath it.",
			},
			{
				kind: "better",
				text: "When a check has failed, the guide's steps are open instead of folded away behind \"All 3 steps done\".",
				note: "They fold when everything works, because you did not open the screen to re-read how to make an account. A failed key is exactly when you did.",
			},
			{
				kind: "fixed",
				text: "Completed walkthrough steps are readable again.",
				note: "They were faded to about a third of the contrast text needs, so a finished step was hard to read on the screen you had opened in order to read it.",
			},
			{
				kind: "fixed",
				text: "On the publish sheet, a target you have not set up yet no longer greys out its own instructions.",
				note: "The line telling you what is missing — and that you can tap the tile to fix it — was the faintest thing on the tile. The tile also showed a \"not allowed\" cursor while being perfectly tappable.",
			},
			{
				kind: "fixed",
				text: "The position numbers on the statistics charts are no longer too faint to read.",
			},
		],
	},
	{
		version: "0.9.33",
		date: "2026-08-22",
		headline: "Remove, on a film's page, no longer looks switched off.",
		changes: [
			{
				kind: "fixed",
				text: "The Remove button on a film's page now has an outline, like the buttons beside it.",
				note: "It had no fill and no edge in a row of four buttons that had both, which is exactly how this plugin draws a control you cannot press. It stays grey rather than red until you tap it once — that part was deliberate and has not changed.",
			},
		],
	},
	{
		version: "0.9.32",
		date: "2026-08-22",
		headline: "The button that confirms a deletion now looks like a button.",
		changes: [
			{
				kind: "fixed",
				text: "In every confirmation dialog, the confirm button rendered as plain grey text with no fill and no border.",
				note: "Cancel beside it had both, so the only thing on the screen that looked pressable was the one that does nothing. It affected all six irreversible actions: removing every key, removing one, disconnecting Trakt, trashing cached posters, and switching to plain-text storage.",
			},
			{
				kind: "fixed",
				text: "Destructive buttons are now readable on dark and unusual themes.",
				note: "The red fill and its white text were both taken from theme colours meant for other purposes, so on a dark theme the text on them fell to 2.7:1 — well below the readable threshold.",
			},
		],
	},
	{
		version: "0.9.31",
		date: "2026-08-22",
		headline: "Clearing the settings search now puts the screen back exactly as it was.",
		changes: [
			{
				kind: "fixed",
				text: "Explanations no longer stay hidden after you clear the search box.",
				note: "A screen that had ever been searched lost its paragraphs until the next full redraw. Introduced in the previous release, alongside the fix that hides them while a search is running.",
			},
			{
				kind: "fixed",
				text: "Tapping a section header during a search no longer silently changes which sections are open.",
				note: "A section a search opens stays visible whether or not it is folded, so the tap moved nothing — and then turned up later as a section standing open when you cleared the box. The header is inert for as long as the search is deciding, and goes back to normal when the query does.",
			},
		],
	},
	{
		version: "0.9.30",
		date: "2026-08-22",
		headline: "Searching settings now hides the explanations along with the controls they describe.",
		changes: [
			{
				kind: "fixed",
				text: "A search no longer leaves paragraphs about settings it just hid.",
				note: "Searching \"spoiler\" gave you one matching control under three hundred pixels of prose, including a note about why IMDb is not a publishing destination, beside a list of destinations that was no longer on screen.",
			},
			{
				kind: "better",
				text: "Searching a section by name still shows all of it, prose included.",
				note: "Asking for \"publishing\" is asking for the section; asking for \"spoiler\" is asking for a control.",
			},
		],
	},
	{
		version: "0.9.29",
		date: "2026-08-22",
		headline: "The setup summary now mentions anything you started and haven't finished.",
		changes: [
			{
				kind: "better",
				text: "A half-finished feature is named in the setup line, not silently counted as off.",
				note: "It read \"4 of 5 optional features on\" while a row below said Mastodon was half done. A feature two minutes from working and one nobody has touched ask completely different things of you, and the line you read when the section is folded — which is every visit, once TMDB is in — could not tell them apart.",
			},
		],
	},
	{
		version: "0.9.28",
		date: "2026-08-22",
		headline: "The settings list and the guide it opens now agree about how far in you are.",
		changes: [
			{
				kind: "fixed",
				text: "Mastodon reads as half done once your server is entered, instead of not set up.",
				note: "The guide had started counting your server address as progress and the row that opens it had not, so one screen showed five of six steps behind you while the other said you had not begun. Both were describing the same vault.",
			},
		],
	},
	{
		version: "0.9.27",
		date: "2026-08-22",
		headline: "A walkthrough now remembers where you were when you left it.",
		changes: [
			{
				kind: "fixed",
				text: "Steps you tick off stay ticked after you close the guide.",
				note: "Half of these steps happen on somebody else's website, and a phone cannot show two apps at once. You marked step two, switched to a browser for step three, came back — and every mark was gone, which is the one question the ticks exist to answer.",
			},
			{
				kind: "better",
				text: "The Mastodon guide now has a middle: typing your server address counts as progress.",
				note: "Its steps could only be ticked by the access token, the very last thing you get, so entering your server and going off to make a token brought you back to a list reporting nothing done at all.",
			},
			{
				kind: "better",
				text: "That guide asks for the server and the token as two steps, because they are two actions.",
			},
		],
	},
	{
		version: "0.9.26",
		date: "2026-08-22",
		headline: "The model picker now says whether the prices in front of you are real.",
		changes: [
			{
				kind: "fixed",
				text: "The list of models says whether it came from OpenRouter or from Reel's own suggestions.",
				note: "The two render identically, and they are not the same thing: one is four names Reel carries and will eventually get wrong, the other is the live catalogue with today's prices. Fetching said so in a notice that then took the count away, so a screen that had just pulled the real list looked exactly like one that never had.",
			},
		],
	},
	{
		version: "0.9.25",
		date: "2026-08-22",
		headline: "A destination you haven't set up is now something you can tap, not just something you're told about.",
		changes: [
			{
				kind: "fixed",
				text: "Tapping a greyed-out Trakt or Mastodon tile in the publish sheet opens its walkthrough.",
				note: "The tile said what was missing and where to go and fix it, inside a button that was disabled — so the one control carrying the instruction was the one control you could not press.",
			},
			{
				kind: "better",
				text: "Those tiles now say what tapping will do instead of naming a settings tab.",
			},
		],
	},
	{
		version: "0.9.24",
		date: "2026-08-22",
		headline: "Finishing a walkthrough now leaves you with a working feature.",
		changes: [
			{
				kind: "fixed",
				text: "The Trakt and Mastodon guides now contain the switch that turns publishing on.",
				note: "You could paste a Trakt client ID and secret, complete the sign-in, watch all five steps tick and the status line turn green, close the guide, and find no Publish button anywhere — because the destination switch lived on the settings tab and defaults to off.",
			},
			{
				kind: "better",
				text: "Ask and Publish now open the relevant guide instead of dropping you in the settings tab.",
				note: "Both screens knew exactly which feature was missing and threw that away to leave you hunting for one section among forty-nine controls.",
			},
			{
				kind: "fixed",
				text: "Opening Ask with a saved key and the switch off no longer tells you to add a key.",
				note: "Being set up means two things — a key and the switch — and that screen treated it as one, so it gave the wrong instruction to the one person it could actually help.",
			},
			{
				kind: "better",
				text: "The publish sheet with nothing set up says what Trakt and Mastodon each do with your review.",
			},
		],
	},
	{
		version: "0.9.23",
		date: "2026-08-22",
		headline: "The key storage dropdown now explains the mode you picked, not the one it was written for.",
		changes: [
			{
				kind: "better",
				text: "Each of the three storage modes explains itself, under the control that chose it.",
				note: "The paragraph described the encrypted blob and its single passphrase to everybody, including people on session-only storage, for whom there is neither.",
			},
			{
				kind: "new",
				text: "Session-only storage now says you re-enter your key every time Obsidian starts.",
				note: "The label said “never written to disk”, which is the appealing half. The half you found out by restarting was written down nowhere.",
			},
			{
				kind: "fixed",
				text: "Test connections no longer answers with silence when nothing is configured.",
				note: "It checked none of six services and returned, so the button read Testing… and went back to Test with no row and no notice. On a new install that is the control you press to prove it works. It now says there is nothing to test yet, and is disabled until there is.",
			},
		],
	},
	{
		version: "0.9.22",
		date: "2026-08-22",
		headline: "Switching your keys to plain text now asks first, and says where they will land.",
		changes: [
			{
				kind: "fixed",
				text: "Choosing “Plain text in vault” from the storage dropdown now asks you to confirm.",
				note: "One tap used to take every key out of the encrypted blob and write it readably to disk. Removing a single key has always asked; exposing all of them asked nothing. Encrypting again afterwards does not un-sync a secret that has already been copied out in the clear.",
			},
			{
				kind: "better",
				text: "The plain-text warning now sits directly under the dropdown that chose it.",
				note: "It used to render at the foot of the section, below three key fields, a toggle, the connection table and two buttons — most of a phone screen away from the control it was about.",
			},
			{
				kind: "fixed",
				text: "That warning names the real file path instead of “undefined/plugins/reel/data.json”.",
			},
			{
				kind: "fixed",
				text: "Plain-text mode no longer prints each key name twice, once in amber and once in green.",
			},
		],
	},
	{
		version: "0.9.21",
		date: "2026-08-22",
		headline: "Settings can now unlock your keys, instead of waiting for something else to demand the passphrase.",
		changes: [
			{
				kind: "new",
				text: "An Unlock button, on the settings screen, beside the line that says the keys are locked.",
				note: "There has always been a Lock now button and never an unlock. Locking was a decision you could make; unlocking was something that happened to you later, when some unrelated action reached for a key and a passphrase box appeared for a reason you had to work out. Encrypted storage is the default, so that is the state the screen is in every time Obsidian starts.",
			},
			{
				kind: "fixed",
				text: "Test connections no longer reports five broken services because you declined a passphrase prompt.",
				note: "Locked keys are still listed as configured, correctly — their names are stored beside the encrypted blob. Testing reached for five of them anyway, put a passphrase box over a screen you had not asked anything of, and wrote down five failures if you cancelled it. It now says “Unlock and test” and asks first.",
			},
			{
				kind: "better",
				text: "Locked services say so, rather than saying they have not been checked yet.",
				note: "A key nobody has tried and a key nobody can try are different problems with different answers, and they used to read identically.",
			},
			{
				kind: "better",
				text: "A finished walkthrough opened on a locked vault offers to unlock it.",
				note: "Reopening a guide for something already set up almost always means it has stopped working. The status line said the keys were locked and left you to go elsewhere to do something about it.",
			},
		],
	},
	{
		version: "0.9.20",
		date: "2026-08-22",
		headline: "The Ask guide now contains the switch its last step tells you to flip.",
		changes: [
			{
				kind: "fixed",
				text: "The OpenRouter guide ends “paste it below, press Save, then turn Ask on”, and now has the Enable Ask switch in it.",
				note: "It contained the first half of that sentence and not the second. It also closes a gap of its own: a saved key with Ask off reads as set up everywhere, because being set up means having the key — and yet no question will run.",
			},
			{
				kind: "better",
				text: "Every feature's walkthrough is now checked on every build, including any added later.",
				note: "Three guides had been added to the test harness by hand over three releases and each one turned up a real fault the first time it was drawn. Three more had never been rendered at all. Whether a guide gets checked is no longer something anybody has to remember.",
			},
		],
	},
	{
		version: "0.9.19",
		date: "2026-08-22",
		headline: "A brand new install is no longer offered a connection test it cannot pass.",
		changes: [
			{
				kind: "fixed",
				text: "The TMDB guide no longer shows “Not checked yet” and a Check now button before you have a key.",
				note: "TMDB was excepted from the rule every other feature follows, on the grounds its key might be built in. There is no built-in key — which is why the same screen tells you Reel needs one. So the very first guide anybody opens offered to test a connection that could only fail, and pressing Test connections on a fresh install recorded that failure.",
			},
			{
				kind: "better",
				text: "Test connections skips what you have not set up yet, including TMDB.",
			},
		],
	},
	{
		version: "0.9.18",
		date: "2026-08-22",
		headline: "A guide for something already working opens on the parts you came for.",
		changes: [
			{
				kind: "better",
				text: "Once every step of a guide is done, the steps fold away behind a line saying so.",
				note: "Opening a guide for a working feature is normal — it is where the status lives, and the check button, and the field you would use to replace a key. What you are not doing is reading how to create the account. The whole thing now fits one screen instead of three thousand pixels of settled questions.",
			},
			{
				kind: "better",
				text: "Folded, never dropped. Making a second token a year from now means reading them again.",
			},
		],
	},
	{
		version: "0.9.17",
		date: "2026-08-22",
		headline: "A guide you come back to knows which steps you already finished.",
		changes: [
			{
				kind: "new",
				text: "Steps whose key is already saved are ticked when the guide opens, along with every step before them.",
				note: "Ticking existed and was entirely manual, so it lasted one sitting — come back tomorrow to a guide you half finished and the marks were gone. A saved credential is durable and settles it directly: you cannot be holding a Trakt client secret without having created the application it belongs to.",
			},
			{
				kind: "fixed",
				text: "Ticks no longer vanish when the guide redraws after saving a key.",
				note: "The marks were only ever applied by the tap that made them, which was fine while the sheet was drawn once. It now redraws whenever you save something, and each redraw cleared a list that still believed it was holding them — so the buttons looked untouched and did nothing visible when pressed.",
			},
			{
				kind: "better",
				text: "Save stops competing for attention once the key it saves is already there.",
				note: "A half-finished Trakt guide had Save and Sign in in the same accent: one replaces a credential you already have, the other is the step you came back for. A screen with two primary actions has none.",
			},
		],
	},
	{
		version: "0.9.16",
		date: "2026-08-22",
		headline: "Getting started says what each feature will cost you, before you tap it.",
		changes: [
			{
				kind: "new",
				text: "Each feature you have not set up now shows how long it takes and whether it costs anything.",
				note: "Every feature already carried that line and it was only ever shown inside the guide — one tap too late, because it is the fact that decides whether you take the tap. “Publishing to a public film profile” says what it does and nothing about whether it is two minutes or an account you have to register. OpenRouter says you pay per question; DoesTheDogDie says they approve by hand.",
			},
			{
				kind: "better",
				text: "The note under Getting started describes what a guide now actually does.",
				note: "It still said guides give you values to paste somewhere else, which stopped being true when they started taking the key themselves and checking it works.",
			},
		],
	},
	{
		version: "0.9.15",
		date: "2026-08-22",
		headline: "Every control on the settings screen says what it does.",
		changes: [
			{
				kind: "fixed",
				text: "A Trakt token that was refused no longer calls itself expired.",
				note: "The row title said “Trakt session expired” while the status line under it said the token had been refused and the expiry was two months away. One state, two labels, disagreeing.",
			},
			{
				kind: "fixed",
				text: "Remove all keys and Open the note after adding now explain themselves.",
				note: "Deleting every saved key was the most destructive control on the screen and the one with nothing written under it.",
			},
			{
				kind: "better",
				text: "A control with no explanation is now something the build refuses to ship.",
				note: "A settings screen is where a plugin explains itself, and a row that is only a name and a switch makes you guess — the same hidden-information problem as a feature with no walkthrough, repeated forty-six times.",
			},
		],
	},
	{
		version: "0.9.14",
		date: "2026-08-22",
		headline: "Every guide told you to paste the key below. Now there is a below.",
		changes: [
			{
				kind: "fixed",
				text: "Setup guides now contain the fields their steps point at, so a walkthrough can be finished without leaving it.",
				note: "All six guides ended by telling you to paste something below — the key, the client ID and secret, the server address — and there was nothing below. The field was on the settings screen underneath the sheet saying “look down”, so following the instruction meant abandoning the guide halfway and hunting for a control among forty-nine others.",
			},
			{
				kind: "new",
				text: "Trakt's sign-in and Mastodon's server address are in their guides too, so both can be set up start to finish in one place.",
			},
			{
				kind: "fixed",
				text: "Buttons and inputs in a guide are a full 44px again, and no longer sit flush against the edges of the phone.",
				note: "The 44px floor was written for the settings screen rather than for the controls, so the moment the guides drew the same fields they silently lost it.",
			},
		],
	},
	{
		version: "0.9.13",
		date: "2026-08-22",
		headline: "Every setup guide can now check itself, on the spot.",
		changes: [
			{
				kind: "new",
				text: "A Check now button in each guide, which tests just that feature and updates its status in place.",
				note: "Verification used to live on a different screen from setup, behind one button that tested all six services at once. Finishing a walkthrough meant closing it and going to look for something else in order to find out whether the key you had just pasted was right.",
			},
			{
				kind: "new",
				text: "Mastodon can be checked as soon as you have typed a server, before you have made a token.",
				note: "The server address is what people actually get wrong, and that is the cheapest moment to find out.",
			},
			{
				kind: "fixed",
				text: "A guide's title and description no longer run into both edges of the screen.",
				note: "Every other block on that screen pads itself — the numbered steps, the privacy note, the status line — so the head was the only text sitting flush against the phone. Nothing caught it, because nothing overflowed: the text was inside its box, and the box was the width of the phone.",
			},
			{
				kind: "better",
				text: "Test connections runs its checks at once rather than one after another.",
				note: "Three services became six, and they share no rate limit and no dependency, so waiting for each in turn bought nothing but the wait.",
			},
		],
	},
	{
		version: "0.9.12",
		date: "2026-08-22",
		headline: "A Trakt session you revoked no longer says you are signed in.",
		changes: [
			{
				kind: "new",
				text: "Test connections now checks your Trakt session, which catches access you revoked from Trakt's own website.",
				note: "The stored token's expiry is exact, needs no network and can be read while your keys are locked, so it stays what the row reports on every render. What it cannot see is revocation: withdrawing Reel's access leaves the token stored and its expiry months away, so every signal still said “Signed in” and the first contradiction was a review that would not post.",
			},
			{
				kind: "fixed",
				text: "A refused Trakt token now offers the Sign in again button, instead of titling the row “Signed in to Trakt” and offering nothing.",
				note: "That row is the one place the problem can be fixed from, and it was the one place that did not know there was a problem.",
			},
			{
				kind: "better",
				text: "Every screen now works out a feature's health the same way.",
				note: "The rule had been written out four separate times — the health table, the settings row, the setup guide, and the Trakt sign-in row. The fourth copy had already been missed by this fix, which is how two screens come to disagree about whether the same thing works.",
			},
		],
	},
	{
		version: "0.9.11",
		date: "2026-08-22",
		headline: "Ask and Mastodon can be tested, instead of only reporting that you typed something in.",
		changes: [
			{
				kind: "new",
				text: "Test connections now checks your OpenRouter key, and tells you how much credit is left on it.",
				note: "A wrong OpenRouter key is not rejected when you save it — it is rejected when you ask a question, so the error arrives attached to the question and reads like Ask being broken. A key that has simply run out of credit behaves exactly the same way. Both are answerable before the first question.",
			},
			{
				kind: "new",
				text: "Test connections now checks your Mastodon server, and says plainly that it has not checked your token.",
				note: "Reel asks for a token that can only post, which is the least a thing that posts can hold. The endpoint that would verify a token needs permission to read your account, so on a correctly scoped token it fails — and a check that fails on the setup Reel told you to create is worse than no check. The server address is the half people actually get wrong, and it used to fail at the moment you pressed publish on a review you had just written.",
			},
			{
				kind: "better",
				text: "A check that could only test half the question says “Checked” rather than “Working”.",
				note: "Green, a tick and the word Working is what a scan of five rows actually reads, whatever the sentence after it says.",
			},
			{
				kind: "fixed",
				text: "A connection result is shown whenever there is one, rather than only when a key happens to be stored for it.",
			},
		],
	},
	{
		version: "0.9.10",
		date: "2026-08-22",
		headline: "Ask shows its answer above the buttons, and the reasons read as writing rather than as links.",
		changes: [
			{
				kind: "fixed",
				text: "Asking a question no longer leaves Close and Ask stranded in the middle of the sheet with the recommendations underneath them.",
				note: "The answer is the reason the screen exists and it was rendering behind the buttons that produced it. They sit at the bottom now and stay there while a long list scrolls.",
			},
			{
				kind: "fixed",
				text: "The reason a film was picked is no longer painted in the accent colour.",
				note: "In this plugin the accent means you can tap something — it is the Ask button, it is a link, it is the stars sitting right underneath. Three lines of prose wearing it looked tappable and did nothing when tapped. It still leads the runtime and the genre; it does it by rank now instead of by hue.",
			},
			{
				kind: "fixed",
				text: "The line reporting how much of your library was searched, and what the question cost in tokens, was too faint to read on warm themes.",
				note: "It was set in the most de-emphasised colour a theme has, which is meant for chrome you look past. It is the only place either number is reported, and one of them is money.",
			},
		],
	},
	{
		version: "0.9.9",
		date: "2026-08-22",
		headline: "The daily note setting now checks itself against your actual daily notes.",
		changes: [
			{
				kind: "new",
				text: "The daily note folder says how many dated notes it holds \u2014 and warns when it holds none, because then nothing will ever be found there on any day.",
				note: "Linking is unchanged: Reel appends to today's note if it exists and never creates one. The problem was one level down. \u201cNo daily note today\u201d and \u201cyou typed the wrong folder\u201d produced exactly the same silence, and only one of them is fine.",
			},
			{
				kind: "new",
				text: "When the folder is wrong, the folders that do hold dated notes are offered underneath. Usually there is exactly one, so it is a single tap.",
			},
			{
				kind: "new",
				text: "The line prefix shows the line it produces, as it will appear in the note.",
				note: "Its effect used to be invisible until the next time you happened to log a film and then went and opened a different note.",
			},
			{
				kind: "better",
				text: "Having no note for today is not reported as a problem. That is the ordinary state of a morning, and Reel is designed to do nothing in it.",
			},
		],
	},
	{
		version: "0.9.8",
		date: "2026-08-22",
		headline: "Ask's model setting is checked as you type, and suggests models that work.",
		changes: [
			{
				kind: "new",
				text: "The model box says whether the slug is the right shape \u2014 a missing vendor, a pasted URL, a stray space, capitals.",
				note: "Reel already caught a bad slug, but only at question time: you typed a question, waited, and were refused. The screen where the string was typed said nothing.",
			},
			{
				kind: "new",
				text: "Models are suggested underneath, with what each costs. \u201cLoad list\u201d fetches the current list from OpenRouter.",
				note: "Before you fetch anything it offers three that suit the job, with a line on why. The job is ranking sixty one-line summaries against a sentence, which a small fast model does as well as a large one and far more cheaply.",
			},
			{
				kind: "fixed",
				text: "Folder suggestions had no spacing between them when there was more than one.",
				note: "The container was missing its class, so every rule written for it \u2014 the row, the wrapping, the gaps \u2014 had never applied to anything. With a single suggestion it looked exactly right, which is why last release's screenshot did not catch it.",
			},
		],
	},
	{
		version: "0.9.7",
		date: "2026-08-22",
		headline: "Settings now knows the difference between set up and working.",
		changes: [
			{
				kind: "fixed",
				text: "\u201cSigned in to Trakt\u201d meant \u201ca token is stored\u201d, which stays true forever \u2014 including long after the session expired.",
				note: "The first you heard about it was a review that would not publish. The expiry was inside the token the whole time, unread. The row now says whether the session is live, and offers a way back in when it is not.",
			},
			{
				kind: "better",
				text: "Test connections keeps its answer. Each service shows what it did and how long ago, until you test again.",
				note: "It used to report into a Notice that vanished after eight seconds, so a screen that had just proved every key worked looked exactly like one that had never been tested.",
			},
			{
				kind: "new",
				text: "A feature that has stopped working says so in Getting started, where you look when something has stopped working.",
				note: "That section could previously only answer \u201cis this set up\u201d \u2014 a question a revoked key and an expired session both answer yes to.",
			},
			{
				kind: "fixed",
				text: "A failing service no longer shows a green tick beside the words explaining that it failed.",
			},
		],
	},
	{
		version: "0.9.6",
		date: "2026-08-22",
		headline: "The folder settings now tell you whether the folder is actually there.",
		changes: [
			{
				kind: "new",
				text: "Each folder field says what it is looking at: \u201cFolder exists\u201d, \u201cDoes not exist yet \u2014 Reel will create it\u201d, or that a note is already sitting on the name.",
				note: "These four fields were the only place in Settings where being wrong was silent. A bad API key errors the first time it is used; a mistyped folder just becomes a folder, and Reel carries on working perfectly while writing notes somewhere you are not looking. It surfaces weeks later as \u201cmy films have stopped appearing\u201d.",
			},
			{
				kind: "new",
				text: "Folders you already have are offered underneath, as buttons. Tap one instead of typing a path on a phone keyboard.",
				note: "They appear only while the path does not resolve \u2014 once the folder exists the question is answered, and four fields each showing five suggestions would be most of the section.",
			},
			{
				kind: "better",
				text: "\u201cDoes not exist yet\u201d is deliberately not styled as a problem. On a fresh install none of the four folders exist and all four are about to be created.",
			},
			{
				kind: "fixed",
				text: "Paths pasted with backslashes, doubled slashes or stray spaces are now understood rather than saved as-is.",
			},
		],
	},
	{
		version: "0.9.5",
		date: "2026-08-22",
		headline: "Settings folds up, says what is inside each section, and can be searched.",
		changes: [
			{
				kind: "new",
				text: "Every settings section folds, and a folded one tells you what it holds \u2014 \u201cMovies \u00b7 Series\u201d, \u201c10 cast \u00b7 US \u00b7 people linked\u201d, \u201cOff \u2014 nothing leaves your vault\u201d.",
				note: "The screen opens at 1,657px instead of roughly 3,700px, and most of the time the summary line is the whole thing you came to check.",
			},
			{
				kind: "new",
				text: "A search box at the top of Settings. Type \u201cspoiler\u201d and you get the one control, not the section it lives in.",
				note: "It searches the descriptions too, so you can find a setting without knowing what it is called or which section somebody filed it under.",
			},
			{
				kind: "better",
				text: "Settings remembers which sections you left open.",
			},
			{
				kind: "better",
				text: "A feature you have already set up is one line in Getting started instead of a paragraph.",
				note: "The description is a pitch, and a pitch is for something you have not bought yet. With everything configured it was five paragraphs about features you were already using.",
			},
			{
				kind: "better",
				text: "Getting started stops being pinned open once TMDB is in. Until then nothing else on the screen matters, so it stays.",
			},
		],
	},
	{
		version: "0.9.4",
		date: "2026-08-22",
		headline: "Setting Reel up is now something the app walks you through.",
		changes: [
			{
				kind: "new",
				text: "Settings opens with Getting started \u2014 every feature Reel can use, which are set up, and which are not.",
				note: "A new install used to show forty-nine controls with nothing marking the one that matters from the forty-eight with sensible defaults. It now says so in a sentence at the top, and nothing else competes with it until TMDB is in.",
			},
			{
				kind: "new",
				text: "Every feature has a guide: numbered steps, the pages to open, and the exact values to paste.",
				note: "Trakt's redirect URI and Mastodon's scope have to match character for character, and both are now a button that copies them rather than a string to retype from a paragraph.",
			},
			{
				kind: "new",
				text: "Each guide says what leaves your vault before you set the feature up, not after.",
			},
			{
				kind: "better",
				text: "A feature that is half set up says so. Registering a Trakt application and not signing in used to look exactly like never having started.",
			},
			{
				kind: "fixed",
				text: "The links inside the new guides were invisible \u2014 a white button on a white card.",
				note: "The same collision that hid the key pills in 0.9.3: a control filled with the theme's form-field colour, sitting on a surface that is the same colour. Correctly sized, correctly padded, and not there.",
			},
			{
				kind: "fixed",
				text: "The tick and warning marks were unreadable on warm-toned themes, at 4.09:1.",
				note: "Reel now owns those two colours instead of borrowing the theme's. A green chosen against a white page is a fail on a cream card, and both the borrowed value and the fallback behind it had been picked against white.",
			},
			{
				kind: "fixed",
				text: "In a long guide on a phone with the keyboard up, the way back to settings had scrolled 800px off the bottom.",
			},
		],
	},
	{
		version: "0.9.3",
		date: "2026-08-22",
		headline: "The settings screen has been designed, and can finally be checked.",
		changes: [
			{
				kind: "better",
				text: "Settings is nine cards instead of one run of forty-nine rows, each section titled and separated.",
				note: "Every section is its own element now. They used to be appended straight onto the container, so there was nothing a stylesheet could reach \u2014 which is why the settings screen was the one surface in Reel with no styling of its own at all.",
			},
			{
				kind: "better",
				text: "Every control in Settings is at least 44px tall, and fields take the full width on a narrow pane.",
				note: "Their size used to be whatever the installed theme happened to give them. On a phone-first plugin that is not a decision anybody made.",
			},
			{
				kind: "better",
				text: "Maintenance looks like what it is. The actions that delete things no longer sit in identical chrome to a preference toggle.",
			},
			{
				kind: "fixed",
				text: "The service pills at the top of Settings could silently lose their colour on some themes, leaving \u201cworking\u201d and \u201cnot set\u201d looking identical.",
				note: "They filled with a colour taken straight from the theme with no fallback, and in CSS a missing variable does not fall back \u2014 it voids the whole declaration. Seven such uses across the app are now guarded.",
			},
			{
				kind: "fixed",
				text: "The key storage description said \u201call three keys\u201d. There are seven, and two of them can post publicly as you \u2014 which it now says.",
			},
			{
				kind: "fixed",
				text: "The Remove buttons were unreadable: red text on a grey button, 3.87:1 in light and 2.43:1 in dark.",
				note: "Found by the audit, which reached the settings screen for the first time in this release.",
			},
		],
	},
	{
		version: "0.9.2",
		date: "2026-08-21",
		headline: "Turning off automatic enrichment now actually turns it off.",
		changes: [
			{
				kind: "fixed",
				text: "\u201cEnrich new notes automatically\u201d works. With it off, adding a title no longer calls OMDb and DoesTheDogDie anyway.",
				note: "The setting has existed for a long time and nothing ever read it, so switching it off changed nothing at all \u2014 Reel kept making third-party requests on behalf of someone who had just declined them. The two Fetch commands still work with it off, since asking for enrichment outright is not the same as it happening automatically.",
			},
			{
				kind: "new",
				text: "Ask has a button in the Library, next to Filters, instead of living only in the command palette.",
				note: "Three taps and a keyboard was a strange way in for the feature whose whole pitch is describing a mood in one sentence. It appears only once an OpenRouter key exists.",
			},
			{
				kind: "fixed",
				text: "Removed the \u201cConfirm before posting\u201d switch, which governed nothing.",
				note: "It shipped in 0.9.0 with a default and a toggle and was read by no code: the confirmation always happened. Rather than wire up a way to skip it, the switch is gone and the guarantee is unconditional \u2014 a review is never posted without you reading the exact text first.",
			},
		],
	},
	{
		version: "0.9.1",
		date: "2026-08-21",
		headline: "Every filter chip carries its own count, so the size of your watchlist is just there.",
		changes: [
			{
				kind: "new",
				text: "The Type and Status chips in Filters show how many titles each one holds \u2014 \u201cFilms 36\u201d, \u201cwatchlist 4\u201d.",
				note: "It was answerable before: tick the chip, read \u201cShow 4 titles\u201d at the bottom. But that is a question you have to already be asking, and the point of a count is seeing it without asking.",
			},
			{
				kind: "better",
				text: "The watchlist tile in Stats splits films from series \u2014 \u201c12 films, 6 series\u201d \u2014 alongside how long the backlog runs at your current pace.",
				note: "One number covering both described an evening very differently depending on which you were planning.",
			},
			{
				kind: "fixed",
				text: "Status counts agree with what the chip actually shows when you tap it.",
				note: "Counting the raw labels would have printed a number next to \u201cwatched\u201d that the filter then disagreed with, since watched and completed are answered from your logged dates and episode progress rather than from a label.",
			},
		],
	},
	{
		version: "0.9.0",
		date: "2026-08-21",
		headline: "Your reviews can leave the vault, and you can ask for something to watch in your own words.",
		changes: [
			{
				kind: "new",
				text: "Publish a review to Trakt or Mastodon, one at a time, from the button beside it.",
				note: "IMDb was the ask and IMDb has no way in \u2014 no public API for posting a review, and the only alternative would be driving a login and a form as you, which Reel won't do. Trakt is the closest thing with a real door: a public profile carrying ratings and reviews. Both are off until you switch them on.",
			},
			{
				kind: "new",
				text: "Nothing is sent until you have read the exact text that will be sent.",
				note: "The sheet shows the real post, per destination, with the character count and the truncation if there is one. No destination is ticked to start with, so a reflex tap on Publish posts nowhere.",
			},
			{
				kind: "better",
				text: "A published review records where it went, so the button says so rather than quietly posting twice.",
			},
			{
				kind: "new",
				text: "Ask \u2014 describe what you feel like watching and Reel finds it in what you already own.",
				note: "\u201cSomething short and funny I haven't seen, nothing too bleak\u201d works, because there is no field in the vault called bleak and that is exactly the kind of question nothing else in the app could answer.",
			},
			{
				kind: "new",
				text: "Ask shows its working: what it understood you to mean, what it had to give up on, how many titles it looked at, and one line on why each result is there.",
				note: "It cannot recommend a film you do not own \u2014 the ranking only ever sees titles that came out of your own library \u2014 and it says what each question cost in tokens.",
			},
			{
				kind: "better",
				text: "Ask needs an OpenRouter key and is off until you add one. A question sends titles, years, genres, runtimes and your ratings \u2014 never your review text, your watch dates or your file paths.",
			},
		],
	},
	{
		version: "0.8.40",
		date: "2026-08-20",
		headline: "The superlative rows read as one line again.",
		changes: [
			{
				kind: "fixed",
				text: "“Highest rated”, “Lowest rated” and “Longest” put the poster, the label and the film's name together on one line instead of leaving the poster floating above a name stranded in the far corner.",
				note: "The row aligned on the text baseline, and for a box holding a picture and no text the baseline is its bottom edge — so the row lined the poster's bottom up with the label and pushed everything down by nearly the poster's height. Rows are a third shorter as well.",
			},
			{
				kind: "fixed",
				text: "“Films per year” shows small posters when closed, like the other charts do.",
				note: "It was built from a count and a label and never carried the titles, so the poster strip added in 0.8.36 had nothing to draw — which looked like the feature being broken rather than that one chart having no data to give it.",
			},
		],
	},
	{
		version: "0.8.39",
		date: "2026-08-20",
		headline: "Names you tap look like names again, not beige slabs.",
		changes: [
			{
				kind: "fixed",
				text: "The three names under STARS on a title, and “Read more” under a biography, were rendering as filled boxes with the separating dots stranded between them.",
				note: "Reel had always said those should be bare text. The declaration was there and losing to the theme, which styles every button on the page and does it more specifically than the obvious fix accounts for.",
			},
			{
				kind: "fixed",
				text: "“Add another” on the reviews pane was accent text on a grey fill — 4.05:1, under the readable minimum.",
			},
			{
				kind: "better",
				text: "The same fix covers the trailer button, “Read the rest”, the like toggle and the screen tabs, which were all one theme away from the same fault.",
			},
		],
	},
	{
		version: "0.8.38",
		date: "2026-08-20",
		headline: "Putting something back on the watchlist no longer forgets that you watched it.",
		changes: [
			{
				kind: "fixed",
				text: "A film or series you move to the watchlist stays in Watched, and a finished series stays in Completed.",
				note: "`status` holds one value, so moving a title to the watchlist overwrote the only field saying you had seen it, and it fell out of its own category. Watched and Completed are now answered from your logged dates and episode progress — facts about what happened — rather than from a label a later intention can overwrite.",
			},
			{
				kind: "fixed",
				text: "Series are included in Watched at all now.",
				note: "The check asked whether the status field said the word “watched”, which for a series it never does — shows are “watching” or “completed” — so selecting Watched returned almost no television.",
			},
			{
				kind: "better",
				text: "An imported title marked watched with no dates keeps that fact when you queue it for a rewatch.",
				note: "For those notes the label was the only evidence, so it is recorded before being overwritten rather than a watch date being invented.",
			},
			{
				kind: "better",
				text: "The artwork behind a title's tabs fades out at the bottom instead of ending in a straight line, and the open tab now runs into the list below it.",
			},
		],
	},
	{
		version: "0.8.37",
		date: "2026-08-20",
		headline: "Tapping an actor shows what they played, not which chat shows they sat on.",
		changes: [
			{
				kind: "fixed",
				text: "A person's filmography leads with their parts. Chat-show appearances are collected underneath, behind a tap.",
				note: "Robert Downey Jr's opened with The Tonight Show, Family Guy, Late Night, The Late Show and The Daily Show — all real credits, four of them him as himself. Chat shows run for decades and out-score any single film on a straight popularity sort, so this happened for every actor.",
			},
			{
				kind: "fixed",
				text: "The name and portrait at the top of a person are no longer cut through the middle.",
				note: "The blurred backdrop added behind them in 0.8.34 also turned off the panel's minimum height, so it shrank to the space left over and clipped its own contents. The same two lines were on four other sheets and are fixed there too.",
			},
			{
				kind: "new",
				text: "Press and hold a poster on someone's filmography for the whole part: their face on a frame from the film, the character's name set large, the episode count, and the way in to the title.",
				note: "The character used to be a fragment truncated off the end of a 96px card. Holding still for half a second opens it; moving cancels, so the grid still scrolls.",
			},
			{
				kind: "better",
				text: "The character is now its own line on each poster, in the accent, above the year.",
			},
			{
				kind: "fixed",
				text: "The Cast / Crew / Details tabs on a title were rendering as the theme's plain buttons.",
				note: "Reel's reset for them was a single class and lost to the theme's own button rule on specificity. They now carry the film's artwork blurred behind them, and the open tab is a lit panel rather than a hairline.",
			},
			{
				kind: "better",
				text: "The Rate card fits on a phone: the poster sits beside the details instead of above them, so the whole thumbnail stays visible while you rate.",
				note: "It was about 900px tall on a 600px screen, so rating anything meant scrolling the poster underneath the queue chips.",
			},
			{
				kind: "fixed",
				text: "The blurred image on Diary, Library, Stats and Up Next fades in at the top instead of starting at a line.",
				note: "Rounding its corners in 0.8.36 was half the fix — the top edge was still straight across, which is where the eye went.",
			},
		],
	},
	{
		version: "0.8.36",
		date: "2026-08-20",
		headline: "The film titles are back on the superlatives.",
		changes: [
			{
				kind: "fixed",
				text: "“Highest rated”, “Lowest rated” and “Longest” show their film's name again.",
				note: "Trimming those rows to two lines in 0.8.31 collapsed the title to zero height instead — poster and label showed, the name did not. It was in the page the whole time, just never painted.",
			},
			{
				kind: "fixed",
				text: "The Library header's blurred image no longer ends in a hard line across the screen.",
				note: "The same fix landed on Stats in 0.8.28 but was scoped to that screen, so the identical component on Library kept the square edge.",
			},
			{
				kind: "new",
				text: "A collapsed chart shows small posters from its top rows instead of just naming them.",
				note: "“Films per year · 1 · 2026” was three words standing for a set of titles the chart already held. Folds are closed by default, so this is the state the page is mostly in.",
			},
			{
				kind: "better",
				text: "Charts about people and characters still show no posters, closed or open.",
				note: "A poster under someone's name reads as a picture of that person. That was fixed once for the open rows and is not coming back through the closed ones.",
			},
		],
	},
	{
		version: "0.8.31",
		date: "2026-08-20",
		headline: "Every superlative shows the film it is about.",
		changes: [
			{
				kind: "new",
				text: "“Highest rated”, “Longest” and the rest now show the film's poster beside them.",
				note: "These rows name one specific title and showed nothing of it — plain text describing a film, with the film absent. Each row has carried its entry since it was written, so the poster was one property away the whole time.",
			},
			{
				kind: "better",
				text: "Those rows read as a poster with a caption rather than a line of text.",
				note: "The label sits above the title, at body size and clamped to two lines, so the row height is set by the poster instead of by however long the film's name happens to be.",
			},
		],
	},
	{
		version: "0.8.30",
		date: "2026-08-20",
		headline: "The stats facts really do fit on one line now.",
		changes: [
			{
				kind: "fixed",
				text: "“Highest rated” and its answer sit side by side instead of stacked.",
				note: "This was claimed as fixed in 0.8.27 and was not. The row was already a flex container, but a narrow-screen rule set it to lay out vertically — so every property added to put the two side by side was quietly being applied to a column. Short rows drop from 81px to 51px; long titles still wrap, but inside their own column rather than onto a new line.",
			},
		],
	},
	{
		version: "0.8.29",
		date: "2026-08-20",
		headline: "Washes use a frame from the film, not its poster.",
		changes: [
			{
				kind: "better",
				text: "Blurred backdrops now come from a still of the film rather than its poster.",
				note: "A poster is marketing art — mostly a title treatment and a credit block, composed around the words printed on it, so blurring one mostly leaves the dark band where the text was. A backdrop is a frame from the film: no type, landscape, lit for the scene. It gives the colour of the film instead of the colour of its advertising. Falls back to the poster where no backdrop exists.",
			},
			{
				kind: "new",
				text: "Stats tiles carry the artwork of the title their number is about.",
				note: "The most recent film behind “Films watched”, the longest behind “Hours of film”. A tile with no single title behind it stays plain rather than borrowing an unrelated image — the point is that the tile is illustrated by its own data.",
			},
		],
	},
	{
		version: "0.8.28",
		date: "2026-08-20",
		headline: "Less text, more film.",
		changes: [
			{
				kind: "new",
				text: "The year buttons on Stats carry the artwork of what you watched that year.",
				note: "They were outlined pills with a number in them — the same control you would use for a sort menu — on a page that is otherwise entirely about pictures. Blurred far enough that it is colour rather than image, so the label stays readable and 2024 stops looking identical to 2025.",
			},
			{
				kind: "better",
				text: "One headline number leads the stats grid instead of ten tiles of equal weight.",
				note: "Ten equal tiles give the eye no way in. The lead is picked by position, not by name, so a mostly-television library leads with episodes rather than films.",
			},
			{
				kind: "fixed",
				text: "The blurred header no longer ends in a hard straight line across the screen.",
			},
			{
				kind: "fixed",
				text: "The “Show N titles” button no longer renders behind the filter chips.",
				note: "Sticky decides where something sits, not what it sits in front of — so the label looked detached and the button only appeared once you had scrolled past everything overlapping it.",
			},
			{
				kind: "fixed",
				text: "The close button on sheets is no longer a hard white tile on a tinted theme.",
			},
		],
	},
	{
		version: "0.8.27",
		date: "2026-08-20",
		headline: "The stats cards are surfaces now, not outlines.",
		changes: [
			{
				kind: "better",
				text: "Cards on the stats page are raised surfaces rather than hairline boxes drawn on the page.",
				note: "A stroke has to be traced; a raised surface is read before you have looked at it. Outlined boxes are also what a layout looks like before anyone decided what the material was.",
			},
			{
				kind: "better",
				text: "Facts like “Highest rated” put the label and the answer on one line.",
				note: "Stacked, three of them ate half the screen to say three short things. Side by side the labels form a column you scan and the answers form one beside it — and long titles still wrap rather than being squeezed.",
			},
		],
	},
	{
		version: "0.8.26",
		date: "2026-08-20",
		headline: "Reel holds up under other people's themes.",
		changes: [
			{
				kind: "fixed",
				text: "The “mark watched” tick on Up Next was invisible under themes that style buttons.",
				note: "It lost its accent fill to the theme's own button rule but kept its white checkmark — a white tick on a pale grey disc. The control worked the whole time and showed nothing.",
			},
			{
				kind: "fixed",
				text: "Discover's card buttons no longer overlap each other when a theme adds button padding.",
				note: "Two 44px targets were sharing a 16px strip, so a tap in it went to whichever the browser decided.",
			},
			{
				kind: "better",
				text: "Labels, years and timestamps stay legible on themes with soft muted text.",
				note: "Reel now derives those tones from the theme's own body and page colours instead of trusting a token that some themes set below the readability floor. It keeps the theme's hue — nothing is repainted, only guaranteed.",
			},
			{
				kind: "better",
				text: "Cast and crew names are a full-size tap target.",
			},
		],
	},
	{
		version: "0.8.25",
		date: "2026-08-20",
		headline: "Searching in Stats names the films it found.",
		changes: [
			{
				kind: "new",
				text: "A search on the Stats tab now shows the matching titles as posters, above the numbers.",
				note: "Searching “dog” used to answer “1 film · 1h 39m” — all true, and all derivable from the one thing it would not tell you, which is which film.",
			},
			{
				kind: "better",
				text: "The heatmap reads as marks on a quiet field instead of a wall of beige.",
				note: "Empty days were drawn in the theme's border colour, which on a cream theme is darker than the card it sits on — so 363 empty squares were more visible than the four days that had something on them. Cells are a little larger and rounder too, which also makes them tappable.",
			},
			{
				kind: "fixed",
				text: "The heatmap no longer slices through the first month label at the left edge.",
			},
		],
	},
	{
		version: "0.8.24",
		date: "2026-08-20",
		headline: "Cached artwork stays out of your phone's photo gallery.",
		changes: [
			{
				kind: "fixed",
				text: "Cached posters and portraits no longer appear in Google Photos alongside your own pictures.",
				note: "Nothing was ever uploaded anywhere. Android indexes every image file in shared storage, and a vault is an ordinary folder there, so the cache was being handed to the gallery. Reel now marks that folder as not-media, which is the documented way to opt out.",
			},
			{
				kind: "better",
				text: "Chart bars take the colour of the film behind them instead of a flat block of accent.",
				note: "Every recurring character is in exactly three films, so every bar was three-out-of-three — eight identical full-width slabs that looked like rows selected by accident rather than a chart.",
			},
			{
				kind: "fixed",
				text: "Active filter chips are chip-sized again, and read as one control rather than two welded together.",
				note: "The dismiss half was picking up a background of its own. The tap target is still full size; only the ink shrank.",
			},
			{
				kind: "better",
				text: "Discover shows a title sooner — the taste note and Refresh share a row, and the sections sit closer on a phone.",
			},
		],
	},
	{
		version: "0.8.23",
		date: "2026-08-20",
		headline: "The Rate card takes the colour of the film it is asking about.",
		changes: [
			{
				kind: "new",
				text: "The Rate screen carries the artwork wash, like the detail screen and the sheets.",
				note: "The whole screen is one film and one question about it, so there was nothing else for it to belong to.",
			},
			{
				kind: "better",
				text: "Up Next rows read as cards rather than stripes of text, with the same elevation as everything else.",
				note: "No wash there on purpose: four rows each tinted by their own poster is a list that looks highlighted at random.",
			},
		],
	},
	{
		version: "0.8.22",
		date: "2026-08-20",
		headline: "Every sheet about one title now carries that title's colour.",
		changes: [
			{
				kind: "new",
				text: "The blurred artwork behind the detail screen now sits behind the preview, log and season sheets too.",
				note: "Each of those was a flat panel about a specific film. The poster is blurred and desaturated behind the sheet, with a scrim in your theme's own colour on top, so the sheet takes the film's colour and no text is ever asked to be legible against a photograph.",
			},
			{
				kind: "better",
				text: "The wash is absent rather than grey when a title has no artwork.",
			},
		],
	},
	{
		version: "0.8.21",
		date: "2026-08-20",
		headline: "A typography and materials pass: numbers that line up, surfaces that read as surfaces.",
		changes: [
			{
				kind: "better",
				text: "Every number in the app uses tabular figures, so columns of them line up and a counter no longer shifts what is beside it.",
			},
			{
				kind: "better",
				text: "Large numbers and titles are optically tightened.",
				note: "Type is spaced for reading at body size; the same spacing at 34px looks loose, and no browser tightens it for you.",
			},
			{
				kind: "better",
				text: "Stats tiles keep the hue of the poster but not its intensity.",
				note: "The tint was drawn at whatever saturation the artwork had, so a strongly coloured poster washed the whole page in it. The hue still travels; the chroma is held low.",
			},
			{
				kind: "better",
				text: "Shadows have two stops instead of one, so cards sit on the page instead of looking pasted on.",
			},
			{
				kind: "better",
				text: "Cards, tiles and rows all respond to a press the same way, on one easing curve.",
			},
			{
				kind: "better",
				text: "Sheets arrive on a curve with momentum rather than a symmetrical fade.",
			},
			{
				kind: "fixed",
				text: "The dot between the filter controls is gone.",
				note: "It failed contrast on every colour tried, and the spacing either side of it already said what it said.",
			},
		],
	},
	{
		version: "0.8.20",
		date: "2026-08-20",
		headline: "The Filters button stays put, and sheets stop ending in a band of nothing.",
		changes: [
			{
				kind: "fixed",
				text: "The Filters button no longer scrolls off the row once you have filters set.",
				note: "It sat at the start of a scrolling row, so two or three tags pushed it off the left edge — and the only way back was to delete filters until the row fitted again. It pins to the left now and the tags scroll behind it.",
			},
			{
				kind: "better",
				text: "Filter chips are about half the width they were.",
				note: "Both halves padded themselves out to a full touch target, so a chip was 200px wide before its label had said anything and two of them filled the screen.",
			},
			{
				kind: "fixed",
				text: "Sheets no longer end with a deep band of empty space below the buttons.",
				note: "Clearance added in 0.8.18 to stop content showing under the sticky bar was still being applied after 0.8.19 fixed the cause, so every sheet carried two copies of it.",
			},
			{
				kind: "better",
				text: "A long list name in a filter chip is truncated instead of taking the whole row.",
			},
		],
	},
	{
		version: "0.8.19",
		date: "2026-08-20",
		headline: "Films you marked watched without a date were missing from their own filter.",
		changes: [
			{
				kind: "fixed",
				text: "Filtering by watched now finds every film you have marked watched, not only the ones with a logged date.",
				note: "A film matched only if it had watch dates recorded, so anything imported or ticked off without one fell out of its own filter \u2014 which is why selecting watched, watching and completed returned far fewer titles than the library holds.",
			},
			{
				kind: "better",
				text: "Tapping an active filter chip opens the filters. Only its x removes it.",
				note: "The whole chip used to clear the filter, so tapping the one filter-shaped thing on screen deleted a filter instead of letting you change it.",
			},
			{
				kind: "fixed",
				text: "The Discover preview sheet keeps its buttons at the bottom, below everything else.",
				note: "The bar is sticky, and content loaded afterwards landed underneath it \u2014 so the IMDb row sat below the buttons at the screen edge and the cast names were sliced through the middle.",
			},
			{
				kind: "better",
				text: "IMDb, Parents guide and TMDB read as links rather than as three tall ovals.",
			},
			{
				kind: "better",
				text: "The three preview actions are equal width, so Not interested looks like the button it is.",
			},
			{
				kind: "fixed",
				text: "Cast members with no photograph get a visible circle instead of floating initials.",
			},
		],
	},
	{
		version: "0.8.18",
		date: "2026-08-20",
		headline: "Filters let you pick more than one thing, and the episode list stopped overlapping itself.",
		changes: [
			{
				kind: "better",
				text: "Filters are multi-select: tick as many genres, statuses and lists as you like.",
				note: "Each section only held one value, so choosing Comedy silently replaced Action \u2014 the chips looked like checkboxes and behaved like a radio group.",
			},
			{
				kind: "fixed",
				text: "The filter sheet keeps your place when you tick something.",
				note: "Every tap rebuilt the whole sheet, which threw you back to the top \u2014 so picking a second genre meant scrolling down to find it again.",
			},
			{
				kind: "new",
				text: "The filter sheet has a foot that counts: \u201cShow 34 titles\u201d, and closes when you press it.",
				note: "There was no confirm at all, so the only way out was the x in the corner, which reads as cancel.",
			},
			{
				kind: "fixed",
				text: "The filter sheet no longer cuts the genre list off mid-row.",
				note: "The list was its own scroller inside a sheet that already scrolls, so it ended early and left a band of empty sheet below it.",
			},
			{
				kind: "fixed",
				text: "Removing one filter leaves the rest alone \u2014 each value has its own x in the bar.",
			},
			{
				kind: "fixed",
				text: "The episode checklist no longer draws each row on top of the next one.",
				note: "Every row was squeezed to 48px while holding 87px of content, so each one painted its star strip over the title below it.",
			},
			{
				kind: "better",
				text: "Episode rows put the date and the stars on one line, and the tick has a full-size target.",
			},
			{
				kind: "fixed",
				text: "Sheet buttons reach the bottom of the sheet, instead of leaving a strip where content scrolled past underneath.",
			},
			{
				kind: "fixed",
				text: "Links like Read more, IMDb and Parents guide stopped drawing a pale capsule around themselves.",
				note: "They are buttons that had never reset the button styling, which on a light theme reads as brackets and in dark mode left pale text on a pale slab \u2014 1.23:1.",
			},
			{
				kind: "fixed",
				text: "A long credit no longer stretches the whole row on a person\u2019s filmography.",
			},
			{
				kind: "better",
				text: "Faint grey text is gone from labels, placeholders, credits, years and counters.",
				note: "The seventh time this has come up: --text-faint is a hairline colour at about 2.85:1, and it was being used wherever something wanted to be quiet.",
			},
			{
				kind: "better",
				text: "Cast and character names are at least 12px, and the Discover and preview controls are full-size targets.",
			},
		],
	},
	{
		version: "0.8.17",
		date: "2026-08-20",
		headline: "The stars on the Rate tab look like something you can press.",
		changes: [
			{
				kind: "better",
				text: "The five stars on the Rate card are legible and respond to a press.",
				note: "They were drawn in a border colour, so the one control the whole tab exists for was the palest thing on the screen and read as disabled.",
			},
			{
				kind: "fixed",
				text: "The keyboard hint under the Rate card is readable on a wide pane.",
			},
		],
	},
	{
		version: "0.8.16",
		date: "2026-08-20",
		headline: "The fix for long titles now covers the Upcoming rows too.",
		changes: [
			{
				kind: "fixed",
				text: "Upcoming episode rows can truncate a long series name properly, like Up Next already could.",
				note: "Those rows are built in a different file from the ones above them, so last release's fix reached only half of them.",
			},
		],
	},
	{
		version: "0.8.15",
		date: "2026-08-20",
		headline: "The Diary tab catches up with the Diary block it had quietly fallen behind.",
		changes: [
			{
				kind: "fixed",
				text: "Diary rows can be reached and activated from a keyboard, and announce the title, date and rating.",
				note: "The same list is drawn by the diary block and by the Diary tab, and only the block had ever been given those. The tab announced each of four hundred rows as nothing at all.",
			},
			{
				kind: "better",
				text: "Diary rows show the release year beside the title, and a series shows which episode the entry was for.",
			},
		],
	},
	{
		version: "0.8.14",
		date: "2026-08-20",
		headline: "A long series name in Up Next ends in an ellipsis instead of stopping mid-word.",
		changes: [
			{
				kind: "fixed",
				text: "Series titles that do not fit now end in “…” on the Up Next screen.",
				note: "The title was cut mid-word with no ellipsis, which reads as a name stored wrong rather than as text that did not fit.",
			},
		],
	},
	{
		version: "0.8.13",
		date: "2026-08-20",
		headline: "The cast strip lines up, and Remove stops looking like Refresh.",
		changes: [
			{
				kind: "fixed",
				text: "Cast tiles are all the same height.",
				note: "Nothing in a tile was clamped, so an ordinary-length character name wrapped to four lines inside a 76px column and the strip read as debris rather than a row of people.",
			},
			{
				kind: "better",
				text: "Remove is quieter than the buttons above it, and only turns red when it asks you to confirm.",
				note: "The one button on the screen that deletes a note looked exactly like the one that reloads it.",
			},
		],
	},
	{
		version: "0.8.12",
		date: "2026-08-20",
		headline: "The year heatmap reads as one scale, and its labels are legible.",
		changes: [
			{
				kind: "fixed",
				text: "Your busiest day is drawn in the same colour as the rest of the heatmap.",
				note: "The top step used Obsidian's accent instead of the page's, so one square came out purple in a field of green and read as an error or a selection.",
			},
			{
				kind: "fixed",
				text: "The month labels above the heatmap are readable, and the “+7 more” on a poster strip has enough contrast to see.",
			},
		],
	},
	{
		version: "0.8.11",
		date: "2026-08-20",
		headline: "On Stats, colour goes back to meaning one thing.",
		changes: [
			{
				kind: "better",
				text: "An open section's header is no longer tinted, so the bars are the only coloured thing on the page.",
				note: "A bar is longer because there is more of it. The header was using the same colour to say something else, and expanded sections read as one block of tint with the bars lost inside it.",
			},
			{
				kind: "better",
				text: "A section's heading leads it, and its first row no longer butts against it.",
			},
		],
	},
	{
		version: "0.8.10",
		date: "2026-08-20",
		headline: "Reel behaves like a phone app: taps respond instantly, sheets have a grabber, and nothing scrolls the page behind it.",
		changes: [
			{
				kind: "better",
				text: "Taps register immediately instead of pausing first.",
				note: "A browser holds every tap for a third of a second in case a second one means “zoom”. That delay is most of why a phone web page feels slower than an app.",
			},
			{
				kind: "better",
				text: "Buttons and posters respond the moment your finger lands.",
				note: "The grey flash was suppressed in fifteen places and nothing put in its place, so a tap that worked looked like a tap that missed.",
			},
			{
				kind: "better",
				text: "Bottom sheets have a grabber, and dragging past the end of one no longer scrolls the library behind it.",
			},
			{
				kind: "fixed",
				text: "Holding a button no longer selects its label and raises the copy bar over it.",
			},
			{
				kind: "better",
				text: "Stats tiles are tighter, and the arrow that means “this opens” sits against the right edge rather than floating in a corner.",
			},
		],
	},
	{
		version: "0.8.9",
		date: "2026-08-20",
		headline: "Sheets fit the screen they are on, so the passphrase box is where you can see it.",
		changes: [
			{
				kind: "fixed",
				text: "The passphrase prompt stays on screen with the keyboard up.",
				note: "A sheet was allowed to be 88% of the whole screen while half of it was showing, so it overflowed off the top and took the field with it.",
			},
			{
				kind: "better",
				text: "A sheet's buttons ride its bottom edge while the rest scrolls, instead of sitting at the end of the content.",
				note: "With the keyboard up, the log sheet's Save button was 240 pixels below the fold on a sheet that cannot be scrolled clear.",
			},
			{
				kind: "better",
				text: "Reel is now checked with the keyboard open, not only at rest.",
				note: "Four separate “I can't see it, the keyboard is over it” faults had shipped, and none of them could fail a test.",
			},
		],
	},
	{
		version: "0.8.8",
		date: "2026-08-20",
		headline: "Reel tells you what it changed, and Stats reads like a page rather than a pile of numbers.",
		changes: [
			{
				kind: "new",
				text: "This screen. After an update, Reel shows what changed since the version you were on.",
				note: "Reel updates through BRAT, which swaps the file out silently. Everything fixed here was something you reported, and there was no way to tell it had landed.",
			},
			{
				kind: "new",
				text: "“What's new in Reel” is a command, so you can reread any release rather than only catching it once.",
			},
			{
				kind: "better",
				text: "Stats headline numbers sit on their own cards with the unit beside them, instead of running together as one block of digits.",
			},
			{
				kind: "better",
				text: "Every chart row now shows its share as a bar you can compare at a glance, with the count kept in line down the right.",
			},
			{
				kind: "better",
				text: "The collapsed sections say what is inside them before you open them.",
			},
		],
	},
	{
		version: "0.8.7",
		date: "2026-08-20",
		headline: "The search box stops fighting Obsidian's floating + button.",
		changes: [
			{
				kind: "fixed",
				text: "The + button no longer sits on top of the search field.",
				note: "Reel was looking for a full-width toolbar and a round corner button never matched, so it measured nothing to avoid.",
			},
			{
				kind: "fixed",
				text: "The magnifier no longer prints over the first characters you type.",
			},
			{
				kind: "fixed",
				text: "One search box, with one border, instead of a box drawn inside a box.",
			},
			{
				kind: "fixed",
				text: "Search results fill the screen instead of showing one clipped row above a large empty space.",
				note: "Opening the keyboard shrank the screen mid-draw and Reel kept the small measurement it took at that moment.",
			},
		],
	},
	{
		version: "0.8.6",
		date: "2026-08-20",
		headline: "The search field docks above the keyboard and stays there.",
		changes: [
			{
				kind: "better",
				text: "While searching, the field sits just above the keyboard, the way Obsidian's own search does.",
			},
			{
				kind: "fixed",
				text: "The field no longer stretches past the edge of the screen with its left end cut off.",
			},
			{ kind: "fixed", text: "It stops springing open from a squash every time it is drawn." },
		],
	},
	{
		version: "0.8.5",
		date: "2026-08-19",
		headline: "Undo puts the poster back, and the sheet you use most stops being a grey box.",
		changes: [
			{
				kind: "fixed",
				text: "Undoing a rating returns the title to Discover instead of leaving a gap where it was.",
			},
			{
				kind: "better",
				text: "The “seen it” sheet shows the poster, the year and what your rating means in words.",
			},
		],
	},
	{
		version: "0.8.4",
		date: "2026-08-19",
		headline: "Stats gets colour drawn from your own posters.",
		changes: [
			{ kind: "better", text: "Cards and charts tint towards the artwork of what you have been watching." },
			{ kind: "new", text: "A year-at-a-glance heatmap. Tap any day to see what you watched." },
		],
	},
	{
		version: "0.8.3",
		date: "2026-08-19",
		headline: "The doubled star, the review you could not see, and typing at the bottom of the screen.",
		changes: [
			{
				kind: "fixed",
				text: "Stars are one star each. Half ratings fill by clipping rather than by shrinking the glyph.",
				note: "The filled star was drawn beside the empty one rather than over it, everywhere stars appear.",
			},
			{
				kind: "fixed",
				text: "The review box sits above the rating controls, so the keyboard cannot cover what you are writing.",
			},
		],
	},
	{
		version: "0.8.2",
		date: "2026-08-18",
		headline: "One row of controls, three ways to see a library, and the review where you look for it.",
		changes: [
			{ kind: "new", text: "Posters, Dense and List layouts, remembered between sessions." },
			{ kind: "better", text: "Filters, sort and search share a single row instead of stacking three deep." },
			{ kind: "new", text: "Your review appears on the detail screen, and can be edited from there." },
		],
	},
	{
		version: "0.8.1",
		date: "2026-08-18",
		headline: "The artwork band goes on every tab, and the diary stops reading four hundred notes.",
		changes: [
			{ kind: "better", text: "Every tab opens on artwork from your library rather than on a bare list." },
			{ kind: "fixed", text: "The diary reads notes as you scroll to them, so the first screen appears at once." },
		],
	},
	{
		version: "0.8.0",
		date: "2026-08-17",
		headline: "A feed that does not end, a search that means the same thing everywhere, and your own reviews.",
		changes: [
			{
				kind: "new",
				text: "Discover keeps going. Rows extend as you reach them and new ones load underneath, with a reroll for a different set.",
			},
			{ kind: "new", text: "The same search works on every tab, and can be filtered like the library." },
			{ kind: "new", text: "Reviews are read out of your notes and shown wherever the title is." },
		],
	},
];

/** `1` if `a` is newer than `b`, `-1` if older, `0` if the same. */
export function compareVersions(a: string, b: string): number {
	const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
	const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const d = (pa[i] ?? 0) - (pb[i] ?? 0);
		if (d) return d > 0 ? 1 : -1;
	}
	return 0;
}

/**
 * Everything released after the version last seen.
 *
 * An empty `since` means this install has never recorded one. That is either a
 * first run or an upgrade from before this screen existed, and in both cases
 * the whole file would be a wall of text about releases the reader may never
 * have run. Only the newest is shown.
 */
export function releasesSince(since: string, all: Release[] = RELEASES): Release[] {
	if (!since) return all.slice(0, 1);
	return all.filter((r) => compareVersions(r.version, since) > 0);
}

/** The newest release described here, which must be the one being shipped. */
export function latestRelease(all: Release[] = RELEASES): Release | null {
	return all[0] ?? null;
}
