"""Versioned local form contract. Siagh numbers are deliberately not input fields."""
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def digits(value):
    if isinstance(value, str):
        return value.translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")).strip()
    return value


Number = Annotated[float, Field(ge=0, allow_inf_nan=False, le=1e12)]
SURVEY_METHODS = ("مستقیم زمینی(مساحی)", "برداشت GPS-RTK", "gps دستی", "دوربین نقشه برداری", "تصاویر پهپادی", "تصاویر هوایی", "تصاویر ماهواره ای")


class FormModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, allow_inf_nan=False)

    @field_validator("*", mode="before")
    @classmethod
    def clean_numeric(cls, value, info):
        annotation = str(cls.model_fields[info.field_name].annotation)
        if "float" in annotation or "int" in annotation:
            value = digits(value)
            if isinstance(value, str):
                value = value.replace(",", "").replace("٬", "").replace("٫", ".").replace("/", ".")
                if not value:
                    return None
        return value


class KrokyInformation(FormModel):
    kind: Literal["kroky", "map"] = "kroky"
    survey_date: str = Field(default="", max_length=10)
    management_area: str = Field(default="", max_length=200)
    city: str = Field(min_length=1, max_length=120)
    land_name: str = Field(min_length=1, max_length=200)
    alley: str = Field(default="", max_length=200)
    region: str = Field(default="", max_length=40)
    district: str = Field(default="", max_length=40)
    block: str = Field(default="", max_length=40)
    main_parcel: str = Field(default="", max_length=40)
    sub_parcel: str = Field(default="", max_length=40)
    unit: str = Field(default="", max_length=40)
    legal_land_use: str = Field(min_length=1, max_length=120)
    density: str = Field(default="", max_length=100)
    main_registration: str = Field(min_length=1, max_length=100)
    sub_registration_1: str = Field(default="", max_length=100)
    sub_registration_2: str = Field(default="", max_length=100)
    sub_registration_3: str = Field(default="", max_length=100)
    sub_registration_4: str = Field(default="", max_length=100)
    class_file: str = Field(default="", max_length=120)
    legal_reprint: bool = False
    property_type: str = Field(min_length=1, max_length=120)
    property_location: str = Field(default="", max_length=200)
    land_status: str = Field(default="", max_length=200)
    old_parcel: str = Field(default="", max_length=100)
    old_block: str = Field(default="", max_length=100)
    total_area: Number | None = None
    in_road_area: Number | None = None
    land_share_area: Number
    common_share_area: Number | None = None
    common_share: str = Field(default="", max_length=100)
    building_area: Number | None = None
    useful_area: Number | None = None
    floor_number: str = Field(default="", max_length=100)
    address: str = Field(min_length=1, max_length=2000)
    municipal_number: str = Field(default="", max_length=100)
    frontage: str = Field(default="", max_length=100)
    gis_area: str = Field(default="", max_length=100)
    letter_number: str = Field(default="", max_length=100)
    letter_date: str = Field(default="", max_length=10)
    correction_land: str = Field(default="", max_length=400)
    description: str = Field(default="", max_length=8000)
    land_information: str = Field(default="", max_length=4000)
    cartographer: str = Field(default="", max_length=200)
    controller: str = Field(default="", max_length=200)
    department_head: str = Field(default="", max_length=200)

    @field_validator("survey_date", "letter_date")
    @classmethod
    def jalali_date(cls, value):
        import re
        value = digits(value)
        if value and not re.fullmatch(r"1[34]\d{2}/(0[1-9]|1[0-2])/(0[1-9]|[12]\d|30|31)", value):
            raise ValueError("تاریخ را به شکل 1405/07/25 وارد کنید")
        if value:
            y, m, d = map(int, value.split("/"))
            # Gregorian conversion validates Esfand leap days as well.
            import jdatetime
            try:
                jdatetime.date(y, m, d)
            except ValueError as exc:
                raise ValueError("تاریخ شمسی معتبر نیست") from exc
        return value


class Boundary(FormModel):
    direction: Literal["N", "E", "S", "W"]
    neighbor: str = Field(min_length=1, max_length=1000)
    length: Annotated[float, Field(gt=0, le=1e9, allow_inf_nan=False)]
    road_width: Number | None = None


class LandUse(FormModel):
    use: str = Field(min_length=1, max_length=200)
    area: Number
    description: str = Field(default="", max_length=2000)


class UploadOptions(FormModel):
    survey_method: str = Field(default="", max_length=150)
    utm_zone: int = Field(default=40, ge=1, le=60)
    hemisphere: Literal["N", "S"] = "N"
    north_deviation: float = Field(default=0, ge=-90, le=90)
    update_boundaries: Literal[False] = False
    analysis_mode: Literal["demo"] = "demo"


class VisitInformation(FormModel):
    description: str = Field(default="", max_length=8000)
    is_done: bool = False
    done_date: str = Field(default="", max_length=10)

    @field_validator("done_date")
    @classmethod
    def date(cls, value):
        return KrokyInformation.jalali_date(value)

    @model_validator(mode="after")
    def completion_date(self):
        if self.is_done and not self.done_date:
            raise ValueError("تاریخ انجام بازدید الزامی است")
        if not self.is_done and self.done_date:
            raise ValueError("برای بازدید انجام‌نشده، تاریخ انجام را خالی بگذارید")
        return self


class PhotoMetadata(FormModel):
    id: int | None = None
    title: str = Field(default="عکس محل", min_length=1, max_length=300)
    description: str = Field(default="", max_length=2000)


class KrokyPayload(FormModel):
    schema_version: Literal["1.0"] = "1.0"
    information: KrokyInformation
    boundaries: list[Boundary] = Field(min_length=4, max_length=100)
    land_uses: list[LandUse] = Field(default_factory=list, max_length=100)
    upload_options: UploadOptions = Field(default_factory=UploadOptions)
    visit: VisitInformation = Field(default_factory=VisitInformation)
    kept_photos: list[PhotoMetadata] = Field(default_factory=list, max_length=30)
    new_photos: list[PhotoMetadata] = Field(default_factory=list, max_length=30)

    @model_validator(mode="after")
    def all_directions(self):
        if self.upload_options.survey_method not in SURVEY_METHODS:
            raise ValueError("روش نقشه‌برداری را از هفت گزینه مجاز انتخاب کنید")
        if {b.direction for b in self.boundaries} != {"N", "S", "E", "W"}:
            raise ValueError("اطلاعات هر چهار جهت حدود اربعه الزامی است")
        ids = [p.id for p in self.kept_photos]
        if None in ids or len(ids) != len(set(ids)):
            raise ValueError("شناسه عکس‌های قبلی معتبر نیست")
        return self
