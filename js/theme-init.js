/* Runs in <head> before the page paints, so the saved theme is applied
   without a flash. Falls back to the system setting if nothing is saved
   or if storage is blocked. */
(function () {
  var theme = null;
  try { theme = localStorage.getItem("yc-theme"); } catch (e) { /* storage blocked */ }
  if (theme !== "light" && theme !== "dark") {
    theme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  document.documentElement.setAttribute("data-theme", theme);
})();
