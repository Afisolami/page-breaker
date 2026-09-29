# Page Breaker

Page Breaker is a full-screen arcade launcher that turns a pasted public website into a brick-breaker level.

## Add it to a website

```html
<iframe src="https://page-breaker-game.tact-studios0.chatgpt.site" title="Page Breaker" allow="autoplay" style="width:100%;height:720px;border:0"></iframe>
```

The launcher also exposes this snippet through its **Embed** control. Add `?url=example.com` to load a particular public page immediately.

The server loads a safe, inert copy of the target page. Scripts and active navigation are removed, while form contents and sandboxed embeds remain visible. Lazy images, responsive image sets, fonts, video, and background media are promoted before play.

Text fragments, controls, images, videos, icons, canvases, decorative surfaces, and even thin borders become collision targets. The level auto-scrolls after a cleared viewport, while manual scrolling remains available. The paddle and every active ball sample the section directly behind them and switch instantly between black and white for maximum contrast.
