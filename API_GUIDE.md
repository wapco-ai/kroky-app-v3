# قرارداد API محلی برای سرویس انتقال به سیاق — نسخه 1.0

این API اطلاعات ثبت‌شده در اپ را در اختیار سرویس شما می‌گذارد. انتقال واقعی و نگاشت به API نوشتن سیاق توسط سرویس شما انجام می‌شود. نمونه‌های JSON ارسالی ساختار دریافت کارتابل، پیوست، بازدید و سوابق را مشخص می‌کردند؛ برای فیلدهای جدید فرم که در آن نمونه‌ها وجود نداشتند، قرارداد محلی زیر تعریف شده است. نام‌های این بخش ادعای نام رسمی فیلدهای API نوشتن سیاق نیستند.

## احراز هویت

راه اول، کلید سرویس فقط‌خواندنی:

```dotenv
INTEGRATION_API_KEY=your-own-long-random-key
```

پس از تنظیم در `.env`، دستور `docker compose up -d` را اجرا کنید. درخواست نمونه:

```bash
curl -H 'X-Integration-Key: your-own-long-random-key' \
  'http://localhost:3000/api/integration/kroky'
```

این کلید فقط در مسیرهای `/api/integration` معتبر است و اجازه ثبت، تأیید یا تغییر اطلاعات ندارد. کلید در رابط مرورگر قرار نمی‌گیرد. اگر تنظیم نشده باشد، JWT مدیر یا کارشناس مسئول را بفرستید:

```bash
curl -X POST 'http://localhost:3000/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"username":"masoul","password":"1234","otp":"123456"}'

curl 'http://localhost:3000/api/integration/kroky' \
  -H 'Authorization: Bearer TOKEN_FROM_LOGIN'
```

## مسیرهای خواندن

| روش و مسیر | کاربرد |
| --- | --- |
| `GET /api/integration/kroky` | فهرست فرم‌های ساختاریافته؛ پیش‌فرض فقط تأییدشده‌ها |
| `GET /api/integration/kroky/{request_id}` | تمام اطلاعات یک درخواست؛ وضعیت آماده‌بودن را کنترل کنید |
| `GET /api/integration/kroky/{request_id}/files/dxf` | بایت‌های فایل DXF |
| `GET /api/integration/kroky/{request_id}/files/photos/{photo_id}` | بایت‌های یک عکس متعلق به همان درخواست |
| `GET /api/integration/cartable` | اطلاعات مبدأ درخواست‌ها با نام فیلدهای نمونه `cartable_all.json` |
| `GET /api/openapi.json` | تعریف ماشینی مسیرها و مدل خروجی |
| `GET /api/docs` | صفحه Swagger؛ دارایی‌های نمایشی آن ممکن است اینترنت لازم داشته باشند |

تمام URLهای بازگشتی نسبی‌اند؛ آن‌ها را نسبت به آدرس سامانه، مثلاً `http://localhost:3000`، resolve کنید. هدر احراز هویت باید هنگام دانلود فایل‌ها نیز ارسال شود.

پارامترهای فهرست:

| پارامتر | مقدار |
| --- | --- |
| `status` | `approved` پیش‌فرض؛ یا `submitted`، `assigned`، `all` |
| `limit` | پیش‌فرض ۱۰۰؛ بین ۱ تا ۵۰۰ |
| `offset` | پیش‌فرض صفر |
| `updated_since` | تاریخ ISO 8601 با `Z` یا offset زمانی؛ شرط مقایسه شامل مساوی است |

برای انتقال، فقط `ready_for_transfer=true` را پردازش کنید. رکورد قبل از تأیید در دیتابیس موجود است و با `status=submitted` برای بررسی در دسترس است.

پاسخ فهرست:

```json
{
  "schema_version": "1.0",
  "total_records": 0,
  "limit": 100,
  "offset": 0,
  "next_offset": null,
  "records": []
}
```

مثال بالا پاسخ بدون نتیجه است. در صورت وجود ثبت، آرایه `records` شامل رکوردهایی با ساختار شرح‌داده‌شده در ادامه خواهد بود. `total_records` تعداد تمام نتایج فیلترشده قبل از صفحه‌بندی است. `next_offset=null` یعنی صفحه آخر.

## اجزای هر رکورد

| کلید | معنا |
| --- | --- |
| `M_REQUISITION_ID` | شناسه درخواست مبدأ، از نوع رشته؛ مرجع اصلی اتصال داده‌ها |
| `document_no` | شماره درخواست مبدأ؛ از نوع رشته |
| `schema_version` | نسخه قرارداد محلی، فعلاً `1.0` |
| `revision` | نسخه ثبت فرم؛ با ارسال مجدد پس از عودت افزایش می‌یابد |
| `status` | وضعیت محلی گردش‌کار |
| `ready_for_transfer` | فقط در وضعیت تأییدشده `true` است |
| `updated_at` | آخرین ثبت/عودت/تأیید، UTC و دارای offset |
| `prepared_by` | نام کاربری محلی نقشه‌بردار ثبت‌کننده |
| `surveyor` | نام کاربری و نام نمایشی نقشه‌بردار |
| `approved_by`، `approved_at` | کارشناس تأییدکننده و زمان تأیید؛ قبل از تأیید `null` |
| `source_request` | اطلاعات اصلی درخواست با نام‌های نمونه JSON |
| `information` | مشخصات واردشده در فرم کروکی؛ جدول فیلدها در ادامه |
| `boundaries` | ردیف‌های حدود؛ ترتیب ثبت حفظ می‌شود |
| `land_uses` | ردیف‌های وضعیت زمین و بهره‌برداری |
| `upload_options` | تنظیمات برداشت و فایل؛ تحلیل همیشه نمایشی است |
| `visit` | اطلاعات جدید بازدید با ساختار آرایه‌ای مشابه `visit.json` |
| `attachments` | آرایه‌های موازی `URL`، `TITEL` و `DESCRIPTION` مطابق نام‌های نمونه؛ شامل DXF و عکس‌های این ثبت |
| `files` | جزئیات فایل‌ها، نام، عنوان، توضیح، مسیر دانلود، حجم و SHA-256 |
| `siagh` | مقادیر اختصاصی سیاق که این اپ تولید نمی‌کند |

فیلدهای `source_request`:

```text
M_REQUISITION_ID, DOCUMENTNO, DOCNO_REQ, USERNAME, DOCTYPE_NAME,
CODEMOMAYEZI, CLASSFILE, ADDRESS, AD_USER_ID, DESCRIPTION,
BAZDIDDATE, PHONE, parcel
```

ساختار `parcel` مانند نمونه شامل `polygon` و `centroid` به‌صورت WKT و `lon` و `lat` به‌صورت رشته است؛ در نبود هندسه `null` است. این اطلاعات مربوط به داده مبدأ است و با DXF بارگذاری‌شده عوض نمی‌شود. `source_request.USERNAME` را با `surveyor.name` اشتباه نگیرید؛ اولی نام موجود در درخواست مبدأ است.

## حدود، بهره‌برداری و تنظیمات فایل

```json
{
  "boundaries": [
    {"direction":"N","neighbor":"قطعه ۱۴","length":8,"road_width":null},
    {"direction":"E","neighbor":"قطعه ۲۹","length":25,"road_width":null},
    {"direction":"S","neighbor":"خیابان ۱۰ متری","length":8,"road_width":10},
    {"direction":"W","neighbor":"قطعه ۲۷","length":25,"road_width":null}
  ],
  "land_uses": [
    {"use":"آپارتمان مسکونی","area":200,"description":"طبقه سوم"}
  ],
  "upload_options": {
    "survey_method":"برداشت GPS-RTK",
    "utm_zone":40,
    "hemisphere":"N",
    "north_deviation":0,
    "update_boundaries":false,
    "analysis_mode":"demo"
  },
  "visit": {
    "DESCRIPTION":["شرح بازدید"],
    "IS_BAZDID_DONE":["Y"],
    "DATE_BAZDID_DONE":["1405/07/25"]
  },
  "siagh": {
    "kroky_number":null,
    "kroky_date":null,
    "temporary_number":null,
    "temporary_date":null
  }
}
```

جهت‌ها `N/E/S/W` هستند. برای هر چهار جهت حداقل یک ردیف لازم است؛ هر جهت می‌تواند چند ردیف داشته باشد. طول باید مثبت و عرض معبر در صورت وجود غیرمنفی باشد. مساحت‌ها مترمربع و طول‌ها متر هستند. اعداد فارسی/عربی ورودی پذیرفته و در پاسخ به عدد JSON تبدیل می‌شوند. `/` فقط در ورودی فیلدهای عددی به‌عنوان اعشار پذیرفته می‌شود؛ برای نمونه `۱۶/۵` به `16.5` تبدیل می‌شود. کدهای ثبتی و ممیزی رشته می‌مانند.

تاریخ‌های فرم شمسی، با قالب `YYYY/MM/DD` و معتبر از نظر تقویم جلالی‌اند. زمان‌های سیستمی مانند `updated_at` میلادی ISO 8601 و UTC هستند. مقدار خالی عدد اختیاری `null` است؛ عدد صفر حفظ می‌شود. بازدید انجام‌نشده `N` و تاریخ آن `null` است.

`update_boundaries=true` پذیرفته نمی‌شود. DXF فقط پسوند، خالی‌نبودن و حجمش بررسی می‌شود؛ صحت هندسی آن در این نسخه بررسی نمی‌شود.

در نسخه ۸ برای ثبت جدید یا ارسال مجدد، `survey_method` باید یکی از این هفت مقدار متنی باشد: `مستقیم زمینی(مساحی)`، `برداشت GPS-RTK`، `gps دستی`، `دوربین نقشه برداری`، `تصاویر پهپادی`، `تصاویر هوایی`، `تصاویر ماهواره ای`. خواندن مقادیر قدیمی API همچنان پشتیبانی می‌شود. گروه‌بندی «کد ممیزی» در رابط، کلیدهای شش‌گانه `region / district / block / main_parcel / sub_parcel / unit` را تغییر نمی‌دهد.

## فایل‌ها

`attachments.URL[i]`، `TITEL[i]` و `DESCRIPTION[i]` متعلق به یک فایل‌اند. املای `TITEL` عمداً برای سازگاری با نمونه حفظ شده است. این پیوست‌ها جدید و متعلق به ثبت محلی هستند؛ پیوست‌های قدیمی درخواست در جدول مبدأ جداگانه نگهداری می‌شوند.

نمونه جزئیات فایل:

```json
{
  "kind":"dxf",
  "id":null,
  "name":"parcel.dxf",
  "path":"478239263/unique-file.dxf",
  "download_url":"/api/integration/kroky/478239263/files/dxf",
  "title":"فایل DXF کروکی",
  "description":"",
  "size_bytes":1024,
  "sha256":"checksum-for-the-actual-file"
}
```

`path` یک مسیر نسبی داخلی است؛ برای دانلود از `download_url` استفاده کنید. برای عکس‌ها `kind=photo` و `id` شناسه عکس در همین اپ است. نام ذخیره‌شده فایل یکتا و نام اصلی جداگانه نگهداری می‌شود. عکس‌ها تا ۳۰ عدد، هرکدام تا ۱۵ مگابایت و DXF تا ۵۰ مگابایت پذیرفته می‌شوند.

## جلوگیری از انتقال تکراری

سرویس شما نتیجه انتقال را بر اساس ترکیب `M_REQUISITION_ID + revision` نگهداری کند. API دریافت فقط‌خواندنی است و علامت «منتقل شد» نمی‌زند؛ دریافت مجدد فهرست همان ثبت‌های تأییدشده را برمی‌گرداند. در polling از `updated_since` با هم‌پوشانی استفاده کنید و رکوردهای قبلاً پردازش‌شده را تشخیص دهید. بعد از پردازش موفق تمام صفحه‌ها، checkpoint زمانی را جلو ببرید.

در این نسخه مسیر نوشتن شماره‌های اختصاص‌یافته سیاق یا ثبت نتیجه انتقال به اپ وجود ندارد. شماره‌های تولیدشده توسط سیاق را سرویس شما در گردش‌کار خودش نگه می‌دارد.

## ثبت از رابط و اعتبارسنجی

رابط از `POST /api/requests/{request_id}/submit` با `multipart/form-data` استفاده می‌کند: `metadata` رشته JSON، `dxf` فایل و `photos` فایل‌های تکرارشونده. `metadata` شامل `schema_version`، `information`، `boundaries`، `land_uses`، `upload_options`، `visit`، `kept_photos` و `new_photos` است. عکس‌های قبلی با شناسه نگه داشته می‌شوند؛ عنوان و توضیح آن‌ها قابل اصلاح است. تعداد و ترتیب `new_photos` باید با فایل‌های عکس جدید یکسان باشد.

ثبت فقط برای نقشه‌بردار مالک درخواست و در وضعیت `assigned` مجاز است. تأیید توسط کارشناس مسئول، خروجی را برای انتقال آماده می‌کند. فرم نامعتبر با ۴۲۲، عدم دسترسی با ۴۰۱/۴۰۳، وضعیت نامناسب با ۴۰۹ و فایل یا فرم ناموجود با ۴۰۴ پاسخ داده می‌شود.

## فیلدهای information

فیلدهای متنی اختیاری در صورت خالی‌بودن رشته خالی‌اند. فیلدهای ستاره‌دار طبق فرم نمونه برای ثبت لازم‌اند. `kind` برابر `kroky` یا `map` و `legal_reprint` بولی است. هویت ثبت‌کننده از حساب واردشده گرفته می‌شود.

| کلید | عنوان فرم | نوع | الزامی |
| --- | --- | --- | --- |
| `kind` | نوع کروکی / نقشه | enum | پیش‌فرض کروکی |
| `legal_reprint` | چاپ پرینت حقوقی | boolean | پیش‌فرض false |
| `survey_date` | تاریخ نقشه‌برداری (شمسی) | string | خیر |
| `management_area` | حوزه مدیریت | string | خیر |
| `city` | شهر | string | بله |
| `land_name` | نام اراضی / بازار | string | بله |
| `alley` | نام کوی | string | خیر |
| `region` | منطقه | string | خیر |
| `district` | حوزه | string | خیر |
| `block` | بلوک | string | خیر |
| `main_parcel` | قطعه اصلی | string | خیر |
| `sub_parcel` | قطعه فرعی | string | خیر |
| `unit` | واحد | string | خیر |
| `legal_land_use` | کاربری قانونی | string | بله |
| `density` | تراکم | string | خیر |
| `main_registration` | پلاک ثبتی اصلی | string | بله |
| `sub_registration_1` | پلاک ثبتی فرعی ۱ | string | خیر |
| `sub_registration_2` | پلاک ثبتی فرعی ۲ | string | خیر |
| `sub_registration_3` | پلاک ثبتی فرعی ۳ | string | خیر |
| `sub_registration_4` | پلاک ثبتی فرعی ۴ | string | خیر |
| `class_file` | کد کلاسه | string | خیر |
| `property_type` | نوع ملک | string | بله |
| `property_location` | موقعیت ملک | string | خیر |
| `land_status` | وضعیت زمین | string | خیر |
| `old_parcel` | قطعه قدیم | string | خیر |
| `old_block` | بلوک قدیم | string | خیر |
| `total_area` | مساحت کل (مترمربع) | number / null | خیر |
| `in_road_area` | مساحت در مسیر (مترمربع) | number / null | خیر |
| `land_share_area` | مساحت سهم عرصه (مترمربع) | number | بله |
| `common_share_area` | مساحت سهم مشاع (مترمربع) | number / null | خیر |
| `common_share` | سهم مشاع | string | خیر |
| `building_area` | مساحت اعیانی (مترمربع) | number / null | خیر |
| `useful_area` | مساحت مفید (مترمربع) | number / null | خیر |
| `floor_number` | شماره طبقه | string | خیر |
| `address` | آدرس | string | بله |
| `municipal_number` | پلاک شهرداری | string | خیر |
| `frontage` | جهت ملک | string | خیر |
| `gis_area` | منطقه GIS | string | خیر |
| `letter_number` | شماره درخواست / نامه | string | خیر |
| `letter_date` | تاریخ درخواست / نامه (شمسی) | string | خیر |
| `correction_land` | اصلاحات اراضی / مازاد | string | خیر |
| `description` | شرح | string | خیر |
| `land_information` | اطلاعات اراضی | string | خیر |
| `cartographer` | کارتوگراف | string | خیر |
| `controller` | کنترل‌کننده | string | خیر |
| `department_head` | رئیس اداره | string | خیر |
