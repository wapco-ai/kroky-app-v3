import json
import math
from pathlib import Path

from sqlalchemy import func
from sqlalchemy.orm import Session

from .config import settings
from .models import Attachment, LegacyKroky, MapLayer, Readiness, Request, SourceUserAccess, User, Visit
from .security import hash_password

PLAKS = [
    ("طرق", 36.2745, 59.4905),
    ("آبکوه", 36.3155, 59.5750),
    ("احمدآباد", 36.2985, 59.5955),
    ("سمزقند", 36.3450, 59.5205),
    ("ملک‌آباد", 36.3105, 59.5555),
]

SEED_USERS = [
    ("admin", "admin", "مدیر سامانه", "admin", "سرپرست فنی", 0, None),
    ("masoul", "1234", "حسین رحیمی", "expert", "کارشناس مسئول", 0, None),
    ("tamizi", "1234", "ابراهیم تمیزی", "surveyor", None, 920, "senior"),
    ("nikzad", "1234", "رضا نیک‌زاد", "surveyor", None, 760, "senior"),
    ("ahmadi", "1234", "محمد احمدی", "surveyor", None, 540, "pro"),
    ("mohammadi", "1234", "علی محمدی", "surveyor", None, 120, "regular"),
]

SEED_READINESS = {
    "tamizi": ["طرق", "آبکوه"],
    "nikzad": ["طرق", "سمزقند"],
    "ahmadi": ["احمدآباد", "ملک‌آباد"],
}


def _load(name: str, default):
    path: Path = settings.seed_data_dir / name
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8-sig"))


def _nearest_plak(lat: float | None, lng: float | None) -> str:
    if lat is None or lng is None:
        return "نامشخص"
    return min(PLAKS, key=lambda p: math.hypot(lat - p[1], lng - p[2]))[0]


def _scalar(value):
    if isinstance(value, list):
        return value[0] if value else None
    return value


def seed_database(db: Session) -> None:
    if db.query(func.count(User.id)).scalar():
        return

    for username, password, name, role, role_label, points, tier in SEED_USERS:
        db.add(User(
            username=username,
            password_hash=hash_password(password),
            name=name,
            role=role,
            role_label=role_label,
            points=points,
            tier=tier,
        ))
    db.flush()

    users = {u.username: u for u in db.query(User).all()}
    for username, areas in SEED_READINESS.items():
        for area in areas:
            db.add(Readiness(user_id=users[username].id, registration_area=area))

    cartable = _load("cartable_all.json", {}).get("records", [])
    for row in cartable:
        parcel = row.get("parcel") or {}
        lat = float(parcel["lat"]) if parcel.get("lat") else None
        lng = float(parcel["lon"]) if parcel.get("lon") else None
        request_id = int(row["M_REQUISITION_ID"])
        wkt = parcel.get("polygon")
        req = Request(
            id=request_id,
            request_no=str(row.get("DOCUMENTNO") or request_id),
            docno_req=row.get("DOCNO_REQ"),
            requester_name=row.get("USERNAME"),
            document_type=row.get("DOCTYPE_NAME"),
            audit_code=row.get("CODEMOMAYEZI"),
            class_file=row.get("CLASSFILE"),
            address=row.get("ADDRESS") or "بدون آدرس",
            ad_user_id=row.get("AD_USER_ID"),
            description=row.get("DESCRIPTION"),
            visit_date=row.get("BAZDIDDATE"),
            phone=row.get("PHONE"),
            reg_plak=_nearest_plak(lat, lng),
            parcel=row.get("CLASSFILE"),
            area=0,
            land_use=row.get("DOCTYPE_NAME"),
            status="unassigned",
            lat=lat,
            lng=lng,
            parcel_wkt=wkt,
            geom=f"SRID=4326;{wkt}" if wkt else None,
        )
        db.add(req)

    db.flush()
    request_ids = {str(x[0]) for x in db.query(Request.id).all()}

    for item in _load("attachments_all.json", {}).get("attachments", []):
        rid = str(item.get("M_REQUISITION_ID"))
        payload = item.get("attachments") or {}
        if rid not in request_ids:
            continue
        urls = payload.get("URL", [])
        titles = payload.get("TITEL", [])
        descriptions = payload.get("DESCRIPTION", [])
        for i, url in enumerate(urls):
            db.add(Attachment(
                request_id=int(rid),
                title=titles[i] if i < len(titles) else None,
                description=descriptions[i] if i < len(descriptions) else None,
                source_url=url,
            ))

    for item in _load("visit_all.json", {}).get("visits", []):
        rid = str(item.get("M_REQUISITION_ID"))
        if rid not in request_ids or item.get("error"):
            continue
        db.add(Visit(
            request_id=int(rid),
            description=item.get("description"),
            is_done=item.get("is_bazdid_done") == "Y",
            done_date=item.get("date_bazdid_done"),
        ))

    for item in _load("krooki_all.json", {}).get("krooki_data", []):
        for record in item.get("records", []):
            db.add(LegacyKroky(
                audit_code=item.get("original_code") or "",
                clean_code=item.get("clean_code"),
                kroky_text=record.get("krk_text"),
                image_url=record.get("krk_image"),
                requisition_reference=record.get("req_koroki"),
            ))

    layers = _load("layers.json", {})
    for layer in layers.get("layers", []):
        db.add(MapLayer(
            source_id=str(layer.get("layer_id")),
            map_name=layer.get("layer_map_name"),
            title_fa=layer.get("layer_title_fa"),
            layer_type_id=layer.get("layer_type_id"),
            editable=str(layer.get("layer_editable", "")).lower() in {"t", "true", "1"},
            style_name=layer.get("style_name"),
            raw_json=layer,
        ))

    for user_id, payload in _load("user_access_all.json", {}).items():
        db.add(SourceUserAccess(ad_user_id=user_id, access_json=payload.get("access") or payload))

    db.commit()
