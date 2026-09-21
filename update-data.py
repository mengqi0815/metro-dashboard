#!/usr/bin/env python3
"""
地铁渗透率看板 - 数据更新脚本
从原始 Muse 项目页面拉取最新 HTML，提取数据 JSON 并更新本地 data/ 目录。

用法:
  python3 update-data.py

需在内网环境运行（能访问 cloudide.dev.alipay.net）。
可配合 crontab 每日定时执行。
"""

import json
import re
import sys
import os
import urllib.request
from datetime import datetime, timezone

# ===== 配置 =====
SOURCE_URL = "http://dw5j8w5ip5q4d8yo-et15-sqa.cloudide.dev.alipay.net:8080/metro-dashboard.html"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "data")

DATA_VARS = [
    "__ALL_DATA__",
    "__DAP_DAILY_DATA__",
    "__MF_MONTHLY_DATA__",
    "__MF_DAP_MONTHLY_DATA__",
    "__COEF_DATA__",
]

VAR_TO_FILE = {
    "__ALL_DATA__": "all-data.json",
    "__DAP_DAILY_DATA__": "dap-daily-data.json",
    "__MF_MONTHLY_DATA__": "mf-monthly-data.json",
    "__MF_DAP_MONTHLY_DATA__": "mf-dap-monthly-data.json",
    "__COEF_DATA__": "coef-data.json",
}


def fetch_html(url):
    print(f"正在获取: {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "MetroDashboard/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        html = resp.read().decode("utf-8")
    print(f"  ✓ 获取成功 ({len(html):,} 字节)")
    return html


def extract_data(html):
    scripts = re.findall(r"<script[^>]*>(.*?)</script>", html, re.DOTALL)
    if len(scripts) < 2:
        print("✗ 未找到数据 script 标签")
        return {}
    data_script = scripts[1]
    pattern = r"window\.(__[A-Z_]+__)\s*=\s*"
    positions = [(m.group(1), m.start(), m.end()) for m in re.finditer(pattern, data_script)]
    results = {}
    for i, (var_name, start, end) in enumerate(positions):
        if var_name not in DATA_VARS:
            continue
        if i + 1 < len(positions):
            json_end = positions[i + 1][1]
        else:
            json_end = len(data_script)
        json_str = data_script[end:json_end].strip()
        if json_str.endswith(";"):
            json_str = json_str[:-1]
        try:
            data = json.loads(json_str)
            results[var_name] = data
            print(f"  ✓ {var_name} ({len(json_str):,} 字节)")
        except json.JSONDecodeError as e:
            print(f"  ✗ {var_name}: JSON 解析失败 - {e}")
    return results


def save_data(data_map):
    os.makedirs(DATA_DIR, exist_ok=True)
    for var_name, data in data_map.items():
        filename = VAR_TO_FILE.get(var_name)
        if not filename:
            continue
        filepath = os.path.join(DATA_DIR, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
        print(f"  ✓ 已保存 {filepath}")
    meta = {
        "lastUpdated": datetime.now(timezone.utc).isoformat(),
        "source": SOURCE_URL,
    }
    meta_path = os.path.join(DATA_DIR, "meta.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print(f"  ✓ 已保存 {meta_path}")


def main():
    print("=" * 50)
    print("地铁渗透率看板 - 数据更新")
    print(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 50)
    try:
        html = fetch_html(SOURCE_URL)
        data_map = extract_data(html)
        if not data_map:
            print("✗ 未提取到任何数据")
            sys.exit(1)
        print(f"\n提取到 {len(data_map)} 个数据集，正在保存...")
        save_data(data_map)
        print("\n✅ 数据更新完成!")
    except Exception as e:
        print(f"\n❌ 更新失败: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
