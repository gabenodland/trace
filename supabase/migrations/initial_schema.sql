


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


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."auto_set_completed_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Set completed_at when status becomes complete
  IF NEW.status = 'complete' AND (OLD.status IS NULL OR OLD.status != 'complete') THEN
    NEW.completed_at = now();
  END IF;

  -- Clear completed_at when status changes from complete to something else
  IF NEW.status != 'complete' AND OLD.status = 'complete' THEN
    NEW.completed_at = NULL;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_set_completed_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_entry_version"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Only increment if actual content fields changed (not just metadata)
  IF (
    OLD.title IS DISTINCT FROM NEW.title OR
    OLD.content IS DISTINCT FROM NEW.content OR
    OLD.tags IS DISTINCT FROM NEW.tags OR
    OLD.mentions IS DISTINCT FROM NEW.mentions OR
    OLD.stream_id IS DISTINCT FROM NEW.stream_id OR
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.due_date IS DISTINCT FROM NEW.due_date OR
    OLD.completed_at IS DISTINCT FROM NEW.completed_at OR
    OLD.entry_date IS DISTINCT FROM NEW.entry_date OR
    OLD.entry_latitude IS DISTINCT FROM NEW.entry_latitude OR
    OLD.entry_longitude IS DISTINCT FROM NEW.entry_longitude OR
    OLD.location_id IS DISTINCT FROM NEW.location_id OR
    OLD.priority IS DISTINCT FROM NEW.priority OR
    OLD.rating IS DISTINCT FROM NEW.rating OR
    OLD.is_pinned IS DISTINCT FROM NEW.is_pinned OR
    OLD.deleted_at IS DISTINCT FROM NEW.deleted_at
  ) THEN
    NEW.version = COALESCE(OLD.version, 1) + 1;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."increment_entry_version"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."increment_entry_version"() IS 'Auto-increments version column on entries when content fields change';



CREATE OR REPLACE FUNCTION "public"."increment_stream_version"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Only increment if actual content fields changed
  -- Note: full_path and parent_id were removed when categories became streams
  IF (
    OLD.name IS DISTINCT FROM NEW.name OR
    OLD.color IS DISTINCT FROM NEW.color OR
    OLD.icon IS DISTINCT FROM NEW.icon OR
    OLD.entry_title_template IS DISTINCT FROM NEW.entry_title_template OR
    OLD.entry_content_template IS DISTINCT FROM NEW.entry_content_template OR
    OLD.entry_use_rating IS DISTINCT FROM NEW.entry_use_rating OR
    OLD.entry_use_priority IS DISTINCT FROM NEW.entry_use_priority OR
    OLD.entry_use_status IS DISTINCT FROM NEW.entry_use_status OR
    OLD.entry_use_duedates IS DISTINCT FROM NEW.entry_use_duedates OR
    OLD.entry_use_location IS DISTINCT FROM NEW.entry_use_location OR
    OLD.entry_use_photos IS DISTINCT FROM NEW.entry_use_photos OR
    OLD.entry_content_type IS DISTINCT FROM NEW.entry_content_type OR
    OLD.is_private IS DISTINCT FROM NEW.is_private
  ) THEN
    NEW.version = COALESCE(OLD.version, 1) + 1;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."increment_stream_version"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."increment_stream_version"() IS 'Auto-increments version column on streams when content fields change';



CREATE OR REPLACE FUNCTION "public"."is_entry_owner"("p_entry_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM entries
    WHERE entry_id = p_entry_id
    AND user_id = auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."is_entry_owner"("p_entry_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_stream_owner"("p_stream_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM streams
    WHERE stream_id = p_stream_id
    AND user_id = auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."is_stream_owner"("p_stream_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_categories_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_categories_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_entry_completed_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Set completed_at when status becomes a completed status (done, closed, cancelled)
  IF NEW.status IN ('done', 'closed', 'cancelled') AND (OLD.status IS NULL OR OLD.status NOT IN ('done', 'closed', 'cancelled')) THEN
    NEW.completed_at := NOW();
  END IF;

  -- Clear completed_at when status changes from completed to non-completed
  IF NEW.status NOT IN ('done', 'closed', 'cancelled') AND OLD.status IN ('done', 'closed', 'cancelled') THEN
    NEW.completed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_entry_completed_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_locations_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_locations_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."entries" (
    "entry_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text",
    "content" "text" NOT NULL,
    "stream_id" "uuid",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "mentions" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "entry_latitude" double precision,
    "entry_longitude" double precision,
    "status" "text" DEFAULT 'none'::"text" NOT NULL,
    "due_date" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "attachments" "jsonb" DEFAULT '[]'::"jsonb",
    "location_accuracy" double precision,
    "deleted_at" timestamp with time zone,
    "entry_date" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "version" integer DEFAULT 1,
    "base_version" integer DEFAULT 1,
    "conflict_status" "text",
    "conflict_backup" "jsonb",
    "last_edited_by" "text",
    "last_edited_device" "text",
    "location_id" "uuid",
    "priority" integer DEFAULT 0 NOT NULL,
    "rating" numeric(4,2) DEFAULT 0.00 NOT NULL,
    "is_pinned" boolean DEFAULT false NOT NULL,
    "type" "text",
    CONSTRAINT "entries_conflict_status_check" CHECK ((("conflict_status" = ANY (ARRAY['conflicted'::"text", 'resolved'::"text"])) OR ("conflict_status" IS NULL))),
    CONSTRAINT "entries_rating_check" CHECK ((("rating" >= (0)::numeric) AND ("rating" <= (10)::numeric))),
    CONSTRAINT "entries_status_check" CHECK (("status" = ANY (ARRAY['none'::"text", 'new'::"text", 'todo'::"text", 'in_progress'::"text", 'in_review'::"text", 'waiting'::"text", 'on_hold'::"text", 'done'::"text", 'closed'::"text", 'cancelled'::"text"])))
);

ALTER TABLE ONLY "public"."entries" REPLICA IDENTITY FULL;


ALTER TABLE "public"."entries" OWNER TO "postgres";


COMMENT ON TABLE "public"."entries" IS 'Primary data entity - stores all captured content (notes, tasks, events). Single flexible model where attributes determine behavior.';



COMMENT ON COLUMN "public"."entries"."stream_id" IS 'Which stream the entry belongs to. NULL = Inbox (unorganized)';



COMMENT ON COLUMN "public"."entries"."tags" IS 'Freeform discovery keywords extracted from inline #tags in content';



COMMENT ON COLUMN "public"."entries"."mentions" IS 'Person references extracted from inline @mentions in content';



COMMENT ON COLUMN "public"."entries"."entry_latitude" IS 'GPS latitude captured when entry was created (exact location of user)';



COMMENT ON COLUMN "public"."entries"."entry_longitude" IS 'GPS longitude captured when entry was created (exact location of user)';



COMMENT ON COLUMN "public"."entries"."status" IS 'Entry status: none=note, new/todo/in_progress/in_review/waiting/on_hold=actionable task, done/closed/cancelled=completed task';



COMMENT ON COLUMN "public"."entries"."due_date" IS 'When set, entry appears in calendar views. Tasks can have due dates for deadlines.';



COMMENT ON COLUMN "public"."entries"."location_accuracy" IS 'GPS accuracy/precision in meters';



COMMENT ON COLUMN "public"."entries"."entry_date" IS 'The date when the memory/event actually occurred. Can be backdated for past memories. Defaults to created_at if not specified.';



COMMENT ON COLUMN "public"."entries"."version" IS 'Increments with each edit - used for conflict detection';



COMMENT ON COLUMN "public"."entries"."base_version" IS 'Server version this edit is based on - used for 3-way merge conflict detection';



COMMENT ON COLUMN "public"."entries"."conflict_status" IS 'null (no conflict), conflicted (conflict detected), or resolved (user resolved conflict)';



COMMENT ON COLUMN "public"."entries"."conflict_backup" IS 'JSON backup of losing version when conflict is detected';



COMMENT ON COLUMN "public"."entries"."last_edited_by" IS 'Email of user who last edited this entry';



COMMENT ON COLUMN "public"."entries"."last_edited_device" IS 'Device name that last edited this entry';



COMMENT ON COLUMN "public"."entries"."priority" IS 'Integer priority level for sorting and filtering (default: 0)';



COMMENT ON COLUMN "public"."entries"."rating" IS 'Decimal rating from 0.00 to 10.00 (stored internally on 0-10 scale)';



COMMENT ON COLUMN "public"."entries"."is_pinned" IS 'Boolean flag to pin important entries to the top (default: false)';



COMMENT ON COLUMN "public"."entries"."type" IS 'User-selected type for this entry. Must be one of the types defined in the stream.';



CREATE TABLE IF NOT EXISTS "public"."locations" (
    "location_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "latitude" double precision NOT NULL,
    "longitude" double precision NOT NULL,
    "source" "text",
    "address" "text",
    "neighborhood" "text",
    "postal_code" "text",
    "city" "text",
    "subdivision" "text",
    "region" "text",
    "country" "text",
    "mapbox_place_id" "text",
    "foursquare_fsq_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone
);

ALTER TABLE ONLY "public"."locations" REPLICA IDENTITY FULL;


ALTER TABLE "public"."locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."photos" (
    "photo_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entry_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "file_path" "text" NOT NULL,
    "thumbnail_path" "text",
    "mime_type" "text" DEFAULT 'image/jpeg'::"text" NOT NULL,
    "file_size" integer NOT NULL,
    "width" integer,
    "height" integer,
    "position" integer DEFAULT 0 NOT NULL,
    "captured_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."photos" REPLICA IDENTITY FULL;


ALTER TABLE "public"."photos" OWNER TO "postgres";


COMMENT ON TABLE "public"."photos" IS 'Photos attached to journal entries, stored inline within entry content';



COMMENT ON COLUMN "public"."photos"."file_path" IS 'Path in Supabase Storage bucket';



COMMENT ON COLUMN "public"."photos"."position" IS 'Order of photo within entry content (0-indexed)';



CREATE TABLE IF NOT EXISTS "public"."streams" (
    "stream_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "entry_count" integer DEFAULT 0 NOT NULL,
    "color" "text",
    "icon" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "version" integer DEFAULT 1,
    "base_version" integer DEFAULT 1,
    "conflict_status" "text",
    "conflict_backup" "jsonb",
    "last_edited_by" "text",
    "last_edited_device" "text",
    "entry_title_template" "text",
    "entry_content_template" "text",
    "entry_use_rating" boolean DEFAULT false NOT NULL,
    "entry_use_priority" boolean DEFAULT false NOT NULL,
    "entry_use_status" boolean DEFAULT true NOT NULL,
    "entry_use_duedates" boolean DEFAULT false NOT NULL,
    "entry_use_location" boolean DEFAULT true NOT NULL,
    "entry_use_photos" boolean DEFAULT true NOT NULL,
    "entry_content_type" "text" DEFAULT 'richformat'::"text" NOT NULL,
    "is_private" boolean DEFAULT false NOT NULL,
    "is_localonly" boolean DEFAULT false NOT NULL,
    "entry_types" "text"[] DEFAULT '{}'::"text"[],
    "entry_use_type" boolean DEFAULT false,
    "entry_rating_type" "text" DEFAULT 'stars'::"text",
    "entry_statuses" "text"[] DEFAULT ARRAY['new'::"text", 'todo'::"text", 'in_progress'::"text", 'done'::"text"],
    "entry_default_status" "text" DEFAULT 'new'::"text",
    CONSTRAINT "categories_conflict_status_check" CHECK ((("conflict_status" = ANY (ARRAY['conflicted'::"text", 'resolved'::"text"])) OR ("conflict_status" IS NULL))),
    CONSTRAINT "categories_entry_content_type_check" CHECK (("entry_content_type" = ANY (ARRAY['text'::"text", 'list'::"text", 'richformat'::"text", 'bullet'::"text"]))),
    CONSTRAINT "category_name_not_empty" CHECK (("length"(TRIM(BOTH FROM "name")) > 0)),
    CONSTRAINT "chk_entry_rating_type" CHECK (("entry_rating_type" = ANY (ARRAY['stars'::"text", 'decimal_whole'::"text", 'decimal'::"text"]))),
    CONSTRAINT "valid_entry_default_status" CHECK ((("entry_default_status" IS NULL) OR ("entry_default_status" = ANY (ARRAY['none'::"text", 'new'::"text", 'todo'::"text", 'in_progress'::"text", 'in_review'::"text", 'waiting'::"text", 'on_hold'::"text", 'done'::"text", 'closed'::"text", 'cancelled'::"text"]))))
);

ALTER TABLE ONLY "public"."streams" REPLICA IDENTITY FULL;


ALTER TABLE "public"."streams" OWNER TO "postgres";


COMMENT ON TABLE "public"."streams" IS 'Flat organizational structure for entries (like buckets/feeds). Users create streams to organize their captures.';



COMMENT ON COLUMN "public"."streams"."version" IS 'Increments with each edit - used for conflict detection';



COMMENT ON COLUMN "public"."streams"."base_version" IS 'Server version this edit is based on - used for 3-way merge conflict detection';



COMMENT ON COLUMN "public"."streams"."conflict_status" IS 'null (no conflict), conflicted (conflict detected), or resolved (user resolved conflict)';



COMMENT ON COLUMN "public"."streams"."conflict_backup" IS 'JSON backup of losing version when conflict is detected';



COMMENT ON COLUMN "public"."streams"."last_edited_by" IS 'Email of user who last edited this category';



COMMENT ON COLUMN "public"."streams"."last_edited_device" IS 'Device name that last edited this category';



COMMENT ON COLUMN "public"."streams"."entry_title_template" IS 'Template for auto-populating entry titles. Supports variables: {date}, {day}, {month}';



COMMENT ON COLUMN "public"."streams"."entry_content_template" IS 'Template for auto-populating entry content';



COMMENT ON COLUMN "public"."streams"."entry_use_rating" IS 'Enable rating field for entries in this category';



COMMENT ON COLUMN "public"."streams"."entry_use_priority" IS 'Enable priority field for entries in this category';



COMMENT ON COLUMN "public"."streams"."entry_use_status" IS 'Enable status field for entries in this category';



COMMENT ON COLUMN "public"."streams"."entry_use_duedates" IS 'Enable due dates for entries in this category';



COMMENT ON COLUMN "public"."streams"."entry_use_location" IS 'Enable location tracking for entries in this category';



COMMENT ON COLUMN "public"."streams"."entry_use_photos" IS 'Enable photo attachments for entries in this category';



COMMENT ON COLUMN "public"."streams"."entry_content_type" IS 'Content type for entries: text, list, richformat, or bullet (future use)';



COMMENT ON COLUMN "public"."streams"."is_private" IS 'If true, entries only show when viewing this category directly, not in "All" or parent categories';



COMMENT ON COLUMN "public"."streams"."is_localonly" IS 'If true, category and its entries will not sync to cloud';



COMMENT ON COLUMN "public"."streams"."entry_types" IS 'Array of custom type names available for entries in this stream. User-defined, stored alphabetically.';



COMMENT ON COLUMN "public"."streams"."entry_use_type" IS 'Whether the type feature is enabled for this stream. Default: false.';



COMMENT ON COLUMN "public"."streams"."entry_rating_type" IS 'Rating display type: stars (1-5 stars), decimal_whole (0-10 whole numbers), or decimal (0-10 with tenths). All ratings stored internally on 0-10 scale.';



COMMENT ON COLUMN "public"."streams"."entry_statuses" IS 'Array of allowed status values for entries in this stream. Default: [new, todo, in_progress, done]';



COMMENT ON COLUMN "public"."streams"."entry_default_status" IS 'Default status assigned to new entries in this stream when status is enabled. Default: new';



ALTER TABLE ONLY "public"."streams"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("stream_id");



ALTER TABLE ONLY "public"."entries"
    ADD CONSTRAINT "entries_pkey" PRIMARY KEY ("entry_id");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_pkey" PRIMARY KEY ("location_id");



ALTER TABLE ONLY "public"."photos"
    ADD CONSTRAINT "photos_pkey" PRIMARY KEY ("photo_id");



CREATE INDEX "idx_categories_conflict_status" ON "public"."streams" USING "btree" ("conflict_status") WHERE ("conflict_status" IS NOT NULL);



CREATE INDEX "idx_categories_is_localonly" ON "public"."streams" USING "btree" ("is_localonly") WHERE ("is_localonly" = true);



CREATE INDEX "idx_categories_is_private" ON "public"."streams" USING "btree" ("is_private") WHERE ("is_private" = true);



CREATE INDEX "idx_categories_user_id" ON "public"."streams" USING "btree" ("user_id");



CREATE INDEX "idx_entries_category_id" ON "public"."entries" USING "btree" ("stream_id");



CREATE INDEX "idx_entries_conflict_status" ON "public"."entries" USING "btree" ("conflict_status") WHERE ("conflict_status" IS NOT NULL);



CREATE INDEX "idx_entries_content_search" ON "public"."entries" USING "gin" ("to_tsvector"('"english"'::"regconfig", "content"));



CREATE INDEX "idx_entries_created_at" ON "public"."entries" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_entries_deleted_at" ON "public"."entries" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_entries_due_date" ON "public"."entries" USING "btree" ("user_id", "due_date") WHERE ("due_date" IS NOT NULL);



CREATE INDEX "idx_entries_entry_date" ON "public"."entries" USING "btree" ("user_id", "entry_date" DESC);



CREATE INDEX "idx_entries_gps_coords" ON "public"."entries" USING "btree" ("entry_latitude", "entry_longitude") WHERE (("entry_latitude" IS NOT NULL) AND ("entry_longitude" IS NOT NULL));



CREATE INDEX "idx_entries_is_pinned" ON "public"."entries" USING "btree" ("is_pinned") WHERE ("is_pinned" = true);



CREATE INDEX "idx_entries_location_id" ON "public"."entries" USING "btree" ("location_id");



CREATE INDEX "idx_entries_mentions" ON "public"."entries" USING "gin" ("mentions");



CREATE INDEX "idx_entries_priority" ON "public"."entries" USING "btree" ("priority" DESC);



CREATE INDEX "idx_entries_status" ON "public"."entries" USING "btree" ("user_id", "status");



CREATE INDEX "idx_entries_tags" ON "public"."entries" USING "gin" ("tags");



CREATE INDEX "idx_entries_type" ON "public"."entries" USING "btree" ("type");



CREATE INDEX "idx_entries_updated_at" ON "public"."entries" USING "btree" ("user_id", "updated_at" DESC);



CREATE INDEX "idx_entries_updated_at_deleted" ON "public"."entries" USING "btree" ("updated_at" DESC, "deleted_at");



CREATE INDEX "idx_entries_user_id" ON "public"."entries" USING "btree" ("user_id");



CREATE INDEX "idx_locations_city" ON "public"."locations" USING "btree" ("city");



CREATE INDEX "idx_locations_coords" ON "public"."locations" USING "btree" ("latitude", "longitude");



CREATE INDEX "idx_locations_deleted_at" ON "public"."locations" USING "btree" ("deleted_at");



CREATE INDEX "idx_locations_name" ON "public"."locations" USING "btree" ("name");



CREATE INDEX "idx_locations_user_id" ON "public"."locations" USING "btree" ("user_id");



CREATE INDEX "idx_photos_entry_id" ON "public"."photos" USING "btree" ("entry_id");



CREATE INDEX "idx_photos_position" ON "public"."photos" USING "btree" ("entry_id", "position");



CREATE INDEX "idx_photos_user_id" ON "public"."photos" USING "btree" ("user_id");



CREATE INDEX "idx_streams_entry_default_status" ON "public"."streams" USING "btree" ("entry_default_status");



CREATE OR REPLACE TRIGGER "increment_entries_version" BEFORE UPDATE ON "public"."entries" FOR EACH ROW EXECUTE FUNCTION "public"."increment_entry_version"();



CREATE OR REPLACE TRIGGER "increment_streams_version" BEFORE UPDATE ON "public"."streams" FOR EACH ROW EXECUTE FUNCTION "public"."increment_stream_version"();



CREATE OR REPLACE TRIGGER "locations_updated_at_trigger" BEFORE UPDATE ON "public"."locations" FOR EACH ROW EXECUTE FUNCTION "public"."update_locations_updated_at"();



CREATE OR REPLACE TRIGGER "set_completed_at" BEFORE INSERT OR UPDATE ON "public"."entries" FOR EACH ROW EXECUTE FUNCTION "public"."update_entry_completed_at"();



CREATE OR REPLACE TRIGGER "update_categories_updated_at" BEFORE UPDATE ON "public"."streams" FOR EACH ROW EXECUTE FUNCTION "public"."update_categories_updated_at"();



CREATE OR REPLACE TRIGGER "update_entries_updated_at" BEFORE UPDATE ON "public"."entries" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_photos_updated_at" BEFORE UPDATE ON "public"."photos" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."streams"
    ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entries"
    ADD CONSTRAINT "entries_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("location_id");



ALTER TABLE ONLY "public"."entries"
    ADD CONSTRAINT "entries_stream_id_fkey" FOREIGN KEY ("stream_id") REFERENCES "public"."streams"("stream_id");



ALTER TABLE ONLY "public"."entries"
    ADD CONSTRAINT "entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."photos"
    ADD CONSTRAINT "photos_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("entry_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."photos"
    ADD CONSTRAINT "photos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Users can create their own entries" ON "public"."entries" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own streams" ON "public"."streams" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own entries" ON "public"."entries" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own locations" ON "public"."locations" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own photos" ON "public"."photos" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own streams" ON "public"."streams" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own categories" ON "public"."streams" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own entries" ON "public"."entries" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own locations" ON "public"."locations" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own photos" ON "public"."photos" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can soft delete their own entries" ON "public"."entries" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own entries" ON "public"."entries" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own locations" ON "public"."locations" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own photos" ON "public"."photos" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own streams" ON "public"."streams" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own entries" ON "public"."entries" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own locations" ON "public"."locations" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own photos" ON "public"."photos" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own streams" ON "public"."streams" FOR SELECT USING (("auth"."uid"() = "user_id"));



COMMENT ON POLICY "Users can view their own streams" ON "public"."streams" IS 'RLS policy: Ensures users can only SELECT their own streams via user_id = auth.uid()';



ALTER TABLE "public"."entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."locations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."streams" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."entries";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."locations";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."photos";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."streams";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."auto_set_completed_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_set_completed_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_set_completed_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_entry_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_entry_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_entry_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_stream_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_stream_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_stream_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_entry_owner"("p_entry_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_entry_owner"("p_entry_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_entry_owner"("p_entry_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_stream_owner"("p_stream_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_stream_owner"("p_stream_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_stream_owner"("p_stream_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_categories_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_categories_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_categories_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_entry_completed_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_entry_completed_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_entry_completed_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_locations_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_locations_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_locations_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."entries" TO "anon";
GRANT ALL ON TABLE "public"."entries" TO "authenticated";
GRANT ALL ON TABLE "public"."entries" TO "service_role";



GRANT ALL ON TABLE "public"."locations" TO "anon";
GRANT ALL ON TABLE "public"."locations" TO "authenticated";
GRANT ALL ON TABLE "public"."locations" TO "service_role";



GRANT ALL ON TABLE "public"."photos" TO "anon";
GRANT ALL ON TABLE "public"."photos" TO "authenticated";
GRANT ALL ON TABLE "public"."photos" TO "service_role";



GRANT ALL ON TABLE "public"."streams" TO "anon";
GRANT ALL ON TABLE "public"."streams" TO "authenticated";
GRANT ALL ON TABLE "public"."streams" TO "service_role";









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































RESET ALL;
