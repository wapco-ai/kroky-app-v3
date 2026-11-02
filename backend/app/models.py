from datetime import datetime

from geoalchemy2 import Geometry
from sqlalchemy import BigInteger, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(160))
    role: Mapped[str] = mapped_column(String(30), index=True)
    role_label: Mapped[str | None] = mapped_column(String(100))
    points: Mapped[int] = mapped_column(Integer, default=0)
    tier: Mapped[str | None] = mapped_column(String(20))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    readiness: Mapped[list["Readiness"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Readiness(Base):
    __tablename__ = "readiness"
    __table_args__ = (UniqueConstraint("user_id", "registration_area"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    registration_area: Mapped[str] = mapped_column(String(120), index=True)
    user: Mapped[User] = relationship(back_populates="readiness")


class Request(Base):
    __tablename__ = "requests"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    request_no: Mapped[str] = mapped_column(String(80), index=True)
    docno_req: Mapped[str | None] = mapped_column(String(80))
    requester_name: Mapped[str | None] = mapped_column(String(200))
    document_type: Mapped[str | None] = mapped_column(String(250))
    audit_code: Mapped[str | None] = mapped_column(String(120), index=True)
    class_file: Mapped[str | None] = mapped_column(String(120))
    address: Mapped[str | None] = mapped_column(Text)
    ad_user_id: Mapped[str | None] = mapped_column(String(80), index=True)
    description: Mapped[str | None] = mapped_column(Text)
    visit_date: Mapped[str | None] = mapped_column(String(80))
    phone: Mapped[str | None] = mapped_column(String(30))
    reg_plak: Mapped[str | None] = mapped_column(String(120), index=True)
    parcel: Mapped[str | None] = mapped_column(String(120))
    area: Mapped[float] = mapped_column(Float, default=0)
    land_use: Mapped[str | None] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(30), default="unassigned", index=True)
    assigned_to: Mapped[str | None] = mapped_column(ForeignKey("users.username", ondelete="SET NULL"), index=True)
    submitted: Mapped[bool] = mapped_column(Boolean, default=False)
    tracking_no: Mapped[str | None] = mapped_column(String(100))
    reject_reason: Mapped[str | None] = mapped_column(Text)
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    parcel_wkt: Mapped[str | None] = mapped_column(Text)
    geom: Mapped[object | None] = mapped_column(Geometry("GEOMETRY", srid=4326, spatial_index=True))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    submission: Mapped["KrokySubmission | None"] = relationship(back_populates="request", cascade="all, delete-orphan")
    attachments: Mapped[list["Attachment"]] = relationship(back_populates="request", cascade="all, delete-orphan")
    visits: Mapped[list["Visit"]] = relationship(back_populates="request", cascade="all, delete-orphan")


class KrokySubmission(Base):
    __tablename__ = "kroky_submissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("requests.id", ondelete="CASCADE"), unique=True)
    metadata_json: Mapped[dict] = mapped_column(JSONB, default=dict)
    corners_json: Mapped[dict | list | None] = mapped_column(JSONB)
    dxf_name: Mapped[str | None] = mapped_column(String(255))
    dxf_path: Mapped[str | None] = mapped_column(String(500))
    submitted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    request: Mapped[Request] = relationship(back_populates="submission")
    photos: Mapped[list["KrokyPhoto"]] = relationship(back_populates="submission", cascade="all, delete-orphan")


class KrokyPhoto(Base):
    __tablename__ = "kroky_photos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    submission_id: Mapped[int] = mapped_column(ForeignKey("kroky_submissions.id", ondelete="CASCADE"))
    original_name: Mapped[str] = mapped_column(String(255))
    file_path: Mapped[str] = mapped_column(String(500))
    content_type: Mapped[str | None] = mapped_column(String(100))
    submission: Mapped[KrokySubmission] = relationship(back_populates="photos")


class Attachment(Base):
    __tablename__ = "attachments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("requests.id", ondelete="CASCADE"), index=True)
    title: Mapped[str | None] = mapped_column(String(300))
    description: Mapped[str | None] = mapped_column(Text)
    source_url: Mapped[str] = mapped_column(Text)
    request: Mapped[Request] = relationship(back_populates="attachments")


class Visit(Base):
    __tablename__ = "visits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("requests.id", ondelete="CASCADE"), index=True)
    description: Mapped[str | None] = mapped_column(Text)
    is_done: Mapped[bool] = mapped_column(Boolean, default=False)
    done_date: Mapped[str | None] = mapped_column(String(80))
    request: Mapped[Request] = relationship(back_populates="visits")


class LegacyKroky(Base):
    __tablename__ = "legacy_kroky"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    audit_code: Mapped[str] = mapped_column(String(120), index=True)
    clean_code: Mapped[str | None] = mapped_column(String(120))
    kroky_text: Mapped[str | None] = mapped_column(String(255))
    image_url: Mapped[str | None] = mapped_column(Text)
    requisition_reference: Mapped[str | None] = mapped_column(String(255))


class MapLayer(Base):
    __tablename__ = "map_layers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_id: Mapped[str] = mapped_column(String(40), unique=True)
    map_name: Mapped[str | None] = mapped_column(String(150))
    title_fa: Mapped[str | None] = mapped_column(String(300))
    layer_type_id: Mapped[str | None] = mapped_column(String(40))
    editable: Mapped[bool] = mapped_column(Boolean, default=False)
    style_name: Mapped[str | None] = mapped_column(String(120))
    raw_json: Mapped[dict] = mapped_column(JSONB, default=dict)


class SourceUserAccess(Base):
    __tablename__ = "source_user_access"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ad_user_id: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    access_json: Mapped[dict] = mapped_column(JSONB, default=dict)


# Additive tables: existing installations keep their original tables and rows.
class KrokyForm(Base):
    __tablename__ = "kroky_forms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("requests.id", ondelete="CASCADE"), unique=True, index=True)
    fields_json: Mapped[dict] = mapped_column(JSONB)
    upload_options_json: Mapped[dict] = mapped_column(JSONB)
    visit_json: Mapped[dict] = mapped_column(JSONB)
    schema_version: Mapped[str] = mapped_column(String(20), default="1.0")
    revision: Mapped[int] = mapped_column(Integer, default=1)
    prepared_by: Mapped[str] = mapped_column(String(80))
    approved_by: Mapped[str | None] = mapped_column(String(80))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    boundaries: Mapped[list["KrokyBoundary"]] = relationship(cascade="all, delete-orphan", order_by="KrokyBoundary.position")
    land_uses: Mapped[list["KrokyLandUse"]] = relationship(cascade="all, delete-orphan", order_by="KrokyLandUse.position")


class KrokyBoundary(Base):
    __tablename__ = "kroky_boundaries"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    form_id: Mapped[int] = mapped_column(ForeignKey("kroky_forms.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    direction: Mapped[str] = mapped_column(String(1))
    neighbor: Mapped[str] = mapped_column(String(1000))
    length: Mapped[float] = mapped_column(Float)
    road_width: Mapped[float | None] = mapped_column(Float)


class KrokyLandUse(Base):
    __tablename__ = "kroky_land_uses"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    form_id: Mapped[int] = mapped_column(ForeignKey("kroky_forms.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    use: Mapped[str] = mapped_column(String(200))
    area: Mapped[float] = mapped_column(Float)
    description: Mapped[str] = mapped_column(Text, default="")


class KrokyFileMetadata(Base):
    __tablename__ = "kroky_file_metadata"
    file_path: Mapped[str] = mapped_column(String(500), primary_key=True)
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text, default="")
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    sha256: Mapped[str] = mapped_column(String(64))

