/**
 * Legal pages — TOC scrollspy + Print/Email actions.
 *
 * Scrollspy: highlights the current section in the sticky TOC as the
 * user scrolls. Uses IntersectionObserver with a top-weighted root
 * margin so the active item updates when a heading crosses the upper
 * 20% of the viewport, not when it briefly intersects the bottom.
 *
 * Actions:
 *   .legal-action[data-action="print"] → window.print()
 *   .legal-action[data-action="email"] → mailto: with current URL
 *
 * Stand-alone (no engine dependency) so the legal pages stay light.
 */
(function () {
  'use strict';

  /* ----- Scrollspy ----- */
  var sections = document.querySelectorAll('.legal-section');
  var tocLinks = document.querySelectorAll('.legal-toc-item a');
  var linkById = Object.create(null);
  tocLinks.forEach(function (a) {
    var href = a.getAttribute('href') || '';
    if (href.charAt(0) === '#') linkById[href.slice(1)] = a;
  });

  function setActive(id) {
    tocLinks.forEach(function (l) { l.classList.remove('active'); });
    if (linkById[id]) linkById[id].classList.add('active');
  }

  if ('IntersectionObserver' in window && sections.length) {
    var observer = new IntersectionObserver(function (entries) {
      // Pick the topmost intersecting section as active.
      var top = null;
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var rect = e.target.getBoundingClientRect();
        if (top === null || rect.top < top.rect.top) top = { el: e.target, rect: rect };
      });
      if (top) setActive(top.el.id);
    }, { rootMargin: '-20% 0% -70% 0%', threshold: 0 });
    sections.forEach(function (s) { observer.observe(s); });
  }

  /* ----- Smooth scroll on TOC click (accounting for sticky nav) ----- */
  tocLinks.forEach(function (a) {
    a.addEventListener('click', function (e) {
      var href = a.getAttribute('href') || '';
      if (href.charAt(0) !== '#') return;
      var target = document.getElementById(href.slice(1));
      if (!target) return;
      e.preventDefault();
      var top = target.getBoundingClientRect().top + window.pageYOffset - 80;
      window.scrollTo({ top: top, behavior: 'smooth' });
      history.replaceState(null, '', href);
    });
  });

  /* ----- Action buttons ----- */
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('.legal-action');
    if (!btn) return;
    var action = btn.getAttribute('data-action');
    if (action === 'print') {
      e.preventDefault();
      window.print();
    } else if (action === 'email') {
      e.preventDefault();
      var title = document.title.replace(/\s+·.*$/, '');
      var url = window.location.href.split('#')[0];
      var subject = encodeURIComponent('DOLPHLINK — ' + title);
      var body = encodeURIComponent('Reference: ' + url + '\n\n');
      window.location.href = 'mailto:?subject=' + subject + '&body=' + body;
    } else if (action === 'copy') {
      e.preventDefault();
      var url2 = window.location.href.split('#')[0];
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url2).then(function () {
          var orig = btn.querySelector('span').textContent;
          btn.querySelector('span').textContent = 'Copied';
          setTimeout(function () { btn.querySelector('span').textContent = orig; }, 1600);
        });
      }
    }
  });
})();
