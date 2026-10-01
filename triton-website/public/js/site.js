/* Triton Landscaping – site behaviour: menu, saved edits, gallery viewer, quote form */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var DEFAULT_PHONE = '0423 307 052';

  var Triton = window.Triton = { content: {}, defaults: { texts: {}, gallery: [] } };

  /* ---------- Menu ---------- */
  var menuBtn = $('#menu-btn'), menu = $('#menu');
  function setMenu(open) {
    if (!menuBtn) return;
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    $('.menu-label', menuBtn).textContent = open ? 'Close' : 'Menu';
    menu.hidden = !open;
    document.documentElement.classList.toggle('no-scroll', open);
  }
  if (menuBtn) {
    menuBtn.addEventListener('click', function () { setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'); });
    $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
  }
  $$('.year').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- Photo resizing (used by the quote form and the editor) ---------- */
  Triton.resizeImage = function (file, max, quality) {
    max = max || 1600; quality = quality || 0.82;
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, s = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas');
        c.width = Math.round(w * s); c.height = Math.round(h * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error('encode')); }, 'image/jpeg', quality);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  };

  /* ---------- Saved edits ---------- */
  function digits(s) { return String(s || '').replace(/[^\d+]/g, ''); }

  Triton.syncPhone = function (phone) {
    var tel = 'tel:' + (digits(phone) || digits(DEFAULT_PHONE));
    $$('a[data-tel]').forEach(function (a) { a.href = tel; });
  };

  Triton.apply = function (c) {
    c = c || {};
    var texts = c.texts || {}, images = c.images || {}, links = c.links || {};
    $$('[data-edit]').forEach(function (el) {
      var k = el.getAttribute('data-edit');
      if (typeof texts[k] === 'string' && texts[k] !== Triton.defaults.texts[k]) {
        el.textContent = texts[k];
        el.classList.remove('ph');
      }
    });
    $$('[data-img]').forEach(function (el) {
      var k = el.getAttribute('data-img');
      if (images[k]) { el.src = images[k]; el.removeAttribute('srcset'); }
    });
    $$('[data-link]').forEach(function (el) {
      var k = el.getAttribute('data-link');
      if (links[k]) { el.href = links[k]; el.classList.toggle('ph', links[k] === '#'); }
    });
    Triton.syncPhone(texts.phone || DEFAULT_PHONE);
    if (Array.isArray(c.gallery) && $('#gallery')) Triton.renderGallery(c.gallery);
  };

  // Remember the original text of every editable element
  $$('[data-edit]').forEach(function (el) {
    var k = el.getAttribute('data-edit');
    if (!(k in Triton.defaults.texts)) Triton.defaults.texts[k] = el.textContent;
  });

  /* ---------- Gallery ---------- */
  var galleryEl = $('#gallery');
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  Triton.galleryList = [];
  if (galleryEl) {
    Triton.defaults.gallery = $$('.g-item img', galleryEl).map(function (img) {
      return { src: img.getAttribute('src'), alt: img.getAttribute('alt') || '' };
    });
    Triton.galleryList = Triton.defaults.gallery.slice();
  }
  Triton.renderGallery = function (list) {
    Triton.galleryList = list.slice();
    galleryEl.innerHTML = list.map(function (p, i) {
      return '<button class="g-item" type="button" data-i="' + i + '"><img src="' + esc(p.src) + '" alt="' +
        esc(p.alt || 'Triton Landscaping job photo') + '" loading="lazy" decoding="async"></button>';
    }).join('');
    if (Triton.onGalleryRender) Triton.onGalleryRender();
  };

  /* ---------- Full-screen photo viewer (swipe on iPhone) ---------- */
  var lb = $('#lightbox');
  if (lb && galleryEl) {
    var track = $('#lb-track'), count = $('#lb-count'), current = 0, lastFocus = null, scrollTimer;
    var show = function (i, smooth) {
      var n = Triton.galleryList.length;
      current = Math.max(0, Math.min(n - 1, i));
      track.scrollTo({ left: current * track.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
      count.textContent = (current + 1) + ' / ' + n;
    };
    var open = function (i) {
      lastFocus = document.activeElement;
      track.innerHTML = Triton.galleryList.map(function (p) {
        return '<div class="lb-slide"><img src="' + esc(p.src) + '" alt="' + esc(p.alt || '') + '" draggable="false"></div>';
      }).join('');
      lb.hidden = false;
      document.documentElement.classList.add('no-scroll');
      requestAnimationFrame(function () { show(i, false); });
      $('.lb-close', lb).focus({ preventScroll: true });
    };
    var close = function () {
      lb.hidden = true; track.innerHTML = '';
      document.documentElement.classList.remove('no-scroll');
      if (lastFocus) lastFocus.focus({ preventScroll: true });
    };
    galleryEl.addEventListener('click', function (e) {
      var item = e.target.closest('.g-item');
      if (!item || document.documentElement.classList.contains('editing')) return;
      open(+item.getAttribute('data-i'));
    });
    track.addEventListener('scroll', function () {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function () {
        current = Math.round(track.scrollLeft / track.clientWidth);
        count.textContent = (current + 1) + ' / ' + Triton.galleryList.length;
      }, 60);
    }, { passive: true });
    $('.lb-close', lb).addEventListener('click', close);
    $('.lb-prev', lb).addEventListener('click', function () { show(current - 1, true); });
    $('.lb-next', lb).addEventListener('click', function () { show(current + 1, true); });
    window.addEventListener('resize', function () { if (!lb.hidden) show(current, false); });
    document.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') show(current + 1, true);
      if (e.key === 'ArrowLeft') show(current - 1, true);
    });
  }

  /* ---------- Home: pick jobs, then go to the quote form ---------- */
  var qqNext = $('#qq-next');
  if (qqNext) {
    var updateNext = function () {
      var picked = $$('.qq-opt[aria-pressed="true"]').map(function (b) { return b.getAttribute('data-i'); });
      qqNext.href = 'contact.html' + (picked.length ? '?work=' + picked.join('.') : '') + '#quote';
    };
    $$('.qq-opt').forEach(function (b) {
      b.addEventListener('click', function () {
        if (document.documentElement.classList.contains('editing')) return;
        b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
        updateNext();
      });
    });
    updateNext();
  }

  /* ---------- Quote form ---------- */
  var form = $('#quote-form');
  if (form) {
    var MAX_PHOTOS = 5, photos = [], thanks = $('#thanks'), errBox = $('#form-error');
    var picker = $('#photo-picker'), previews = $('#previews'), submitBtn = $('#submit-btn');
    var otherBox = $('#work-other'), otherField = $('#other-field');

    var showThanks = function () {
      form.hidden = true; thanks.hidden = false;
      thanks.scrollIntoView({ block: 'center' }); thanks.focus({ preventScroll: true });
    };
    if (/[?&]sent=1/.test(location.search)) showThanks();
    // Jobs picked on the home page arrive as ?work=1.3.o
    var pre = /[?&]work=([\w.]+)/.exec(location.search);
    if (pre) {
      var boxes = $$('[data-work]');
      pre[1].split('.').forEach(function (v) {
        var box = v === 'o' ? $('#work-other') : boxes[parseInt(v, 10) - 1];
        if (box) box.checked = true;
      });
      if ($('#work-other').checked) $('#other-field').hidden = false;
    }

    otherBox.addEventListener('change', function () {
      otherField.hidden = !otherBox.checked;
      if (otherBox.checked) $('#f-other').focus();
    });

    var renderPreviews = function () {
      previews.innerHTML = '';
      photos.forEach(function (p, i) {
        var li = document.createElement('li');
        li.innerHTML = p.url ? '<img alt="Photo ' + (i + 1) + '">' : '<span class="busy">Adding…</span>';
        if (p.url) li.firstChild.src = p.url;
        var rm = document.createElement('button');
        rm.type = 'button'; rm.setAttribute('aria-label', 'Remove photo ' + (i + 1));
        rm.innerHTML = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
        rm.addEventListener('click', function () {
          if (p.url) URL.revokeObjectURL(p.url);
          photos.splice(photos.indexOf(p), 1); renderPreviews();
        });
        li.appendChild(rm); previews.appendChild(li);
      });
      $('.upload-btn span').textContent = photos.length ? 'Add more photos' : 'Add photos';
      $('.upload-btn').style.display = photos.length >= MAX_PHOTOS ? 'none' : '';
    };

    picker.addEventListener('change', function () {
      var files = Array.prototype.slice.call(picker.files || []);
      picker.value = '';
      var room = MAX_PHOTOS - photos.length;
      if (files.length > room) showError('You can add up to ' + MAX_PHOTOS + ' photos. We added the first ' + room + '.');
      files.slice(0, room).forEach(function (file) {
        var p = { blob: null, url: null };
        photos.push(p);
        Triton.resizeImage(file, 1600, 0.8).then(function (blob) {
          p.blob = blob; p.url = URL.createObjectURL(blob); renderPreviews();
        }).catch(function () {
          photos.splice(photos.indexOf(p), 1); renderPreviews();
          showError('One of those photos couldn’t be added. Please try a different photo.');
        });
      });
      renderPreviews();
    });

    function showError(msg) {
      errBox.textContent = msg; errBox.hidden = false;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (document.documentElement.classList.contains('editing')) return;
      errBox.hidden = true;
      if (photos.some(function (p) { return !p.blob; })) { showError('Photos are still being added – please wait a moment.'); return; }

      $('#type-of-work').value = $$('[data-work]:checked').map(function (c) {
        return c.value === 'Other' ? 'Other' : c.parentNode.textContent.trim();
      }).join(', ');

      var fd = new FormData(form);
      for (var i = 1; i <= MAX_PHOTOS; i++) fd.delete('photo' + i);
      photos.forEach(function (p, i) { fd.append('photo' + (i + 1), p.blob, 'photo-' + (i + 1) + '.jpg'); });

      var label = submitBtn.querySelector('[data-edit]'), original = label.textContent;
      submitBtn.disabled = true; label.textContent = 'Sending…';
      fetch('/', { method: 'POST', body: fd })
        .then(function (r) { if (!r.ok) throw new Error(r.status); showThanks(); })
        .catch(function () {
          var phone = ($('[data-edit="phone"]') || {}).textContent || DEFAULT_PHONE;
          showError('Sorry, your request didn’t send. Please check your internet connection and try again, or call us on ' + phone + '.');
        })
        .then(function () { submitBtn.disabled = false; label.textContent = original; });
    });
  }

  /* ---------- Load saved edits, then show the page ---------- */
  var revealed = false;
  function reveal() {
    if (revealed) return; revealed = true;
    document.documentElement.classList.remove('cms-wait');
  }
  setTimeout(reveal, 1500);

  var token = null;
  try { token = localStorage.getItem('tritonToken'); } catch (e) {}

  fetch('/api/content', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : {}; })
    .catch(function () { return {}; })
    .then(function (c) {
      Triton.content = (c && typeof c === 'object') ? c : {};
      try { Triton.apply(Triton.content); } catch (e) { console.error(e); }
      reveal();
      if (token) {
        var s = document.createElement('script');
        s.src = 'js/editor.js'; document.body.appendChild(s);
      }
    });
})();
