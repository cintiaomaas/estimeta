import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { calculatePlanning } from '../src/lib/finance/planning-math';
import { planningSchema, type PlanningInput } from '../src/lib/validations/planning';
const ids = [randomUUID(), randomUUID(), randomUUID()];
const config = (): PlanningInput => ({ revision: 0, enabled: true, incomeSource: 'MANUAL', referenceIncome: '10000', groups: [
  { name: 'Fixos', percentage: '20', alertPercentage: '90', active: true, categoryIds: [ids[0]] },
  { name: 'Diversos', percentage: '30', alertPercentage: '90', active: true, categoryIds: [ids[1]] },
  { name: 'Objetivo sem categorias', percentage: '20', alertPercentage: '90', active: true, categoryIds: [] },
] });
test('planejamento manual: 20%, 30%, comprometido, restante e excesso', () => {
 const result = calculatePlanning(config(), '0', [{ categoryId: ids[0], amount: '1500' }, { categoryId: ids[1], amount: '3500' }, { categoryId: ids[2], amount: '50' }]);
 assert.equal(result.totalPercentage, '70.00'); assert.equal(result.remainingPercentage, '30.00'); assert.equal(result.unclassified, '50.00');
 assert.deepEqual([result.groups[0].incomePercentage, result.groups[0].utilizationPercentage, result.groups[0].remaining, result.groups[0].state], ['15.00', '75.00', '500.00', 'WITHIN']);
 assert.deepEqual([result.groups[1].incomePercentage, result.groups[1].utilizationPercentage, result.groups[1].excess, result.groups[1].excessPercentagePoints, result.groups[1].state], ['35.00', '116.67', '500.00', '5.00', 'EXCEEDED']);
});
test('desativado e grupo inativo não produzem consumo duplicado', () => {
 const c = config(); c.enabled = false; assert.equal(calculatePlanning(c, '5000', []).groups.length, 0);
 c.enabled = true; c.groups[1].active = false; assert.equal(calculatePlanning(c, '0', []).totalPercentage, '40.00');
});
test('renda realizada e zero não usam renda manual ou saldo como fallback', () => {
 const c = config(); c.incomeSource = 'REALIZED';
 assert.equal(calculatePlanning(c, '5000', []).groups[0].planned, '1000.00');
 const empty = calculatePlanning(c, '0', [{ categoryId: ids[0], amount: '1500' }]);
 assert.equal(empty.available, false); assert.equal(empty.groups[0].committed, '1500.00');
 assert.equal(empty.groups[0].state, 'UNAVAILABLE'); assert.equal(empty.groups[0].incomePercentage, null); assert.equal(empty.groups[0].utilizationPercentage, null);
});
test('alerta de 90%, igualdade e ultrapassagem usam valores exatos', () => {
 for (const [amount, expected] of [['1799.99', 'WITHIN'], ['1800', 'NEAR'], ['2000', 'REACHED'], ['2000.01', 'EXCEEDED']]) assert.equal(calculatePlanning(config(), '0', [{ categoryId: ids[0], amount }]).groups[0].state, expected);
});
test('percentuais abaixo/iguais/acima de 100, duplicidade e precisão', () => {
 const c = config(); assert.ok(planningSchema.safeParse(c).success);
 c.groups[2].percentage = '50'; assert.ok(planningSchema.safeParse(c).success);
 c.groups[2].percentage = '50.01'; assert.equal(planningSchema.safeParse(c).success, false);
 c.groups[2].percentage = '49.99'; assert.equal(calculatePlanning(c, '0', []).totalPercentage, '99.99');
 c.groups[1].categoryIds = [ids[0]]; assert.equal(planningSchema.safeParse(c).success, false);
 c.groups[1].active = false; assert.ok(planningSchema.safeParse(c).success);
 c.groups[0].percentage = '20.001'; assert.equal(planningSchema.safeParse(c).success, false);
});
test('valida fonte, renda, percentuais positivos e propriedades extras', () => {
 for (const patch of [{referenceIncome:'0'}, {referenceIncome:'-1'}, {incomeSource:'BALANCE'}, {householdId:randomUUID()}]) assert.equal(planningSchema.safeParse({...config(),...patch}).success,false);
 for(const value of ['0','-1','101','abc']) { const c=config(); c.groups[0].percentage=value; assert.equal(planningSchema.safeParse(c).success,false); }
 const c=config(); c.groups[0].percentage='0.01'; c.referenceIncome='9999999999999.99';
 assert.equal(calculatePlanning(c,'0',[]).groups[0].planned,'1000000000.00');
});
