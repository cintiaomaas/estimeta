import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { financialService } from '../../src/services/finance';
import { planningService } from '../../src/services/planning';
import { reportService } from '../../src/services/reports';
import { AppError } from '../../src/lib/api/errors';
import type { PlanningInput } from '../../src/lib/validations/planning';
test('planejamento MySQL: persistência, compromissos, invariantes e isolamento', async (suite) => {
 assert.notEqual(process.env.NODE_ENV, 'production');
 const db=new PrismaClient(), households=[randomUUID(),randomUUID()], users=[randomUUID(),randomUUID()];
 try {
  for(let i=0;i<2;i++) await db.user.create({data:{id:users[i],name:'Planejamento QA',email:`planning-${users[i]}@example.invalid`,passwordHash:'not-a-password',membership:{create:{role:'OWNER',household:{create:{id:households[i],name:'Planejamento QA'}}}}}});
  const actor={userId:users[0],householdId:households[0]}, bActor={userId:users[1],householdId:households[1]};
  const f=financialService(db,actor), b=financialService(db,bActor), p=planningService(db,actor), reports=reportService(db,actor,new Date('2026-09-22T15:00:00Z'));
  const account=await f.saveAccount({name:'QA',type:'CASH',initialBalance:'0'});
  const fixed=await f.saveCategory({name:'Fixos',type:'EXPENSE'}), various=await f.saveCategory({name:'Diversos',type:'EXPENSE'}), other=await f.saveCategory({name:'Sem grupo',type:'EXPENSE'}), income=await f.saveCategory({name:'Renda',type:'INCOME'});
  const foreign=await b.saveCategory({name:'Categoria de outro espaço',type:'EXPENSE'});
  let config:PlanningInput={revision:0,enabled:true,incomeSource:'MANUAL',referenceIncome:'10000',groups:[{name:'Fixos',percentage:'20',alertPercentage:'90',active:true,categoryIds:[fixed.id]},{name:'Diversos',percentage:'30',alertPercentage:'90',active:true,categoryIds:[various.id]},{name:'Reserva apenas planejada',percentage:'20',alertPercentage:'90',active:true,categoryIds:[]}]};
  const add=(categoryId:string,amount:string,status:'PAID'|'PENDING'|'RECEIVED', competenceDate='2026-09-01')=>f.saveTransaction({accountId:account.id,categoryId,amount,status,type:status==='RECEIVED'?'INCOME':'EXPENSE',description:'Compromisso QA',competenceDate,scheduledDate:'2026-09-01',transactionDate:status==='PENDING'?null:'2026-09-02'});
  await suite.test('inicia desativado e salva renda manual sem criar transações',async()=>{
   assert.equal((await p.config()).enabled,false); assert.equal((await reports.dashboard({year:2026,month:9})).planning.enabled,false);
   config=await p.save(config); assert.equal(config.referenceIncome,'10000.00'); assert.equal(await db.transaction.count({where:{householdId:households[0]}}),0);
  });
  await add(fixed.id,'1000','PAID'); await add(fixed.id,'500','PENDING'); await add(various.id,'3500','PENDING'); await add(other.id,'75','PAID');
  const future=await add(fixed.id,'999','PENDING','2027-01-01');
  await suite.test('PAID + PENDING comprometem; saldo inclui apenas realizado por competência',async()=>{
   const d=await reports.dashboard({year:2026,month:9});
   assert.equal(d.balance,'-1075.00'); assert.equal(d.planning.groups[0].committed,'1500.00'); assert.equal(d.planning.groups[0].utilizationPercentage,'75.00'); assert.equal(d.planning.groups[1].utilizationPercentage,'116.67'); assert.equal(d.planning.unclassified,'75.00');
   assert.equal(d.planning.groups[0].remaining,'500.00'); assert.equal(d.planning.groups[1].excess,'500.00');
   assert.equal((await f.accounts())[0].balance,d.balance);
  });
  await suite.test('valida 100%, duplicidade, tipo e Household de categorias',async()=>{
   await assert.rejects(p.save({...config,groups:config.groups.map(g=>({...g,percentage:'40'}))}));
   await assert.rejects(p.save({...config,groups:[config.groups[0],{...config.groups[1],categoryIds:[fixed.id]}]}));
   for(const categoryId of [foreign.id,income.id]) await assert.rejects(p.save({...config,groups:[{...config.groups[0],categoryIds:[categoryId]}]}),e=>e instanceof AppError && e.status===400);
   assert.equal((await p.config()).revision,config.revision);
   const group=await db.planningGroup.findFirstOrThrow({where:{householdId:households[0]}});
   await assert.rejects(db.planningGroupCategory.create({data:{planningGroupId:group.id,householdId:households[0],categoryId:foreign.id}}));
  });
  await suite.test('configuração de outro Household não mistura nem sobrescreve dados',async()=>{
   const pb=planningService(db,bActor); assert.equal((await pb.config()).enabled,false);
   await pb.save({revision:0,enabled:true,incomeSource:'MANUAL',referenceIncome:'99999',groups:[{name:'Grupo B',percentage:'100',alertPercentage:'50',active:true,categoryIds:[foreign.id]}]});
   assert.equal((await reports.dashboard({year:2026,month:9})).planning.referenceIncome,'10000.00');
   assert.equal((await p.config()).groups.some(g=>g.name==='Grupo B'),false);
  });
  await suite.test('renda realizada zero, depois recebida, configurações recalculam sem modificar fatos',async()=>{
   config=await p.save({...config,incomeSource:'REALIZED'});
   assert.equal((await reports.dashboard({year:2026,month:9})).planning.available,false);
   await add(income.id,'10000','RECEIVED');
   const d=await reports.dashboard({year:2026,month:9}); assert.equal(d.planning.referenceIncome,'10000.00'); assert.equal(d.planning.groups[0].incomePercentage,'15.00'); assert.equal(d.balance,'8925.00');
   config=await p.save({...config,groups:config.groups.map((g,i)=>i===0?{...g,percentage:'15'}:g)});
   assert.equal((await reports.dashboard({year:2026,month:9})).planning.groups[0].state,'REACHED');
   assert.equal((await f.transaction(future.id)).amount,'999.00');
  });
  await suite.test('concorrência rejeita revisão antiga e preserva configuração',async()=>{
   const stale={...config}; config=await p.save({...config,enabled:false});
   await assert.rejects(p.save(stale),e=>e instanceof AppError && e.status===409);
   assert.equal((await reports.dashboard({year:2026,month:9})).planning.enabled,false);
   const results=await Promise.allSettled([p.save({...config,enabled:true}),p.save({...config,enabled:true})]);
   assert.equal(results.filter(r=>r.status==='fulfilled').length,1); config=await p.config();
  });
  await suite.test('nova conexão, categoria desativada e alteração de tipo protegem planejamento',async()=>{
   const fresh=new PrismaClient(); try { assert.equal((await planningService(fresh,actor).config()).revision,config.revision); }finally{await fresh.$disconnect();}
   await f.removeCategory(fixed.id); assert.equal((await reports.dashboard({year:2026,month:9})).planning.groups[0].committed,'1500.00');
   const unused=await f.saveCategory({name:'Vinculada sem transações',type:'EXPENSE'});
   config=await p.save({...config,groups:[...config.groups,{name:'Pequeno',percentage:'1',alertPercentage:'90',active:true,categoryIds:[unused.id]}]});
   await assert.rejects(f.saveCategory({name:unused.name,type:'INCOME'},unused.id));
  });
 }finally{
  await db.transaction.deleteMany({where:{householdId:{in:households}}});
  await db.incomePlanning.deleteMany({where:{householdId:{in:households}}});
  await db.category.deleteMany({where:{householdId:{in:households}}}); await db.account.deleteMany({where:{householdId:{in:households}}});
  await db.household.deleteMany({where:{id:{in:households}}}); await db.user.deleteMany({where:{id:{in:users}}}); await db.$disconnect();
 }
});
