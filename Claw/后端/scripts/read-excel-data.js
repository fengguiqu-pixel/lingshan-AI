const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

function readExcelFile(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheets = workbook.SheetNames;
  
  console.log('=== Excel文件结构 ===');
  console.log('工作表数量:', sheets.length);
  sheets.forEach((sheet, idx) => {
    console.log(`${idx + 1}. ${sheet}`);
  });
  
  const lingshanData = [];
  const allAttractions = [];
  
  sheets.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`\n=== 工作表: ${sheetName} ===`);
    console.log(`行数: ${data.length}`);
    
    if (data.length > 0) {
      const columns = Object.keys(data[0]);
      console.log('列名:', columns);
      
      data.forEach(row => {
        const name = row['attraction_name'] || row['景点名称'] || row['景区名称'] || '';
        const content = row['attraction_content'] || row['景点内容'] || row['景区介绍'] || '';
        
        allAttractions.push({
          name: name,
          content: content.substring(0, 500),
          type: row['attraction_type'] || '',
          visitDate: row['visit_date'] || '',
          stayDuration: row['stay_duration'] || '',
          ticketCost: row['ticket_cost'] || '',
          totalCost: row['total_cost'] || '',
          groupSize: row['group_size'] || '',
          satisfaction: row['satisfaction'] || ''
        });
        
        if (name && (name.includes('灵山') || content.includes('灵山') || name.includes('大佛'))) {
          lingshanData.push({
            name: name,
            content: content.substring(0, 2000),
            type: row['attraction_type'] || '',
            visitDate: row['visit_date'] || '',
            stayDuration: row['stay_duration'] || '',
            ticketCost: row['ticket_cost'] || '',
            totalCost: row['total_cost'] || '',
            groupSize: row['group_size'] || '',
            satisfaction: row['satisfaction'] || ''
          });
        }
      });
      
      console.log(`\n灵山相关数据: ${lingshanData.length} 条`);
      lingshanData.forEach((item, i) => {
        console.log(`${i + 1}. 名称: ${item.name}`);
        console.log(`   内容预览: ${item.content.substring(0, 200)}...`);
        console.log(`   类型: ${item.type}`);
        console.log(`   满意度: ${item.satisfaction}`);
        console.log();
      });
    }
  });
  
  const outputPath = path.join(__dirname, '../data/lingshan-excel-data.json');
  fs.writeFileSync(outputPath, JSON.stringify(lingshanData, null, 2));
  console.log(`\n已保存灵山数据到 ${outputPath}`);
  
  const attractionsPath = path.join(__dirname, '../data/all-attractions.json');
  fs.writeFileSync(attractionsPath, JSON.stringify(allAttractions.slice(0, 500), null, 2));
  console.log(`已保存部分景点数据到 ${attractionsPath}`);
  
  return { lingshanData, allAttractions };
}

const filePath = path.join(__dirname, '../../景点景区旅游数据行为分析数据.xlsx');
readExcelFile(filePath);