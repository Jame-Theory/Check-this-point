// List of YouTube recommendation elements to hide
const selectorsToHide = [
  '#related', // Sidebar related videos
  'ytd-watch-next-secondary-results-renderer', // Suggested videos below main
  'ytd-compact-autoplay-renderer', // Autoplay up next
  'ytp-endscreen-content', // Endscreen suggestions
  'ytd-rich-grid-renderer', // Home page video grid
  'a#endpoint[title="Shorts"]',
  'ytp-endscreen-content',
];

function hideRecommendations() {
  selectorsToHide.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      el.style.display = 'none';
    });
  });
    if (location.pathname.startsWith('/shorts')) {
    window.location.href = 'https://www.youtube.com';
  }
}

hideRecommendations();

const observer = new MutationObserver(() => {
  hideRecommendations();
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});