import pytest
from app.services.encryption import encrypt_password, decrypt_password


def test_encryption_roundtrip():
    """Test encrypting and decrypting a password."""
    original = "super_secret_password_123!"
    
    encrypted = encrypt_password(original)
    assert encrypted != original
    
    decrypted = decrypt_password(encrypted)
    assert decrypted == original


def test_encryption_different_values():
    """Test that same password encrypts to different values (due to IV)."""
    password = "test_password"
    
    encrypted1 = encrypt_password(password)
    encrypted2 = encrypt_password(password)
    
    # Both should decrypt to same value
    assert decrypt_password(encrypted1) == password
    assert decrypt_password(encrypted2) == password
