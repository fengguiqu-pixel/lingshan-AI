const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../景点景区旅游数据行为分析数据.xlsx');
const workbook = XLSX.readFile(filePath);
const sheets = workbook.SheetNames;

console.log('=== Excel文件结构 ===');
console.log('工作表:', sheets);

const sheetName = sheets[0];
const worksheet = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(worksheet);

console.log(`\n工作表 ${sheetName} 列名:`, Object.keys(rows[0]));
console.log(`总数据行数: ${rows.length}`);

const lingshanData = [];
const keywords = ['灵山', '大佛', '梵宫', '灌浴', '坛城', '祥符', '拈花', '胜境'];

rows.forEach(d => {
  const name = d['attraction_name'] || d['景点名称'] || '';
  const content = d['attraction_content'] || d['景点内容'] || '';
  
  if (keywords.some(k => name.includes(k) || content.includes(k))) {
    lingshanData.push(d);
  }
});

console.log(`\n灵山相关数据: ${lingshanData.length} 条`);

const spotStats = {};
const visitDates = {};
const costs = [];
const durations = [];
const groupSizes = [];
const satisfactions = [];
const foodCosts = [];
const shoppingCosts = [];
const transportCosts = [];
const entertainmentCosts = [];

lingshanData.forEach(item => {
  const name = item['attraction_name'] || '';
  const visitDate = item['visit_date'] || '';
  const stayDuration = parseFloat(item['stay_duration']) || 0;
  const totalCost = parseFloat(item['total_cost']) || 0;
  const groupSize = parseInt(item['group_size']) || 1;
  const satisfaction = parseInt(item['satisfaction']) || 0;
  const foodCost = parseFloat(item['food_cost']) || 0;
  const shoppingCost = parseFloat(item['shopping_cost']) || 0;
  const transportCost = parseFloat(item['transport_cost']) || 0;
  const entertainmentCost = parseFloat(item['entertainment_cost']) || 0;
  
  if (name) spotStats[name] = (spotStats[name] || 0) + 1;
  if (visitDate) visitDates[visitDate] = (visitDates[visitDate] || 0) + 1;
  if (stayDuration > 0) durations.push(stayDuration);
  if (totalCost > 0) costs.push(totalCost);
  if (groupSize > 0) groupSizes.push(groupSize);
  if (satisfaction > 0) satisfactions.push(satisfaction);
  if (foodCost > 0) foodCosts.push(foodCost);
  if (shoppingCost > 0) shoppingCosts.push(shoppingCost);
  if (transportCost > 0) transportCosts.push(transportCost);
  if (entertainmentCost > 0) entertainmentCosts.push(entertainmentCost);
});

console.log('\n=== 景点访问统计 ===');
Object.entries(spotStats).forEach(([name, count]) => {
  console.log(`${name}: ${count}次访问`);
});

console.log('\n=== 满意度分布 ===');
const satisfactionStats = {};
satisfactions.forEach(s => {
  satisfactionStats[s] = (satisfactionStats[s] || 0) + 1;
});
Object.entries(satisfactionStats).forEach(([level, count]) => {
  console.log(`满意度${level}星: ${count}人`);
});

console.log('\n=== 消费统计 ===');
const avgCost = costs.reduce((a, b) => a + b, 0) / costs.length;
console.log(`平均消费: ¥${avgCost.toFixed(2)}`);

console.log('\n=== 消费结构 ===');
const avgFood = foodCosts.reduce((a, b) => a + b, 0) / foodCosts.length;
const avgShopping = shoppingCosts.reduce((a, b) => a + b, 0) / shoppingCosts.length;
const avgTransport = transportCosts.reduce((a, b) => a + b, 0) / transportCosts.length;
const avgEntertainment = entertainmentCosts.reduce((a, b) => a + b, 0) / entertainmentCosts.length;
console.log(`餐饮: ¥${avgFood.toFixed(2)}`);
console.log(`购物: ¥${avgShopping.toFixed(2)}`);
console.log(`交通: ¥${avgTransport.toFixed(2)}`);
console.log(`娱乐: ¥${avgEntertainment.toFixed(2)}`);

console.log('\n=== 停留时长统计 ===');
const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
console.log(`平均停留时长: ${avgDuration.toFixed(1)}小时`);

console.log('\n=== 团队规模统计 ===');
const avgGroupSize = groupSizes.reduce((a, b) => a + b, 0) / groupSizes.length;
console.log(`平均团队人数: ${avgGroupSize.toFixed(1)}人`);

const sortedDates = Object.entries(visitDates).sort((a, b) => a[0] - b[0]);
const dailyVisits = sortedDates.slice(-30).map(([date, count]) => {
  const dateObj = new Date(1899, 11, 30 + parseFloat(date));
  return {
    date: dateObj.toISOString().split('T')[0],
    count
  };
});

const jsonOutput = {
  spotStats,
  satisfactionStats,
  avgCost,
  avgDuration,
  avgGroupSize,
  totalVisits: lingshanData.length,
  consumptionStructure: {
    food: avgFood,
    shopping: avgShopping,
    transport: avgTransport,
    entertainment: avgEntertainment
  },
  dailyVisits
};

fs.writeFileSync(path.join(__dirname, '../data/visualization-data.json'), JSON.stringify(jsonOutput, null, 2), 'utf8');
console.log('\n已保存可视化数据到 visualization-data.json');