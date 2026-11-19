import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import mongoose from "mongoose";
import { createApp } from "../app.js";
import { AdminUser, AdminSession, CentrePresentation, BlogPost } from "../models/platform.models.js";
import { hashToken } from "../services/password.service.js";
import { seedPlatform, getPublicPortal } from "../services/platform.service.js";

test("présentations: brouillons privés, publication ordonnée, droits et données initiales durables", async () => {
  await mongoose.connect(`mongodb://127.0.0.1:27017/alhakim_presentations_test_${process.pid}`, {serverSelectionTimeoutMS:2000});
  let server;
  try {
    await seedPlatform();
    assert.equal(await CentrePresentation.countDocuments(), 3);
    assert.equal(await BlogPost.countDocuments(), 3);
    await CentrePresentation.deleteMany({});
    const user = await AdminUser.create({name:"Test",username:"presentation-admin",email:"test@example.com",passwordHash:"unused",role:"admin"});
    await AdminSession.create({userId:user._id, tokenHash:hashToken('presentation-test-token'),csrfToken:'csrf-test',expiresAt:new Date(Date.now()+60000),lastSeenAt:new Date()});
    server=createApp().listen(0,'127.0.0.1');
    await once(server,'listening');
    const origin=`http://127.0.0.1:${server.address().port}`;
    const call=(method,path,body,auth=true)=>fetch(`${origin}/api/admin/resources/presentations${path}`,{method,headers:{'Content-Type':'application/json',...(auth?{Cookie:'ah_admin=presentation-test-token','X-CSRF-Token':'csrf-test'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    assert.equal((await call('POST','',{title:'Interdit'},false)).status,401);
    const draft=await call('POST','',{title:'Brouillon',order:0});
    assert.equal(draft.status,201);
    const {item}=await draft.json();
    assert.equal((await getPublicPortal()).presentations.length,0);
    assert.equal((await call('POST','',{title:'Deuxième',published:true,order:2})).status,201);
    assert.equal((await call('PATCH',`/${item._id}`,{published:true,order:1})).status,200);
    assert.deepEqual((await getPublicPortal()).presentations.map(x=>x.title),['Brouillon','Deuxième']);
    assert.equal((await call('PATCH',`/${item._id}`,{buttonLink:'javascript:alert(1)'})).status,400);
    const videoResponse = await fetch(`${origin}/api/admin/resources/blog`, {
      method:'POST', headers:{'Content-Type':'application/json',Cookie:'ah_admin=presentation-test-token','X-CSRF-Token':'csrf-test'},
      body:JSON.stringify({title:'Actualité vidéo',published:true,videoUrl:'/uploads/reportage.mp4'}),
    });
    assert.equal(videoResponse.status,201);
    assert.equal((await getPublicPortal()).blog.find(article=>article.title==='Actualité vidéo').videoUrl,'/uploads/reportage.mp4');
    user.role='staff'; user.permissions=['centre.presentations:view']; await user.save();
    assert.equal((await call('GET','')).status,200);
    assert.equal((await call('POST','',{title:'Interdit'})).status,403);
    await CentrePresentation.deleteMany({});
    await BlogPost.deleteMany({});
    await seedPlatform();
    assert.equal(await CentrePresentation.countDocuments(),0,'Ne pas recréer les diapositives supprimées');
    assert.equal(await BlogPost.countDocuments(),0,'Ne pas recréer les articles supprimés');
  } finally {
    if(server) await new Promise(resolve=>server.close(resolve));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
