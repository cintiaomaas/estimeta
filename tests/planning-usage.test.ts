import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { calculatePlanning } from '../src/lib/finance/planning-math';
import { PlanningGroupUsage } from '../src/components/planning/planning-group-usage';
import type { PlanningInput } from '../src/lib/validations/planning';
const config: PlanningInput = { revision: 0, enabled: true, incomeSource: 'MANUAL', referenceIncome: '5000', groups: [{ name: 'Aplicação', percentage: '10', alertPercentage: '90', active: true, categoryIds: ['category'] }] };
for (const [amount, usage, remaining, excess, label] of [
 ['0','0','500.00','0.00','Dentro do planejado'], ['350','70','150.00','0.00','Dentro do planejado'],
 ['450','90','50.00','0.00','Próximo do limite'], ['500','100','0.00','0.00','Planejado atingido'],
 ['575','115','0.00','75.00','Acima do planejado'],
]) test(`legenda e tooltip: ${amount} de 500, utilização ${usage}%`, () => {
 const report = calculatePlanning(config, '0', [{ categoryId: 'category', amount }]);
 const group = report.groups[0];
 assert.equal(group.utilizationPercentage, `${usage}.00`); assert.equal(group.remaining, remaining); assert.equal(group.excess, excess);
 assert.equal(report.totalPercentage, '10.00'); assert.equal(report.remainingPercentage, '90.00');
 const html = renderToStaticMarkup(createElement(PlanningGroupUsage, {group}));
 assert.ok(html.includes(label)); assert.ok(html.includes(`${usage}% do planejado utilizado`));
 assert.ok(html.includes(`aria-valuetext="${usage}% do planejado utilizado"`));
 assert.ok(html.includes(`value="${Math.min(100, Number(usage))}"`));
 assert.ok(html.includes('10% da renda')); assert.ok(html.includes('R$ 500,00 planejados'));
 assert.ok(html.includes(excess !== '0.00' ? 'R$ 75,00 acima do planejado' : `R$ ${remaining.replace('.',',')} disponíveis`));
 const tooltip = renderToStaticMarkup(createElement(PlanningGroupUsage, {group,tooltip:true}));
 assert.ok(tooltip.includes('comprometidos')); assert.ok(tooltip.includes(label)); assert.ok(tooltip.includes(`${usage}% do planejado utilizado`)); assert.ok(!tooltip.includes('<progress'));
});
test('renda zero: texto acessível sem divisão, NaN ou infinito', () => {
 const group = calculatePlanning({...config,referenceIncome:'0'}, '0', [{ categoryId:'category',amount:'350' }]).groups[0];
 const html = renderToStaticMarkup(createElement(PlanningGroupUsage,{group}));
 assert.ok(html.includes('Utilização indisponível')); assert.ok(html.includes('Sem renda de referência')); assert.ok(!/NaN|Infinity/.test(html));
});
