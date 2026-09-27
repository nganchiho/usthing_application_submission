"""Run from the repo root:  python -m unittest scripts/test_preprocess.py"""

import unittest

from preprocess import parse_prerequisite


def course(code, **extra):
    return {"kind": "course", "code": code, **extra}


class ParsePrerequisiteTest(unittest.TestCase):
    def test_empty(self):
        self.assertIsNone(parse_prerequisite(""))

    def test_single_course(self):
        self.assertEqual(parse_prerequisite("DLED 3020"), course("DLED 3020"))

    def test_and_binds_tighter_than_or_with_brackets(self):
        self.assertEqual(
            parse_prerequisite("CHEM 1052 AND (CHEM 2409 OR MATH 2351)"),
            {
                "kind": "all",
                "children": [
                    course("CHEM 1052"),
                    {"kind": "any", "children": [course("CHEM 2409"), course("MATH 2351")]},
                ],
            },
        )

    def test_square_brackets_and_nested_groups(self):
        tree = parse_prerequisite("[(ECON 3014 AND ECON 3024) OR (ECON 3133 AND ECON 3143)] AND ECON 3334")
        self.assertEqual(tree["kind"], "all")
        self.assertEqual(tree["children"][0]["kind"], "any")
        self.assertEqual(tree["children"][1], course("ECON 3334"))

    def test_missing_space_in_code(self):
        tree = parse_prerequisite("DSAA 2011 or DSAA4040")
        self.assertEqual(tree["children"][1], course("DSAA 4040"))

    def test_bare_number_reuses_prefix(self):
        self.assertEqual(
            parse_prerequisite("UFUG 1103 or 1106"),
            {"kind": "any", "children": [course("UFUG 1103"), course("UFUG 1106")]},
        )

    def test_comma_list_with_and(self):
        self.assertEqual(parse_prerequisite("FINA 5120, FINA 5210 and FINA 5290")["kind"], "all")

    def test_one_of_makes_commas_alternatives(self):
        tree = parse_prerequisite("One of ISOM 2500, MATH 2411 or MATH 3423")
        self.assertEqual(tree["kind"], "any")
        self.assertEqual(len(tree["children"]), 3)

    def test_qualifier_becomes_note_on_course(self):
        tree = parse_prerequisite("SOSC 1300 OR SOSC 1450 (prior to 2021-22)")
        self.assertEqual(tree["children"][1], course("SOSC 1450", note="prior to 2021-22"))

    def test_or_above_is_not_an_operator(self):
        self.assertEqual(
            parse_prerequisite("Grade B- or above in MATH 2131"),
            course("MATH 2131", note="Grade B- or above in"),
        )

    def test_text_only_requirement(self):
        self.assertEqual(parse_prerequisite("CGA at 2.70 or above"), {"kind": "text", "text": "CGA at 2.70 or above"})

    def test_unbalanced_brackets_do_not_crash(self):
        self.assertEqual(parse_prerequisite("(COMP 2011 OR COMP 2012"), {
            "kind": "any", "children": [course("COMP 2011"), course("COMP 2012")],
        })


if __name__ == "__main__":
    unittest.main()
