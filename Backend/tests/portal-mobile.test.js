import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import mongoose from 'mongoose';
import {createApp} from '../app.js';
import {StudentUser,StudentSession,Lesson} from '../models/student.models.js';
import {StudentAccount,Payment} from '../models/finance.models.js';
import {PortalPublication,StudentCard,portalModels} from '../models/portal.models.js';
import {AdminUser,AdminSession} from '../models/platform.models.js';
import {MarketingAgent,MarketingSession,MarketingProspect} from '../models/marketing.models.js';
import {hashToken} from '../services/password.service.js';
import {publicationsFor} from '../services/portal.service.js';
import {getPublicPortal} from '../services/platform.service.js';

test('Portails mobiles: audiences, groupes, documents privés, cartes révoquées et périmètre agent',async()=>{
  await mongoose.connect(`mongodb://127.0.0.1:27017/alhakim_mobile_test_${process.pid}`,{serverSelectionTimeoutMS:2000});
  let server;
  try{
    await Promise.all(portalModels.map(model=>model.init()));
    const a=await StudentAccount.create({reference:'A',studentName:'Fathia',courseId:'anglais',groupId:'A',startDate:'2026-01-01'});
    const b=await StudentAccount.create({reference:'B',studentName:'Autre',courseId:'anglais',groupId:'B',startDate:'2026-01-01'});
    const student=await StudentUser.create({name:'Fathia',username:'fathia',passwordHash:'unused',mustChangePassword:false,accountIds:[a._id],phone:'77703436'});
    await StudentSession.create({userId:student._id,tokenHash:hashToken('student-token'),csrfToken:'student-csrf',expiresAt:new Date(Date.now()+600000)});
    const admin=await AdminUser.create({name:'Admin',username:'test-admin',email:'admin@example.com',passwordHash:'unused',role:'admin'});
    await AdminSession.create({userId:admin._id,tokenHash:hashToken('admin-token'),csrfToken:'admin-csrf',expiresAt:new Date(Date.now()+600000)});
    await PortalPublication.insertMany([
      {title:'Site public',published:true,audiences:['public']},
      {title:'Étudiants A',published:true,audiences:['student'],courseId:'anglais',groupId:'A'},
      {title:'Étudiants B',published:true,audiences:['student'],courseId:'anglais',groupId:'B'},
      {title:'Annonce expirée',published:true,audiences:['student'],endsAt:'2000-01-01'},
      {title:'Brouillon',published:false,audiences:['student']},
      {title:'Marketing',published:true,audiences:['marketing']},
    ]);
    assert.deepEqual((await publicationsFor('student',[a])).map(item=>item.title),['Étudiants A']);
    assert.deepEqual((await getPublicPortal()).publications.map(item=>item.title),['Site public']);
    await Lesson.insertMany([{title:'Cours A',courseId:'anglais',groupId:'A'},{title:'Cours B',courseId:'anglais',groupId:'B'},{title:'Cours commun',courseId:'anglais'}]);
    const receipt=await Payment.create({reference:'PAY-B',receiptNumber:'REC-B',studentAccountId:b._id,date:'2026-01-01',amount:100});
    const pending=await Payment.create({reference:'PAY-A',receiptNumber:'REC-A',studentAccountId:a._id,date:'2026-01-01',amount:100,status:'pending'});
    const agent=await MarketingAgent.create({reference:'AG-TEST',name:'Agent',email:'agent@example.com',passwordHash:'unused',mustChangePassword:false});
    await MarketingSession.create({agentId:agent._id,tokenHash:hashToken('agent-token'),csrfToken:'agent-csrf',expiresAt:new Date(Date.now()+600000)});
    const own=await MarketingProspect.create({reference:'PRO-ME',name:'Mon prospect',phone:'77111111',phoneKey:'77111111',courseId:'anglais',agentId:agent._id});
    const other=await MarketingProspect.create({reference:'PRO-OTHER',name:'Secret autre équipe',phone:'77222222',phoneKey:'77222222',courseId:'anglais'});
    server=createApp().listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
    const call=(path,role='student',method='GET',body)=>fetch(`${base}/api/${path}`,{method,headers:{Accept:'application/json','Content-Type':'application/json',Cookie:`ah_${role}=${role==='student'?'student':role==='marketing'?'agent':'admin'}-token`,'X-CSRF-Token':`${role==='marketing'?'agent':role}-csrf`},...(body?{body:JSON.stringify(body)}:{})});
    assert.equal((await call('student/home')).status,200);
    const lessons=await(await call('student/lessons')).json();assert.deepEqual(lessons.items.map(item=>item.title).sort(),['Cours A','Cours commun']);
    assert.equal((await call(`student/documents/receipts/${receipt._id}`)).status,404);
    assert.equal((await call(`student/documents/receipts/${pending._id}`)).status,404);
    assert.equal((await call('student/profile','student','PATCH',{accountIds:[b._id]})).status,400);
    const card=await(await call('student/card')).json();assert.match(card.verifyUrl,/\/api\/cards\/verify\/[a-f0-9]{64}$/);assert.equal(card.status,'valid');
    const token=card.verifyUrl.split('/').pop();const verify=await fetch(`${base}/api/cards/verify/${token}`,{headers:{Accept:'application/json'}});const publicCard=await verify.json();assert.equal(publicCard.name,'Fathia');assert.equal(publicCard.phone,undefined);assert.equal(publicCard.token,undefined);
    assert.equal((await call(`admin/eleves/access/${student._id}/card/revoke`,'admin','POST',{})).status,200);
    const revoked=await(await fetch(`${base}/api/cards/verify/${token}`,{headers:{Accept:'application/json'}})).json();assert.equal(revoked.status,'revoked');
    await StudentCard.updateOne({studentId:student._id},{$unset:{revokedAt:1},$set:{validUntil:new Date('2000-01-01')}});
    const expired=await(await fetch(`${base}/api/cards/verify/${token}`,{headers:{Accept:'application/json'}})).json();assert.equal(expired.status,'expired');
    const list=await(await call('marketing/prospects?agentId=none','marketing')).json();assert.equal(list.total,1);assert.equal(list.items[0]._id,own._id.toString());
    assert.equal((await call(`marketing/prospects/${other._id}/history`,'marketing')).status,404);
    assert.equal((await call(`marketing/prospects/${own._id}/status`,'marketing','POST',{status:'enrolled'})).status,403);
    const duplicate=await call('marketing/prospects','marketing','POST',{name:'Test',phone:'77222222',courseId:'anglais'});assert.equal(duplicate.status,409);assert.ok(!(await duplicate.text()).includes('Secret autre équipe'));
    assert.equal((await call(`marketing/prospects/${own._id}/interactions`,'marketing','POST',{note:'Appel effectué à la demande du prospect.'})).status,201);
    const settingsResponse=await call('admin/site-settings','admin','PATCH',{phone:'+253 77 70 34 36',footer:{...(await(await call('admin/site-settings','admin')).json()).settings.footer,ctaTitle:'Votre avenir commence ici.'}});
    assert.equal(settingsResponse.status,200,await settingsResponse.clone().text());
    const site=await(await fetch(`${base}/api/centre`)).json();
    assert.equal(site.centre.footer.ctaTitle,'Votre avenir commence ici.');
    const studentCentre=(await(await call('student/home')).json()).centre;
    assert.equal(studentCentre.phone,site.centre.phone);
    assert.equal((await call('admin/site-settings','admin','PATCH',{mapUrl:'javascript:alert(1)'})).status,400);
    const competency=await call('admin/resources/courses','admin','POST',{id:'competence-test',title:'Compétence de test',description:'Compétence administrable.',department:'informatique',courseType:'competence'});
    assert.equal(competency.status,201);
    const choices=await(await call('admin/lookups/courses','admin')).json();
    assert.equal(choices.items.find(item=>item.id==='competence-test').courseType,'competence');
  }finally{if(server)await new Promise(resolve=>server.close(resolve));await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
