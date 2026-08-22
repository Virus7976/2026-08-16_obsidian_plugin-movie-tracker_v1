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
