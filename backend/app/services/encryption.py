import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from app.config import get_settings

settings = get_settings()


def get_fernet() -> Fernet:
    """Get Fernet instance from encryption key."""
    key = settings.encryption_key.encode()
    # Derive a proper 32-byte key using PBKDF2
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"sqlagent_salt_v1",  # Static salt for consistency
        iterations=100000,
    )
    derived_key = base64.urlsafe_b64encode(kdf.derive(key))
    return Fernet(derived_key)


def encrypt_password(password: str) -> str:
    """Encrypt a password for storage."""
    f = get_fernet()
    return f.encrypt(password.encode()).decode()


def decrypt_password(encrypted: str) -> str:
    """Decrypt a stored password."""
    f = get_fernet()
    return f.decrypt(encrypted.encode()).decode()
