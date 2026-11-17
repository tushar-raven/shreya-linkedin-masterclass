(() => {
  'use strict';
  const base = window.MASTERCLASS_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  let config = { ...base };
  $('#year').textContent = new Date().getFullYear();

  /* ---------- Countdown ---------- */
  const fmt = (date, zone) => {
    try {
      return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: zone, timeZoneName: 'short' }).format(date);
    } catch (_) { return date.toLocaleString(); }
  };
  const pad = (n) => String(n).padStart(2, '0');
  function renderCountdown() {
    const target = new Date(config.eventDate);
    const valid = config.eventDate && !Number.isNaN(target.getTime());
    const title = $('.count-title');
    if (!valid) {
      $('#event-date-display').textContent = 'Date to be announced';
      $('#event-meta').textContent = 'Live online · ' + (config.duration || '90 minutes');
      ['days', 'hours', 'minutes', 'seconds'].forEach((k) => ($('#cd-' + k).textContent = '--'));
      title.textContent = 'COUNTDOWN STARTS SOON';
      return;
    }
    $('#event-date-display').textContent = fmt(target, config.eventTimeZone || 'Asia/Kolkata') + (config.eventConfirmed ? '' : ' (to be confirmed)');
    $('#event-meta').textContent = 'Live online · ' + (config.duration || '90 minutes');
    const left = Math.max(0, target.getTime() - Date.now());
    $('#cd-days').textContent = pad(Math.floor(left / 86400000));
    $('#cd-hours').textContent = pad(Math.floor(left / 3600000) % 24);
    $('#cd-minutes').textContent = pad(Math.floor(left / 60000) % 60);
    $('#cd-seconds').textContent = pad(Math.floor(left / 1000) % 60);
    title.textContent = left === 0 ? "WE'RE LIVE" : config.eventConfirmed ? 'THE SESSION STARTS IN' : 'TENTATIVE · STARTS IN';
  }
  renderCountdown();
  setInterval(renderCountdown, 1000);

  /* ---------- Photos (approved files only; styled stand-ins until then) ---------- */
  function loadPhotos() {
    $$('img[data-photo]').forEach((img) => {
      const src = img.dataset.photo === 'hero' ? config.heroPhoto : config.aboutPhoto;
      if (!src || img.dataset.src === src) return;
      img.dataset.src = src;
      const probe = new Image();
      probe.onload = () => {
        img.src = src;
        img.classList.remove('is-pending');
        const ph = img.previousElementSibling;
        if (ph && ph.classList.contains('photo-ph')) ph.hidden = true;
      };
      probe.src = src;
    });
  }
  loadPhotos();

  /* ---------- Live settings from the Google Sheet ---------- */
  if (config.apiUrl) {
    fetch(config.apiUrl + '?action=config', { method: 'GET' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((remote) => {
        if (!remote || !remote.ok) return;
        const s = remote.settings || {};
        ['eventDate', 'eventTimeZone', 'duration', 'heroPhoto', 'aboutPhoto'].forEach((k) => { if (s[k]) config[k] = s[k]; });
        if (typeof s.eventConfirmed === 'boolean') config.eventConfirmed = s.eventConfirmed;
        config.registrationOpen = s.registrationOpen !== false;
        renderCountdown();
        loadPhotos();
        if (!config.registrationOpen) $$('.open-register').forEach((b) => (b.dataset.closed = '1'));
      })
      .catch((e) => console.warn('Using fallback settings from config.js', e));
  }

  /* ---------- Modal ---------- */
  let lastFocus = null;
  const modal = $('#modal');
  function openModal() {
    lastFocus = document.activeElement;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    if (config.registrationOpen === false) setMessage('Registrations are closed for now. Please check back soon.', 'error');
    setTimeout(() => modal.querySelector('input:not([type=hidden])')?.focus(), 40);
  }
  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
    lastFocus?.focus?.();
  }
  $$('.open-register').forEach((b) => b.addEventListener('click', openModal));
  $('#modal-close').addEventListener('click', closeModal);
  modal.addEventListener('mousedown', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (!modal.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeModal();
    if (e.key === 'Tab') {
      const items = Array.from(modal.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled])')).filter((el) => el.getClientRects().length);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- Registration (stored in the Sheet, confirmed by the backend) ---------- */
  const form = $('#signup-form');
  const msg = $('#form-message');
  function setMessage(text, kind) { msg.className = 'form-message ' + (kind || ''); msg.textContent = text; }
  const qs = new URLSearchParams(location.search);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMessage('', '');
    if (!form.reportValidity()) return;
    if (form.elements.website.value) return; // honeypot
    if (config.registrationOpen === false) { setMessage('Registrations are closed for now.', 'error'); return; }
    if (!config.apiUrl) {
      setMessage('Registrations open very soon. Please check back shortly.', 'error');
      return;
    }
    const data = {
      firstName: form.elements.firstName.value.trim(),
      lastName: form.elements.lastName.value.trim(),
      email: form.elements.email.value.trim(),
      role: form.elements.role.value,
      linkedin: form.elements.linkedin.value.trim(),
      goal: form.elements.goal.value.trim(),
      consent: form.elements.consent.checked,
      website: form.elements.website.value,
      page: location.origin + location.pathname,
      utmSource: qs.get('utm_source') || '',
      utmMedium: qs.get('utm_medium') || '',
      utmCampaign: qs.get('utm_campaign') || ''
    };
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Saving your seat...';
    try {
      // text/plain keeps this a "simple" request, so Apps Script can answer with readable JSON.
      const res = await fetch(config.apiUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(data) });
      const out = await res.json();
      if (!out.ok) throw new Error(out.error || 'Could not save');
      setMessage(out.duplicate
        ? "You're already registered with this email. We'll be in touch with the details."
        : "You're in, " + data.firstName + '! Your seat is saved. Watch your inbox for the joining details.', 'success');
      form.reset();
    } catch (err) {
      console.error(err);
      setMessage(err.message && err.message !== 'Could not save' && !/JSON|fetch/i.test(err.message)
        ? err.message
        : 'Something went wrong and your registration was not saved. Please try again in a minute.', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Register my interest <span>↗</span>';
    }
  });
})();
