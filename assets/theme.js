// Day and night: a visitor's choice is remembered on this device; until they choose, the
// device setting applies. Loaded in <head> so the page never flashes the wrong colours.
(function () {
  const KEY = 'crowd-theme';
  const root = document.documentElement;
  let saved = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch (error) {
    // Storage can be blocked (private windows); the device setting still applies.
  }
  if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;

  const current = () => root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const label = (button) => {
    const text = current() === 'dark' ? 'Switch to day mode' : 'Switch to night mode';
    button.setAttribute('aria-label', text);
    button.title = text;
  };

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.theme-toggle').forEach((button) => {
      label(button);
      button.addEventListener('click', () => {
        const next = current() === 'dark' ? 'light' : 'dark';
        root.dataset.theme = next;
        try {
          localStorage.setItem(KEY, next);
        } catch (error) {
          // Not remembered, but the switch still works for this visit.
        }
        label(button);
      });
    });
  });
})();
