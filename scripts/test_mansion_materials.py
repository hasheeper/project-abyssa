"""Pixel-level regression checks; run with python3 -m unittest discover -s scripts -p test_mansion_materials.py."""
import importlib.util
import json
import unittest

import numpy as np
from PIL import Image

from pathlib import Path

spec = importlib.util.spec_from_file_location("materials", Path(__file__).with_name("prepare-mansion-materials.py"))
materials = importlib.util.module_from_spec(spec)
spec.loader.exec_module(materials)


class MansionMaterialsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rules = json.loads(materials.RULES_PATH.read_text())

    def images(self, layer):
        base = materials.ASSETS / "layers"
        return tuple(np.asarray(Image.open(base / f"{layer}{suffix}.png").convert("RGBA"))
                     for suffix in ["", materials.SUFFIX])

    def test_manifests_preserve_source_geometry_and_visibility(self):
        original = json.loads((materials.ASSETS / "manifest.json").read_text())
        processed = json.loads((materials.ASSETS / "manifest-materials-v1.json").read_text())
        self.assertEqual(len(original["layers"]), len(processed["layers"]))
        for before, after in zip(original["layers"], processed["layers"]):
            self.assertEqual({k:v for k,v in before.items() if k != "src"}, {k:v for k,v in after.items() if k != "src"})
            self.assertEqual(before["src"], f'layers/{before["id"]}.png')
            self.assertTrue((materials.ASSETS / after["src"]).is_file())

    def test_room_glass_keeps_milky_fill_and_original_colour(self):
        for layer, (x,y) in {"layer-03":(115,105), "layer-04":(70,170), "layer-16":(115,85), "layer-24":(584,159)}.items():
            before, after = self.images(layer)
            with self.subTest(layer=layer):
                self.assertEqual(int(before[y,x,3]), 255)
                self.assertGreaterEqual(int(after[y,x,3]), 102)
                self.assertLessEqual(int(after[y,x,3]), 120)
                np.testing.assert_array_equal(before[y,x,:3],after[y,x,:3])

    def test_greenhouse_keeps_both_luminous_herbs_exactly(self):
        before, after = self.images("layer-21")
        for polygon in self.rules["greenhouse"]["protect"]:
            mask = materials.polygon_mask((before.shape[1],before.shape[0]), [polygon]) == 1
            np.testing.assert_array_equal(before[mask],after[mask])
        self.assertGreaterEqual(int(after[1082,3330,3]), 127)
        self.assertLess(int(after[1082,3330,3]), 180)

    def test_foreground_and_masonry_stay_opaque(self):
        before, after = self.images("layer-21")
        for x,y in [(4040,1110), (4095,1180), (3720,1200), (3995,1100), (3430,1194), (3375,1194)]:
            with self.subTest(point=(x,y)):
                self.assertEqual(int(before[y,x,3]),255)
                self.assertEqual(int(after[y,x,3]),255)

    def test_other_room_pixels_are_unchanged(self):
        for layer in self.rules["glass"]:
            if layer == "layer-21":
                continue
            before, after = self.images(layer)
            mask = materials.polygon_mask((before.shape[1],before.shape[0]), self.rules["glass"][layer])
            np.testing.assert_array_equal(before[mask == 0], after[mask == 0])
            self.assertEqual(before.shape,after.shape)


if __name__ == "__main__":
    unittest.main()
