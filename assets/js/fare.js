/*!
 * fare.js - pure fare + place-search logic (no DOM, no jQuery).
 * Mirrors site_data.py so the fare tables printed on route pages equal the live calculator.
 * Browser: window.BRC.fare   |   Node: module.exports(data)
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) { module.exports = factory; }
  else {
    root.BRC = root.BRC || {};
    root.BRC.fare = factory(root.BRC_DATA);
  }
}(typeof self !== 'undefined' ? self : this, function (DATA) {
  'use strict';

  var vehicles = DATA.vehicles;
  var places = DATA.places.map(function (p) {
    return { id: p[0], name: p[1], region: p[2], lat: p[3], lng: p[4], type: p[5],
             aliases: p[6] || '', key: (p[1] + ' ' + p[0].replace(/-/g, ' ') + ' ' + (p[6] || '')).toLowerCase() };
  });
  var byId = {}, byName = {};
  places.forEach(function (p) { byId[p.id] = p; byName[p.name.toLowerCase()] = p; });
  var vById = {};
  vehicles.forEach(function (v) { vById[v.id] = v; });

  function round10(x) { return Math.round(x / 10) * 10; }

  function inr(n) {
    n = Math.round(n);
    try { return n.toLocaleString('en-IN'); } catch (e) { return String(n); }
  }

  function haversine(a, b) {
    var R = 6371, rad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    var h = Math.pow(Math.sin(dLat / 2), 2) +
            Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.pow(Math.sin(dLng / 2), 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  /** Road distance in km. Verified overrides first, else straight-line x road factor. */
  function distanceKm(aId, bId) {
    var key = [aId, bId].sort().join('|');
    if (DATA.routeKm[key]) { return DATA.routeKm[key]; }
    var straight = haversine(byId[aId], byId[bId]);
    return Math.max(3, Math.round(straight * (straight > 40 ? 1.28 : 1.4)));
  }

  /** Resolve free text to a known place (exact name / id / alias). */
  function findPlace(text) {
    if (!text) { return null; }
    var t = String(text).trim().toLowerCase();
    if (!t) { return null; }
    if (byName[t]) { return byName[t]; }
    if (byId[t.replace(/\s+/g, '-')]) { return byId[t.replace(/\s+/g, '-')]; }
    for (var i = 0; i < places.length; i++) {
      var p = places[i];
      if (p.aliases && (' ' + p.aliases + ' ').indexOf(' ' + t + ' ') > -1) { return p; }
    }
    return null;
  }

  /** Ranked autocomplete. opts: {types:[...], limit:n}. */
  function search(query, opts) {
    opts = opts || {};
    var q = String(query || '').trim().toLowerCase();
    var limit = opts.limit || 7;
    var pool = places.filter(function (p) { return !opts.types || opts.types.indexOf(p.type) > -1; });
    if (!q) {
      var pop = (DATA.popular || []).map(function (id) { return byId[id]; }).filter(Boolean)
        .filter(function (p) { return !opts.types || opts.types.indexOf(p.type) > -1; });
      return (pop.length ? pop : pool).slice(0, limit);
    }
    var tokens = q.split(/\s+/);
    var scored = [];
    pool.forEach(function (p) {
      var name = p.name.toLowerCase(), score = 0;
      if (name === q) { score = 100; }
      else if (name.indexOf(q) === 0) { score = 80; }
      else if (new RegExp('(^|[\\s,(-])' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(name)) { score = 60; }
      else if (tokens.every(function (t) { return p.key.indexOf(t) > -1; })) { score = 40; }
      if (score) {
        if (p.type === 'city') { score += 3; }
        scored.push({ p: p, s: score });
      }
    });
    scored.sort(function (a, b) { return b.s - a.s || a.p.name.length - b.p.name.length; });
    return scored.slice(0, limit).map(function (x) { return x.p; });
  }

  /**
   * Quote one vehicle.
   * input: {trip:'oneway'|'round'|'airport', from:placeId, to:placeId, vehicle:id, days:int}
   */
  function quote(input) {
    var v = vById[input.vehicle];
    var km = distanceKm(input.from, input.to);
    var P = DATA.policy;
    var q = { trip: input.trip, vehicle: v.id, km: km, lines: [], notes: [] };
    if (input.trip === 'round') {
      var days = Math.max(1, input.days || 1);
      var billed = Math.max(km * 2, P.minRoundPerDay * days);
      var base = billed * v.rt;
      var da = Math.max(0, days - 1) * v.da;
      q.days = days; q.billedKm = billed; q.rate = v.rt;
      q.lines.push(['Distance (round trip)', km * 2 + ' km']);
      if (billed > km * 2) { q.lines.push(['Billed at minimum ' + P.minRoundPerDay + ' km/day x ' + days + ' day' + (days > 1 ? 's' : ''), billed + ' km']); }
      q.lines.push(['Rate', '\u20B9' + v.rt + '/km']);
      q.lines.push(['Base fare', '\u20B9' + inr(base)]);
      if (da) { q.lines.push(['Driver allowance (' + (days - 1) + ' night' + (days > 2 ? 's' : '') + ')', '\u20B9' + inr(da)]); }
      q.total = round10(base + da);
    } else if (input.trip === 'airport') {
      var inc = P.airportIncludedKm, extra = Math.max(0, km - inc);
      q.billedKm = km; q.rate = v.ak;
      q.lines.push(['Distance', km + ' km']);
      q.lines.push(['Base fare (first ' + inc + ' km)', '\u20B9' + inr(v.ab)]);
      if (extra) { q.lines.push(['Extra ' + extra + ' km x \u20B9' + v.ak, '\u20B9' + inr(extra * v.ak)]); }
      q.lines.push(['Airport waiting', P.airportWaitMin + ' min free']);
      q.total = round10(v.ab + extra * v.ak);
    } else {
      var billedOw = Math.max(km, P.minOneway);
      q.billedKm = billedOw; q.rate = v.ow;
      q.lines.push(['Distance', km + ' km']);
      if (billedOw > km) { q.lines.push(['Billed at minimum', billedOw + ' km']); }
      q.lines.push(['Rate (one way)', '\u20B9' + v.ow + '/km']);
      q.lines.push(['Driver allowance', 'Included']);
      q.total = round10(billedOw * v.ow);
    }
    return q;
  }

  /** Quote every vehicle that seats `pax`; returns array sorted by price. */
  function quoteAll(input, pax) {
    return vehicles.filter(function (v) { return !pax || v.seats >= pax; })
      .map(function (v) { return quote({ trip: input.trip, from: input.from, to: input.to, vehicle: v.id, days: input.days }); })
      .sort(function (a, b) { return a.total - b.total; });
  }

  /** Smallest vehicle (by price rank in fleet order) that seats pax. */
  function vehicleFor(pax) {
    for (var i = 0; i < vehicles.length; i++) { if (vehicles[i].seats >= pax) { return vehicles[i]; } }
    return vehicles[vehicles.length - 1];
  }

  return {
    data: DATA, places: places, vehicles: vehicles, vehicleById: vById, placeById: byId,
    findPlace: findPlace, search: search, distanceKm: distanceKm, quote: quote, quoteAll: quoteAll,
    vehicleFor: vehicleFor, inr: inr
  };
}));
