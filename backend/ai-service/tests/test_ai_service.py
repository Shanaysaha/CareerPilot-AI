import os
import unittest
from unittest.mock import patch

from fastapi import HTTPException

import main


class AIServiceValidationTests(unittest.TestCase):
    def test_provider_score_accepts_number_in_range(self):
        self.assertEqual(main.clean_score(84.6), 85)

    def test_provider_score_rejects_out_of_range_or_boolean_values(self):
        for value in (-1, 101, True, "80"):
            with self.subTest(value=value):
                with self.assertRaises(HTTPException) as raised:
                    main.clean_score(value)
                self.assertEqual(raised.exception.status_code, 502)

    def test_provider_lists_must_contain_text(self):
        self.assertEqual(main.clean_string_list([" Python ", "SQL"], "skills", 2), ["Python", "SQL"])
        with self.assertRaises(HTTPException):
            main.clean_string_list(["Python", 4], "skills", 2)

    def test_provider_json_parser_requires_an_object(self):
        self.assertEqual(main.parse_json_response('```json\n{"score": 80}\n```'), {"score": 80})
        for value in ("[]", "not json", None):
            with self.subTest(value=value):
                with self.assertRaises(HTTPException):
                    main.parse_json_response(value)

    def test_internal_routes_fail_closed_without_a_shared_key(self):
        with patch.dict(os.environ, {"AI_SERVICE_API_KEY": ""}):
            with self.assertRaises(HTTPException) as raised:
                main.check_internal_key(None)
            self.assertEqual(raised.exception.status_code, 503)

    def test_mock_resume_analysis_returns_bounded_schema(self):
        result = main.make_resume_analysis(
            "Education experience projects skills Python and PostgreSQL", "Backend Developer"
        )
        self.assertIn(result["score"], range(101))
        self.assertEqual(result["provider"], "mock")
        self.assertIsInstance(result["detectedSkills"], list)


if __name__ == "__main__":
    unittest.main()
