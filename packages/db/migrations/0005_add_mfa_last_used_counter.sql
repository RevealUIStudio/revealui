-- B-03: TOTP replay prevention — track the time counter of the last used TOTP code
ALTER TABLE "users" ADD COLUMN "mfa_last_used_counter" integer;
