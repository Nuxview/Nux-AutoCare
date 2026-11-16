-- Remove Supabase default browser grants from related server-only tables.
revoke all on table
  public.franchises, public.invoice_lines, public.job_stages,
  public.notifications, public.plans, public.push_devices,
  public.repair_tasks, public.repair_photos
from public, anon, authenticated;
