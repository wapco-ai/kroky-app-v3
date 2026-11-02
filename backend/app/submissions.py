import hashlib
import hmac
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import ValidationError
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .forms import KrokyPayload
from .export_schema import KrokyExport, KrokyExportPage
from .models import KrokyBoundary, KrokyFileMetadata, KrokyForm, KrokyLandUse, KrokyPhoto, KrokySubmission, Request, User
from .security import bearer, current_user, require_roles

router = APIRouter()


def integration_access(
    x_integration_key: str | None = Header(default=None),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
):
    if x_integration_key is not None:
        expected = settings.integration_api_key
        if not expected or not hmac.compare_digest(x_integration_key.encode(), expected.encode()):
            raise HTTPException(401, "کلید سرویس معتبر نیست")
        return
    user = current_user(credentials, db)
    if user.role not in {"admin", "expert"}:
        raise HTTPException(403, "دسترسی سرویس فقط برای مدیر یا کارشناس مسئول مجاز است")


def write_upload(upload: UploadFile, request_id: int, max_size: int, created: list[Path]):
    folder = settings.upload_dir / str(request_id)
    folder.mkdir(parents=True, exist_ok=True)
    suffix = Path(upload.filename or "").suffix.lower()[:12]
    path = folder / f"{uuid.uuid4().hex}{suffix}"
    created.append(path)
    total, digest = 0, hashlib.sha256()
    with path.open("xb") as target:
        while chunk := upload.file.read(1024 * 1024):
            total += len(chunk)
            if total > max_size:
                raise HTTPException(413, "حجم فایل بیشتر از حد مجاز است")
            target.write(chunk)
            digest.update(chunk)
    if not total:
        raise HTTPException(422, "فایل خالی قابل ثبت نیست")
    return f"{request_id}/{path.name}", total, digest.hexdigest()


@router.post("/api/requests/{request_id}/submit")
def submit_kroky(
    request_id: int,
    metadata: str = Form(...),
    dxf: UploadFile | None = File(None),
    photos: list[UploadFile] = File(default=[]),
    actor: User = Depends(require_roles("surveyor")),
    db: Session = Depends(get_db),
):
    # No upload/analyze endpoint exists: selecting a file cannot write any table.
    try:
        payload = KrokyPayload.model_validate_json(metadata)
    except ValidationError as exc:
        messages = [f"{'.'.join(map(str, e['loc']))}: {e['msg']}" for e in exc.errors()]
        raise HTTPException(422, "اطلاعات فرم معتبر نیست: " + "؛ ".join(messages)) from exc
    if len(photos) != len(payload.new_photos) or len(photos) + len(payload.kept_photos) > 30:
        raise HTTPException(422, "تعداد فایل‌ها و مشخصات عکس‌ها یکسان نیست یا بیش از ۳۰ عکس است")
    if dxf and Path(dxf.filename or "").suffix.lower() != ".dxf":
        raise HTTPException(422, "فایل کروکی باید DXF باشد")
    if any(not (p.content_type or "").startswith("image/") for p in photos):
        raise HTTPException(422, "پیوست عکس باید از نوع تصویر باشد")
    req = db.query(Request).filter(Request.id == request_id).with_for_update().first()
    if not req or req.assigned_to != actor.username or req.status != "assigned":
        raise HTTPException(409, "درخواست برای این کاربر قابل ارسال نیست")
    submission = db.query(KrokySubmission).filter_by(request_id=request_id).first()
    if not dxf and (not submission or not submission.dxf_path):
        raise HTTPException(422, "انتخاب فایل DXF الزامی است")
    existing_photos = {p.id: p for p in submission.photos} if submission else {}
    if any(p.id not in existing_photos for p in payload.kept_photos):
        raise HTTPException(422, "عکس انتخاب‌شده متعلق به این درخواست نیست")
    created: list[Path] = []
    try:
        now = datetime.utcnow()
        if not submission:
            submission = KrokySubmission(request_id=request_id)
            db.add(submission)
        submission.metadata_json = payload.model_dump(exclude={"kept_photos", "new_photos"})
        submission.corners_json = None  # Do not persist the former demonstration coordinates.
        submission.submitted_at = now
        if dxf:
            path, size, checksum = write_upload(dxf, request_id, 50 * 1024 * 1024, created)
            submission.dxf_name = Path(dxf.filename.replace("\\", "/")).name
            submission.dxf_path = path
            db.add(KrokyFileMetadata(file_path=path, title="فایل DXF کروکی", description="", size_bytes=size, sha256=checksum))
        db.flush()
        kept_ids = {p.id for p in payload.kept_photos}
        for photo_id, photo in existing_photos.items():
            if photo_id not in kept_ids:
                db.delete(photo)
        for detail in payload.kept_photos:
            photo = existing_photos[detail.id]
            meta = db.get(KrokyFileMetadata, photo.file_path)
            if not meta:
                absolute = settings.upload_dir / photo.file_path
                meta = KrokyFileMetadata(file_path=photo.file_path, size_bytes=absolute.stat().st_size if absolute.exists() else 0, sha256="")
                db.add(meta)
            meta.title, meta.description = detail.title, detail.description
        for upload, detail in zip(photos, payload.new_photos):
            path, size, checksum = write_upload(upload, request_id, 15 * 1024 * 1024, created)
            db.add(KrokyPhoto(submission_id=submission.id, original_name=Path(upload.filename.replace("\\", "/")).name,
                              file_path=path, content_type=upload.content_type))
            db.add(KrokyFileMetadata(file_path=path, title=detail.title, description=detail.description, size_bytes=size, sha256=checksum))
        form = db.query(KrokyForm).filter_by(request_id=request_id).first()
        if not form:
            form = KrokyForm(request_id=request_id, revision=0)
            db.add(form)
        form.fields_json = payload.information.model_dump()
        form.upload_options_json = payload.upload_options.model_dump()
        form.visit_json = payload.visit.model_dump()
        form.prepared_by = actor.username
        form.revision += 1
        form.updated_at = now
        form.approved_by, form.approved_at = None, None
        form.boundaries = [KrokyBoundary(position=i, **b.model_dump()) for i, b in enumerate(payload.boundaries)]
        form.land_uses = [KrokyLandUse(position=i, **u.model_dump()) for i, u in enumerate(payload.land_uses)]
        req.status, req.submitted, req.reject_reason = "submitted", True, None
        req.tracking_no = None
        db.commit()
    except Exception:
        db.rollback()
        for path in created:
            path.unlink(missing_ok=True)
        raise
    # Refresh collections after replacement; the old upload files remain recoverable.
    db.expire_all()
    from .main import full_request_query, request_json
    return request_json(full_request_query(db).filter(Request.id == request_id).first())


def utc_iso(value):
    return value.replace(tzinfo=timezone.utc).isoformat() if value else None


def source_record(req: Request):
    parcel = None
    if req.parcel_wkt:
        parcel = {"polygon": req.parcel_wkt,
                  "centroid": f"POINT({req.lng} {req.lat})" if req.lng is not None and req.lat is not None else None,
                  "lon": str(req.lng) if req.lng is not None else None,
                  "lat": str(req.lat) if req.lat is not None else None}
    return {"M_REQUISITION_ID": str(req.id), "DOCUMENTNO": req.request_no, "DOCNO_REQ": req.docno_req,
            "USERNAME": req.requester_name, "DOCTYPE_NAME": req.document_type, "CODEMOMAYEZI": req.audit_code,
            "CLASSFILE": req.class_file, "ADDRESS": req.address, "AD_USER_ID": req.ad_user_id,
            "DESCRIPTION": req.description, "BAZDIDDATE": req.visit_date, "PHONE": req.phone, "parcel": parcel}


def export_record(form: KrokyForm, req: Request, db: Session):
    submission = req.submission
    files = []
    if submission and submission.dxf_path:
        files.append({"kind": "dxf", "name": submission.dxf_name, "path": submission.dxf_path,
                      "download_url": f"/api/integration/kroky/{req.id}/files/dxf"})
    if submission:
        for photo in submission.photos:
            files.append({"kind": "photo", "id": photo.id, "name": photo.original_name, "path": photo.file_path,
                          "download_url": f"/api/integration/kroky/{req.id}/files/photos/{photo.id}"})
    for file in files:
        info = db.get(KrokyFileMetadata, file["path"])
        file.update({"title": info.title if info else file["name"], "description": info.description if info else None,
                     "size_bytes": info.size_bytes if info else None, "sha256": info.sha256 if info else None})
    visit = form.visit_json
    surveyor = db.query(User).filter_by(username=form.prepared_by).first()
    return {
        "schema_version": form.schema_version, "M_REQUISITION_ID": str(req.id), "document_no": req.request_no,
        "revision": form.revision, "status": req.status, "ready_for_transfer": req.status == "approved",
        "updated_at": utc_iso(form.updated_at), "prepared_by": form.prepared_by,
        "surveyor": {"username": form.prepared_by, "name": surveyor.name if surveyor else None},
        "approved_by": form.approved_by, "approved_at": utc_iso(form.approved_at),
        "source_request": source_record(req), "information": form.fields_json,
        "boundaries": [{"direction": b.direction, "neighbor": b.neighbor, "length": b.length, "road_width": b.road_width} for b in form.boundaries],
        "land_uses": [{"use": u.use, "area": u.area, "description": u.description} for u in form.land_uses],
        "upload_options": form.upload_options_json,
        "visit": {"DESCRIPTION": [visit.get("description") or None], "IS_BAZDID_DONE": ["Y" if visit.get("is_done") else "N"],
                  "DATE_BAZDID_DONE": [visit.get("done_date") or None]},
        "attachments": {"URL": [f["download_url"] for f in files], "TITEL": [f["title"] for f in files],
                        "DESCRIPTION": [f["description"] or None for f in files]},
        "files": files,
        # Assigned by Siagh. This app neither fabricates these values nor reports a transfer.
        "siagh": {"kroky_number": None, "kroky_date": None, "temporary_number": None, "temporary_date": None},
    }


@router.get("/api/integration/kroky", dependencies=[Depends(integration_access)], response_model=KrokyExportPage)
def list_kroky(
    status: str = Query(default="approved", pattern="^(approved|submitted|assigned|all)$"),
    limit: int = Query(default=100, ge=1, le=500), offset: int = Query(default=0, ge=0),
    updated_since: datetime | None = None, db: Session = Depends(get_db),
):
    q = db.query(KrokyForm, Request).join(Request, Request.id == KrokyForm.request_id)
    if status != "all":
        q = q.filter(Request.status == status)
    if updated_since:
        if updated_since.tzinfo is None:
            raise HTTPException(422, "updated_since باید منطقه زمانی UTC یا offset داشته باشد")
        q = q.filter(KrokyForm.updated_at >= updated_since.astimezone(timezone.utc).replace(tzinfo=None))
    total = q.count()
    rows = q.order_by(KrokyForm.updated_at, KrokyForm.request_id).offset(offset).limit(limit).all()
    return {"schema_version": "1.0", "total_records": total, "limit": limit, "offset": offset,
            "next_offset": offset + limit if offset + limit < total else None,
            "records": [export_record(form, req, db) for form, req in rows]}


@router.get("/api/integration/kroky/{request_id}", dependencies=[Depends(integration_access)], response_model=KrokyExport)
def get_kroky(request_id: int, db: Session = Depends(get_db)):
    form = db.query(KrokyForm).filter_by(request_id=request_id).first()
    req = db.get(Request, request_id)
    if not form or not req:
        raise HTTPException(404, "فرم ساختاریافته‌ای برای این درخواست ثبت نشده است")
    return export_record(form, req, db)


def send_file(request_id: int, photo_id: int | None, db: Session):
    submission = db.query(KrokySubmission).filter_by(request_id=request_id).first()
    if not submission:
        raise HTTPException(404, "فایل پیدا نشد")
    if photo_id is None:
        relative, name, media = submission.dxf_path, submission.dxf_name, "application/dxf"
    else:
        photo = db.query(KrokyPhoto).filter_by(id=photo_id, submission_id=submission.id).first()
        if not photo:
            raise HTTPException(404, "عکس متعلق به این درخواست نیست")
        relative, name, media = photo.file_path, photo.original_name, photo.content_type
    if not relative:
        raise HTTPException(404, "فایل پیدا نشد")
    root = settings.upload_dir.resolve()
    path = (root / relative).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise HTTPException(404, "فایل در محل ذخیره‌سازی موجود نیست")
    return FileResponse(path, filename=name, media_type=media)


@router.get("/api/integration/kroky/{request_id}/files/dxf", dependencies=[Depends(integration_access)])
def download_dxf(request_id: int, db: Session = Depends(get_db)):
    return send_file(request_id, None, db)


@router.get("/api/integration/kroky/{request_id}/files/photos/{photo_id}", dependencies=[Depends(integration_access)])
def download_photo(request_id: int, photo_id: int, db: Session = Depends(get_db)):
    return send_file(request_id, photo_id, db)


@router.get("/api/integration/cartable", dependencies=[Depends(integration_access)])
def cartable(db: Session = Depends(get_db)):
    records = [source_record(r) for r in db.query(Request).order_by(Request.id).all()]
    codes = {r["CODEMOMAYEZI"] for r in records if r["CODEMOMAYEZI"]}
    valid = {c for c in codes if any(ch in "123456789" for ch in c)}
    return {"total_records": len(records), "limit": len(records),
            "unique_users": len({r["AD_USER_ID"] for r in records if r["AD_USER_ID"]}),
            "unique_codes": len(codes), "valid_codes": len(valid), "records": records}
