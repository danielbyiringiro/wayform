


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."channel_type"("p_channel" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select type from public.channels where id = p_channel;
$$;


ALTER FUNCTION "public"."channel_type"("p_channel" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."course_of_channel"("p_channel" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select course_id from public.channels where id = p_channel;
$$;


ALTER FUNCTION "public"."course_of_channel"("p_channel" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_case_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare cnt integer;
begin
  if new.created_by is not null and new.is_seed = false then
    select count(*) into cnt
      from public.cases
      where created_by = new.created_by and is_seed = false;
    if cnt >= 1 then
      raise exception 'Limit reached: each member can add at most 1 case.'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end; $$;


ALTER FUNCTION "public"."enforce_case_limit"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "avatar_url" "text",
    "role" "text" DEFAULT 'student'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['student'::"text", 'staff'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_profile"() RETURNS "public"."profiles"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_id    uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_name  text;
  v_row   public.profiles;
begin
  if v_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_email is null or v_email !~* '@ashesi\.edu\.gh$' then
    raise exception 'Only ashesi.edu.gh accounts may use this app';
  end if;

  v_name := coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'name', ''),
    split_part(v_email, '@', 1)
  );

  insert into public.profiles (id, email, full_name, role)
  values (v_id, v_email, v_name, 'student')
  on conflict (id) do update
    set email = excluded.email
  returning * into v_row;

  return v_row;
end;
$_$;


ALTER FUNCTION "public"."ensure_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
begin
  if new.email is null or new.email !~* '@ashesi\.edu\.gh$' then
    raise exception 'Only ashesi.edu.gh accounts may use this app';
  end if;

  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url',
    'student'
  )
  on conflict (id) do nothing;

  return new;
end;
$_$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_course_member"("p_course" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.is_course_staff(p_course)
    or exists(
      select 1 from public.enrollments
      where course_id = p_course and user_id = auth.uid()
    );
$$;


ALTER FUNCTION "public"."is_course_member"("p_course" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_course_staff"("p_course" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists(
    select 1 from public.staff_assignments
    where course_id = p_course and user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_course_staff"("p_course" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_cohort_in_course"("p_course" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select cohort_id from public.enrollments
  where course_id = p_course and user_id = auth.uid()
  limit 1;
$$;


ALTER FUNCTION "public"."my_cohort_in_course"("p_course" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select role from public.profiles where id = auth.uid();
$$;


ALTER FUNCTION "public"."my_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin new.updated_at = now(); return new; end; $$;


ALTER FUNCTION "public"."touch_updated_at"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nb" integer,
    "name" "text" NOT NULL,
    "sc" "text",
    "pd" "text",
    "approved" "text",
    "dq" "text",
    "consular" "text",
    "interview" "text",
    "visa" "text",
    "stage" "text" DEFAULT 'Pending'::"text" NOT NULL,
    "pd_current" boolean DEFAULT false NOT NULL,
    "awaiting" boolean GENERATED ALWAYS AS (("stage" <> 'Issued'::"text")) STORED,
    "is_seed" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "creator_email" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cases_stage_check" CHECK (("stage" = ANY (ARRAY['Pending'::"text", 'Current'::"text", 'Approved'::"text", 'Interview'::"text", 'Admin Processing'::"text", 'Issued'::"text"])))
);


ALTER TABLE "public"."cases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."channels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_id" "uuid" NOT NULL,
    "key" "text" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "channels_type_check" CHECK (("type" = ANY (ARRAY['announcements'::"text", 'questions'::"text", 'general'::"text"])))
);


ALTER TABLE "public"."channels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cohorts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_id" "uuid" NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "public"."cohorts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."courses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "title" "text" NOT NULL,
    "term" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."courses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."enrollments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "cohort_id" "uuid" NOT NULL,
    "course_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."enrollments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "parent_id" "uuid",
    "cohort_scope_id" "uuid",
    "is_question" boolean DEFAULT false NOT NULL,
    "resolved" boolean DEFAULT false NOT NULL,
    "mentions_staff" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "messages_body_check" CHECK ((("char_length"("body") >= 1) AND ("char_length"("body") <= 4000)))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "course_id" "uuid" NOT NULL,
    "title" "text" DEFAULT 'TA'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "staff_assignments_title_check" CHECK (("title" = ANY (ARRAY['Lecturer'::"text", 'TA'::"text"])))
);


ALTER TABLE "public"."staff_assignments" OWNER TO "postgres";


ALTER TABLE ONLY "public"."cases"
    ADD CONSTRAINT "cases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."channels"
    ADD CONSTRAINT "channels_course_id_key_key" UNIQUE ("course_id", "key");



ALTER TABLE ONLY "public"."channels"
    ADD CONSTRAINT "channels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cohorts"
    ADD CONSTRAINT "cohorts_course_id_name_key" UNIQUE ("course_id", "name");



ALTER TABLE ONLY "public"."cohorts"
    ADD CONSTRAINT "cohorts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_code_term_key" UNIQUE ("code", "term");



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_user_id_course_id_key" UNIQUE ("user_id", "course_id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_assignments"
    ADD CONSTRAINT "staff_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_assignments"
    ADD CONSTRAINT "staff_assignments_user_id_course_id_key" UNIQUE ("user_id", "course_id");



CREATE INDEX "cases_created_by_idx" ON "public"."cases" USING "btree" ("created_by");



CREATE INDEX "cases_stage_idx" ON "public"."cases" USING "btree" ("stage");



CREATE INDEX "idx_enrollments_user" ON "public"."enrollments" USING "btree" ("user_id");



CREATE INDEX "idx_messages_channel" ON "public"."messages" USING "btree" ("channel_id", "created_at");



CREATE INDEX "idx_messages_parent" ON "public"."messages" USING "btree" ("parent_id");



CREATE INDEX "idx_staff_user" ON "public"."staff_assignments" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "trg_case_limit" BEFORE INSERT ON "public"."cases" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_case_limit"();



CREATE OR REPLACE TRIGGER "trg_touch" BEFORE UPDATE ON "public"."cases" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



ALTER TABLE ONLY "public"."cases"
    ADD CONSTRAINT "cases_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."channels"
    ADD CONSTRAINT "channels_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cohorts"
    ADD CONSTRAINT "cohorts_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_cohort_scope_id_fkey" FOREIGN KEY ("cohort_scope_id") REFERENCES "public"."cohorts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_assignments"
    ADD CONSTRAINT "staff_assignments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_assignments"
    ADD CONSTRAINT "staff_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE "public"."cases" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cases_delete_own" ON "public"."cases" FOR DELETE TO "authenticated" USING ((("created_by" = "auth"."uid"()) AND ("is_seed" = false)));



CREATE POLICY "cases_insert_own" ON "public"."cases" FOR INSERT TO "authenticated" WITH CHECK ((("created_by" = "auth"."uid"()) AND ("is_seed" = false)));



CREATE POLICY "cases_read_all" ON "public"."cases" FOR SELECT USING (true);



CREATE POLICY "cases_update_own" ON "public"."cases" FOR UPDATE TO "authenticated" USING ((("created_by" = "auth"."uid"()) AND ("is_seed" = false))) WITH CHECK ((("created_by" = "auth"."uid"()) AND ("is_seed" = false)));



ALTER TABLE "public"."channels" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "channels readable to members" ON "public"."channels" FOR SELECT TO "authenticated" USING ("public"."is_course_member"("course_id"));



ALTER TABLE "public"."cohorts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cohorts readable" ON "public"."cohorts" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."courses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "courses readable" ON "public"."courses" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "drop own enrollment" ON "public"."enrollments" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."enrollments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles readable" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "read messages" ON "public"."messages" FOR SELECT TO "authenticated" USING (("public"."is_course_member"("public"."course_of_channel"("channel_id")) AND (("cohort_scope_id" IS NULL) OR "public"."is_course_staff"("public"."course_of_channel"("channel_id")) OR ("cohort_scope_id" = "public"."my_cohort_in_course"("public"."course_of_channel"("channel_id"))))));



CREATE POLICY "read own or staff enrollments" ON "public"."enrollments" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_course_staff"("course_id")));



CREATE POLICY "read staff of my courses" ON "public"."staff_assignments" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_course_member"("course_id")));



CREATE POLICY "self enrol" ON "public"."enrollments" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND ("public"."my_role"() = 'student'::"text")));



CREATE POLICY "send messages" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK ((("author_id" = "auth"."uid"()) AND "public"."is_course_member"("public"."course_of_channel"("channel_id")) AND (("public"."channel_type"("channel_id") <> 'announcements'::"text") OR "public"."is_course_staff"("public"."course_of_channel"("channel_id"))) AND (("cohort_scope_id" IS NULL) OR "public"."is_course_staff"("public"."course_of_channel"("channel_id")))));



ALTER TABLE "public"."staff_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "update own or staff" ON "public"."messages" FOR UPDATE TO "authenticated" USING ((("author_id" = "auth"."uid"()) OR "public"."is_course_staff"("public"."course_of_channel"("channel_id"))));



CREATE POLICY "update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"()));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."channel_type"("p_channel" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."channel_type"("p_channel" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."channel_type"("p_channel" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."course_of_channel"("p_channel" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."course_of_channel"("p_channel" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."course_of_channel"("p_channel" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_case_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_case_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_case_limit"() TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_course_member"("p_course" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_course_member"("p_course" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_course_member"("p_course" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_course_staff"("p_course" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_course_staff"("p_course" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_course_staff"("p_course" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."my_cohort_in_course"("p_course" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."my_cohort_in_course"("p_course" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."my_cohort_in_course"("p_course" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."my_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."my_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."my_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."cases" TO "anon";
GRANT ALL ON TABLE "public"."cases" TO "authenticated";
GRANT ALL ON TABLE "public"."cases" TO "service_role";



GRANT ALL ON TABLE "public"."channels" TO "anon";
GRANT ALL ON TABLE "public"."channels" TO "authenticated";
GRANT ALL ON TABLE "public"."channels" TO "service_role";



GRANT ALL ON TABLE "public"."cohorts" TO "anon";
GRANT ALL ON TABLE "public"."cohorts" TO "authenticated";
GRANT ALL ON TABLE "public"."cohorts" TO "service_role";



GRANT ALL ON TABLE "public"."courses" TO "anon";
GRANT ALL ON TABLE "public"."courses" TO "authenticated";
GRANT ALL ON TABLE "public"."courses" TO "service_role";



GRANT ALL ON TABLE "public"."enrollments" TO "anon";
GRANT ALL ON TABLE "public"."enrollments" TO "authenticated";
GRANT ALL ON TABLE "public"."enrollments" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."staff_assignments" TO "anon";
GRANT ALL ON TABLE "public"."staff_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_assignments" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







