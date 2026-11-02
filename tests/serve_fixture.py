"""Disposable local server for UI smoke tests, never uses production storage."""
import os
from pathlib import Path
from tempfile import TemporaryDirectory

with TemporaryDirectory(prefix="kroky-ui-test-") as temporary:
    os.environ["UPLOAD_DIR"] = str(Path(temporary) / "uploads")
    os.environ["INTEGRATION_API_KEY"] = "test-service-key"
    from conftest import main, Base, settings
    from app.database import get_db
    from app.models import Request
    from app.seed import seed_database
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    import uvicorn

    engine = create_engine(f"sqlite:///{temporary}/ui-test.db")
    factory = sessionmaker(engine, autoflush=False, expire_on_commit=False)
    Base.metadata.create_all(engine)
    with factory() as db:
        seed_database(db)
        for request in db.query(Request).order_by(Request.id.desc()).limit(2):
            request.assigned_to, request.status = "tamizi", "assigned"
        db.commit()
    main.engine, main.SessionLocal = engine, factory
    def get_test_db():
        with factory() as db:
            yield db
    main.app.dependency_overrides[get_db] = get_test_db
    uvicorn.run(main.app, host="127.0.0.1", port=8000, log_level="warning")
