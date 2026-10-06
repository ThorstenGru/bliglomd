-- Allow the static guide pages (public/guider/t.js) to log CTA clicks so the
-- guide → /scan conversion step is measurable.
alter table public.analytics_events drop constraint analytics_events_event_type_check;
alter table public.analytics_events add constraint analytics_events_event_type_check
  check (event_type in (
    'pageview', 'exit', 'search_no_match', 'guide_cta_click',
    'scan_completed', 'signup_started', 'signup_completed',
    'checkout_started', 'checkout_completed', 'request_sent'
  ));
