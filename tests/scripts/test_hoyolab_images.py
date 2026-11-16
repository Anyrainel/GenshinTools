"""Live artwork refreshes replace existing images only after valid encoding."""

import io
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))

import hoyolab  # noqa: E402


class HoyolabImageRefreshTests(unittest.TestCase):
    def test_unlabelled_artifact_thumbnails_cannot_replace_valid_slot_art(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            artifact = hoyolab.ArtifactSource(
                entry_id="123",
                name="Example",
                image_urls={"flower": "https://example.com/x.png"},
            )
            path = root / "public/artifact/example.webp"
            path.parent.mkdir(parents=True)
            before = self.image_bytes("red")
            path.write_bytes(before)
            response = Mock(content=self.image_bytes("blue"))
            with patch.object(hoyolab.requests, "get", return_value=response) as get:
                hoyolab.HoyolabAssetManager.download_artifact_assets(
                    artifact, str(root)
                )
            get.assert_called_once()
            self.assertEqual(path.read_bytes(), before)
            path.unlink()
            with self.assertRaisesRegex(RuntimeError, "without reliable identity"):
                hoyolab.HoyolabAssetManager.download_artifact_assets(
                    artifact, str(root)
                )
            self.assertFalse(path.exists())

    @staticmethod
    def image_bytes(color):
        output = io.BytesIO()
        Image.new("RGBA", (4, 4), color).save(output, "PNG")
        return output.getvalue()

    def test_default_refresh_downloads_updated_existing_artwork(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "image.webp"
            path.write_bytes(self.image_bytes("red"))
            response = Mock(content=self.image_bytes("blue"))
            with patch.object(hoyolab.requests, "get", return_value=response) as get:
                self.assertTrue(
                    hoyolab.download_image("https://example.com/image.png", str(path))
                )
            get.assert_called_once()
            with Image.open(path) as result:
                self.assertEqual(result.format, "WEBP")
                red, green, blue = result.convert("RGB").getpixel((0, 0))
                self.assertGreater(blue, red + green)

    def test_failed_or_empty_live_response_preserves_existing_artwork(self):
        for content in (b"", b"<html>upstream unavailable</html>"):
            with (
                self.subTest(content=content),
                tempfile.TemporaryDirectory() as directory,
            ):
                path = Path(directory) / "image.webp"
                before = self.image_bytes("red")
                path.write_bytes(before)
                with patch.object(
                    hoyolab.requests, "get", return_value=Mock(content=content)
                ):
                    with self.assertRaisesRegex(
                        RuntimeError, "Failed to download image"
                    ):
                        hoyolab.download_image(
                            "https://example.com/image.png", str(path)
                        )
                self.assertEqual(path.read_bytes(), before)

    def test_http_failure_preserves_existing_artwork(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "image.webp"
            before = self.image_bytes("red")
            path.write_bytes(before)
            response = Mock()
            response.raise_for_status.side_effect = hoyolab.requests.HTTPError("404")
            with patch.object(hoyolab.requests, "get", return_value=response):
                with self.assertRaisesRegex(RuntimeError, "404"):
                    hoyolab.download_image("https://example.com/image.png", str(path))
            self.assertEqual(path.read_bytes(), before)

    def test_live_thumbnail_does_not_downgrade_larger_local_artwork(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "image.webp"
            before = self.image_bytes("red")
            path.write_bytes(before)
            thumbnail = io.BytesIO()
            Image.new("RGBA", (2, 2), "red").save(thumbnail, "PNG")
            response = Mock(content=thumbnail.getvalue())
            with patch.object(hoyolab.requests, "get", return_value=response) as get:
                hoyolab.download_image("https://example.com/thumb.png", str(path))
            get.assert_called_once()
            self.assertEqual(path.read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
