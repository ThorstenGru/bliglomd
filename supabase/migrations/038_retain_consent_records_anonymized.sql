-- Decision reversal (2026-09-30, founder instruction during go-live verification):
-- migration 035 reworded the Privacy Policy to match the fact that consent
-- records were CASCADE-deleted with account deletion, rather than build
-- retention. Founder now wants the opposite: purchase consent (the
-- angerratt-waiver record) and signup consent (Terms/Privacy acceptance)
-- BOTH survive account deletion, anonymized -- closing a real legal gap
-- flagged in an earlier assessment (no way to prove a deleted customer once
-- waived their right of withdrawal or accepted the no-refund terms).
--
-- user_id is set NULL on deletion rather than kept, per explicit choice: the
-- record keeps its evidentiary value (timestamp, version, consent text,
-- price/device info) without staying linked to the person, the stronger
-- GDPR-compatible position under Art. 17(3)(e) (legal-claims exception).
--
-- Applied directly 2026-09-30 (this file records it for history/reproducibility).
-- The Privacy Policy text update + signup-consent trigger snapshot bump that
-- normally accompanies a retention-policy change is tracked separately -- see
-- go-live protocol -- since it touches published legal text.

alter table public.consent_records
  alter column user_id drop not null;
alter table public.consent_records
  drop constraint consent_records_user_id_fkey,
  add constraint consent_records_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete set null;

alter table public.signup_consent_records
  alter column user_id drop not null;
alter table public.signup_consent_records
  drop constraint signup_consent_records_user_id_fkey,
  add constraint signup_consent_records_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete set null;
