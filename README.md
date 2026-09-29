# Page Breaker

Page Breaker is a zero-dependency website embed that turns the current viewport into a brick-breaker level.

## Add it to a website

```html
<script src="https://page-breaker-game.tact-studios0.chatgpt.site/embed.js" data-pagebreaker-launcher="true"></script>
```

The script adds a floating launcher. A link with `?pagebreaker=1` starts the game automatically, and `window.PageBreaker.start()` can launch it from a custom control.

The game reads the host page’s computed background and accent colors, selects accessible game colors, converts visible content into collision targets, and restores the page when the game closes.
