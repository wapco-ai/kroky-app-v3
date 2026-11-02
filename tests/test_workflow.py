import base64
import copy
import hashlib
import json

import pytest
from app.forms import KrokyInformation, KrokyPayload
from app.models import KrokyBoundary, KrokyForm, KrokyLandUse, KrokySubmission, Request, User
from conftest import POSTGRES_DDL

SERVICE = {"X-Integration-Key": "test-service-key"}
DXF = b"0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n"
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jxbkAAAAASUVORK5CYII=")


def payload():
    information = KrokyInformation(address="مشهد؛ نشانی آزمایشی", legal_land_use="مسکونی", property_type="قطعه اصلی", city="مشهد", land_name="ملک‌آباد", main_registration="256", land_share_area=0).model_dump()
    numeric = {"total_area", "in_road_area", "land_share_area", "common_share_area", "building_area", "useful_area"}
    for key, value in information.items():
        if isinstance(value, str) and key not in {"kind", "survey_date", "letter_date"}:
            information[key] = "مقدار آزمایشی " + key
        elif key in numeric:
            information[key] = "۱۴۸٫۵"
    information.update(survey_date="۱۴۰۵/۰۷/۲۵", letter_date="1405/07/22", legal_reprint=True)
    return {"schema_version": "1.0", "information": information,
            "boundaries": [{"direction": d, "neighbor": "مجاور " + d, "length": "۱۶/۵", "road_width": "" if d != "N" else "۱۰"} for d in "NESW"],
            "land_uses": [{"use": "ساختمان", "area": "۱۴۸٫۵", "description": "شرح بهره‌برداری"}],
            "upload_options": {"survey_method": "برداشت GPS-RTK", "utm_zone": "۴۰", "hemisphere": "N", "north_deviation": "-۲٫۵", "update_boundaries": False, "analysis_mode": "demo"},
            "visit": {"description": "شرح بازدید", "is_done": True, "done_date": "1405/07/25"},
            "kept_photos": [], "new_photos": [{"title": "نمای شمال", "description": "عکس آزمایشی"}]}


def submit(client, users, request_id, data=None, include_dxf=True, include_photo=True):
    files = []
    if include_dxf:
        files.append(("dxf", ("ملک.dxf", DXF, "application/dxf")))
    if include_photo:
        files.append(("photos", ("نما.png", PNG, "image/png")))
    return client.post(f"/api/requests/{request_id}/submit", headers=users["tamizi"], data={"metadata": json.dumps(data or payload(), ensure_ascii=False)}, files=files)


def test_full_persistence_export_and_download(client, users, assigned):
    rid = assigned[0]
    with client.db_factory() as db:
        before = db.get(Request, rid)
        source = (before.area, before.address, before.land_use, before.parcel_wkt)
    # Merely reading or opening an assigned request cannot create form rows.
    client.get("/api/bootstrap", headers=users["tamizi"])
    with client.db_factory() as db:
        assert db.query(KrokyForm).count() == 0
    response = submit(client, users, rid)
    assert response.status_code == 200, response.text
    kroky = response.json()["kroky"]
    assert kroky["boundaries"][0]["length"] == 16.5
    assert kroky["information"]["total_area"] == 148.5
    assert kroky["photos"][0]["title"] == "نمای شمال"
    assert kroky["corners"] is None
    assert client.get("/api/integration/kroky", headers=SERVICE).json()["records"] == []
    exported = client.get(f"/api/integration/kroky/{rid}", headers=SERVICE).json()
    expected = KrokyPayload.model_validate(payload())
    assert exported["information"] == expected.information.model_dump()
    assert exported["boundaries"] == [b.model_dump() for b in expected.boundaries]
    assert exported["land_uses"] == [u.model_dump() for u in expected.land_uses]
    assert exported["upload_options"] == expected.upload_options.model_dump()
    assert exported["visit"] == {"DESCRIPTION": ["شرح بازدید"], "IS_BAZDID_DONE": ["Y"], "DATE_BAZDID_DONE": ["1405/07/25"]}
    assert exported["ready_for_transfer"] is False
    assert len(exported["attachments"]["URL"]) == len(exported["attachments"]["TITEL"]) == 2
    assert exported["M_REQUISITION_ID"] == str(rid)
    for i, file in enumerate(exported["files"]):
        actual = client.get(file["download_url"], headers=SERVICE)
        content = DXF if i == 0 else PNG
        assert actual.status_code == 200
        assert actual.content == content
        assert file["sha256"] == hashlib.sha256(content).hexdigest()
        assert file["size_bytes"] == len(content)
        assert client.get(file["download_url"]).status_code == 401
    with client.db_factory() as db:
        req = db.get(Request, rid)
        assert (req.area, req.address, req.land_use, req.parcel_wkt) == source
        assert db.query(KrokyForm).count() == db.query(KrokySubmission).count() == 1
        assert db.query(KrokyBoundary).count() == 4
        assert db.query(KrokyLandUse).count() == 1
    # Refresh uses DB values, not component state.
    fresh = client.get("/api/bootstrap", headers=users["tamizi"]).json()["requests"]
    assert next(r for r in fresh if r["id"] == rid)["kroky"]["information"] == expected.information.model_dump()
    response = client.post(f"/api/requests/{rid}/approve", headers=users["masoul"])
    assert response.status_code == 200, response.text
    assert response.json()["trackingNo"] is None
    record = client.get("/api/integration/kroky", headers=SERVICE).json()["records"][0]
    assert record["ready_for_transfer"] is True and record["approved_by"] == "masoul"
    assert all(v is None for v in record["siagh"].values())
    assert client.get("/api/integration/kroky", headers=SERVICE, params={"updated_since": record["updated_at"]}).json()["total_records"] == 1
    assert client.get("/api/integration/kroky", headers=SERVICE, params={"updated_since": "2026-01-01T00:00:00"}).status_code == 422
    assert client.post(f"/api/requests/{rid}/approve", headers=users["masoul"]).status_code == 404


def test_rejection_resubmit_keeps_files_and_one_form(client, users, assigned):
    rid = assigned[0]
    original = submit(client, users, rid)
    assert original.status_code == 200, original.text
    photo_id = original.json()["kroky"]["photos"][0]["id"]
    assert submit(client, users, rid).status_code == 409
    assert client.post(f"/api/requests/{rid}/reject", headers=users["masoul"], json={"reason": "اصلاح حدود"}).status_code == 200
    changed = payload()
    changed["new_photos"] = []
    changed["kept_photos"] = [{"id": photo_id, "title": "عنوان اصلاحی", "description": "حفظ فایل قبلی"}]
    changed["boundaries"][0]["neighbor"] = "معبر اصلاح‌شده"
    changed["land_uses"] = []
    response = submit(client, users, rid, changed, include_dxf=False, include_photo=False)
    assert response.status_code == 200, response.text
    assert response.json()["kroky"]["photos"][0]["id"] == photo_id
    record = client.get(f"/api/integration/kroky/{rid}", headers=SERVICE).json()
    assert record["revision"] == 2 and record["files"][1]["title"] == "عنوان اصلاحی"
    assert record["boundaries"][0]["neighbor"] == "معبر اصلاح‌شده"
    with client.db_factory() as db:
        assert db.query(KrokyForm).count() == db.query(KrokySubmission).count() == 1
        assert db.query(KrokyBoundary).count() == 4
        assert db.query(KrokyLandUse).count() == 0
    # Another request cannot download this photo by reusing its id.
    assert client.get(f"/api/integration/kroky/{assigned[1]}/files/photos/{photo_id}", headers=SERVICE).status_code == 404


@pytest.mark.parametrize("fault", ["array", "siagh_number", "update_dxf", "missing_direction", "negative_area", "nan_area", "bad_date", "bad_photo_count", "forged_photo", "bad_survey_method"])
def test_invalid_data_never_writes(client, users, assigned, fault):
    data = payload()
    if fault == "array": data = []
    if fault == "siagh_number": data["information"]["kroky_number"] = "fake"
    if fault == "update_dxf": data["upload_options"]["update_boundaries"] = True
    if fault == "missing_direction": data["boundaries"][0]["direction"] = "E"
    if fault == "negative_area": data["information"]["total_area"] = -3
    if fault == "nan_area": data["information"]["total_area"] = "NaN"
    if fault == "bad_date": data["information"]["survey_date"] = "1405/07/31"
    if fault == "bad_survey_method": data["upload_options"]["survey_method"] = "روش خارج از فهرست"
    if fault == "bad_photo_count": data["new_photos"] = []
    if fault == "forged_photo": data["kept_photos"] = [{"id": 999}]
    response = client.post(f"/api/requests/{assigned[0]}/submit", headers=users["tamizi"], data={"metadata": json.dumps(data)}, files=[("dxf", ("a.dxf", DXF, "application/dxf")), ("photos", ("a.png", PNG, "image/png"))])
    assert response.status_code == 422, response.text
    with client.db_factory() as db:
        assert db.query(KrokyForm).count() == db.query(KrokySubmission).count() == 0
        assert db.get(Request, assigned[0]).status == "assigned"


def test_upload_failure_rolls_back_all_rows_and_files(client, users, assigned):
    data = payload()
    response = client.post(f"/api/requests/{assigned[0]}/submit", headers=users["tamizi"], data={"metadata": json.dumps(data)}, files=[("dxf", ("a.dxf", DXF, "application/dxf")), ("photos", ("empty.png", b"", "image/png"))])
    assert response.status_code == 422
    from app.config import settings
    assert list(settings.upload_dir.rglob("*.dxf")) == []
    assert list(settings.upload_dir.rglob("*.png")) == []
    with client.db_factory() as db:
        assert db.query(KrokyForm).count() == db.query(KrokySubmission).count() == 0


def test_permissions_and_source_shape(client, users, assigned):
    assert client.get("/api/integration/kroky").status_code == 401
    assert client.get("/api/integration/kroky", headers=users["tamizi"]).status_code == 403
    assert client.get("/api/integration/kroky", headers={"X-Integration-Key": "wrong"}).status_code == 401
    assert client.get("/api/integration/kroky", headers=users["admin"]).status_code == 200
    assert client.post(f"/api/requests/{assigned[0]}/approve", headers=SERVICE).status_code == 401
    openapi = client.get("/api/openapi.json")
    assert openapi.status_code == 200
    assert "KrokyExport" in openapi.json()["components"]["schemas"]
    record = client.get("/api/integration/cartable", headers=SERVICE).json()
    assert record["total_records"] == 10
    assert all(isinstance(r["M_REQUISITION_ID"], str) for r in record["records"])
    response = client.post(f"/api/requests/{assigned[0]}/submit", headers=users["nikzad"], data={"metadata": json.dumps(payload())}, files=[("dxf", ("a.dxf", DXF)), ("photos", ("a.png", PNG, "image/png"))])
    assert response.status_code == 409
    with client.db_factory() as db:
        assert db.query(User).count() == 6
    assert "JSONB" in POSTGRES_DDL["kroky_forms"]
    assert "GEOMETRY" in POSTGRES_DDL["requests"].upper()
