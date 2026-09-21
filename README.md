# 地铁渗透率看板

44 城地铁日维度/月维度渗透率分析看板。

## 访问地址

GitHub Pages: https://mengqi0815.github.io/metro-dashboard/

## 功能

- **城市看板**：44 城每日/近7日/MTD 核心指标（进站客流、笔数、DAP、渗透率），趋势图，城市明细表
- **自然月维度**：月度渗透率趋势分析，全国/大区/城市维度切换，月度明细表

## 数据来源

- 日客流：深度出行API
- DAP/笔数：ODPS
- 历史月度：交通运输部月度速报
- 换乘系数：离线xlsx速报计算

## 自动更新

数据每天自动更新：
- 在内网环境执行 `python3 update-data.py` 更新数据
- 可配合 crontab 每日定时执行

## 本地部署

```bash
python3 -m http.server 8080
# 访问 http://localhost:8080/index.html
```

## 维护

孟琦 (276831)