"""HTTP/ORM tests on a disposable SQLite DB; never connect to an existing DB.

JSONB/Geometry storage types are substituted only here. Spatial analysis is
deliberately not tested because this release's DXF analysis is a demonstration.
Set KROKY_TEST_DATABASE_URL to an EMPTY disposable PostGIS database to test
against PostgreSQL instead; the fixture never drops existing database tables.
"""
import os
import sys
from pathlib import Path

import pytest
from sqlalchemy import JSON, Text, create_engine, inspect, text
from sqlalchemy.dialects.postgresql import JSONB, dialect
from sqlalchemy.schema import CreateTable
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from geoalchemy2 import Geometry

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SEED_DATA_DIR"] = str(ROOT / "data")
from app import main
from app.config import settings
from app.database import Base, get_db

POSTGRES_DDL = {name: str(CreateTable(table).compile(dialect=dialect())) for name, table in Base.metadata.tables.items()}
POSTGIS_TEST_URL = os.environ.get("KROKY_TEST_DATABASE_URL")
if not POSTGIS_TEST_URL:
    for table in Base.metadata.tables.values():
        for column in table.columns:
            if isinstance(column.type, JSONB):
                column.type = JSON()
            elif isinstance(column.type, Geometry):
                column.type = Text()


@pytest.fixture
def client(tmp_path, monkeypatch):
    from fastapi.testclient import TestClient
    if POSTGIS_TEST_URL:
        engine = create_engine(POSTGIS_TEST_URL)
        if set(inspect(engine).get_table_names()) - {"spatial_ref_sys"}:
            pytest.fail("KROKY_TEST_DATABASE_URL must reference an empty disposable database")
        with engine.begin() as connection:
            connection.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
    else:
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        with engine.connect() as connection:
            connection.execute(text("PRAGMA foreign_keys=ON"))
    factory = sessionmaker(engine, autoflush=False, expire_on_commit=False)
    monkeypatch.setattr(main, "engine", engine)
    monkeypatch.setattr(main, "SessionLocal", factory)
    monkeypatch.setattr(settings, "upload_dir", tmp_path / "uploads")
    monkeypatch.setattr(settings, "integration_api_key", "test-service-key")
    def db():
        with factory() as session:
            yield session
    main.app.dependency_overrides[get_db] = db
    with TestClient(main.app) as http:
        http.db_factory = factory
        yield http
    main.app.dependency_overrides.clear()
    # Only tables created by this test in its confirmed-empty database.
    Base.metadata.drop_all(engine)
    engine.dispose()


def auth(client, username="tamizi", password="1234"):
    response = client.post("/api/auth/login", json={"username": username, "password": password, "otp": "123456"})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['accessToken']}"}


@pytest.fixture
def users(client):
    return {name: auth(client, name, "admin" if name == "admin" else "1234") for name in ["admin", "masoul", "tamizi", "nikzad"]}


@pytest.fixture
def assigned(client, users):
    response = client.get("/api/bootstrap", headers=users["masoul"])
    ids = [r["id"] for r in response.json()["requests"]]
    response = client.post("/api/requests/assign", headers=users["masoul"], json={"ids": ids[:2], "surveyorUsername": "tamizi"})
    assert response.status_code == 200
    return ids[:2]
