import pytest
from app.services.auth import get_password_hash, verify_password, create_access_token, decode_token


def test_password_hashing():
    """Test password hashing and verification."""
    password = "test_password_123"
    hashed = get_password_hash(password)
    
    assert hashed != password
    assert verify_password(password, hashed)
    assert not verify_password("wrong_password", hashed)


def test_jwt_token():
    """Test JWT token creation and decoding."""
    user_id = 42
    token = create_access_token(data={"sub": str(user_id)})
    
    assert token is not None
    
    payload = decode_token(token)
    assert payload is not None
    assert payload.get("sub") == str(user_id)


def test_invalid_token():
    """Test decoding invalid token returns None."""
    payload = decode_token("invalid_token")
    assert payload is None
