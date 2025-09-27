import sys
import types

import pytest


class _StubS3Client:
    def put_object(self, **_: object) -> None:  # pragma: no cover - stub behavior
        return None


def _stub_client(service_name: str, **_: object):  # pragma: no cover - stub behavior
    if service_name != "s3":
        raise ValueError(f"Unsupported service {service_name}")
    return _StubS3Client()


boto3_stub = types.SimpleNamespace(client=_stub_client)
sys.modules.setdefault("boto3", boto3_stub)


def pytest_configure(config: pytest.Config) -> None:  # pragma: no cover - pytest hook
    config.addinivalue_line("markers", "asyncio: mark async tests")
