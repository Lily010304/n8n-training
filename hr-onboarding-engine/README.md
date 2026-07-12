# HR Employee Onboarding Engine — n8n Project

نظام n8n كامل لأتمتة عملية Onboarding للموظفين الجدد: استقبال البيانات، Validation، فحص Idempotency، ثم Provisioning fan-out (Drive folder، Google Docs، Google Calendar) وإرسال Notifications، مع Error Handling مركزي عبر Error Trigger workflow.

هذا الدليل مكتوب بالعربية مع إبقاء كل المصطلحات التقنية بالإنجليزية كما هي (n8n, Node, Webhook, Credentials, OAuth...)، ومحتوى ملفات الـ JSON والكود نفسه بالإنجليزية بالكامل.

> **يتطلب**: n8n self-hosted، إصدار 1.x حديث (تم بناء هذا المشروع على بنية n8n 1.6x تقريبًا — بعض أسماء الحقول الداخلية للعقد قد تختلف قليلًا بين الإصدارات الفرعية، لذلك راجع قسم "بعد الاستيراد" في نهاية هذا الملف).

---

## 1) بنية المشروع

```
hr-onboarding-engine/
├── workflows/
│   ├── 01_main_onboarding.json      # الـ orchestrator الرئيسي
│   ├── 02_error_handler.json        # Error Trigger workflow العام
│   └── 03_notify_subworkflow.json   # Sub-workflow قابل لإعادة الاستخدام للإشعارات
├── sample_payloads/
│   ├── 01_valid_payload.json
│   ├── 02_missing_field_payload.json
│   └── 03_duplicate_email_payload.json
└── README.md
```

---

## 2) ترتيب الاستيراد (Import Order)

استورد الملفات بهذا الترتيب تحديدًا — لأن 01 يستدعي 03 عبر Execute Workflow، فمن الأسهل أن يكون 03 موجودًا مسبقًا في الـ instance حتى تختاره من القائمة المنسدلة مباشرة:

1. `03_notify_subworkflow.json`
2. `02_error_handler.json`
3. `01_main_onboarding.json`

### كيف تستورد ملف JSON في n8n

1. من شاشة **Workflows** الرئيسية في n8n، اضغط **Add workflow** لفتح canvas جديد فارغ.
2. اضغط قائمة الثلاث نقاط (**...**) أعلى يمين الـ canvas → **Import from File**.
3. اختر ملف الـ JSON المطلوب (مثلًا `03_notify_subworkflow.json`).
4. احفظ الـ workflow (Ctrl/Cmd+S) وأعطه اسمًا واضحًا إذا لزم (الاسم موجود بالفعل داخل الـ JSON).
5. كرر نفس الخطوات للملفين الآخرين بنفس الترتيب.

> بديل: يمكنك أيضًا سحب ملف الـ JSON وإفلاته (drag & drop) مباشرة على الـ canvas الفارغ في الإصدارات الحديثة من n8n.

---

## 3) إعداد الـ Credentials

النظام يحتاج 5 (أو 6 مع Slack الاختياري) Credentials من نوع Google OAuth2، بالإضافة إلى Gmail. **لا يوجد أي secret مكتوب داخل ملفات الـ JSON** — كل عقدة تشير إلى credential بالاسم فقط، وعليك ربطها يدويًا بعد الاستيراد.

### 3.1 إنشاء مشروع Google Cloud

1. افتح: https://console.cloud.google.com/projectcreate
2. أنشئ مشروعًا جديدًا (مثلًا: `hr-onboarding-n8n`).

### 3.2 تفعيل الـ APIs المطلوبة

من داخل نفس المشروع، فعّل كل API من الروابط التالية (كل رابط يفتح صفحة الـ API مباشرة مع زر **Enable**):

| API | الرابط |
|---|---|
| Google Drive API | https://console.cloud.google.com/apis/library/drive.googleapis.com |
| Google Docs API | https://console.cloud.google.com/apis/library/docs.googleapis.com |
| Google Sheets API | https://console.cloud.google.com/apis/library/sheets.googleapis.com |
| Google Calendar API | https://console.cloud.google.com/apis/library/calendar-json.googleapis.com |
| Gmail API | https://console.cloud.google.com/apis/library/gmail.googleapis.com |

### 3.3 OAuth Consent Screen

1. افتح: https://console.cloud.google.com/apis/credentials/consent
2. اختر **External** (إلا إذا كان لديك Google Workspace ومطلوب Internal).
3. املأ اسم التطبيق (App name)، بريد الدعم، وبيانات المطور.
4. في خطوة **Scopes**، أضف الـ scopes التالية (أقل صلاحيات ممكنة — least-privilege):

| الخدمة | الـ Scope |
|---|---|
| Drive | `https://www.googleapis.com/auth/drive` |
| Docs | `https://www.googleapis.com/auth/documents` |
| Sheets | `https://www.googleapis.com/auth/spreadsheets` |
| Calendar | `https://www.googleapis.com/auth/calendar.events` |
| Gmail | `https://www.googleapis.com/auth/gmail.send` |

> ملاحظة عن Drive scope: `drive.file` المصغّر لا يكفي هنا لأننا نحتاج نسخ ملفات Template لم يُنشئها التطبيق نفسه (لم تُفتح عبر الـ picker)، لذلك النطاق العملي الأدنى هو `drive` الكامل. إذا كانت سياسة الأمان لديك تمنع ذلك، البديل هو مشاركة مجلد الـ Template صراحة مع نفس حساب الـ Service وربط الوصول عبر Shared Drive بدل نطاق Drive الكامل.
>
> ملاحظة عن Gmail scope: استخدمنا `gmail.send` فقط (إرسال بدون قراءة) — وهو أضيق نطاق ممكن لهذا الاستخدام.

5. إن كان التطبيق في وضع **Testing**، أضف بريدك (وبريد أي مستخدم آخر سيوافق الـ OAuth) تحت **Test users**.

### 3.4 إنشاء OAuth2 Client ID واحد لكل الخدمات

1. افتح: https://console.cloud.google.com/apis/credentials
2. **Create Credentials → OAuth client ID**.
3. Application type: **Web application**.
4. في **Authorized redirect URIs** أضف رابط الـ Redirect الخاص بـ n8n (احصل عليه من الخطوة التالية أولًا ثم ارجع هنا لإضافته) — الصيغة العامة:
   ```
   https://<YOUR_N8N_HOST>/rest/oauth2-credential/callback
   ```
   مثال محلي: `http://localhost:5678/rest/oauth2-credential/callback`
5. احفظ، وانسخ **Client ID** و **Client Secret** — ستستخدمهما في كل الـ credentials الخمسة داخل n8n (نفس الـ Client ID/Secret، credentials منفصلة لكل نوع node).

### 3.5 ربط كل Credential داخل n8n

في n8n: **Credentials → Add Credential**، وأنشئ الأنواع التالية بنفس الأسماء الآتية بالضبط (الأسماء المستخدمة داخل ملفات الـ JSON للتوثيق فقط — بعد الاستيراد لازم تربط يدويًا من كل node أيًا كان اسم الـ credential الذي أنشأته):

| Credential Type في n8n | الاسم المقترح | تُستخدم في عقد |
|---|---|---|
| Google Sheets OAuth2 API | `Google Sheets - HR Onboarding` | كل عقد Google Sheets |
| Google Drive OAuth2 API | `Google Drive - HR Onboarding` | كل عقد Google Drive |
| Google Docs OAuth2 API | `Google Docs - HR Onboarding` | Replace Placeholders In Doc |
| Google Calendar OAuth2 API | `Google Calendar - HR Onboarding` | Create Calendar Event |
| Gmail OAuth2 | `Gmail - HR Onboarding` | كل عقد Gmail |
| Slack API (اختياري) | `Slack - HR Onboarding` | Slack Alert (Disabled)، Send Slack Notification |

لكل واحد: الصق نفس Client ID و Client Secret من الخطوة 3.4، ثم اضغط **Connect my account** وأكمل شاشة موافقة Google.

بعد إنشاء كل الـ credentials، افتح كل عقدة Google/Gmail في الـ 3 workflows واختر الـ credential المناسب من القائمة المنسدلة (الاستيراد لا يربط الـ credentials تلقائيًا لأسباب أمنية — هذا سلوك متوقع وليس خطأ).

---

## 4) تجهيز المتطلبات المسبقة (Prerequisites)

قبل تشغيل أول اختبار، جهّز 3 عناصر في Google Drive/Sheets، وحدّث عقدة **Config** داخل `01_main_onboarding.json` بالقيم الفعلية (Config هي أول عقدة بعد Webhook — كل قيم الإعداد مركزّة فيها في مكان واحد):

### 4.1 مجلد Employees الجذري (Employees Root Folder)

مجلد فارغ في Drive سيُنشأ بداخله مجلد فرعي لكل موظف جديد. انسخ الـ Folder ID من رابط المجلد (الجزء بعد `/folders/` في الـ URL) وضعه في `employees_root_folder_id`.

### 4.2 مجلد Template (Template Drive Folder)

مجلد يحتوي الملفات التي تريد نسخها لكل موظف جديد (مثل: دليل الموظف PDF، نموذج نماذج التوقيع...). ضع الـ Folder ID في `template_folder_id`.

> **حدود معروفة**: هذا التطبيق ينسخ فقط الملفات الموجودة **مباشرة** داخل مجلد الـ Template (مستوى واحد flat). لا يوجد نسخ متداخل تلقائي للمجلدات الفرعية (Google Drive API لا يدعم نسخ شجرة مجلدات كاملة بطلب واحد). إذا احتجت نسخ متداخل، هذا نقطة توسعة واضحة في عقدة **List Template Files** (أضف معالجة recursive).

### 4.3 وثيقة الترحيب (Welcome Doc Template)

مستند Google Docs يحتوي **حرفيًا** على النصوص التالية كـ placeholders (استبدال Case-sensitive):

```
{{name}}
{{role}}
{{start_date}}
{{manager}}
```

انسخ الـ Document ID من رابط المستند وضعه في `doc_template_id`.

### 4.4 جدول تتبّع الـ Onboarding (Google Sheets Tracker)

أنشئ Google Sheet جديد باسم مطابق للقيمة في `tracker_sheet_name` (افتراضيًا `Onboarding Tracker`)، وأضف صف عناوين الأعمدة **بالضبط** بهذا الترتيب والتسمية:

| # | اسم العمود |
|---|---|
| 1 | `received_at` |
| 2 | `full_name` |
| 3 | `personal_email` |
| 4 | `role` |
| 5 | `department` |
| 6 | `manager_email` |
| 7 | `start_date` |
| 8 | `timezone` |
| 9 | `validated` |
| 10 | `provisioned` |
| 11 | `notified` |
| 12 | `status` |
| 13 | `drive_folder_url` |
| 14 | `doc_url` |
| 15 | `calendar_event_url` |
| 16 | `notes` |

انسخ الـ Spreadsheet ID من رابط الملف وضعه في `tracker_spreadsheet_id`.

### 4.5 تحديث عقدة Config

افتح `01_main_onboarding.json` بعد الاستيراد → عقدة **Config** → عدّل القيم الست:

```
template_folder_id           → Folder ID من 4.2
doc_template_id               → Document ID من 4.3
employees_root_folder_id      → Folder ID من 4.1
tracker_spreadsheet_id        → Spreadsheet ID من 4.4
tracker_sheet_name            → اسم التبويبة (افتراضيًا: Onboarding Tracker)
hr_alert_email                → بريد فريق HR الذي يستقبل Summary Email والتنبيهات
```

---

## 5) تفعيل وربط الـ Error Trigger Workflow

1. افتح `02_error_handler` بعد الاستيراد.
2. عدّل عقدة **Send Alert Email** → غيّر `REPLACE_WITH_ONCALL_EMAIL@example.com` إلى بريد فريق الـ on-call/IT الفعلي، واربط الـ Gmail credential.
3. فعّل الـ workflow (زر **Active** أعلى يمين الشاشة).
4. افتح `01_main_onboarding` → قائمة الثلاث نقاط → **Settings** → في حقل **Error Workflow** اختر `02 - HR Onboarding - Error Handler`.
5. كرر نفس خطوة الربط (Settings → Error Workflow) على `03_notify_subworkflow` أيضًا، حتى تُغطّى أخطاء الـ sub-workflow نفسه إن استُدعي يدويًا خارج السياق الطبيعي.
6. (اختياري) لتفعيل تنبيه Slack بالإضافة للبريد: افتح عقدة **Slack Alert (Disabled)** داخل `02_error_handler`، اربط الـ Slack credential، ضع الـ Channel ID الصحيح، ثم فعّل العقدة (Enable من قائمة العقدة).

---

## 6) ربط Notify Sub-workflow داخل الـ Main workflow

بعد استيراد الـ 3 ملفات، افتح `01_main_onboarding` → عقدة **Notify Failure** → حقل **Workflow** → اختر `03 - HR Onboarding - Notify Sub-workflow` من القائمة (بدل القيمة الوهمية `REPLACE_WITH_NOTIFY_SUBWORKFLOW_ID` الموجودة افتراضيًا).

---

## 7) خطة الاختبار (Test Plan)

فعّل `01_main_onboarding` (زر Active)، ثم استخدم الـ Webhook URL الذي يظهر في عقدة **Webhook**:

- رابط الإنتاج (بعد التفعيل): `https://<YOUR_N8N_HOST>/webhook/hr-onboarding`
- رابط الاختبار (بدون تفعيل، أثناء الضغط على Listen for Test Event): `https://<YOUR_N8N_HOST>/webhook-test/hr-onboarding`

### اختبار 1 — Payload صالح (`01_valid_payload.json`)

```bash
curl -X POST https://<YOUR_N8N_HOST>/webhook/hr-onboarding \
  -H "Content-Type: application/json" \
  -d @sample_payloads/01_valid_payload.json
```

**النتيجة المتوقعة**: HTTP 200 مع:
```json
{ "status": "success", "stage": "completed", "personal_email": "sara.alamin@example.com", "drive_folder_url": "...", "doc_url": "...", "calendar_event_url": "..." }
```
وعمليًا: مجلد جديد في Drive باسم "Sara Al-Amin - Onboarding"، وثيقة ترحيب بالـ placeholders مُستبدلة، حدث تقويم "Day 1 welcome meeting" في تقويم `manager.design@example.com`، بريدان مُرسلان (ترحيب + ملخص HR)، وصف جديد بحالة `completed` في Onboarding Tracker.

### اختبار 2 — حقل ناقص (`02_missing_field_payload.json`)

نفس الأمر لكن بملف الحقل الناقص (لا يحتوي `manager_email`).

**النتيجة المتوقعة**: HTTP 400 مع:
```json
{ "status": "error", "stage": "validation", "errors": ["Missing required field: manager_email"] }
```
لا يُكتب أي صف في Tracker، لا يحدث أي Provisioning.

### اختبار 3 — بريد مكرر (`03_duplicate_email_payload.json`)

**يجب تشغيله بعد نجاح اختبار 1** (نفس `personal_email`: `sara.alamin@example.com`).

**النتيجة المتوقعة**: HTTP 200 مع:
```json
{ "status": "skipped", "stage": "idempotency", "message": "already processed", "personal_email": "sara.alamin@example.com" }
```
لا مجلد جديد، لا وثيقة جديدة، لا حدث تقويم جديد، لا بريد جديد، لا صف مكرر في Tracker — هذا هو جوهر فحص الـ Idempotency.

---

## 8) بعد الاستيراد — نقاط تحقق مهمة (Post-Import Checklist)

أسماء العمليات الداخلية لبعض عقد Google (مثل الحقول الدقيقة داخل Google Sheets / Google Docs / Google Calendar nodes) قد تختلف قليلًا حسب الإصدار الفرعي من n8n. بعد الاستيراد، راجع بالذات هذه العقد قبل أول تشغيل حقيقي:

- **Get All Tracker Rows / Append/Update Tracker Row \***: تأكد أن الـ Operation المختارة هي فعلًا "Get Row(s)" / "Append Row" / "Update Row" وأن `documentId`/`sheetName` تُشير للـ Spreadsheet الصحيح.
- **List Template Files**: تأكد أن حقل الـ Query String يُنتج صيغة صحيحة (`'<folder_id>' in parents and trashed = false`).
- **Replace Placeholders In Doc**: تأكد أن الأربع Actions من نوع "Replace All Text" مربوطة بالـ placeholders الصحيحة.
- **Create Calendar Event**: تأكد من صيغة حقلي Start/End وأن Time Zone تُقرأ من `{{ $json.timezone }}`.
- **Merge Provisioning Results**: تأكد أن الوضع Combine → Combine by Position (لتوحيد نتائج فرعي Folder/Doc والـ Calendar في عنصر واحد).

هذه ممارسة قياسية عند استيراد أي workflow template — إعادة التحقق من إعدادات العقد بعد الربط بالـ credentials الفعلية، مثل مراجعة أي Pull Request قبل الدمج.

---

## 9) ملخص معماري سريع

- **كل نداء خارجي** (Google Sheets/Drive/Docs/Calendar/Gmail) مضبوط على: `retryOnFail: true`، 3 محاولات، فاصل 5 ثوانٍ بين المحاولات (backoff)، و`onError: continueErrorOutput` يوجّه للـ failure branch بدل توقف الـ execution بصمت.
- **Idempotency**: فحص عبر قراءة كامل جدول الـ Tracker والبحث في Code node (بدل الاعتماد فقط على فلاتر الـ Sheets node) — أكثر موثوقية عبر إصدارات n8n المختلفة.
- **الترتيب**: Folder → Template Files → Copy → Doc placement (Sequential)، بينما Calendar Event يعمل بالتوازي (Parallel) وينضم عبر Merge node.
- **لا صمت أبدًا**: كل مسار (نجاح، فشل Validation، Duplicate، فشل Provisioning) ينتهي بـ Respond to Webhook برد JSON واضح.
