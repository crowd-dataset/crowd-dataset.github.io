// Every short clip on the page (the strip under the hero and the curation examples). Each loads
// only when it scrolls into view and plays only while visible, so at most a handful decode at
// once. With reduced motion or data saving on, the posters stay still.
(function () {
  const videos = [...document.querySelectorAll('video[data-src]')];
  if (!videos.length || !('IntersectionObserver' in window)) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches || navigator.connection?.saveData;
  if (still) return;

  const play = (video) => {
    if (!video.src) video.src = video.dataset.src;
    const attempt = video.play();
    if (attempt) attempt.catch(() => {});  // autoplay refused: the poster stays
  };

  const onScreen = new Set();
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (isIntersecting) onScreen.add(target);
      else onScreen.delete(target);
      if (isIntersecting && !document.hidden) play(target);
      else target.pause();
    });
  }, { rootMargin: '0px 120px', threshold: 0.2 });
  videos.forEach((video) => observer.observe(video));

  // Pause in a background tab; on return, resume what is on screen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) videos.forEach((video) => video.pause());
    else onScreen.forEach(play);
  });
})();
