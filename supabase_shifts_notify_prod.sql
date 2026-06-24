-- ============================================================
-- ПРОД (Тоймарт): триггер пушей → Edge Function notify-new-offer.
-- Отличие от демо-версии: боевой URL функции + прод-anon.
-- Запускать на ПРОД-Supabase ПОСЛЕ деплоя функции notify-new-offer. Идемпотентно.
-- ============================================================
create extension if not exists pg_net;

create or replace function shift_offer_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://gbyxhcsbvadseegtoxoc.supabase.co/functions/v1/notify-new-offer',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdieXhoY3NidmFkc2VlZ3RveG9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzQ5NjMsImV4cCI6MjA5NjE1MDk2M30.zGjskbaqKGkMtgeXOr_11MdtNjDP0Q8kOEuB-VHvcoc',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdieXhoY3NidmFkc2VlZ3RveG9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzQ5NjMsImV4cCI6MjA5NjE1MDk2M30.zGjskbaqKGkMtgeXOr_11MdtNjDP0Q8kOEuB-VHvcoc'
    ),
    body := jsonb_build_object(
      'store_id', NEW.store_id, 'position', NEW.position,
      'shift_date', NEW.shift_date, 'pay', NEW.pay, 'pay_note', NEW.pay_note
    )
  );
  return NEW;
end; $$;

drop trigger if exists shift_offers_notify on shift_offers;
create trigger shift_offers_notify after insert on shift_offers
  for each row execute procedure shift_offer_notify();
