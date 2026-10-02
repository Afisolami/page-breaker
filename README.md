# Page Breaker

Page Breaker is a full-screen arcade launcher that turns a pasted public website into a brick-breaker level.

## Add it to a website

```html
<iframe src="https://page-breaker-game.tact-studios0.chatgpt.site" title="Page Breaker" allow="autoplay" style="width:100%;height:720px;border:0"></iframe>
```

The launcher also exposes this snippet through its **Embed** control. Add `?url=example.com` to load a particular public page immediately.

The server loads a safe, inert copy of the target page. Scripts and active navigation are removed, while form contents and sandboxed embeds remain visible. Lazy images, responsive image sets, fonts, video, and background media are promoted before play.

Every visible word is wrapped as its own one-hit target. Controls, images, videos, icons, canvases, decorative surfaces, and thin borders are also destroyed one element at a time. A hit produces one short fall with restrained particles—there is no multi-hit cracking phase.

Collision targets are invisible until they break. The loaded website retains its natural appearance with no target boxes, skeleton lines, or debug highlighting.

Power-ups fall from destroyed content. ×2 doubles every ball currently in play and later returns the game to one ball. Bombs make ball impacts destroy a nearby cluster of page elements, while wide-paddle, bottom-shield, and extra-life pickups add short arcade advantages.

When the cleared gap at the top reaches roughly 10% of the viewport, the page scrolls upward to replace that empty space; fully cleared screens still advance automatically, and manual scrolling remains available. The paddle and every active ball sample the section directly behind them and switch instantly between black and white for maximum contrast.

The tracker, score, and game controls fade away after five seconds without pointer activity. Moving the pointer, touching the game, or using the keyboard reveals them again.
