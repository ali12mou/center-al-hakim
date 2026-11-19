import { z } from "zod";
import { studentHome, publicationsFor, getStudentCard, verifyCard } from "../services/portal.service.js";
import { StudentCard, PortalAudit } from "../models/portal.models.js";
import { StudentUser } from "../models/student.models.js";
import { Payment, Invoice } from "../models/finance.models.js";
import { Course } from "../models/index.js";
import { centre } from "../data/catalogue.js";
import { siteContent } from "../data/siteContent.js";
import { getSettings } from "../services/settings.service.js";
import { httpError, validId, sendError } from "../services/crud.js";
import { permit } from "../middleware/admin.middleware.js";
import { getPublicCentre } from "../services/site.service.js";
const wrap = handler => async (req,res,next)=>{try{await handler(req,res);}catch(error){sendError(error,res,next);}};
const canonicalOrigin = () => (process.env.PUBLIC_URL || process.env.CLIENT_ORIGIN?.split(',')[0] || 'http://127.0.0.1:5173').trim();

export function mountStudentPortal(router) {
  router.get('/home', wrap(async(req,res)=>res.json(await studentHome(req.student))));
  router.get('/card', wrap(async(req,res)=>res.json(await getStudentCard(req.student,canonicalOrigin()))));
  router.patch('/profile', wrap(async(req,res)=>{
    const parsed=z.object({phone:z.string().trim().regex(/^[+\d\s().-]{6,30}$/).optional(),email:z.union([z.string().trim().toLowerCase().email(),z.literal('')]).optional()}).strict().safeParse(req.body);
    if(!parsed.success) throw httpError(400,'Coordonnées invalides. Seuls le téléphone et l’e-mail sont modifiables.');
    Object.assign(req.student,parsed.data);await req.student.save();
    await PortalAudit.create({actorId:req.student._id,actorRole:'student',action:'profile_updated',entityId:req.student._id,changes:parsed.data});
    res.json({message:'Coordonnées mises à jour.',phone:req.student.phone,email:req.student.email});
  }));
  for(const [kind,Model] of [['receipts',Payment],['invoices',Invoice]]) {
    router.get(`/documents/${kind}/:id`,wrap(async(req,res)=>{
      if(!validId(req.params.id)) throw httpError(404,'Document introuvable.');
      const item=await Model.findOne({_id:req.params.id,studentAccountId:{$in:req.student.accountIds},status:kind==='receipts'?'confirmed':'issued'})
        .select(kind==='receipts'?'receiptNumber date amount splits.method splits.transactionRef splits.amount studentName':'number issueDate dueDate total subtotal discount lines billTo.name').lean();
      if(!item) throw httpError(404,'Document introuvable.');
      res.json({kind,item,issuer:{centreName:centre.name,centrePhone:centre.phone,centreEmail:centre.email},currency:(await getSettings('finance')).currency||'FDJ'});
    }));
  }
}
export function mountMarketingPortal(router) {
  router.get('/home',wrap(async(req,res)=>res.json({centre:await getPublicCentre(),about:siteContent.about,banners:await publicationsFor('marketing'),courses:await Course.find({published:true}).select('id title description imageUrl department level format duration').lean()})));
}
export function mountPublicCard(router) {
  router.get('/cards/verify/:token',wrap(async(req,res)=>{
    const result=await verifyCard(req.params.token);
    res.set('Cache-Control','no-store');
    if(req.accepts(['html','json'])==='html') {
      const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
      const labels={valid:'Carte valide',revoked:'Carte révoquée',expired:'Carte expirée'};
      res.type('html').send(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Vérification de carte — AL-HAKIM CENTER</title><body><main><h1>AL-HAKIM CENTER</h1><h2>${labels[result.status]}</h2><p>${escape(result.name)}</p><p>Matricule : ${escape(result.number)}</p><p>Validité : ${new Date(result.validUntil).toLocaleDateString('fr-FR',{timeZone:'Africa/Djibouti'})}</p><p>Vérification officielle de la carte étudiant. Aucune information scolaire ou financière n’est rendue publique.</p></main></body></html>`);
    } else res.json(result);
  }));
}
export function mountCardAdmin(router) {
  router.post('/access/:id/card/revoke',permit('eleves.access','update'),wrap(async(req,res)=>{
    if(!validId(req.params.id)) throw httpError(404,'Élève introuvable.');
    const user=await StudentUser.findById(req.params.id);if(!user)throw httpError(404,'Élève introuvable.');
    await getStudentCard(user,canonicalOrigin());
    await StudentCard.updateOne({studentId:user._id},{$set:{revokedAt:new Date()}});
    await PortalAudit.create({actorId:req.admin._id,actorRole:'admin',action:'card_revoked',entityId:user._id});
    res.json({message:'Carte révoquée. Son QR code indique désormais la révocation.'});
  }));
}
