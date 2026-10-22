ALTER TABLE "badges" ADD CONSTRAINT "badges_assign_when_check" CHECK ("assign_when" IN ('Seeds points', 'Select course / service'));
--> statement-breakpoint
ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_status_check" CHECK ("status" IN ('Pending', 'Approved', 'Spam', 'Trash'));
--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_status_check" CHECK ("status" IN ('Draft', 'Pending', 'Published', 'Scheduled', 'Archived', 'Trash'));
--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_visibility_check" CHECK ("visibility" IN ('Public', 'Private', 'Password'));
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_status_check" CHECK ("status" IN ('Booked', 'Attended', 'Cancelled'));
--> statement-breakpoint
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_status_check" CHECK ("status" IN ('draft', 'scheduled', 'sent'));
--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_status_check" CHECK ("status" IN ('Issued', 'In progress'));
--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_group_check" CHECK ("group" IN ('Yoda Class Cohort', 'Growth Scholar Hub', 'Group Chats'));
--> statement-breakpoint
ALTER TABLE "claude_skills" ADD CONSTRAINT "claude_skills_status_check" CHECK ("status" IN ('Published', 'Draft'));
--> statement-breakpoint
ALTER TABLE "course_pricing_plans" ADD CONSTRAINT "course_pricing_plans_access_check" CHECK ("access" IN ('Lifetime', '12 months', '6 months'));
--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_price_check" CHECK ("price" IN ('paid', 'free'));
--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_type_check" CHECK ("type" IN ('self', 'combo', 'starter'));
--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_status_check" CHECK ("status" IN ('Published', 'Draft'));
--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_visibility_check" CHECK ("visibility" IN ('Public', 'Hidden'));
--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_status_check" CHECK ("status" IN ('Active', 'Trial'));
--> statement-breakpoint
ALTER TABLE "email_contacts" ADD CONSTRAINT "email_contacts_status_check" CHECK ("status" IN ('Subscribed', 'Unsubscribed'));
--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_status_check" CHECK ("status" IN ('Active', 'Completed', 'Not started'));
--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_source_check" CHECK ("source" IN ('paid', 'manual', 'free'));
--> statement-breakpoint
ALTER TABLE "fit_call_bookings" ADD CONSTRAINT "fit_call_bookings_submitted_full_application_check" CHECK ("submitted_full_application" IN ('yes', 'no', 'planning-to'));
--> statement-breakpoint
ALTER TABLE "fit_call_bookings" ADD CONSTRAINT "fit_call_bookings_status_check" CHECK ("status" IN ('Requested', 'Scheduled', 'Completed', 'No-show', 'Cancelled'));
--> statement-breakpoint
ALTER TABLE "flagship_applications" ADD CONSTRAINT "flagship_applications_track_preference_check" CHECK ("track_preference" IN ('track-a', 'track-b', 'undecided'));
--> statement-breakpoint
ALTER TABLE "flagship_applications" ADD CONSTRAINT "flagship_applications_batch_preference_check" CHECK ("batch_preference" IN ('batch-4', 'batch-5-waitlist', 'flexible'));
--> statement-breakpoint
ALTER TABLE "flagship_applications" ADD CONSTRAINT "flagship_applications_weekly_hours_check" CHECK ("weekly_hours" IN ('under-8', '8-10', '10-12', '12-15'));
--> statement-breakpoint
ALTER TABLE "flagship_applications" ADD CONSTRAINT "flagship_applications_has_setup_check" CHECK ("has_setup" IN ('yes', 'partial', 'no'));
--> statement-breakpoint
ALTER TABLE "flagship_applications" ADD CONSTRAINT "flagship_applications_experience_level_check" CHECK ("experience_level" IN ('exploring', 'complete-beginner', 'some-campaigns', 'working-marketer', 'founder-operator'));
--> statement-breakpoint
ALTER TABLE "flagship_applications" ADD CONSTRAINT "flagship_applications_payment_plan_check" CHECK ("payment_plan" IN ('full', 'scholarship'));
--> statement-breakpoint
ALTER TABLE "flagship_applications" ADD CONSTRAINT "flagship_applications_status_check" CHECK ("status" IN ('New', 'Shortlisted', 'Fit call booked', 'Accepted', 'Waitlisted', 'Rejected'));
--> statement-breakpoint
ALTER TABLE "funnel_leads" ADD CONSTRAINT "funnel_leads_status_check" CHECK ("status" IN ('New', 'Nurture', 'Purchased', 'Unsubscribed'));
--> statement-breakpoint
ALTER TABLE "funnels" ADD CONSTRAINT "funnels_template_check" CHECK ("template" IN ('Lead Magnet', 'Video Series', 'Survey Funnel'));
--> statement-breakpoint
ALTER TABLE "funnels" ADD CONSTRAINT "funnels_status_check" CHECK ("status" IN ('Live', 'Draft', 'Paused'));
--> statement-breakpoint
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "leaderboard_entries_period_check" CHECK ("period" IN ('week', 'month', 'all'));
--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_status_check" CHECK ("status" IN ('New', 'Contacted', 'Qualified', 'Converted', 'Lost'));
--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_video_status_check" CHECK ("video_status" IN ('uploading', 'processing', 'ready', 'failed'));
--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_content_type_check" CHECK ("content_type" IN ('Video', 'Audio', 'E-book', 'PDF', 'Text', 'Downloads', 'Quiz', 'Survey', 'Assignment', 'Live', 'Custom Code', 'SCORM/HTML'));
--> statement-breakpoint
ALTER TABLE "live_bookings" ADD CONSTRAINT "live_bookings_type_check" CHECK ("type" IN ('Single Session', 'Recurring Session'));
--> statement-breakpoint
ALTER TABLE "live_bookings" ADD CONSTRAINT "live_bookings_duration_check" CHECK ("duration" IN ('30 Minutes', '45 Minutes', '60 Minutes'));
--> statement-breakpoint
ALTER TABLE "live_bookings" ADD CONSTRAINT "live_bookings_theme_check" CHECK ("theme" IN ('Brand Green', 'Ocean', 'Warm Spotlight', 'Minimal Dark'));
--> statement-breakpoint
ALTER TABLE "live_classes" ADD CONSTRAINT "live_classes_status_check" CHECK ("status" IN ('Scheduled', 'Live', 'Ended'));
--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_storage_check" CHECK ("storage" IN ('local', 'bunny'));
--> statement-breakpoint
ALTER TABLE "playbooks" ADD CONSTRAINT "playbooks_status_check" CHECK ("status" IN ('Published', 'Draft'));
--> statement-breakpoint
ALTER TABLE "practice_attempts" ADD CONSTRAINT "practice_attempts_status_check" CHECK ("status" IN ('Not started', 'In progress', 'Completed'));
--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_type_check" CHECK ("target_type" IN ('post', 'comment'));
--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reason_check" CHECK ("reason" IN ('spam', 'harassment', 'hate', 'sexual', 'misinformation', 'other'));
--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_status_check" CHECK ("status" IN ('open', 'actioned', 'dismissed'));
--> statement-breakpoint
ALTER TABLE "terms" ADD CONSTRAINT "terms_taxonomy_check" CHECK ("taxonomy" IN ('category', 'tag', 'topic', 'language', 'blog-category', 'workshop-city'));
--> statement-breakpoint
ALTER TABLE "terms" ADD CONSTRAINT "terms_status_check" CHECK ("status" IN ('Published', 'Draft', 'Archived'));
--> statement-breakpoint
ALTER TABLE "terms" ADD CONSTRAINT "terms_visibility_check" CHECK ("visibility" IN ('Public', 'Hidden'));
--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_cycle_check" CHECK ("cycle" IN ('ONETIME', 'SUBSCRIPTION'));
--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_status_check" CHECK ("status" IN ('SUCCESS', 'REFUNDED', 'FAILED', 'PENDING'));
--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_method_check" CHECK ("method" IN ('MANUAL_UPI', 'RAZORPAY', 'OTHER'));
--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_plan_access_check" CHECK ("plan_access" IN ('Lifetime', '12 months', '6 months'));
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("role" IN ('student', 'admin'));
--> statement-breakpoint
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_mode_check" CHECK ("mode" IN ('online', 'offline'));
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_id_auth_users_fk" FOREIGN KEY ("id") REFERENCES auth.users("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "badges" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "blocks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "blog_comments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "blog_posts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "bookings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "broadcasts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "certificates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "channel_members" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "channels" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "claude_skills" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "comments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "counters" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "course_pricing_plans" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "course_sections" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "courses" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "email_contact_lists" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "email_contacts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "email_lists" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "enrollment_completed_lessons" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "enrollments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fit_call_booking_notes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fit_call_bookings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "flagship_application_notes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "flagship_applications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "funnel_leads" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "funnel_steps" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "funnels" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "lead_notes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "leaderboard_entries" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "lessons" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "live_bookings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "live_class_attendees" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "live_classes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "media" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "playbooks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "point_rules" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "post_likes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "posts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "practice_attempts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "practice_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "programs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "reports" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "terms" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "workshop_registrations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "workshops" ENABLE ROW LEVEL SECURITY;
