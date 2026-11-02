from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session, joinedload, object_session

from .config import settings
from .database import Base, SessionLocal, engine, get_db
from .models import KrokyFileMetadata, KrokyForm, KrokySubmission, Readiness, Request, User
from .security import create_token, current_user, hash_password, require_roles, verify_password
from .seed import PLAKS, seed_database


def tier_from_points(points: int) -> str:
    return "senior" if points >= 700 else "pro" if points >= 300 else "regular"


def user_json(user: User, include_password_placeholder: bool = False) -> dict:
    data = {
        "username": user.username,
        "name": user.name,
        "role": user.role,
        "roleLabel": user.role_label,
        "points": user.points,
        "tier": user.tier,
    }
    if include_password_placeholder:
        data["password"] = "••••••••"
    return data


def request_json(req: Request) -> dict:
    kroky = None
    if req.submission:
        kroky = {
            **(req.submission.metadata_json or {}),
            "corners": req.submission.corners_json,
            "file": {"name": req.submission.dxf_name, "url": f"/uploads/{req.submission.dxf_path}"} if req.submission.dxf_name else None,
            "photos": [
                photo_json(p, object_session(req))
                for p in req.submission.photos
            ],
            "sentAt": req.submission.submitted_at.isoformat(),
        }
    latest_visit = max(req.visits, key=lambda v: v.id) if req.visits else None
    info = (kroky or {}).get("information", {})
    return {
        "id": req.id,
        "requestNo": req.request_no,
        "requestDate": req.visit_date or "—",
        "auditCode": req.audit_code or "—",
        "title": info.get("address") or req.address or "بدون آدرس",
        "address": info.get("address") or req.address or "",
        "regPlak": req.reg_plak or "نامشخص",
        "parcel": req.parcel or "—",
        "area": float(info.get("total_area") or req.area or 0),
        "landUse": info.get("legal_land_use") or req.land_use or "",
        "status": req.status,
        "assignedTo": req.assigned_to,
        "submitted": req.submitted,
        "kroky": kroky,
        "trackingNo": req.tracking_no,
        "rejectReason": req.reject_reason,
        "lat": req.lat,
        "lng": req.lng,
        "source": {
            "requisitionId": str(req.id),
            "docNoRequest": req.docno_req,
            "requesterName": req.requester_name,
            "documentType": req.document_type,
            "classFile": req.class_file,
            "adUserId": req.ad_user_id,
            "description": req.description,
            "phone": req.phone,
            "parcelWkt": req.parcel_wkt,
            "attachmentCount": len(req.attachments),
            "visit": None if not latest_visit else {
                "description": latest_visit.description,
                "isDone": latest_visit.is_done,
                "date": latest_visit.done_date,
            },
        },
    }


def photo_json(photo, db):
    metadata = db.get(KrokyFileMetadata, photo.file_path) if db else None
    return {"id": photo.id, "name": photo.original_name, "url": f"/uploads/{photo.file_path}",
            "title": metadata.title if metadata else "عکس محل",
            "description": metadata.description if metadata else "",
            "size": round(metadata.size_bytes / 1024, 1) if metadata else ""}


def full_request_query(db: Session):
    return db.query(Request).options(
        joinedload(Request.submission).joinedload(KrokySubmission.photos),
        joinedload(Request.attachments),
        joinedload(Request.visits),
    )


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_database(db)
    yield


app = FastAPI(title="Kroky Local API", version="8.0.0", lifespan=lifespan,
              docs_url="/api/docs", openapi_url="/api/openapi.json", redoc_url="/api/redoc")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/uploads", StaticFiles(directory=str(settings.upload_dir), check_dir=False), name="uploads")


class Credentials(BaseModel):
    username: str
    password: str
    otp: str | None = None


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=80)
    password: str = Field(min_length=4, max_length=128)
    name: str = Field(min_length=2, max_length=160)
    role: str
    points: int = 0


class UserPatch(BaseModel):
    password: str | None = Field(default=None, min_length=4, max_length=128)
    name: str | None = Field(default=None, min_length=2, max_length=160)
    points: int | None = None
    tier: str | None = None


class ReadinessBody(BaseModel):
    plaks: list[str]


class AssignmentBody(BaseModel):
    ids: list[int]
    surveyorUsername: str


class PlanItem(BaseModel):
    surveyorUsername: str
    ids: list[int]


class ApplyPlanBody(BaseModel):
    plan: list[PlanItem]


class RejectBody(BaseModel):
    reason: str = "نیازمند اصلاح"


@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}


def authenticate(payload: Credentials, db: Session) -> User:
    user = db.query(User).filter(User.username == payload.username, User.active.is_(True)).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="نام کاربری یا رمز عبور اشتباه است")
    return user


@app.post("/api/auth/validate")
def validate_credentials(payload: Credentials, db: Session = Depends(get_db)):
    return {"user": user_json(authenticate(payload, db))}


@app.post("/api/auth/login")
def login(payload: Credentials, db: Session = Depends(get_db)):
    user = authenticate(payload, db)
    if payload.otp != settings.demo_otp:
        raise HTTPException(status_code=401, detail="رمز یکبارمصرف نادرست است")
    return {"accessToken": create_token(user), "user": user_json(user)}


@app.get("/api/auth/me")
def me(user: User = Depends(current_user)):
    return {"user": user_json(user)}


@app.get("/api/bootstrap")
def bootstrap(user: User = Depends(current_user), db: Session = Depends(get_db)):
    users = db.query(User).filter(User.active.is_(True)).order_by(User.id).all()
    q = full_request_query(db)
    if user.role == "surveyor":
        q = q.filter(Request.assigned_to == user.username)
    requests = q.order_by(Request.id.desc()).all()
    readiness: dict[str, list[str]] = {}
    for row in db.query(Readiness).join(User).filter(User.active.is_(True)).all():
        readiness.setdefault(row.user.username, []).append(row.registration_area)
    return {
        "users": [user_json(u, user.role == "admin") for u in users],
        "requests": [request_json(r) for r in requests],
        "readiness": readiness,
        "plaks": [p[0] for p in PLAKS],
    }


@app.post("/api/users", status_code=201)
def create_user(payload: UserCreate, _: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    if payload.role not in {"surveyor", "expert"}:
        raise HTTPException(status_code=422, detail="نقش کاربر معتبر نیست")
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=409, detail="این نام کاربری قبلاً ثبت شده است")
    user = User(
        username=payload.username.strip(),
        password_hash=hash_password(payload.password),
        name=payload.name.strip(),
        role=payload.role,
        role_label="کارشناس مسئول" if payload.role == "expert" else None,
        points=payload.points if payload.role == "surveyor" else 0,
        tier=tier_from_points(payload.points) if payload.role == "surveyor" else None,
    )
    db.add(user)
    db.commit()
    return user_json(user, True)


@app.patch("/api/users/{username}")
def patch_user(username: str, payload: UserPatch, _: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username, User.active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=404, detail="کاربر پیدا نشد")
    values = payload.model_dump(exclude_unset=True)
    password = values.pop("password", None)
    if password and password != "••••••••":
        user.password_hash = hash_password(password)
    if "name" in values:
        user.name = values["name"]
    if "points" in values:
        user.points = values["points"]
        user.tier = tier_from_points(values["points"])
    if "tier" in values and values["tier"] in {"regular", "pro", "senior"}:
        user.tier = values["tier"]
    db.commit()
    return user_json(user, True)


@app.delete("/api/users/{username}", status_code=204)
def delete_user(username: str, admin: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    if username == admin.username:
        raise HTTPException(status_code=422, detail="حساب مدیر جاری قابل حذف نیست")
    user = db.query(User).filter(User.username == username, User.active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=404, detail="کاربر پیدا نشد")
    user.active = False
    db.query(Request).filter(Request.assigned_to == username, Request.status == "assigned").update({Request.assigned_to: None, Request.status: "unassigned"})
    db.commit()


@app.put("/api/readiness/{username}")
def set_readiness(username: str, payload: ReadinessBody, actor: User = Depends(current_user), db: Session = Depends(get_db)):
    if actor.role != "admin" and actor.username != username:
        raise HTTPException(status_code=403, detail="Access denied")
    user = db.query(User).filter(User.username == username, User.active.is_(True), User.role == "surveyor").first()
    if not user:
        raise HTTPException(status_code=404, detail="نقشه‌بردار پیدا نشد")
    db.query(Readiness).filter(Readiness.user_id == user.id).delete()
    for plak in sorted(set(payload.plaks)):
        db.add(Readiness(user_id=user.id, registration_area=plak))
    db.commit()
    return {"username": username, "plaks": sorted(set(payload.plaks))}


def get_surveyor(db: Session, username: str) -> User:
    user = db.query(User).filter(User.username == username, User.role == "surveyor", User.active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=404, detail="نقشه‌بردار مقصد پیدا نشد")
    return user


@app.post("/api/requests/assign")
def assign_requests(payload: AssignmentBody, _: User = Depends(require_roles("expert", "admin")), db: Session = Depends(get_db)):
    get_surveyor(db, payload.surveyorUsername)
    rows = db.query(Request).filter(Request.id.in_(payload.ids), Request.status == "unassigned").all()
    for req in rows:
        req.status = "assigned"
        req.assigned_to = payload.surveyorUsername
        req.reject_reason = None
    db.commit()
    return {"updated": len(rows)}


def spatial_split(requests: list[Request], count: int):
    if count <= 1:
        return [requests], "lng"
    located = [r for r in requests if r.lat is not None and r.lng is not None]
    unlocated = [r for r in requests if r.lat is None or r.lng is None]
    if located:
        axis = "lng" if (max(r.lng for r in located) - min(r.lng for r in located)) >= (max(r.lat for r in located) - min(r.lat for r in located)) else "lat"
        ordered = sorted(located, key=lambda r: getattr(r, axis)) + unlocated
    else:
        axis, ordered = "lng", list(requests)
    base, remainder = divmod(len(ordered), count)
    groups, pos = [], 0
    for index in range(count):
        size = base + (1 if index < remainder else 0)
        groups.append(ordered[pos:pos + size])
        pos += size
    return groups, axis


@app.get("/api/requests/auto-plan/{plak}")
def auto_plan(plak: str, _: User = Depends(require_roles("expert", "admin")), db: Session = Depends(get_db)):
    pending = db.query(Request).filter(Request.reg_plak == plak, Request.status == "unassigned").all()
    ready = db.query(User).join(Readiness).filter(
        User.role == "surveyor", User.active.is_(True), Readiness.registration_area == plak
    ).order_by(User.id).all()
    if not pending or not ready:
        return {"plak": plak, "ready": [user_json(u) for u in ready], "pending": [request_json(r) for r in pending], "plan": [], "axis": None}
    groups, axis = spatial_split(pending, len(ready))
    return {
        "plak": plak,
        "ready": [user_json(u) for u in ready],
        "pending": [request_json(r) for r in pending],
        "plan": [{"surveyor": user_json(ready[i]), "items": [request_json(r) for r in group]} for i, group in enumerate(groups)],
        "axis": axis,
    }


@app.post("/api/requests/apply-plan")
def apply_plan(payload: ApplyPlanBody, _: User = Depends(require_roles("expert", "admin")), db: Session = Depends(get_db)):
    updated = 0
    for item in payload.plan:
        get_surveyor(db, item.surveyorUsername)
        rows = db.query(Request).filter(Request.id.in_(item.ids), Request.status == "unassigned").all()
        for req in rows:
            req.status = "assigned"
            req.assigned_to = item.surveyorUsername
            req.reject_reason = None
            updated += 1
    db.commit()
    return {"updated": updated}


@app.post("/api/requests/{request_id}/approve")
def approve_request(request_id: int, actor: User = Depends(require_roles("expert")), db: Session = Depends(get_db)):
    req = db.query(Request).filter(Request.id == request_id, Request.status == "submitted").with_for_update().first()
    if not req:
        raise HTTPException(status_code=404, detail="درخواست در انتظار تأیید پیدا نشد")
    form = db.query(KrokyForm).filter_by(request_id=request_id).first()
    if not form:
        raise HTTPException(409, "فرم قدیمی است؛ ابتدا برای تکمیل اطلاعات عودت دهید")
    req.status, req.tracking_no = "approved", None
    form.approved_by, form.approved_at = actor.username, datetime.utcnow()
    form.updated_at = form.approved_at
    db.commit()
    return {"status": "approved", "readyForTransfer": True, "trackingNo": None}


@app.post("/api/requests/{request_id}/reject")
def reject_request(request_id: int, payload: RejectBody, _: User = Depends(require_roles("expert")), db: Session = Depends(get_db)):
    req = db.query(Request).filter(Request.id == request_id, Request.status == "submitted").with_for_update().first()
    if not req:
        raise HTTPException(status_code=404, detail="درخواست در انتظار تأیید پیدا نشد")
    req.status = "assigned"
    req.submitted = False
    req.reject_reason = payload.reason or "نیازمند اصلاح"
    form = db.query(KrokyForm).filter_by(request_id=request_id).first()
    if form:
        form.updated_at = datetime.utcnow()
    db.commit()
    return {"status": "assigned"}


from .submissions import router as submissions_router
app.include_router(submissions_router)
