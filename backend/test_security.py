"""Regression checks; no real Garmin login, credentials or network calls."""
from unittest.mock import patch
from fastapi.testclient import TestClient
from main import app
from routers import auth


def run():
    for base, address, origin in [
        ('http://localhost', '192.0.2.1', 'http://localhost:3000'),
        ('http://attacker.test', '127.0.0.1', 'http://localhost:3000'),
        ('http://localhost', '127.0.0.1', 'https://attacker.test'),
    ]:
        with TestClient(app, base_url=base, client=(address, 50000), headers={'Origin': origin}) as client:
            with patch.object(auth, 'clear_session') as clear:
                assert client.delete('/auth/session').status_code == 403
                clear.assert_not_called()
    with TestClient(app, base_url='http://localhost', client=('127.0.0.1', 50000),
                    headers={'Origin': 'http://localhost:3000'}) as client:
        with patch.object(auth, 'clear_session') as clear:
            assert client.delete('/auth/session').status_code == 200
            clear.assert_called_once()
        marker = 'sensitive-test-marker'
        invalid = client.post('/auth/login', json={'email': {'password': marker}, 'password': marker})
        assert invalid.status_code == 422 and marker not in invalid.text
        with patch.object(auth.sso, 'login', side_effect=RuntimeError(marker)), patch('builtins.print') as output:
            failed = client.post('/auth/login', json={'email': 'test@example.invalid', 'password': marker})
            assert failed.status_code == 400 and marker not in failed.text
            output.assert_not_called()
        with patch.object(auth.sso, 'login', side_effect=RuntimeError('429 ' + marker)):
            limited = client.post('/auth/login', json={'email': 'test@example.invalid', 'password': marker})
            assert limited.status_code == 429 and marker not in limited.text
    print('Security: loopback/Host/Origin guards and sanitized authentication failures OK')


if __name__ == '__main__':
    run()
