import { z } from "zod";
import { ModuleSetting } from "../models/system.models.js";
import { PortalAudit } from "../models/portal.models.js";
import { centre } from "../data/catalogue.js";
import { siteDefaults, footerDefaults } from "../data/siteSettings.js";
const text=z.string().trim().max(2000);
const url=z.string().trim().max(1000).refine(value=>!value||/^https?:\/\//i.test(value)||/^\/(?!\/)/.test(value),'Lien local ou http(s) attendu.');
const footerSchema=z.object(Object.fromEntries(Object.keys(footerDefaults).map(key=>[key,['links','domains'].includes(key)?z.array(z.object({label:z.string().trim().min(1).max(100),url})).max(20):key.endsWith('Url')?url:text]))).strict();
const schema=z.object({name:text,phone:text,phoneLink:z.string().regex(/^\+?[\d ]{6,30}$/),email:z.string().email(),whatsapp:z.string().regex(/^\d{8,20}$/),address:text,landmark:text,mapUrl:url,mapEmbedUrl:z.string().refine(value=>!value||/^https:\/\/(www\.)?google\.com\/maps\/embed\?/i.test(value),'Utilisez le lien d’intégration Google Maps officiel.'),footer:footerSchema}).strict();
export async function getPublicCentre(){const stored=await ModuleSetting.findById('site').lean();return {...centre,...siteDefaults,...stored?.data,footer:{...footerDefaults,...stored?.data?.footer}};}
export async function saveSiteSettings(body,user){const merged={...(await getPublicCentre()),...body};delete merged.slogan;delete merged.whatsappMessage;const parsed=schema.safeParse(merged);if(!parsed.success)return {error:parsed.error.issues.map(issue=>`${issue.path.join('.')}: ${issue.message}`).join(' · ')};await ModuleSetting.updateOne({_id:'site'},{$set:{data:parsed.data,updatedBy:user.name}},{upsert:true});await PortalAudit.create({actorId:user._id,actorRole:'admin',action:'site_settings_updated',changes:parsed.data});return {settings:parsed.data};}
