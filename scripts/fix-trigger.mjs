import pg from "pg";

const client = new pg.Client({
  connectionString: process.env.DIRECT_URL,
});

await client.connect();
console.log("Connected. Fixing trigger...");

try {
  await client.query(`
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
      INSERT INTO public.users (id, name, email, created_at, updated_at)
      VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
        NEW.email,
        NOW(),
        NOW()
      );
      RETURN NEW;
    END;
    $$;
  `);
  console.log("Trigger fixed successfully.");
} catch (err) {
  console.error("Failed:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
