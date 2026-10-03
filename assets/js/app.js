/*!
 * BlueRoute Cabs - app.js  (jQuery 3.x)
 * Features: sticky header, smooth scroll, route autocomplete, fare calculator, validation,
 * date picker, testimonial slider, fleet carousel, AJAX lead submission, FAQ accordion,
 * callback modal / exit-intent, animated counters, booking confirmation.
 */
(function ($, window, document) {
  'use strict';
  if (!$ || !window.BRC_DATA || !window.BRC || !window.BRC.fare) { return; }

  var D = window.BRC_DATA, F = window.BRC.fare, CFG = D.config;
  var RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $win = $(window), $doc = $(document);

  /* ---------------------------------------------------------------- utils */
  function track(name, data) { (window.dataLayer = window.dataLayer || []).push($.extend({ event: name }, data || {})); }
  function esc(s) { return $('<div>').text(s == null ? '' : String(s)).html(); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function toISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseISO(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function startOfToday() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function waLink(text) { return 'https://wa.me/' + CFG.whatsapp + '?text=' + encodeURIComponent(text); }
  function qs(name) { var m = new RegExp('[?&]' + name + '=([^&#]*)').exec(window.location.search); return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : ''; }
  function normMobile(v) {
    var s = String(v || '').replace(/\D/g, '');
    if (s.length === 12 && s.indexOf('91') === 0) { s = s.slice(2); }
    else if (s.length === 11 && s.charAt(0) === '0') { s = s.slice(1); }
    return s;
  }
  function fmtDate(iso) { return parseISO(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }
  function fmtTime(t) {
    if (!t) { return ''; }
    var p = t.split(':'), h = +p[0], ap = h >= 12 ? 'PM' : 'AM';
    return ((h % 12) || 12) + ':' + p[1] + ' ' + ap;
  }
  function hoursFor(km) {
    var h = Math.max(0.5, Math.round((km / 45) * 4) / 4);
    var whole = Math.floor(h), mins = Math.round((h - whole) * 60);
    return (whole ? whole + ' hr' : '') + (mins ? ' ' + mins + ' min' : '');
  }
  var store = {
    get: function (k) { try { return JSON.parse(window.sessionStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { window.sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  };

  /* ------------------------------------------------------ 1. sticky header */
  function initHeader() {
    var $h = $('#siteHeader'), ticking = false;
    if (!$h.length) { return; }
    function update() { $h.toggleClass('is-stuck', window.pageYOffset > 24); ticking = false; }
    $win.on('scroll', function () { if (!ticking) { ticking = true; window.requestAnimationFrame(update); } });
    update();
  }

  /* ---------------------------------------------------- 2. smooth scrolling */
  function scrollToEl($t) {
    var top = $t.offset().top - ($('#siteHeader').outerHeight() || 0) - 12;
    if (RM) { window.scrollTo(0, top); } else { $('html, body').stop(true).animate({ scrollTop: top }, 450, 'swing'); }
  }
  function initSmoothScroll() {
    $doc.on('click', 'a[href*="#"]', function (e) {
      var a = this;
      if (a.hash.length < 2 || $(a).is('[data-bs-toggle]') || a.hostname !== window.location.hostname ||
          a.pathname.replace(/^\//, '') !== window.location.pathname.replace(/^\//, '')) { return; }
      var $t = $(a.hash);
      if (!$t.length) { return; }
      e.preventDefault();
      var oc = document.getElementById('mainNav');
      if (oc && window.bootstrap && $(oc).hasClass('show')) { window.bootstrap.Offcanvas.getOrCreateInstance(oc).hide(); }
      scrollToEl($t);
      if (window.history.pushState) { window.history.pushState(null, '', a.hash); }
      $t.attr('tabindex', '-1')[0].focus({ preventScroll: true });
    });
  }

  /* ----------------------------------------- 3. route search autocomplete */
  $.fn.brcAutocomplete = function (opts) {
    opts = opts || {};
    return this.each(function () {
      var $in = $(this), $wrap = $in.closest('.ac-wrap'), listId = this.id + '-listbox';
      var $list = $('<ul class="ac-list" role="listbox"></ul>').attr('id', listId).prop('hidden', true).appendTo($wrap);
      var results = [], active = -1;
      $in.attr({ role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': listId,
                 autocapitalize: 'off', spellcheck: 'false' });

      function types() { return typeof opts.types === 'function' ? opts.types() : opts.types; }
      function highlight(name, q) {
        var i = q ? name.toLowerCase().indexOf(q.toLowerCase()) : -1;
        if (i < 0) { return esc(name); }
        return esc(name.slice(0, i)) + '<mark>' + esc(name.slice(i, i + q.length)) + '</mark>' + esc(name.slice(i + q.length));
      }
      function open() { $list.prop('hidden', false); $in.attr('aria-expanded', 'true'); }
      function close() { $list.prop('hidden', true); $in.attr({ 'aria-expanded': 'false' }).removeAttr('aria-activedescendant'); active = -1; }
      function render() {
        var q = $.trim($in.val());
        results = F.search(q, { types: types(), limit: 7 });
        var html = '';
        if (!q) { html += '<li class="ac-head" role="presentation">Popular locations</li>'; }
        if (!results.length) {
          html += '<li class="ac-empty" role="presentation">No exact match. You can still submit - we will quote this route on call.</li>';
        }
        $.each(results, function (i, p) {
          var ico = p.type === 'airport' ? 'plane' : (p.type === 'area' ? 'gps' : 'pin');
          html += '<li role="option" id="' + listId + '-' + i + '" data-i="' + i + '" aria-selected="false">' +
            '<svg class="icon" aria-hidden="true"><use href="#i-' + ico + '"></use></svg>' +
            '<span class="ac-main"><span class="ac-name">' + highlight(p.name, q) + '</span>' +
            '<small>' + esc(p.region) + (p.type === 'airport' ? ' &middot; Airport' : '') + '</small></span></li>';
        });
        $list.html(html);
        active = -1;
      }
      function setActive(i) {
        var $o = $list.children('[role=option]');
        $o.attr('aria-selected', 'false').removeClass('is-active');
        active = i;
        if (i > -1) {
          var $a = $o.eq(i).attr('aria-selected', 'true').addClass('is-active');
          $in.attr('aria-activedescendant', $a.attr('id'));
          if ($a[0].scrollIntoView) { $a[0].scrollIntoView({ block: 'nearest' }); }
        } else { $in.removeAttr('aria-activedescendant'); }
      }
      function choose(i) {
        var p = results[i]; if (!p) { return; }
        $in.val(p.name).data('place', p.id);
        close();
        $in.trigger('brc:place').trigger('change');
      }

      $in.on('input', function () { $in.removeData('place'); render(); open(); $in.trigger('brc:place'); });
      $in.on('focus click', function () { if ($list.prop('hidden')) { render(); open(); } });
      $in.on('blur', function () {
        close();
        var p = F.findPlace($in.val());
        if (p) { $in.val(p.name).data('place', p.id); $in.trigger('brc:place'); }
      });
      $in.on('keydown', function (e) {
        var n = results.length;
        if (e.key === 'ArrowDown') { e.preventDefault(); if ($list.prop('hidden')) { render(); open(); } setActive(active + 1 >= n ? 0 : active + 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1 < 0 ? n - 1 : active - 1); }
        else if (e.key === 'Enter' && !$list.prop('hidden') && active > -1) { e.preventDefault(); choose(active); }
        else if (e.key === 'Escape') { close(); }
      });
      $list.on('mousedown', 'li[role=option]', function (e) { e.preventDefault(); choose(+$(this).attr('data-i')); });
    });
  };
  function placeOf($in) {
    var id = $in.data('place');
    return id ? F.placeById[id] : F.findPlace($in.val());
  }

  /* ----------------------------------------------- 6. date picker (flatpickr) */
  function initDates() {
    if (!window.flatpickr) { return; }
    $('.js-date').each(function () {
      var $in = $(this), id = this.id;
      var fp = window.flatpickr(this, {
        minDate: 'today', dateFormat: 'Y-m-d', altInput: true, altFormat: 'D, d M',
        altInputClass: 'form-control js-date-alt', disableMobile: true, locale: { firstDayOfWeek: 1 },
        onChange: function (sel) {
          if (id === 'date') {
            var ret = $('#returnDate').data('fp');
            if (ret) {
              ret.set('minDate', sel[0] || 'today');
              if (ret.selectedDates[0] && sel[0] && ret.selectedDates[0] < sel[0]) { ret.clear(); }
            }
          }
        }
      });
      $(fp.altInput).attr({ id: id + '-alt', placeholder: $in.attr('placeholder'), 'aria-required': 'true', 'aria-describedby': id + '-err', autocomplete: 'off' });
      $('label[for="' + id + '"]').attr('for', id + '-alt');
      $in.data('fp', fp).data('alt', $(fp.altInput));
    });
  }

  /* ---------------------------------------------------- 4. form validation */
  var RULES = {
    required: function (v) { return $.trim(v) !== ''; },
    minlen: function (v, n) { return $.trim(v).length >= +n; },
    phone: function (v) { return /^[6-9]\d{9}$/.test(normMobile(v)); },
    email: function (v) { return !v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); },
    futuredate: function (v) { return !v || parseISO(v) >= startOfToday(); },
    futuretime: function (v) {
      var d = $('#date').val();
      if (!v || !d || d !== toISO(new Date())) { return true; }
      var t = v.split(':'), dt = parseISO(d); dt.setHours(+t[0], +t[1], 0, 0);
      return dt.getTime() >= Date.now() + 55 * 60 * 1000;
    },
    afterpickup: function (v) { var d = $('#date').val(); return !v || !d || parseISO(v) >= parseISO(d); },
    different: function (v, sel, $f) {
      var a = placeOf($(sel)), b = placeOf($f);
      if (a && b) { return a.id !== b.id; }
      return $.trim($(sel).val()).toLowerCase() !== $.trim(v).toLowerCase() || $.trim(v) === '';
    },
    fits: function (v) { var veh = F.vehicleById[v], pax = +$('#pax').val(); return !veh || !pax || veh.seats >= pax; }
  };

  function errEl($f) { return $('#' + $f.attr('id') + '-err'); }
  function altOf($f) { return $f.data('alt') || $(); }
  function setError($f, msg) {
    $f.add(altOf($f)).addClass('is-invalid').attr('aria-invalid', 'true');
    var $e = errEl($f).text(msg).addClass('show');
    if ($e.length) { $f.add(altOf($f)).attr('aria-describedby', $e.attr('id')); }
  }
  function clearError($f) {
    $f.add(altOf($f)).removeClass('is-invalid').removeAttr('aria-invalid');
    errEl($f).text('').removeClass('show');
  }
  function validateField($f) {
    var $wrap = $f.closest('.field');
    if ($wrap.length && $wrap.is(':hidden')) { clearError($f); return ''; }
    var rules = ($f.attr('data-rules') || '').split('|'), val = $f.val();
    for (var i = 0; i < rules.length; i++) {
      var parts = rules[i].split(':'), name = parts[0], arg = parts.slice(1).join(':');
      if (!RULES[name]) { continue; }
      if (name !== 'required' && $.trim(val) === '') { continue; }
      if (!RULES[name](val, arg, $f)) {
        var msg = $f.attr('data-msg-' + name) || 'Please check this field';
        if (name === 'fits') { var v = F.vehicleById[val]; msg = (v ? v.name : 'This vehicle') + ' seats up to ' + (v ? v.seats : '') + ' passengers. Choose a larger vehicle.'; }
        setError($f, msg);
        return msg;
      }
    }
    clearError($f);
    return '';
  }
  function validateForm($form) {
    var first = null;
    $form.find('[data-rules]').each(function () {
      var $f = $(this);
      if (validateField($f) && !first) { first = $f; }
    });
    if (first) {
      var $focus = first.data('alt') && first.data('alt').length ? first.data('alt') : first;
      $focus.trigger('focus');
      if ($focus[0].scrollIntoView && !RM) { $focus[0].scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    }
    return first;
  }
  function initValidation() {
    $doc.on('focusout change', '.js-lead-form [data-rules]', function (e) {
      var $f = $(this);
      if (e.type === 'focusout' && !$f.val() && !$f.hasClass('is-invalid')) { return; }
      if ($f.is('[name=mobile]') && RULES.phone($f.val())) { $f.val(normMobile($f.val())); }
      validateField($f);
    });
    $doc.on('input', '.js-lead-form .is-invalid', function () { validateField($(this).is('.js-date-alt') ? $('#' + this.id.replace(/-alt$/, '')) : $(this)); });
    $doc.on('input', '.js-lead-form [name=mobile]', function () { this.value = this.value.replace(/[^\d+\s-]/g, ''); });
  }

  /* -------------------------------------------- 9. AJAX lead submission */
  function csrfHeaders() {
    var m = /(?:^|;\s*)csrftoken=([^;]+)/.exec(document.cookie);
    return m ? { 'X-CSRFToken': decodeURIComponent(m[1]) } : {};
  }
  function makeRef() { return 'BR' + Date.now().toString(36).toUpperCase().slice(-6); }
  function submitLead(payload) {
    if (CFG.mock) {
      var dfd = $.Deferred();
      window.setTimeout(function () {
        var ref = makeRef();
        try {
          var all = JSON.parse(window.localStorage.getItem('brc_leads') || '[]');
          all.push($.extend({ ref: ref }, payload));
          window.localStorage.setItem('brc_leads', JSON.stringify(all.slice(-20)));
        } catch (e) { /* storage unavailable */ }
        dfd.resolve({ ref: ref, mock: true });
      }, 900);
      return dfd.promise();
    }
    return $.ajax({ url: CFG.endpoint, method: 'POST', contentType: 'application/json; charset=UTF-8', dataType: 'json',
                    data: JSON.stringify(payload), timeout: 15000, headers: csrfHeaders() });
  }
  function utm() {
    var o = {};
    $.each(['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid'], function (_, k) { var v = qs(k); if (v) { o[k] = v; } });
    return o;
  }
  function collect($form) {
    var type = $form.data('leadType') || 'enquiry';
    var p = { type: type, page: window.location.pathname, referrer: document.referrer || '', submittedAt: new Date().toISOString(), utm: utm() };
    $.each($form.serializeArray(), function (_, f) { if (f.name !== 'website' && f.value !== '') { p[f.name] = $.trim(f.value); } });
    if (p.mobile) { p.mobile = '+91' + normMobile(p.mobile); }
    if (type === 'booking') {
      var a = placeOf($('#from')), b = placeOf($('#to'));
      p.fromId = a ? a.id : null; p.toId = b ? b.id : null;
      if (BOOKING && BOOKING.lastQuote) { p.estimate = BOOKING.lastQuote.total; p.distanceKm = BOOKING.lastQuote.km; }
      if (p.trip !== 'airport') { delete p.airportDir; }
      if (p.trip !== 'round') { delete p.returnDate; }
    }
    return p;
  }
  function setBusy($form, busy) {
    $form.data('busy', busy).attr('aria-busy', busy ? 'true' : 'false');
    $form.find('.btn-submit').prop('disabled', busy).toggleClass('is-loading', busy);
  }
  function showAlert($form, html, handoff) { $form.find('.form-alert').toggleClass('is-handoff', !!handoff).removeClass('d-none').html(html); }
  function failMessage(payload) {
    var txt = 'Hi ' + CFG.brand + ', I tried to book online. ' + (payload.from ? 'Trip: ' + payload.from + ' to ' + payload.to + '. ' : '') +
      'Name: ' + (payload.name || '') + ', Mobile: ' + (payload.mobile || '');
    return 'We could not send your request just now. Please <strong>try again</strong>, or reach us instantly: ' +
      '<a href="' + waLink(txt) + '" target="_blank" rel="noopener">WhatsApp</a> &middot; <a href="tel:' + CFG.phone + '">Call us</a>.';
  }
  function onSuccess($form, payload, res) {
    track('generate_lead', { lead_type: payload.type, value: payload.estimate || 0, currency: 'INR' });
    store.set('brc_lead_done', 1);
    if ($form.data('success') === 'redirect') {
      var ref = (res && res.ref) || makeRef();
      store.set('brc_last', $.extend({ ref: ref }, payload));
      window.location.assign((CFG.base || '') + '/booking-confirmation/?ref=' + encodeURIComponent(ref));
      return true; // keep button busy while navigating
    }
    var $wrap = $form.closest('.modal-body, .callback-inner, .lead-wrap');
    $form.addClass('d-none');
    $wrap.find('.callback-copy').addClass('d-none');
    $wrap.find('.lead-success').removeClass('d-none').trigger('focus');
    if ($form.closest('.modal').length) {
      window.setTimeout(function () {
        var m = document.getElementById('callbackModal');
        if (m && window.bootstrap) { window.bootstrap.Modal.getOrCreateInstance(m).hide(); }
      }, 3500);
    }
    return false;
  }
  function onFail($form, payload, xhr) {
    var errs = xhr && xhr.responseJSON && xhr.responseJSON.errors;
    if (xhr && xhr.status === 400 && errs) {
      $.each(errs, function (field, msg) { var $f = $form.find('[name="' + field + '"]'); if ($f.length) { setError($f, $.isArray(msg) ? msg[0] : msg); } });
      return;
    }
    track('lead_error', { lead_type: payload.type, status: xhr ? xhr.status : 0 });
    showAlert($form, failMessage(payload));
  }
  /* ---- lead delivery: api | whatsapp | both (SITE.lead_delivery in site_data.py) ---- */
  function deliveryMode(type) {
    var m = (CFG.deliveryByType && CFG.deliveryByType[type]) || CFG.delivery || 'api';
    return /^(api|whatsapp|both)$/.test(m) ? m : 'api';
  }
  function leadText(p) {
    var TRIP = { oneway: 'One way', round: 'Round trip', airport: 'Airport transfer' };
    var v = F.vehicleById[p.vehicle], L = [];
    function add(label, val) { if (val) { L.push(label + ': ' + val); } }
    if (p.type === 'booking') {
      L.push('Hi ' + CFG.brand + ', I would like to book a cab.');
      add('Trip type', TRIP[p.trip]); add('Pickup', p.from); add('Drop', p.to);
      add('Date', (p.date ? fmtDate(p.date) : '') + (p.time ? ' ' + fmtTime(p.time) : ''));
      add('Return', p.returnDate ? fmtDate(p.returnDate) : '');
      add('Vehicle', v ? v.name : ''); add('Passengers', p.pax);
      add('Estimated fare', p.estimate ? 'Rs ' + F.inr(p.estimate) : '');
    } else if (p.type === 'callback') {
      L.push('Hi ' + CFG.brand + ', please call me back.');
      add('Best time', p.slot && p.slot !== 'asap' ? p.slot : 'As soon as possible');
    } else if (p.type === 'corporate') {
      L.push('Hi ' + CFG.brand + ', we need a corporate cab account.');
      add('Company', p.company); add('Monthly trips', p.volume); add('Requirement', p.message);
    } else {
      L.push('Hi ' + CFG.brand + ', I have an enquiry.');
      add('Message', p.message);
    }
    add('Name', p.name); add('Mobile', p.mobile); add('Email', p.email);
    return L.join('\n');
  }
  function initLeadForms() {
    $doc.on('submit', '.js-lead-form', function (e) {
      e.preventDefault();
      var $form = $(this);
      if ($form.data('busy')) { return; }
      $form.find('.form-alert').removeClass('is-handoff').addClass('d-none').empty();
      if (validateForm($form)) { return; }
      var payload = collect($form);
      if ($form.find('[name=website]').val()) { onSuccess($form, payload, {}); return; } // honeypot: silently drop
      var mode = deliveryMode(payload.type), waWin = null, waUrl = '';
      if (mode !== 'api') {
        // must open synchronously inside the submit gesture or popup blockers stop it
        waUrl = waLink(leadText(payload));
        waWin = window.open(waUrl, '_blank');
        if (waWin) { try { waWin.opener = null; } catch (err) { /* cross-origin */ } }
        track('whatsapp_lead', { lead_type: payload.type, delivery: mode });
      }
      if (mode === 'whatsapp') {
        if (!waWin) {
          showAlert($form, 'Your browser blocked WhatsApp. <a href="' + waUrl + '" target="_blank" rel="noopener">Tap here to send your request on WhatsApp</a>.');
          return;
        }
        $form.removeClass('d-none').closest('.modal-body, .callback-inner, .lead-wrap').find('.lead-success').addClass('d-none');
        showAlert($form, '<strong>WhatsApp opened.</strong> Tap Send there to complete your request.', true);
        return;
      }
      setBusy($form, true);
      var keepBusy = false;
      submitLead(payload)
        .done(function (res) { keepBusy = onSuccess($form, payload, res); })
        .fail(function (xhr) { if (mode === 'both' && waWin) { showAlert($form, '<strong>WhatsApp opened.</strong> The online request could not be saved, so tap Send there to complete it.', true); } else { onFail($form, payload, xhr); } })
        .always(function () { if (!keepBusy) { setBusy($form, false); } });
    });
    var $m = $('#callbackModal');
    $m.on('hidden.bs.modal', function () {
      $m.find('form').removeClass('d-none')[0].reset();
      $m.find('.lead-success').addClass('d-none');
      $m.find('.form-alert').removeClass('is-handoff').addClass('d-none').empty();
      $m.find('[data-rules]').each(function () { clearError($(this)); });
    });
    $m.on('shown.bs.modal', function () { $m.find('input[name=name]').trigger('focus'); });
    $doc.on('click', '[data-track]', function () { track($(this).data('track'), { page: window.location.pathname }); });
  }

  /* --------------------------------- 3b. booking widget + 4b. fare calculator */
  var BOOKING = null;
  function initBooking() {
    var $f = $('#bookingForm');
    if (!$f.length) { return; }
    var $from = $('#from'), $to = $('#to'), $veh = $('#vehicle'), $pax = $('#pax'), $date = $('#date'), $ret = $('#returnDate');
    var $fare = $('#fareBox'), $hint = $('#tripHint'), $vHint = $('#vehicleHint'), $airportNotice = $('#airportNotice');
    var trip = 'oneway', timer = null, seq = 0, airportUndo = null;
    var HINTS = {
      oneway: 'One way: pay for a single leg only - no return charges.',
      round: 'Round trip: stay as long as you like. Billed on the greater of actual km or ' + D.policy.minRoundPerDay + ' km/day.',
      airport: 'Airport: fixed fares with flight tracking and 60 minutes free waiting.'
    };
    BOOKING = { lastQuote: null };

    function dir() { return $f.find('[name=airportDir]:checked').val(); }
    function airportOnly(side) { return trip === 'airport' && dir() === side ? ['airport'] : null; }

    $from.brcAutocomplete({ types: function () { return airportOnly('from'); } });
    $to.brcAutocomplete({ types: function () { return airportOnly('to'); } });

    function setPlace($in, id) { var p = F.placeById[id]; $in.val(p.name).data('place', id); }
    function ensureAirportField() {
      var $air = dir() === 'from' ? $from : $to, $other = dir() === 'from' ? $to : $from;
      var p = placeOf($air);
      if (p && p.type === 'airport') { return ''; }
      var o = placeOf($other);
      var puneish = o && (o.id === 'pune' || /pune/i.test(o.name));
      setPlace($air, puneish ? 'pune-airport' : 'mumbai-airport');
      clearError($air);
      return (dir() === 'from' ? 'Pickup' : 'Drop') + ' changed to ' + $air.val() + '.';
    }
    function applyLabels() {
      if (trip === 'airport') {
        $('#fromLabel').text(dir() === 'from' ? 'Airport (pickup)' : 'Pickup address');
        $('#toLabel').text(dir() === 'to' ? 'Airport (drop)' : 'Drop address');
      } else { $('#fromLabel').text('Pickup'); $('#toLabel').text('Drop'); }
    }
    function setTrip(t) {
      var previousTrip = trip;
      if (t === 'airport' && previousTrip !== 'airport') {
        airportUndo = { trip: previousTrip, from: $from.val(), fromId: $from.data('place'), to: $to.val(), toId: $to.data('place') };
      }
      trip = t;
      $f.find('[name=trip][value=' + t + ']').prop('checked', true);
      $('.js-round-only').toggleClass('d-none', t !== 'round');
      $('.js-airport-only').toggleClass('d-none', t !== 'airport');
      $hint.text(HINTS[t]);
      var airportChange = t === 'airport' ? ensureAirportField() : '';
      if (airportChange) { $airportNotice.removeClass('d-none').find('span').text(airportChange); }
      else if (t !== 'airport') { $airportNotice.addClass('d-none'); }
      applyLabels();
      $f.find('.is-invalid').each(function () { validateField($(this)); });
      schedule();
    }
    function swap() {
      var a = $from.val(), ad = $from.data('place');
      $from.val($to.val()); if ($to.data('place')) { $from.data('place', $to.data('place')); } else { $from.removeData('place'); }
      $to.val(a); if (ad) { $to.data('place', ad); } else { $to.removeData('place'); }
      if (trip === 'airport') { $f.find('[name=airportDir][value=' + (dir() === 'from' ? 'to' : 'from') + ']').prop('checked', true); applyLabels(); }
      clearError($from); clearError($to); schedule();
    }

    function tripDays() {
      if (trip !== 'round' || !$date.val() || !$ret.val()) { return 1; }
      return Math.max(1, Math.round((parseISO($ret.val()) - parseISO($date.val())) / 864e5) + 1);
    }
    function ensureVehicleFits() {
      var pax = +$pax.val(), v = F.vehicleById[$veh.val()];
      if (v && v.seats < pax) {
        var nv = F.vehicleFor(pax);
        $veh.val(nv.id);
        $vHint.text('Switched to ' + nv.name + ' - it seats up to ' + nv.seats + '.').addClass('is-info');
      } else { $vHint.text('').removeClass('is-info'); }
      clearError($veh);
    }

    /* ----- fare box rendering ----- */
    function idleHtml() {
      return '<div class="fare-idle"><svg class="icon" aria-hidden="true"><use href="#i-rupee"></use></svg>' +
             '<span>Select pickup &amp; drop to see your instant fare estimate.</span></div>';
    }
    function unknownHtml() {
      return '<div class="fare-idle is-unknown"><svg class="icon" aria-hidden="true"><use href="#i-info"></use></svg>' +
             '<span>We could not auto-price this route. Submit your request and we will confirm the best fare on call within minutes.</span></div>';
    }
    function loadingHtml() {
      return '<div class="fare-skeleton" aria-label="Calculating fare"><span class="sk sk-lg"></span><span class="sk"></span><span class="sk sk-sm"></span></div>';
    }
    function renderQuote(a, b) {
      var pax = +$pax.val(), inp = { trip: trip, from: a.id, to: b.id, days: tripDays() };
      var all = F.quoteAll(inp, pax);
      if (!all.length) { $fare.html(unknownHtml()); return; }
      var sel = null;
      $.each(all, function (_, q) { if (q.vehicle === $veh.val()) { sel = q; } });
      if (!sel) { sel = all[0]; }
      BOOKING.lastQuote = sel;
      var v = F.vehicleById[sel.vehicle];
      var lines = $.map(sel.lines, function (l) { return '<div><dt>' + esc(l[0]) + '</dt><dd>' + esc(l[1]) + '</dd></div>'; }).join('');
      var chips = $.map(all, function (q) {
        var on = q.vehicle === sel.vehicle;
        return '<button type="button" class="fare-chip' + (on ? ' is-on' : '') + '" data-vehicle="' + q.vehicle + '" aria-pressed="' + on + '">' +
               '<span>' + esc(F.vehicleById[q.vehicle].name) + '</span><strong>\u20B9' + F.inr(q.total) + '</strong></button>';
      }).join('');
      var label = trip === 'round' ? 'Estimated round trip fare' : (trip === 'airport' ? 'Estimated airport fare' : 'Estimated one way fare');
      $fare.html(
        '<div class="fare-head"><div><span class="fare-label">' + label + '</span>' +
        '<div class="fare-total">\u20B9' + F.inr(sel.total) + '</div></div>' +
        '<div class="fare-route"><strong>' + esc(a.name.split(' (')[0].split(',')[0]) + ' \u2192 ' + esc(b.name.split(' (')[0].split(',')[0]) + '</strong>' +
        '<span>' + sel.km + ' km &middot; ~' + hoursFor(sel.km) + ' &middot; ' + esc(v.name) + '</span></div></div>' +
        '<dl class="fare-lines">' + lines + '</dl>' +
        '<div class="fare-compare" role="group" aria-label="Compare vehicle fares">' + chips + '</div>' +
        '<p class="fare-note"><svg class="icon" aria-hidden="true"><use href="#i-info"></use></svg> Tolls, parking &amp; state taxes extra at actuals. Final fare confirmed before your trip.</p>');
      track('fare_estimate', { trip: trip, vehicle: sel.vehicle, value: sel.total, currency: 'INR' });
    }
    function updateFare() {
      var mySeq = ++seq;
      var ft = $.trim($from.val()), tt = $.trim($to.val());
      if (!ft || !tt) { BOOKING.lastQuote = null; $fare.html(idleHtml()); return; }
      var a = placeOf($from), b = placeOf($to);
      if (!a || !b) { BOOKING.lastQuote = null; $fare.html(unknownHtml()); return; }
      if (a.id === b.id) { BOOKING.lastQuote = null; $fare.html(idleHtml()); return; }
      $fare.html(loadingHtml());
      window.setTimeout(function () { if (mySeq === seq) { renderQuote(a, b); } }, RM ? 0 : 320);
    }
    function schedule() { window.clearTimeout(timer); timer = window.setTimeout(updateFare, 140); }

    /* ----- events ----- */
    $f.on('change', '[name=trip]', function () { setTrip(this.value); track('trip_type_change', { trip: this.value }); });
    $f.on('change', '[name=airportDir]', function () {
      var $air = dir() === 'from' ? $from : $to, $other = dir() === 'from' ? $to : $from;
      var pa = placeOf($air), po = placeOf($other);
      if ((!pa || pa.type !== 'airport') && po && po.type === 'airport') {
        var tv = $from.val(), td = $from.data('place');
        $from.val($to.val()).data('place', $to.data('place')); $to.val(tv).data('place', td);
      } else { ensureAirportField(); }
      applyLabels(); schedule();
    });
    $('#swapBtn').on('click', swap);
    $('#airportUndo').on('click', function () {
      if (!airportUndo) { return; }
      function restore($in, value, id) { $in.val(value); if (id) { $in.data('place', id); } else { $in.removeData('place'); } }
      restore($from, airportUndo.from, airportUndo.fromId); restore($to, airportUndo.to, airportUndo.toId);
      var oldTrip = airportUndo.trip; airportUndo = null; setTrip(oldTrip);
      $airportNotice.addClass('d-none');
    });
    $from.add($to).on('brc:place change', schedule);
    $pax.on('change', function () { ensureVehicleFits(); schedule(); });
    $veh.on('change', function () {
      var v = F.vehicleById[this.value], pax = +$pax.val();
      $vHint.removeClass('is-info').text(v.seats < pax ? v.name + ' seats up to ' + v.seats + '.' : '');
      schedule();
    });
    $date.add($ret).on('change', schedule);
    $fare.on('click', '.fare-chip', function () { $veh.val($(this).data('vehicle')); ensureVehicleFits(); schedule(); });

    /* ----- prefill (query string > data attributes) ----- */
    var qFrom = qs('from'), qTo = qs('to');
    if (qFrom) { var pf = F.findPlace(qFrom); $from.val(pf ? pf.name : qFrom); }
    if (qTo) { var pt = F.findPlace(qTo); $to.val(pt ? pt.name : qTo); }
    if (qs('vehicle') && F.vehicleById[qs('vehicle')]) { $veh.val(qs('vehicle')); }
    if (+qs('pax') > 0 && +qs('pax') <= 12) { $pax.val(+qs('pax')); }
    var startTrip = qs('type') || $f.data('defaultTrip') || 'oneway';
    if (!/^(oneway|round|airport)$/.test(startTrip)) { startTrip = 'oneway'; }
    var pFrom = placeOf($from), pTo = placeOf($to);
    if (pFrom) { $from.data('place', pFrom.id); }
    if (pTo) { $to.data('place', pTo.id); }
    if (startTrip === 'airport' && pTo && pTo.type === 'airport') { $f.find('[name=airportDir][value=to]').prop('checked', true); }
    setTrip(startTrip);
    ensureVehicleFits();
    $fare.html(idleHtml());
    updateFare();
  }

  /* ------------------------------------ 7/8. testimonial slider + fleet carousel */
  $.fn.brcCarousel = function () {
    return this.each(function () {
      var $c = $(this), $t = $c.find('.carousel-track'), $slides = $t.children(), $dots = $c.find('.car-dots');
      var $prev = $c.find('.car-prev'), $next = $c.find('.car-next'), $toggle = $c.find('.car-toggle');
      var auto = +$c.data('autoplay') || 0, timer = null, interactionPaused = false;
      var userPaused = auto ? store.get('brc_carousel_paused') === '1' : false, pages = 1, page = 0, tick;
      function perView() { var w = $slides.first().outerWidth(true) || 1; return Math.max(1, Math.round($t[0].clientWidth / w)); }
      function build() {
        var pv = perView(); pages = Math.max(1, Math.ceil($slides.length / pv));
        $dots.empty();
        for (var i = 0; i < pages; i++) {
          $('<button type="button" role="tab" class="car-dot"></button>').attr({ 'aria-label': 'Go to group ' + (i + 1), 'aria-selected': 'false' }).data('i', i).appendTo($dots);
        }
        $c.toggleClass('is-single', pages === 1);
        sync();
      }
      function sync() {
        var max = $t[0].scrollWidth - $t[0].clientWidth;
        page = max <= 0 ? 0 : Math.min(pages - 1, Math.round(($t[0].scrollLeft / max) * (pages - 1)));
        $dots.children().removeClass('is-on').attr('aria-selected', 'false').eq(page).addClass('is-on').attr('aria-selected', 'true');
        $prev.prop('disabled', $t[0].scrollLeft <= 2);
        $next.prop('disabled', $t[0].scrollLeft >= max - 2);
      }
      function go(i) {
        var max = $t[0].scrollWidth - $t[0].clientWidth;
        var left = pages === 1 ? 0 : (i / (pages - 1)) * max;
        $t[0].scrollTo({ left: left, behavior: RM ? 'auto' : 'smooth' });
      }
      function step(dirn) {
        var max = $t[0].scrollWidth - $t[0].clientWidth;
        if (dirn > 0 && $t[0].scrollLeft >= max - 2) { go(0); } else { $t[0].scrollBy({ left: dirn * $t[0].clientWidth * 0.9, behavior: RM ? 'auto' : 'smooth' }); }
      }
      $prev.on('click', function () { step(-1); });
      $next.on('click', function () { step(1); });
      $dots.on('click', '.car-dot', function () { go($(this).data('i')); });
      $t.on('scroll', function () { window.clearTimeout(tick); tick = window.setTimeout(sync, 60); });
      $t.on('keydown', function (e) { if (e.key === 'ArrowRight') { step(1); } else if (e.key === 'ArrowLeft') { step(-1); } });
      $win.on('resize', function () { window.clearTimeout(tick); tick = window.setTimeout(build, 150); });
      if (auto && !RM) {
        var updateToggle = function () { $toggle.attr({ 'aria-pressed': userPaused ? 'true' : 'false', 'aria-label': userPaused ? 'Play automatic slides' : 'Pause automatic slides' }).text(userPaused ? 'Play' : 'Pause'); };
        var start = function () { stop(); timer = window.setInterval(function () { if (!userPaused && !interactionPaused && !document.hidden) { step(1); } }, auto); };
        var stop = function () { if (timer) { window.clearInterval(timer); timer = null; } };
        $c.on('mouseenter focusin touchstart', function () { interactionPaused = true; }).on('mouseleave focusout touchend', function () { interactionPaused = false; });
        $toggle.on('click', function () { userPaused = !userPaused; store.set('brc_carousel_paused', userPaused ? '1' : '0'); updateToggle(); });
        updateToggle(); start();
      } else { $toggle.addClass('d-none'); }
      build();
    });
  };

  /* ------------------------------------------------------ 10. FAQ accordion */
  function initAccordion() {
    function setOpen($b, open, instant) {
      var $p = $('#' + $b.attr('aria-controls'));
      $b.attr('aria-expanded', open ? 'true' : 'false').closest('.faq-item').toggleClass('is-open', open);
      if (RM || instant) { $p.stop(true, true).toggle(open); }
      else if (open) { $p.stop(true, true).slideDown(200); } else { $p.stop(true, true).slideUp(200); }
    }
    $('[data-accordion]').each(function () {
      var $acc = $(this);
      $acc.on('click', '.faq-q button', function () {
        var $b = $(this), open = $b.attr('aria-expanded') !== 'true';
        $acc.find('.faq-q button[aria-expanded="true"]').not($b).each(function () { setOpen($(this), false); });
        setOpen($b, open);
        if (open) { track('faq_open', { question: $.trim($b.text()) }); }
      });
    });
    if (window.location.hash) {
      var $b = $('[data-accordion] .faq-q button[aria-controls="' + window.location.hash.slice(1) + '"], [data-accordion] #' + window.location.hash.slice(1).replace(/[^\w-]/g, ''));
      $b = $b.filter('button').first();
      if ($b.length) { setOpen($b, true, true); window.setTimeout(function () { scrollToEl($b); }, 200); }
    }
  }

  /* --------------------------------------------------- counters / reveal */
  function initCounters() {
    var $n = $('.stat-num[data-count]');
    if (!$n.length) { return; }
    function run($el) {
      var target = +$el.data('count'), dec = +$el.data('decimals') || 0, suf = $el.data('suffix') || '';
      function fmt(x) { return (dec ? x.toFixed(dec) : F.inr(Math.round(x))) + suf; }
      if (RM) { $el.text(fmt(target)); return; }
      $({ v: 0 }).animate({ v: target }, { duration: 1400, easing: 'swing', step: function (now) { $el.text(fmt(now)); }, complete: function () { $el.text(fmt(target)); } });
    }
    if ('IntersectionObserver' in window) {
      var io = new window.IntersectionObserver(function (entries) {
        $.each(entries, function (_, en) { if (en.isIntersecting) { io.unobserve(en.target); run($(en.target)); } });
      }, { threshold: 0.4 });
      $n.each(function () { io.observe(this); });
    }
  }

  /* ---------------------------------------- callback exit-intent (desktop) */
  function initExitIntent() {
    if (!$('body').is('[data-exit]') || store.get('brc_exit') || store.get('brc_lead_done') || !window.bootstrap) { return; }
    var t0 = Date.now();
    $doc.on('mouseleave.exit', function (e) {
      if (e.clientY > 0 || Date.now() - t0 < 15000 || $('.modal.show').length) { return; }
      store.set('brc_exit', 1);
      $doc.off('mouseleave.exit');
      window.bootstrap.Modal.getOrCreateInstance(document.getElementById('callbackModal')).show();
      track('exit_intent_callback_shown');
    });
  }

  /* ----------------------------------------------- vehicle "Get fare" links */
  function initVehiclePick() {
    $doc.on('click', '.js-pick-vehicle', function () {
      var id = $(this).data('vehicle');
      if ($('#bookingForm').length && F.vehicleById[id]) { $('#vehicle').val(id).trigger('change'); window.setTimeout(function () { $('#from').trigger('focus'); }, 600); }
      track('vehicle_select', { vehicle: id });
    });
  }

  /* ------------------------------------------- booking confirmation page */
  function initConfirmation() {
    var $c = $('#confirmation');
    if (!$c.length) { return; }
    var d = store.get('brc_last'), ref = qs('ref');
    if (!d || (ref && d.ref !== ref)) { $('#confFound').addClass('d-none'); $('#confMissing').removeClass('d-none'); return; }
    var rows = [], tripName = { oneway: 'One way', round: 'Round trip', airport: 'Airport transfer', callback: 'Call back request' };
    if (d.trip) { rows.push(['Trip type', tripName[d.trip]]); }
    if (d.from) { rows.push(['Pickup', d.from]); }
    if (d.to) { rows.push(['Drop', d.to]); }
    if (d.date) { rows.push(['Pickup', fmtDate(d.date) + (d.time ? ', ' + fmtTime(d.time) : '')]); }
    if (d.returnDate) { rows.push(['Return date', fmtDate(d.returnDate)]); }
    if (d.vehicle && F.vehicleById[d.vehicle]) { rows.push(['Vehicle', F.vehicleById[d.vehicle].name + (d.pax ? ' - ' + d.pax + ' passenger' + (+d.pax > 1 ? 's' : '') : '')]); }
    if (d.name) { rows.push(['Name', d.name]); }
    if (d.mobile) { rows.push(['Mobile', d.mobile]); }
    if (d.estimate) { rows.push(['Estimated fare', '\u20B9' + F.inr(d.estimate) + ' (tolls & parking extra)']); }
    $('#confRef').text(d.ref);
    $('#confRows').html($.map(rows, function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join(''));
    $('#confWa').attr('href', waLink('Hi ' + CFG.brand + ', my booking reference is ' + d.ref + '. Please confirm my cab.'));
    $('#confPrint').on('click', function () { window.print(); });
    track('booking_confirmation_view', { ref: d.ref });
  }

  /* ------------------------------------------- contact page: package prefill */
  function initContactPrefill() {
    var pkg = qs('package'), $m = $('#ct-message');
    if (pkg && $m.length && !$m.val()) { $m.val('I am interested in the "' + pkg.replace(/-/g, ' ') + '" tourist package. Please share details and the fare.'); }
  }

  /* ------------------------------------------------------------------ init */
  $(function () {
    initHeader();
    initSmoothScroll();
    initDates();
    initValidation();
    initLeadForms();
    initBooking();
    initVehiclePick();
    $('[data-carousel]').brcCarousel();
    initAccordion();
    initCounters();
    initExitIntent();
    initConfirmation();
    initContactPrefill();
    if (CFG.mock && window.console) { window.console.info('[BRC] Lead endpoint is in MOCK mode. Set lead_mock=False in site_data.py and rebuild for production.'); }
  });
}(window.jQuery, window, document));
