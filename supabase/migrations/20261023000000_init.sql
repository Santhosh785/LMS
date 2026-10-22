CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"legacy_id" text,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'student' NOT NULL,
	"suspended_at" timestamp with time zone,
	"suspended_reason" text,
	"avatar_initials" text,
	"phone" text,
	"education" text,
	"current_profile" text,
	"preferred_language" text,
	"streak_days" integer DEFAULT 0 NOT NULL,
	"hours_this_week" integer DEFAULT 0 NOT NULL,
	"seeds" integer DEFAULT 0 NOT NULL,
	"weekly_goal_hours" integer DEFAULT 8 NOT NULL,
	"password_changed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_legacyId_unique" UNIQUE("legacy_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"user_id" uuid NOT NULL,
	"course_id" uuid,
	"course_title" text,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"credential_id" text,
	"status" text DEFAULT 'Issued' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "certificates_legacyId_unique" UNIQUE("legacy_id"),
	CONSTRAINT "certificates_credentialId_unique" UNIQUE("credential_id")
);
--> statement-breakpoint
CREATE TABLE "course_pricing_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"course_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price" numeric(12, 2) DEFAULT 0 NOT NULL,
	"compare_at_price" numeric(12, 2),
	"access" text DEFAULT 'Lifetime' NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "course_pricing_plans_legacyId_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "course_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"course_id" uuid NOT NULL,
	"name" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"duration" text,
	"difficulty" text,
	"key_topics" text[] DEFAULT '{}' NOT NULL,
	"industry_relevance" text[] DEFAULT '{}' NOT NULL,
	CONSTRAINT "course_sections_legacyId_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"topic" text,
	"languages" text[] DEFAULT '{}' NOT NULL,
	"categories" text[] DEFAULT '{}' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"price" text DEFAULT 'paid' NOT NULL,
	"type" text DEFAULT 'self' NOT NULL,
	"rating" double precision DEFAULT 0 NOT NULL,
	"hours" double precision DEFAULT 0 NOT NULL,
	"amount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"strike_amount" numeric(12, 2),
	"popularity" integer DEFAULT 0 NOT NULL,
	"newest_rank" integer DEFAULT 0 NOT NULL,
	"enrolled_count" integer DEFAULT 0 NOT NULL,
	"enrolled_label" text,
	"image" text,
	"image_alt" text,
	"thumb_class" text DEFAULT 'media-seo',
	"media_label" text,
	"kind" text,
	"summary" text,
	"overview" text[] DEFAULT '{}' NOT NULL,
	"journey" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tools" text[] DEFAULT '{}' NOT NULL,
	"careers" text[] DEFAULT '{}' NOT NULL,
	"who_should_enroll" jsonb,
	"faqs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"duration_label" text,
	"status" text DEFAULT 'Published' NOT NULL,
	"visibility" text DEFAULT 'Public' NOT NULL,
	"drip_enabled" boolean DEFAULT false NOT NULL,
	"drip_schedule" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"automation_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"drm_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courses_legacyId_unique" UNIQUE("legacy_id"),
	CONSTRAINT "courses_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "enrollment_completed_lessons" (
	"enrollment_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollment_completed_lessons_enrollment_id_lesson_id_pk" PRIMARY KEY("enrollment_id","lesson_id")
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"progress_pct" integer DEFAULT 0 NOT NULL,
	"current_section_id" uuid,
	"current_lesson_id" uuid,
	"last_accessed_at" timestamp with time zone,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'Not started' NOT NULL,
	"expires_at" timestamp with time zone,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollments_legacyId_unique" UNIQUE("legacy_id"),
	CONSTRAINT "enrollments_userId_courseId_unique" UNIQUE("user_id","course_id")
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"section_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"name" text NOT NULL,
	"duration" text,
	"video_url" text,
	"bunny_video_id" text,
	"video_status" text,
	"video_duration_seconds" integer,
	"content_type" text DEFAULT 'Video' NOT NULL,
	"is_free_preview" boolean DEFAULT false NOT NULL,
	"is_draft" boolean DEFAULT false NOT NULL,
	"is_compulsory" boolean DEFAULT false NOT NULL,
	"enable_discussion" boolean DEFAULT true NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "lessons_legacyId_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "practice_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practice_item_id" uuid NOT NULL,
	"user_id" uuid,
	"status" text DEFAULT 'Not started' NOT NULL,
	"score" double precision,
	"attempted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "practice_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"title" text NOT NULL,
	"type" text DEFAULT 'Drill' NOT NULL,
	"difficulty" text DEFAULT 'Beginner' NOT NULL,
	"course_id" uuid,
	"description" text,
	"question_count" integer,
	"minutes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "practice_items_legacyId_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "counters" (
	"key" text PRIMARY KEY NOT NULL,
	"seq" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"product" text,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_legacyId_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"date" timestamp with time zone DEFAULT now() NOT NULL,
	"customer_id" uuid,
	"customer_name" text,
	"contact" text,
	"product" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"cycle" text DEFAULT 'ONETIME' NOT NULL,
	"status" text DEFAULT 'SUCCESS' NOT NULL,
	"refunded_amount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"invoice_no" text,
	"method" text DEFAULT 'OTHER' NOT NULL,
	"utr" text,
	"course_id" uuid,
	"course_slug" text,
	"plan_name" text,
	"plan_access" text,
	"buyer_name" text,
	"buyer_email" text,
	"buyer_phone" text,
	"razorpay_order_id" text,
	"razorpay_payment_id" text,
	"razorpay_refund_ids" text[] DEFAULT '{}' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_legacyId_unique" UNIQUE("legacy_id"),
	CONSTRAINT "transactions_invoiceNo_unique" UNIQUE("invoice_no"),
	CONSTRAINT "transactions_razorpayPaymentId_unique" UNIQUE("razorpay_payment_id")
);
--> statement-breakpoint
CREATE TABLE "blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocks_legacyId_unique" UNIQUE("legacy_id"),
	CONSTRAINT "blocks_blockerId_blockedId_unique" UNIQUE("blocker_id","blocked_id")
);
--> statement-breakpoint
CREATE TABLE "channel_members" (
	"channel_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "channel_members_channel_id_user_id_pk" PRIMARY KEY("channel_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"group" text DEFAULT 'Growth Scholar Hub' NOT NULL,
	"description" text,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channels_legacyId_unique" UNIQUE("legacy_id"),
	CONSTRAINT "channels_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"post_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comments_legacyId_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "post_likes" (
	"post_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "post_likes_post_id_user_id_pk" PRIMARY KEY("post_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"channel_id" uuid,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "posts_legacyId_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"author_id" uuid,
	"reason" text DEFAULT 'other' NOT NULL,
	"note" text,
	"excerpt" text,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_legacyId_unique" UNIQUE("legacy_id"),
	CONSTRAINT "reports_targetId_reporterId_unique" UNIQUE("target_id","reporter_id")
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"live_class_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"slot" timestamp with time zone,
	"status" text DEFAULT 'Booked' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_legacyId_unique" UNIQUE("legacy_id"),
	CONSTRAINT "bookings_liveClassId_userId_unique" UNIQUE("live_class_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "live_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"topic" text NOT NULL,
	"type" text DEFAULT 'Single Session' NOT NULL,
	"when" timestamp with time zone,
	"time_zone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"max_registrants" integer DEFAULT 1 NOT NULL,
	"duration" text DEFAULT '30 Minutes' NOT NULL,
	"password_protected" boolean DEFAULT false NOT NULL,
	"password" text,
	"theme" text DEFAULT 'Brand Green' NOT NULL,
	"description" text,
	"booked_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "live_bookings_legacyId_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "live_class_attendees" (
	"live_class_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "live_class_attendees_live_class_id_user_id_pk" PRIMARY KEY("live_class_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "live_classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"title" text NOT NULL,
	"description" text,
	"starts_at" timestamp with time zone NOT NULL,
	"duration_mins" integer DEFAULT 60 NOT NULL,
	"host" text,
	"join_url" text,
	"course_id" uuid,
	"status" text DEFAULT 'Scheduled' NOT NULL,
	"kind" text DEFAULT 'Workshop' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "live_classes_legacyId_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "workshop_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"workshop_id" uuid NOT NULL,
	"user_id" uuid,
	"guest_name" text,
	"guest_email" text,
	"guest_phone" text,
	"attended" boolean DEFAULT false NOT NULL,
	"waitlisted" boolean DEFAULT false NOT NULL,
	"cancelled_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workshop_registrations_legacyId_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "workshops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"mode" text DEFAULT 'online' NOT NULL,
	"language" text,
	"categories" text[] DEFAULT '{}' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"level" text,
	"banner_title" text,
	"image" text,
	"image_alt" text,
	"banner_class" text DEFAULT 'ws-seo',
	"price_new" numeric(12, 2) DEFAULT 0 NOT NULL,
	"price_old" numeric(12, 2),
	"starts_at" timestamp with time zone,
	"duration_label" text,
	"venue" text,
	"host" text,
	"host_initials" text,
	"capacity" integer DEFAULT 100 NOT NULL,
	"registered_count" integer DEFAULT 0 NOT NULL,
	"landing" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workshops_legacyId_unique" UNIQUE("legacy_id"),
	CONSTRAINT "workshops_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "fit_call_booking_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"body" text NOT NULL,
	"author" uuid,
	"author_name" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"fit_call_booking_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fit_call_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"timezone" text DEFAULT 'IST' NOT NULL,
	"preferred_week" text,
	"preferred_slots" text[] DEFAULT '{}' NOT NULL,
	"call_language" text,
	"schedule_notes" text,
	"current_status" text,
	"weekly_hours" text,
	"submitted_full_application" text DEFAULT 'no' NOT NULL,
	"why_call_now" text,
	"biggest_blocker" text,
	"call_questions" text,
	"referral_source" text,
	"consent" boolean NOT NULL,
	"status" text DEFAULT 'Requested' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"owner" uuid,
	"page" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fit_call_bookings_legacyId_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "flagship_application_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"body" text NOT NULL,
	"author" uuid,
	"author_name" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"flagship_application_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flagship_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"linkedin" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"track_preference" text NOT NULL,
	"batch_preference" text NOT NULL,
	"mentoring_language" text NOT NULL,
	"current_status" text NOT NULL,
	"employer" text,
	"weekly_hours" text NOT NULL,
	"live_availability" text[] DEFAULT '{}' NOT NULL,
	"has_setup" text NOT NULL,
	"masterclass_city" text NOT NULL,
	"schedule_blockers" text,
	"experience_level" text NOT NULL,
	"channels" text[] DEFAULT '{}' NOT NULL,
	"monthly_spend" text,
	"tools_used" text,
	"portfolio_url" text,
	"starter_courses" text,
	"referral_source" text NOT NULL,
	"referral_detail" text NOT NULL,
	"why_flagship" text NOT NULL,
	"twelve_week_outcome" text NOT NULL,
	"ship_story" text NOT NULL,
	"curriculum_hook" text NOT NULL,
	"payment_plan" text NOT NULL,
	"scholarship_case" text,
	"consent_whatsapp" boolean NOT NULL,
	"consent_accurate" boolean NOT NULL,
	"status" text DEFAULT 'New' NOT NULL,
	"owner" uuid,
	"reviewed_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"page" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flagship_applications_legacyId_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "lead_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"body" text NOT NULL,
	"author" uuid,
	"author_name" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"lead_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"name" text,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"education" text,
	"profile" text,
	"year_of_passing" text,
	"language" text,
	"source" text DEFAULT 'mentor-popup' NOT NULL,
	"page" text,
	"status" text DEFAULT 'New' NOT NULL,
	"owner" uuid,
	"next_follow_up_at" timestamp with time zone,
	"converted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leads_legacyId_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "badges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"name" text NOT NULL,
	"icon" text DEFAULT '🛡' NOT NULL,
	"tone" text DEFAULT 'gold' NOT NULL,
	"description" text,
	"automation_enabled" boolean DEFAULT false NOT NULL,
	"assign_when" text DEFAULT 'Seeds points' NOT NULL,
	"seeds_threshold" integer DEFAULT 0 NOT NULL,
	"course_id" uuid,
	"holder_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "badges_legacyId_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "broadcasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"subject" text NOT NULL,
	"from_name" text DEFAULT 'Growth Scholar' NOT NULL,
	"send_to_list_id" uuid,
	"send_to_list_name" text,
	"body" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"stats" jsonb DEFAULT '{"delivered":0,"opened":0,"clicked":0}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "broadcasts_legacyId_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "email_contact_lists" (
	"contact_id" uuid NOT NULL,
	"list_id" uuid NOT NULL,
	CONSTRAINT "email_contact_lists_contact_id_list_id_pk" PRIMARY KEY("contact_id","list_id")
);
--> statement-breakpoint
CREATE TABLE "email_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"name" text,
	"email" text NOT NULL,
	"status" text DEFAULT 'Subscribed' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_contacts_legacyId_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "email_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"name" text NOT NULL,
	"description" text,
	"contact_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_lists_legacyId_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "funnel_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"funnel_id" uuid,
	"name" text,
	"email" text NOT NULL,
	"phone" text,
	"source_step" text,
	"date" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'New' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "funnel_leads_legacyId_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "funnel_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"funnel_id" uuid NOT NULL,
	"name" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"url" text,
	"unique_visitors" integer DEFAULT 0 NOT NULL,
	"total_views" integer DEFAULT 0 NOT NULL,
	"conversion_pct" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "funnel_steps_legacyId_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "funnels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"name" text NOT NULL,
	"slug" text,
	"template" text DEFAULT 'Lead Magnet' NOT NULL,
	"status" text DEFAULT 'Draft' NOT NULL,
	"lead_count" integer DEFAULT 0 NOT NULL,
	"description" text,
	"domain" text,
	"automation_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "funnels_legacyId_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "leaderboard_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"rank" integer NOT NULL,
	"user_id" uuid,
	"name" text,
	"email" text,
	"badge" text DEFAULT '—' NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"service" text,
	"period" text DEFAULT 'week' NOT NULL,
	"board" text DEFAULT 'Growth Master' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leaderboard_entries_legacyId_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "point_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"activity" text NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "point_rules_legacyId_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "blog_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"post_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"website" text DEFAULT '' NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'Pending' NOT NULL,
	"status_before_trash" text,
	"by_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blog_comments_legacyId_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"category" text,
	"categories" text[] DEFAULT '{}' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"excerpt" text,
	"body" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"author" jsonb,
	"published_at" timestamp with time zone DEFAULT now(),
	"read_time" text,
	"status" text DEFAULT 'Draft' NOT NULL,
	"trashed_at" timestamp with time zone,
	"status_before_trash" text,
	"visibility" text DEFAULT 'Public' NOT NULL,
	"password" text,
	"featured" boolean DEFAULT false NOT NULL,
	"sticky" boolean DEFAULT false NOT NULL,
	"allow_comments" boolean DEFAULT false NOT NULL,
	"image" text,
	"image_alt" text,
	"image_media_id" uuid,
	"image_width" integer,
	"image_height" integer,
	"hero_class" text DEFAULT 'feat-seo',
	"hero_label" text,
	"seo" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"revisions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blog_posts_legacyId_unique" UNIQUE("legacy_id"),
	CONSTRAINT "blog_posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "claude_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"card_title" text,
	"tagline" text,
	"summary" text,
	"about" text,
	"category" text,
	"badge" text,
	"icon" text DEFAULT '✦' NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"works_with" text DEFAULT 'Claude' NOT NULL,
	"readiness" text DEFAULT 'Ready' NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'Published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "claude_skills_legacyId_unique" UNIQUE("legacy_id"),
	CONSTRAINT "claude_skills_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"url" text NOT NULL,
	"filename" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"alt_text" text DEFAULT '' NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"uploaded_by" text DEFAULT 'Admin' NOT NULL,
	"storage" text DEFAULT 'local' NOT NULL,
	"path" text DEFAULT '' NOT NULL,
	"width" integer DEFAULT 0 NOT NULL,
	"height" integer DEFAULT 0 NOT NULL,
	"sizes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_legacyId_unique" UNIQUE("legacy_id"),
	CONSTRAINT "media_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "playbooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"card_title" text,
	"tag" text,
	"deck" text,
	"summary" text,
	"visual_class" text DEFAULT 'pb-v-seo',
	"hero_class" text DEFAULT 'pb-hero-seo',
	"author_name" text,
	"author_role" text,
	"initials" text,
	"achievement" jsonb,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tools" text,
	"related_skill" jsonb,
	"cta" jsonb,
	"order" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'Published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "playbooks_legacyId_unique" UNIQUE("legacy_id"),
	CONSTRAINT "playbooks_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"eyebrow" text,
	"description" text,
	"categories" text[] DEFAULT '{}' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"weeks" integer DEFAULT 12 NOT NULL,
	"meta" text[] DEFAULT '{}' NOT NULL,
	"hero_image" text,
	"outcomes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"stats" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"comparison" jsonb,
	"curriculum" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"audience" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"batch_note" text,
	"trust_bar" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"why" jsonb,
	"structure" jsonb,
	"tracks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tool_groups" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"admission" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mentors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"testimonials" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"faqs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"section_copy" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ctas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"phase_labels" text[] DEFAULT '{}' NOT NULL,
	"pricing" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "programs_legacyId_unique" UNIQUE("legacy_id"),
	CONSTRAINT "programs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"taxonomy" text NOT NULL,
	"name" text NOT NULL,
	"short_label" text,
	"slug" text NOT NULL,
	"description" text,
	"parent" uuid,
	"icon" text,
	"color" text,
	"thumb_class" text,
	"order" integer DEFAULT 0 NOT NULL,
	"show_in_menu" boolean DEFAULT false NOT NULL,
	"show_in_filters" boolean DEFAULT true NOT NULL,
	"show_on_cards" boolean DEFAULT true NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"show_as_rail" boolean DEFAULT false NOT NULL,
	"link_to" text,
	"status" text DEFAULT 'Published' NOT NULL,
	"visibility" text DEFAULT 'Public' NOT NULL,
	"seo" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"former_slugs" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "terms_legacyId_unique" UNIQUE("legacy_id"),
	CONSTRAINT "terms_taxonomy_slug_unique" UNIQUE("taxonomy","slug")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"key" text DEFAULT 'site' NOT NULL,
	"branding" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"menu" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"help" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"domain" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"gamification" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"payments" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"mail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"video" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"media" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"business" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_legacyId_unique" UNIQUE("legacy_id"),
	CONSTRAINT "settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_pricing_plans" ADD CONSTRAINT "course_pricing_plans_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_sections" ADD CONSTRAINT "course_sections_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_completed_lessons" ADD CONSTRAINT "enrollment_completed_lessons_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_completed_lessons" ADD CONSTRAINT "enrollment_completed_lessons_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_section_id_course_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."course_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_attempts" ADD CONSTRAINT "practice_attempts_practice_item_id_practice_items_id_fk" FOREIGN KEY ("practice_item_id") REFERENCES "public"."practice_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_attempts" ADD CONSTRAINT "practice_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_items" ADD CONSTRAINT "practice_items_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_members" ADD CONSTRAINT "channel_members_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_members" ADD CONSTRAINT "channel_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_live_class_id_live_classes_id_fk" FOREIGN KEY ("live_class_id") REFERENCES "public"."live_classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_class_attendees" ADD CONSTRAINT "live_class_attendees_live_class_id_live_classes_id_fk" FOREIGN KEY ("live_class_id") REFERENCES "public"."live_classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_class_attendees" ADD CONSTRAINT "live_class_attendees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_classes" ADD CONSTRAINT "live_classes_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_registrations" ADD CONSTRAINT "workshop_registrations_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_registrations" ADD CONSTRAINT "workshop_registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fit_call_booking_notes" ADD CONSTRAINT "fit_call_booking_notes_author_users_id_fk" FOREIGN KEY ("author") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fit_call_booking_notes" ADD CONSTRAINT "fit_call_booking_notes_fit_call_booking_id_fit_call_bookings_id_fk" FOREIGN KEY ("fit_call_booking_id") REFERENCES "public"."fit_call_bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fit_call_bookings" ADD CONSTRAINT "fit_call_bookings_owner_users_id_fk" FOREIGN KEY ("owner") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flagship_application_notes" ADD CONSTRAINT "flagship_application_notes_author_users_id_fk" FOREIGN KEY ("author") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flagship_application_notes" ADD CONSTRAINT "flagship_application_notes_flagship_application_id_flagship_applications_id_fk" FOREIGN KEY ("flagship_application_id") REFERENCES "public"."flagship_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flagship_applications" ADD CONSTRAINT "flagship_applications_owner_users_id_fk" FOREIGN KEY ("owner") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_author_users_id_fk" FOREIGN KEY ("author") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_users_id_fk" FOREIGN KEY ("owner") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "badges" ADD CONSTRAINT "badges_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_send_to_list_id_email_lists_id_fk" FOREIGN KEY ("send_to_list_id") REFERENCES "public"."email_lists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_contact_lists" ADD CONSTRAINT "email_contact_lists_contact_id_email_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."email_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_contact_lists" ADD CONSTRAINT "email_contact_lists_list_id_email_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."email_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_leads" ADD CONSTRAINT "funnel_leads_funnel_id_funnels_id_fk" FOREIGN KEY ("funnel_id") REFERENCES "public"."funnels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_steps" ADD CONSTRAINT "funnel_steps_funnel_id_funnels_id_fk" FOREIGN KEY ("funnel_id") REFERENCES "public"."funnels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "leaderboard_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_image_media_id_media_id_fk" FOREIGN KEY ("image_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_role_index" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_suspended_at_index" ON "users" USING btree ("suspended_at");--> statement-breakpoint
CREATE INDEX "certificates_user_id_index" ON "certificates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "course_pricing_plans_course_id_order_index" ON "course_pricing_plans" USING btree ("course_id","order");--> statement-breakpoint
CREATE INDEX "course_sections_course_id_order_index" ON "course_sections" USING btree ("course_id","order");--> statement-breakpoint
CREATE INDEX "courses_topic_index" ON "courses" USING btree ("topic");--> statement-breakpoint
CREATE INDEX "courses_price_index" ON "courses" USING btree ("price");--> statement-breakpoint
CREATE INDEX "courses_type_index" ON "courses" USING btree ("type");--> statement-breakpoint
CREATE INDEX "courses_status_index" ON "courses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "courses_categories_index" ON "courses" USING gin ("categories");--> statement-breakpoint
CREATE INDEX "courses_tags_index" ON "courses" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "enrollments_course_id_index" ON "enrollments" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "lessons_section_id_order_index" ON "lessons" USING btree ("section_id","order");--> statement-breakpoint
CREATE INDEX "lessons_course_id_index" ON "lessons" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "lessons_bunny_video_id_index" ON "lessons" USING btree ("bunny_video_id");--> statement-breakpoint
CREATE INDEX "practice_attempts_practice_item_id_index" ON "practice_attempts" USING btree ("practice_item_id");--> statement-breakpoint
CREATE INDEX "practice_attempts_user_id_index" ON "practice_attempts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "customers_email_index" ON "customers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "customers_status_index" ON "customers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "transactions_date_index" ON "transactions" USING btree ("date");--> statement-breakpoint
CREATE INDEX "transactions_method_index" ON "transactions" USING btree ("method");--> statement-breakpoint
CREATE INDEX "transactions_course_id_index" ON "transactions" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "transactions_razorpay_order_id_index" ON "transactions" USING btree ("razorpay_order_id");--> statement-breakpoint
CREATE INDEX "transactions_buyer_email_index" ON "transactions" USING btree ("buyer_email");--> statement-breakpoint
CREATE INDEX "transactions_status_date_index" ON "transactions" USING btree ("status","date" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_live_utr_unique" ON "transactions" USING btree ("utr") WHERE "transactions"."utr" is not null and "transactions"."status" in ('PENDING', 'SUCCESS');--> statement-breakpoint
CREATE INDEX "blocks_blocked_id_index" ON "blocks" USING btree ("blocked_id");--> statement-breakpoint
CREATE INDEX "channel_members_user_id_index" ON "channel_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "channels_group_index" ON "channels" USING btree ("group");--> statement-breakpoint
CREATE INDEX "comments_post_id_created_at_index" ON "comments" USING btree ("post_id","created_at");--> statement-breakpoint
CREATE INDEX "posts_channel_id_created_at_index" ON "posts" USING btree ("channel_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "posts_author_id_index" ON "posts" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "reports_reporter_id_index" ON "reports" USING btree ("reporter_id");--> statement-breakpoint
CREATE INDEX "reports_status_created_at_index" ON "reports" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "bookings_user_id_index" ON "bookings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "live_classes_starts_at_index" ON "live_classes" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "workshop_registrations_workshop_id_index" ON "workshop_registrations" USING btree ("workshop_id");--> statement-breakpoint
CREATE INDEX "workshop_registrations_attended_index" ON "workshop_registrations" USING btree ("attended");--> statement-breakpoint
CREATE INDEX "workshop_registrations_waitlisted_index" ON "workshop_registrations" USING btree ("waitlisted");--> statement-breakpoint
CREATE UNIQUE INDEX "workshop_registrations_user_unique" ON "workshop_registrations" USING btree ("workshop_id","user_id") WHERE "workshop_registrations"."user_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "workshop_registrations_guest_unique" ON "workshop_registrations" USING btree ("workshop_id","guest_email") WHERE "workshop_registrations"."guest_email" is not null;--> statement-breakpoint
CREATE INDEX "workshops_mode_index" ON "workshops" USING btree ("mode");--> statement-breakpoint
CREATE INDEX "workshops_language_index" ON "workshops" USING btree ("language");--> statement-breakpoint
CREATE INDEX "workshops_categories_index" ON "workshops" USING gin ("categories");--> statement-breakpoint
CREATE INDEX "workshops_tags_index" ON "workshops" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "fit_call_booking_notes_fit_call_booking_id_at_index" ON "fit_call_booking_notes" USING btree ("fit_call_booking_id","at");--> statement-breakpoint
CREATE INDEX "fit_call_bookings_email_index" ON "fit_call_bookings" USING btree ("email");--> statement-breakpoint
CREATE INDEX "fit_call_bookings_status_index" ON "fit_call_bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "fit_call_bookings_owner_index" ON "fit_call_bookings" USING btree ("owner");--> statement-breakpoint
CREATE INDEX "fit_call_bookings_created_at_index" ON "fit_call_bookings" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "flagship_application_notes_flagship_application_id_at_index" ON "flagship_application_notes" USING btree ("flagship_application_id","at");--> statement-breakpoint
CREATE INDEX "flagship_applications_email_index" ON "flagship_applications" USING btree ("email");--> statement-breakpoint
CREATE INDEX "flagship_applications_status_index" ON "flagship_applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "flagship_applications_owner_index" ON "flagship_applications" USING btree ("owner");--> statement-breakpoint
CREATE INDEX "flagship_applications_created_at_index" ON "flagship_applications" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "lead_notes_lead_id_at_index" ON "lead_notes" USING btree ("lead_id","at");--> statement-breakpoint
CREATE INDEX "leads_source_index" ON "leads" USING btree ("source");--> statement-breakpoint
CREATE INDEX "leads_status_index" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leads_owner_index" ON "leads" USING btree ("owner");--> statement-breakpoint
CREATE INDEX "leads_next_follow_up_at_index" ON "leads" USING btree ("next_follow_up_at");--> statement-breakpoint
CREATE INDEX "leads_created_at_index" ON "leads" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "broadcasts_status_updated_at_index" ON "broadcasts" USING btree ("status","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "email_contact_lists_list_id_index" ON "email_contact_lists" USING btree ("list_id");--> statement-breakpoint
CREATE INDEX "email_contacts_email_index" ON "email_contacts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "email_contacts_status_index" ON "email_contacts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "funnel_leads_funnel_id_index" ON "funnel_leads" USING btree ("funnel_id");--> statement-breakpoint
CREATE INDEX "funnel_leads_status_index" ON "funnel_leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "funnel_steps_funnel_id_order_index" ON "funnel_steps" USING btree ("funnel_id","order");--> statement-breakpoint
CREATE INDEX "funnels_slug_index" ON "funnels" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "funnels_status_index" ON "funnels" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leaderboard_entries_period_index" ON "leaderboard_entries" USING btree ("period");--> statement-breakpoint
CREATE INDEX "leaderboard_entries_board_period_rank_index" ON "leaderboard_entries" USING btree ("board","period","rank");--> statement-breakpoint
CREATE INDEX "blog_comments_parent_id_index" ON "blog_comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "blog_comments_post_id_status_created_at_index" ON "blog_comments" USING btree ("post_id","status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "blog_comments_status_created_at_index" ON "blog_comments" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "blog_posts_category_index" ON "blog_posts" USING btree ("category");--> statement-breakpoint
CREATE INDEX "blog_posts_featured_index" ON "blog_posts" USING btree ("featured");--> statement-breakpoint
CREATE INDEX "blog_posts_status_published_at_index" ON "blog_posts" USING btree ("status","published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "blog_posts_categories_index" ON "blog_posts" USING gin ("categories");--> statement-breakpoint
CREATE INDEX "blog_posts_tags_index" ON "blog_posts" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "claude_skills_category_index" ON "claude_skills" USING btree ("category");--> statement-breakpoint
CREATE INDEX "claude_skills_status_index" ON "claude_skills" USING btree ("status");--> statement-breakpoint
CREATE INDEX "media_mime_type_index" ON "media" USING btree ("mime_type");--> statement-breakpoint
CREATE INDEX "media_storage_index" ON "media" USING btree ("storage");--> statement-breakpoint
CREATE INDEX "media_created_at_index" ON "media" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "playbooks_tag_index" ON "playbooks" USING btree ("tag");--> statement-breakpoint
CREATE INDEX "playbooks_status_index" ON "playbooks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "programs_categories_index" ON "programs" USING gin ("categories");--> statement-breakpoint
CREATE INDEX "programs_tags_index" ON "programs" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "terms_taxonomy_order_name_index" ON "terms" USING btree ("taxonomy","order","name");--> statement-breakpoint
CREATE INDEX "terms_parent_index" ON "terms" USING btree ("parent");--> statement-breakpoint
CREATE INDEX "terms_featured_index" ON "terms" USING btree ("featured");--> statement-breakpoint
CREATE INDEX "terms_show_as_rail_index" ON "terms" USING btree ("show_as_rail");--> statement-breakpoint
CREATE INDEX "terms_status_index" ON "terms" USING btree ("status");--> statement-breakpoint
CREATE INDEX "terms_former_slugs_index" ON "terms" USING gin ("former_slugs");