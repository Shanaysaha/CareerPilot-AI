import { query, withTransaction } from "./pool.js";
import { validateEnvironment } from "../config/env.js";

// Insert starter roles, skills, practice questions, resources, and score settings.
validateEnvironment();

const skills = [
  "Communication",
  "Problem Solving",
  "JavaScript",
  "HTML",
  "CSS",
  "React",
  "Node.js",
  "Express",
  "PostgreSQL",
  "Python",
  "Data Structures",
  "Git",
];
const roles = {
  "Frontend Developer": [
    "JavaScript",
    "HTML",
    "CSS",
    "React",
    "Git",
    "Communication",
  ],
  "Backend Developer": [
    "Node.js",
    "Express",
    "PostgreSQL",
    "JavaScript",
    "Problem Solving",
    "Git",
  ],
  "Python Developer": [
    "Python",
    "PostgreSQL",
    "Problem Solving",
    "Data Structures",
    "Git",
    "Communication",
  ],
};
const resources = [
  [
    "JavaScript Guide",
    "JavaScript concepts and examples",
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide",
    "JavaScript",
    "article",
  ],
  [
    "HTML Basics",
    "Learn semantic HTML",
    "https://developer.mozilla.org/en-US/docs/Learn/HTML",
    "HTML",
    "article",
  ],
  [
    "CSS Learning Path",
    "Learn layouts and responsive styling",
    "https://developer.mozilla.org/en-US/docs/Learn/CSS",
    "CSS",
    "course",
  ],
  [
    "React Learn",
    "Official React tutorial",
    "https://react.dev/learn",
    "React",
    "course",
  ],
  [
    "Node.js Learn",
    "Official Node.js learning materials",
    "https://nodejs.org/en/learn",
    "Node.js",
    "article",
  ],
  [
    "PostgreSQL Tutorial",
    "Introductory PostgreSQL tutorial",
    "https://www.postgresql.org/docs/current/tutorial.html",
    "PostgreSQL",
    "article",
  ],
  [
    "Python Tutorial",
    "Official Python tutorial",
    "https://docs.python.org/3/tutorial/",
    "Python",
    "article",
  ],
  [
    "Git Book",
    "Learn Git version control",
    "https://git-scm.com/book/en/v2",
    "Git",
    "book",
  ],
];
await withTransaction(async (client) => {
  const ids = {};
  for (const name of Object.keys(roles)) {
    const r = await client.query(
      `INSERT INTO career_roles(name,description) VALUES($1,$2) ON CONFLICT(name) DO UPDATE SET description=EXCLUDED.description RETURNING id`,
      [name, `Skills and learning plan for a ${name.toLowerCase()} career.`],
    );
    ids[name] = r.rows[0].id;
  }
  const skillIds = {};
  for (const name of skills) {
    const r = await client.query(
      `INSERT INTO skills(name,category) VALUES($1,$2) ON CONFLICT(name) DO UPDATE SET category=EXCLUDED.category RETURNING id`,
      [
        name,
        ["Communication", "Problem Solving", "Data Structures"].includes(name)
          ? "professional"
          : "technical",
      ],
    );
    skillIds[name] = r.rows[0].id;
  }
  for (const [role, names] of Object.entries(roles))
    for (const skill of names)
      await client.query(
        `INSERT INTO role_skills(role_id,skill_id,required_level) VALUES($1,$2,3) ON CONFLICT DO NOTHING`,
        [ids[role], skillIds[skill]],
      );
  for (const [title, description, url, skill, type] of resources)
    await client.query(
      `INSERT INTO learning_resources(title,description,url,skill_id,resource_type) SELECT $1,$2,$3,$4,$5 WHERE NOT EXISTS(SELECT 1 FROM learning_resources WHERE title=$1)`,
      [title, description, url, skillIds[skill], type],
    );
  const questions = [
    ["Tell me about a project you are proud of.", "behavioral", "beginner"],
    [
      "How do you investigate a bug that you cannot reproduce reliably?",
      "technical",
      "intermediate",
    ],
    [
      "Describe a time you received difficult feedback and how you responded.",
      "behavioral",
      "intermediate",
    ],
    [
      "What is the difference between a primary key and a foreign key?",
      "technical",
      "beginner",
    ],
    [
      "How do you explain a technical decision to a non-technical teammate?",
      "communication",
      "beginner",
    ],
  ];
  for (const q of questions)
    await client.query(
      `INSERT INTO interview_questions(question_text,category,difficulty) SELECT $1,$2,$3 WHERE NOT EXISTS(SELECT 1 FROM interview_questions WHERE question_text=$1)`,
      q,
    );
  const problems = [
    [
      "Find the larger number",
      "Given two numbers a and b, return the larger number.",
      "beginner",
      "short_answer",
      "compare a and b",
      "Compare both values and return the one that is greater.",
    ],
    [
      "Check for an even number",
      "Describe the condition that tells whether an integer n is even.",
      "beginner",
      "short_answer",
      "n % 2 == 0",
      "An even integer has remainder zero when divided by two.",
    ],
    [
      "Reverse a string",
      "Name a simple operation that returns a string in reverse order.",
      "beginner",
      "short_answer",
      "reverse string",
      "A reverse operation visits characters from the last to the first.",
    ],
  ];
  for (const p of problems)
    await client.query(
      `INSERT INTO coding_problems(title,prompt,difficulty,problem_type,expected_answer,explanation) SELECT $1,$2,$3,$4,$5,$6 WHERE NOT EXISTS(SELECT 1 FROM coding_problems WHERE title=$1)`,
      p,
    );
  const test = await client.query(
    `INSERT INTO aptitude_tests(title,description,company_name) SELECT 'CareerPilot Aptitude Basics','A short starter assessment covering arithmetic and reasoning.','CareerPilot' WHERE NOT EXISTS(SELECT 1 FROM aptitude_tests WHERE title='CareerPilot Aptitude Basics') RETURNING id`,
  );
  const testId =
    test.rows[0]?.id ||
    (
      await client.query(
        "SELECT id FROM aptitude_tests WHERE title='CareerPilot Aptitude Basics'",
      )
    ).rows[0].id;
  const apt = [
    [
      "What is 15% of 200?",
      ["20", "30", "35", "40"],
      1,
      "15% means 0.15, and 0.15 × 200 = 30.",
    ],
    [
      "Complete the sequence: 2, 4, 8, 16, __",
      ["18", "24", "30", "32"],
      3,
      "Each term doubles, so the next value is 32.",
    ],
    [
      "A train travels 60 km in 1 hour. How far in 3 hours at the same speed?",
      ["120 km", "150 km", "180 km", "240 km"],
      2,
      "Distance is speed × time: 60 × 3 = 180 km.",
    ],
  ];
  for (let i = 0; i < apt.length; i++) {
    const [question, options, index, explanation] = apt[i];
    await client.query(
      `INSERT INTO aptitude_questions(test_id,question_text,options_json,correct_option_index,explanation,display_order) SELECT $1,$2,$3::jsonb,$4,$5,$6 WHERE NOT EXISTS(SELECT 1 FROM aptitude_questions WHERE test_id=$1 AND question_text=$2)`,
      [testId, question, JSON.stringify(options), index, explanation, i + 1],
    );
  }
  await client.query(`UPDATE readiness_formulas SET is_active=false`);
  await client.query(
    `INSERT INTO readiness_formulas(version,weights_json,minimum_evidence_json,is_active) VALUES('v1',$1::jsonb,$2::jsonb,true) ON CONFLICT(version) DO UPDATE SET weights_json=EXCLUDED.weights_json,minimum_evidence_json=EXCLUDED.minimum_evidence_json,is_active=true`,
    [
      JSON.stringify({
        resume: 0.25,
        skills: 0.25,
        interview: 0.2,
        coding: 0.15,
        aptitude: 0.15,
      }),
      JSON.stringify({ count: 3 }),
    ],
  );
});
console.log("CareerPilot starter data is ready.");
process.exit(0);
