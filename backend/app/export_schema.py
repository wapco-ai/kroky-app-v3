"""Documented response types for the local integration API, not Siagh's write API."""
from typing import Literal
from pydantic import BaseModel, Field
from .forms import Boundary, KrokyInformation, LandUse, UploadOptions


class AttachmentArrays(BaseModel):
    URL: list[str]
    TITEL: list[str]
    DESCRIPTION: list[str | None]


class VisitArrays(BaseModel):
    DESCRIPTION: list[str | None]
    IS_BAZDID_DONE: list[Literal["Y", "N"]]
    DATE_BAZDID_DONE: list[str | None]


class Parcel(BaseModel):
    polygon: str
    centroid: str | None
    lon: str | None
    lat: str | None


class SourceRequest(BaseModel):
    M_REQUISITION_ID: str
    DOCUMENTNO: str
    DOCNO_REQ: str | None
    USERNAME: str | None
    DOCTYPE_NAME: str | None
    CODEMOMAYEZI: str | None
    CLASSFILE: str | None
    ADDRESS: str | None
    AD_USER_ID: str | None
    DESCRIPTION: str | None
    BAZDIDDATE: str | None
    PHONE: str | None
    parcel: Parcel | None


class SiaghNumbers(BaseModel):
    kroky_number: None = None
    kroky_date: None = None
    temporary_number: None = None
    temporary_date: None = None


class IntegrationFile(BaseModel):
    kind: Literal["dxf", "photo"]
    id: int | None = None
    name: str
    path: str
    download_url: str
    title: str
    description: str | None
    size_bytes: int | None
    sha256: str | None


class SurveyorIdentity(BaseModel):
    username: str
    name: str | None


class KrokyExport(BaseModel):
    schema_version: Literal["1.0"]
    M_REQUISITION_ID: str
    document_no: str
    revision: int
    status: Literal["submitted", "assigned", "approved"]
    ready_for_transfer: bool
    updated_at: str
    prepared_by: str
    surveyor: SurveyorIdentity
    approved_by: str | None
    approved_at: str | None
    source_request: SourceRequest
    information: KrokyInformation
    boundaries: list[Boundary]
    land_uses: list[LandUse]
    upload_options: UploadOptions
    visit: VisitArrays
    attachments: AttachmentArrays
    files: list[IntegrationFile]
    siagh: SiaghNumbers


class KrokyExportPage(BaseModel):
    schema_version: Literal["1.0"] = "1.0"
    total_records: int
    limit: int
    offset: int
    next_offset: int | None
    records: list[KrokyExport]
