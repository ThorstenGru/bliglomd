// First-party, cookie-free guide analytics — mirrors src/lib/analytics.ts so
// guide visits show up in the same analytics_events table (Trafik tab + weekly
// digest). Same sessionStorage keys, so a guide → app visit is one session.
// The anon key is public by design (already shipped in the app bundle); the
// table is insert-only for anonymous callers.
(function () {
  var URL_ = 'https://ydkahdqvuykpmjkpunck.supabase.co/rest/v1/analytics_events';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlka2FoZHF2dXlrcG1qa3B1bmNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MzU0MTIsImV4cCI6MjA5ODAxMTQxMn0.GqHeG9p69YWWpdtuLNVBkMB4TMV2kXvXAg6YXN1RZ4c';
  try {
    var sid = sessionStorage.getItem('bliglomd-session-id');
    if (!sid) { sid = crypto.randomUUID(); sessionStorage.setItem('bliglomd-session-id', sid); }
    var landing = !sessionStorage.getItem('bliglomd-landing-logged');
    if (landing) sessionStorage.setItem('bliglomd-landing-logged', '1');

    function send(type, extra) {
      var body = { session_id: sid, event_type: type, path: location.pathname.slice(0, 500), lang: 'sv' };
      for (var k in extra) body[k] = extra[k];
      fetch(URL_, {
        method: 'POST', keepalive: true,
        headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(body)
      }).catch(function () {});
    }

    var ref = '', refDomain = '';
    if (landing && document.referrer) {
      ref = document.referrer.slice(0, 500);
      try {
        var h = new URL(document.referrer).hostname.replace(/^www\./, '');
        if (!/(^|\.)(xn--bliglmd-e1a\.se|bliglömd\.se)$/.test(h)) refDomain = h;
      } catch (e) {}
    }
    var p = new URLSearchParams(location.search);
    send('pageview', {
      referrer: ref || null, referrer_domain: refDomain || null,
      utm_source: p.get('utm_source'), utm_medium: p.get('utm_medium'), utm_campaign: p.get('utm_campaign'),
      metadata: { is_landing: landing ? 'true' : 'false', kind: 'guide' }
    });

    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="/scan"]');
      if (a) send('guide_cta_click', { metadata: { kind: 'guide' } });
    });
  } catch (e) {}
})();
