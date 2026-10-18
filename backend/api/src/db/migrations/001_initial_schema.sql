-- Main CareerPilot schema. IDs use PostgreSQL's built-in UUID generator.
CREATE TABLE cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  academic_year text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, academic_year)
);

CREATE TABLE career_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('student', 'placement_officer', 'administrator')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE student_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  cohort_id uuid REFERENCES cohorts(id) ON DELETE SET NULL,
  course text NOT NULL DEFAULT '',
  graduation_year integer CHECK (graduation_year BETWEEN 2000 AND 2100),
  target_role_id uuid REFERENCES career_roles(id) ON DELETE SET NULL,
  ai_data_consent boolean NOT NULL DEFAULT false,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE officer_cohorts (
  officer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cohort_id uuid NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (officer_id, cohort_id)
);

CREATE TABLE auth_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_sessions_user_idx ON auth_sessions(user_id);

CREATE TABLE resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL UNIQUE REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'My Resume',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE resume_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id uuid NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  content_json jsonb,
  original_filename text,
  stored_path text,
  mime_type text,
  file_size_bytes integer,
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resume_id, version_number),
  CHECK (content_json IS NOT NULL OR stored_path IS NOT NULL)
);
CREATE UNIQUE INDEX one_current_resume_version ON resume_versions(resume_id) WHERE is_current = true;

CREATE TABLE resume_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_version_id uuid NOT NULL REFERENCES resume_versions(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  score integer CHECK (score BETWEEN 0 AND 100),
  result_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider text NOT NULL DEFAULT 'mock',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX resume_analyses_version_idx ON resume_analyses(resume_version_id, created_at DESC);

CREATE TABLE skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  category text NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE student_skills (
  student_id uuid NOT NULL REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  proficiency integer NOT NULL CHECK (proficiency BETWEEN 1 AND 5),
  source text NOT NULL DEFAULT 'student',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, skill_id)
);

CREATE TABLE role_skills (
  role_id uuid NOT NULL REFERENCES career_roles(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  required_level integer NOT NULL DEFAULT 3 CHECK (required_level BETWEEN 1 AND 5),
  PRIMARY KEY (role_id, skill_id)
);

CREATE TABLE learning_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id uuid REFERENCES skills(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  url text NOT NULL,
  resource_type text NOT NULL DEFAULT 'article',
  difficulty text NOT NULL DEFAULT 'beginner',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE student_resource_progress (
  student_id uuid NOT NULL REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES learning_resources(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'saved' CHECK (status IN ('saved', 'in_progress', 'completed')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, resource_id)
);

CREATE TABLE interview_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  difficulty text NOT NULL DEFAULT 'beginner',
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE interview_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  interview_type text NOT NULL DEFAULT 'technical',
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  score integer CHECK (score BETWEEN 0 AND 100),
  feedback_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE interview_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  question_id uuid REFERENCES interview_questions(id) ON DELETE SET NULL,
  question_text text NOT NULL,
  answer_text text NOT NULL DEFAULT '',
  score integer CHECK (score BETWEEN 0 AND 100),
  feedback_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, question_id)
);

CREATE TABLE coding_problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  prompt text NOT NULL,
  difficulty text NOT NULL DEFAULT 'beginner',
  problem_type text NOT NULL DEFAULT 'multiple_choice' CHECK (problem_type IN ('multiple_choice', 'short_answer')),
  options_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  expected_answer text NOT NULL,
  explanation text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE coding_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  problem_id uuid NOT NULL REFERENCES coding_problems(id) ON DELETE CASCADE,
  submitted_answer text NOT NULL,
  is_correct boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX coding_submissions_student_idx ON coding_submissions(student_id, created_at DESC);

CREATE TABLE aptitude_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  company_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE aptitude_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES aptitude_tests(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  options_json jsonb NOT NULL,
  correct_option_index integer NOT NULL CHECK (correct_option_index >= 0),
  explanation text NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 1
);

CREATE TABLE aptitude_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  test_id uuid NOT NULL REFERENCES aptitude_tests(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  score integer CHECK (score BETWEEN 0 AND 100),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE aptitude_answers (
  attempt_id uuid NOT NULL REFERENCES aptitude_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES aptitude_questions(id) ON DELETE CASCADE,
  selected_option_index integer CHECK (selected_option_index >= 0),
  is_correct boolean NOT NULL DEFAULT false,
  PRIMARY KEY (attempt_id, question_id)
);

CREATE TABLE readiness_formulas (
  version text PRIMARY KEY,
  weights_json jsonb NOT NULL,
  minimum_evidence_json jsonb NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE readiness_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  formula_version text NOT NULL REFERENCES readiness_formulas(version),
  total_score integer CHECK (total_score BETWEEN 0 AND 100),
  breakdown_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_complete boolean NOT NULL DEFAULT false,
  calculated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX readiness_student_idx ON readiness_snapshots(student_id, calculated_at DESC);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  cohort_id uuid REFERENCES cohorts(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notification_deliveries (
  notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES student_profiles(user_id) ON DELETE CASCADE,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  PRIMARY KEY (notification_id, student_id)
);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_created_idx ON audit_events(created_at DESC);

CREATE INDEX student_profiles_cohort_idx ON student_profiles(cohort_id);
CREATE INDEX officer_cohorts_cohort_idx ON officer_cohorts(cohort_id);
CREATE INDEX resume_versions_resume_idx ON resume_versions(resume_id, version_number DESC);
CREATE INDEX interview_sessions_student_idx ON interview_sessions(student_id, started_at DESC);
CREATE INDEX aptitude_attempts_student_idx ON aptitude_attempts(student_id, started_at DESC);
CREATE INDEX notification_deliveries_student_idx ON notification_deliveries(student_id, is_read);
