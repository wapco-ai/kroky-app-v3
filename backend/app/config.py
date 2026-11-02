import os
from pathlib import Path


class Settings:
    database_url = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://kroky:kroky@db:5432/kroky",
    )
    jwt_secret = os.getenv("JWT_SECRET", "change-this-secret-before-production")
    access_token_minutes = int(os.getenv("ACCESS_TOKEN_MINUTES", "480"))
    seed_data_dir = Path(os.getenv("SEED_DATA_DIR", "/app/seed-data"))
    upload_dir = Path(os.getenv("UPLOAD_DIR", "/app/uploads"))
    demo_otp = os.getenv("DEMO_OTP", "123456")
    integration_api_key = os.getenv("INTEGRATION_API_KEY", "")


settings = Settings()

