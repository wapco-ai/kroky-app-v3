import StepProgress from '../ui/StepProgress.jsx'
import KrokyDetails from '../ui/KrokyDetails.jsx'
import KrokySheet from '../ui/KrokySheet.jsx'
import { STEPS } from './UploadForm.jsx'
export default function DraftReview({ request, draft, surveyorName, onBack, onSubmit }) {
  return <section className="desktop-review">
    <StepProgress steps={STEPS} active={2} />
    <div className="preview-toolbar"><div><h2>پیش‌نمایش کروکی</h2><p>درخواست {request.requestNo} · اطلاعات فرم را پیش از ثبت بازبینی کنید.</p></div><span className="preview-status">پیش‌نویس؛ هنوز ثبت نشده</span></div>
    <div className="kroky-preview-stage"><KrokySheet request={request} draft={draft} surveyorName={surveyorName} /></div>
    <details className="review-details"><summary>نمایش همه اطلاعات و پیوست‌ها</summary><KrokyDetails kroky={draft} /></details>
    <div className="form-actions"><button className="btn btn-outline" onClick={onBack}>ویرایش اطلاعات</button><button className="btn btn-success" onClick={onSubmit}>ثبت اطلاعات و ارسال به کارشناس مسئول ←</button></div>
  </section>
}
