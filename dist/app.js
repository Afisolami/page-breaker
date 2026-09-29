(() => {
  const form = document.querySelector("#url-form");
  const input = document.querySelector("#site-url");
  const note = document.querySelector("#url-note");
  const panel = document.querySelector("#install-panel");
  const siteChip = document.querySelector("#site-chip");
  const embedCode = document.querySelector("#embed-code");
  const playLink = document.querySelector("#play-link");
  const openLink = document.querySelector("#open-link");
  const toast = document.querySelector("#toast");
  const appScript = [...document.scripts].find((script) => script.src.endsWith("/app.js"));
  const scriptOrigin = new URL(appScript?.src || location.href).origin;
  let currentCode = "";
  let currentLink = "";
  let toastTimer = null;

  function normalizeUrl(value) {
    const candidate = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
    const url = new URL(candidate);
    if (!url.hostname.includes(".") && url.hostname !== "localhost") throw new Error("Enter a full website address");
    url.hash = "";
    return url;
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
  }

  async function copy(text, success) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    showToast(success);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const url = normalizeUrl(input.value);
      url.searchParams.set("pagebreaker", "1");
      currentLink = url.toString();
      currentCode = `<script src="${scriptOrigin}/embed.js" data-pagebreaker-launcher="true"><\/script>`;
      embedCode.textContent = currentCode;
      playLink.textContent = currentLink;
      openLink.href = currentLink;
      siteChip.textContent = url.hostname;
      note.classList.remove("error");
      note.textContent = "Your install code and playable link are ready.";
      panel.hidden = false;
      requestAnimationFrame(() => panel.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (error) {
      note.classList.add("error");
      note.textContent = error.message || "Enter a valid website address.";
      input.focus();
    }
  });

  document.querySelector("#copy-code").addEventListener("click", () => copy(currentCode, "Embed code copied"));
  document.querySelector("#copy-link").addEventListener("click", () => copy(currentLink, "Playable link copied"));
  document.querySelectorAll("#demo-button-top, #demo-button-bottom").forEach((button) => button.addEventListener("click", () => window.PageBreaker?.start()));
})();
