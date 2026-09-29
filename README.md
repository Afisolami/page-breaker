# Page Breaker

Page Breaker is a full-screen arcade launcher that turns a pasted public website into a brick-breaker level.

## Add it to a website

```html
<iframe src="https://page-breaker-game.tact-studios0.chatgpt.site" title="Page Breaker" allow="autoplay" style="width:100%;height:720px;border:0"></iframe>
```

The launcher also exposes this snippet through its **Embed** control. Add `?url=example.com` to load a particular public page immediately.

The server loads a safe, inert copy of the target page. Scripts, forms, frames, and interactive navigation are removed before play. Page content becomes collision targets; the level auto-scrolls after a cleared viewport, while manual scrolling remains available. Paddle and ball colors adapt to the page theme.
