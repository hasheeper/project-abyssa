"""Regression checks for transparent art and complete batch coverage.

Run with the same environment as prepare-codex-observation.py.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

import numpy as np
from PIL import Image, ImageDraw

spec = importlib.util.spec_from_file_location("observation", Path(__file__).with_name("prepare-codex-observation.py"))
observation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(observation)


class ObservationTests(unittest.TestCase):
    def test_catalog_covers_all_sources_and_current_outputs(self):
        catalog = json.loads(observation.CATALOG.read_text())
        manifest = json.loads((observation.OUT / "sources.json").read_text())
        self.assertEqual({entry["source"] for entry in catalog}, observation.registered_sources())
        self.assertEqual(len({entry["id"] for entry in catalog}), len(catalog))
        self.assertEqual({entry["id"] for entry in catalog}, {entry["assetId"] for entry in manifest["assets"]})
        self.assertEqual(manifest["parameters"], observation.PARAMS)
        for entry in manifest["assets"]:
            with self.subTest(asset=entry["assetId"]):
                source_path = observation.ROOT / entry["source"]
                self.assertEqual(hashlib.sha256(source_path.read_bytes()).hexdigest(), entry["sourceSha256"])
                source = Image.open(source_path).convert("RGBA")
                self.assertEqual(len(entry["outputs"]), 2)
                for index, output in enumerate(entry["outputs"]):
                    path = observation.OUT / output["file"]
                    self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), output["sha256"])
                    art = Image.open(path).convert("RGBA")
                    self.assertEqual(list(art.size), output["size"])
                    _, expected_alpha, _, _ = observation.normalize_source(source, (82, 62) if index else (550, 380), padding=4 if index else None)
                    np.testing.assert_array_equal(np.asarray(art)[..., 3], np.rint(expected_alpha.astype(np.float64) * 255).astype(np.uint8))
                    alpha = np.asarray(art)[..., 3]
                    self.assertEqual(np.count_nonzero(alpha[0]) + np.count_nonzero(alpha[-1]) + np.count_nonzero(alpha[:, 0]) + np.count_nonzero(alpha[:, -1]), 0)

    def test_invisible_rgb_cannot_pollute_lines_or_wash(self):
        source = Image.new("RGBA", (160, 120))
        draw = ImageDraw.Draw(source)
        draw.ellipse((22, 15, 142, 111), fill=(150, 125, 90, 230), outline=(35, 30, 25, 255), width=3)
        draw.line((40, 55, 95, 80, 125, 35), fill=(30, 25, 20, 255), width=2)
        dirty = np.asarray(source).copy()
        hidden = dirty[..., 3] == 0
        dirty[hidden, :3] = np.random.default_rng(42).integers(0, 256, (hidden.sum(), 3))
        plain, _, _ = observation.render_drawing(source, (120, 90))
        polluted, _, _ = observation.render_drawing(Image.fromarray(dirty), (120, 90))
        np.testing.assert_array_equal(np.asarray(plain), np.asarray(polluted))

    def test_wide_source_strokes_do_not_become_bright_blocks(self):
        support = np.ones((180, 180), dtype=bool)
        for half_width in (3, 12):
            candidate = np.zeros(support.shape)
            candidate[15:165, 90-half_width:90+half_width+1] = .9
            ink, _, stats = observation.ranked_strokes(candidate, np.ones_like(candidate), support, 2)
            section = np.flatnonzero(ink[90] > .25)
            self.assertGreater(stats["acceptedSegments"], 0)
            self.assertGreater(len(section), 0)
            self.assertLessEqual(section[-1] - section[0] + 1, 3)
            self.assertAlmostEqual(float(section.mean()), 90, delta=1)


if __name__ == "__main__":
    unittest.main()
