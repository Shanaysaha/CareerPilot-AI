# CareerPilot AI user manual

## Install and start

Follow the [laptop setup guide](../README.md#run-careerpilot-ai-on-your-laptop). Users of the compiled archive should follow [Program](../Program/README.md). Keep PostgreSQL, the Express API, the FastAPI service, and the website running in their respective terminals.

Open http://localhost:5173. The API health address is http://localhost:4000/api/health and the AI health address is http://127.0.0.1:8001/health.

## Create an account and sign in

Students select Create an account, enter their name, email and password, and optionally provide their course and graduation year. Public registration creates a student account.

Students and placement officers select Login as user. Administrators select Login as admin. The application uses the account role saved by the backend to grant access. Administrators create placement officer accounts from Staff accounts and assign them to cohorts.

## Student preparation

1. Open Profile and save your education details, target career role, and preferences.
2. Open Skill Gap and enter your skills and proficiency. Compare them with your target role and review suggested learning.
3. Open Resume to build a resume or upload a text-based PDF or DOCX, then request analysis and review feedback. Resume versions are available for review and download.
4. Open Learning to browse resources and update your learning progress.
5. Open Mock Interview, select a role, start a practice session, submit answers, and complete the session to review feedback.
6. Open Coding Practice, choose a question, submit an answer, and review the result. Practice uses answer-based assessment.
7. Open Aptitude Tests, start a test, answer the questions, submit the attempt, and review results and history.
8. Open Career Guidance for suggested roles and Readiness for evidence-based preparation progress. Readiness is guidance for further practice.
9. Open Notifications to review announcements and mark updates as read.

Settings provides AI consent, password change, and account deletion controls. External AI feedback requires consent and configured provider credentials. The local mock provider can be used for demonstrations.

## Placement officer workflow

An administrator must assign a cohort to the officer account. After signing in, use the placement dashboard to view assigned cohorts and student progress, Reports to review preparation summaries, and Notifications to publish updates to an assigned cohort.

## Administrator workflow

1. Create the first administrator using the command in the setup guide.
2. Sign in using Login as admin and open Cohorts to create a group.
3. Assign registered students to the cohort and assign a placement officer.
4. Use Staff accounts to create or manage staff access and issue password reset tokens.
5. Use Content library to manage roles, skills, learning resources and assessment content.
6. Use Readiness settings to create a formula version with weights totaling 100% and an evidence minimum.
7. Review reports, create student notifications, and inspect Audit logs.

## Password recovery and sign out

Request a one-time password reset token from your administrator through an agreed private channel. Open Forgot password on the sign-in page, enter the token and a new password, then sign in again. Use the profile menu to sign out when finished.

## Demonstration preparation

Use synthetic student data, create a cohort, and assign an officer before demonstrating cohort reports. Complete sample student activities so readiness and progress views have evidence. Seed content supplies educational practice material. The final demonstration should use the same application version described in the report.

Repository: https://github.com/Shanaysaha/CareerPilot-AI
