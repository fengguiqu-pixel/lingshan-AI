const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

router.get('/dashboard', (req, res) => {
  const dataPath = path.join(__dirname, '../data/visualization-data.json');
  let jsonData = {};
  
  if (fs.existsSync(dataPath)) {
    jsonData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  }

  const spots = Object.entries(jsonData.spotStats || {});
  
  const lingshanKeywords = ['灵山', '大佛', '梵宫', '灌浴', '坛城', '祥符', '拈花', '胜境'];
  let filteredSpots = spots.filter(([name]) => 
    lingshanKeywords.some(k => name.includes(k))
  );
  
  const allLingshanSpots = {
    '灵山大佛': 286,
    '禅意小镇·拈花湾': 255,
    '灵山胜境': 236,
    '灵山梵宫': 200,
    '九龙灌浴': 180,
    '五印坛城': 150,
    '祥符禅寺': 120
  };
  
  filteredSpots = Object.entries(allLingshanSpots);
  const sortedSpots = filteredSpots.sort((a, b) => b[1] - a[1]);
  
  const satisfaction = Object.entries(jsonData.satisfactionStats || {});
  
  const consumption = jsonData.consumptionStructure || {
    food: 495.65,
    shopping: 543.47,
    transport: 255.53,
    entertainment: 198.30
  };

  const dailyVisits = jsonData.dailyVisits || [];
  
  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const totalVisits = jsonData.totalVisits || 4566;
  const monthlyData = [
    Math.floor(totalVisits * 0.05),
    Math.floor(totalVisits * 0.04),
    Math.floor(totalVisits * 0.08),
    Math.floor(totalVisits * 0.1),
    Math.floor(totalVisits * 0.12),
    Math.floor(totalVisits * 0.13),
    Math.floor(totalVisits * 0.15),
    Math.floor(totalVisits * 0.14),
    Math.floor(totalVisits * 0.1),
    Math.floor(totalVisits * 0.08),
    Math.floor(totalVisits * 0.05),
    Math.floor(totalVisits * 0.06)
  ];
  
  const ageGroups = [
    { name: '18岁以下', value: Math.floor(totalVisits * 0.12) },
    { name: '18-25岁', value: Math.floor(totalVisits * 0.28) },
    { name: '26-35岁', value: Math.floor(totalVisits * 0.35) },
    { name: '36-45岁', value: Math.floor(totalVisits * 0.18) },
    { name: '46-55岁', value: Math.floor(totalVisits * 0.05) },
    { name: '55岁以上', value: Math.floor(totalVisits * 0.02) }
  ];
  
  const genderData = [
    { name: '男性', value: Math.floor(totalVisits * 0.48) },
    { name: '女性', value: Math.floor(totalVisits * 0.52) }
  ];

  const tourTypes = [
    { name: '家庭游', value: Math.floor(totalVisits * 0.35) },
    { name: '情侣游', value: Math.floor(totalVisits * 0.28) },
    { name: '朋友游', value: Math.floor(totalVisits * 0.22) },
    { name: '独自游', value: Math.floor(totalVisits * 0.10) },
    { name: '团队游', value: Math.floor(totalVisits * 0.05) }
  ];

  const hotSpots = [
    { name: '灵山大佛', visits: 286, avgDuration: 120, avgCost: 280 },
    { name: '禅意小镇·拈花湾', visits: 255, avgDuration: 180, avgCost: 380 },
    { name: '灵山胜境', visits: 236, avgDuration: 150, avgCost: 320 },
    { name: '灵山梵宫', visits: 200, avgDuration: 90, avgCost: 220 },
    { name: '九龙灌浴', visits: 180, avgDuration: 30, avgCost: 150 },
    { name: '五印坛城', visits: 150, avgDuration: 60, avgCost: 180 },
    { name: '祥符禅寺', visits: 120, avgDuration: 45, avgCost: 120 }
  ];

  const visitorTrend = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    visitorTrend.push({
      date: `${date.getMonth() + 1}/${date.getDate()}`,
      visits: Math.floor(Math.random() * 50) + 100,
      newUsers: Math.floor(Math.random() * 20) + 40
    });
  }

  const ticketStats = [
    { name: '全价票', count: Math.floor(totalVisits * 0.65), revenue: Math.floor(totalVisits * 0.65 * 210) },
    { name: '半价票', count: Math.floor(totalVisits * 0.25), revenue: Math.floor(totalVisits * 0.25 * 105) },
    { name: '免票', count: Math.floor(totalVisits * 0.1), revenue: 0 }
  ];

  res.json({
    overview: {
      totalVisits: jsonData.totalVisits || 4566,
      avgStayDuration: parseFloat((jsonData.avgDuration || 3.8).toFixed(1)),
      avgConsumption: parseFloat((jsonData.avgCost || 680.96).toFixed(2)),
      satisfactionRate: 96.5
    },
    spotRankings: sortedSpots.map(([name, count]) => ({ name, count })),
    satisfactionDistribution: satisfaction.map(([level, count]) => ({
      name: `${level}星`,
      value: count
    })),
    consumptionStructure: [
      { name: '餐饮', value: consumption.food },
      { name: '购物', value: consumption.shopping },
      { name: '交通', value: consumption.transport },
      { name: '娱乐', value: consumption.entertainment }
    ],
    monthlyVisits: { months, data: monthlyData },
    ageDistribution: ageGroups,
    genderDistribution: genderData,
    tourTypeDistribution: tourTypes,
    hotSpots,
    visitorTrend,
    dailyVisits,
    ticketStats
  });
});

router.get('/real-data', (req, res) => {
  const dataPath = path.join(__dirname, '../data/visualization-data.json');
  
  if (fs.existsSync(dataPath)) {
    const jsonData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    res.json(jsonData);
  } else {
    res.json({ message: '数据文件不存在' });
  }
});

module.exports = router;