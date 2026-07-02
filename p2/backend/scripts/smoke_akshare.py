"""akshare 接口冒烟测试:逐个调用本项目依赖的接口,打印列名与首行。

用途:
1. 初次搭建时确认网络连通性;
2. akshare 升级后确认列名未变(akshare_client.py 的字段映射依赖这些列名)。

运行:python scripts/smoke_akshare.py [接口名...]  # 不带参数则全部跑
"""
import sys
import datetime

import akshare as ak

CASES = {
    "spot": lambda: ak.stock_zh_a_spot_em(),
    "hist_daily": lambda: ak.stock_zh_a_hist(
        symbol="600519", period="daily",
        start_date="20250101", end_date="20250701", adjust="qfq"),
    "hist_min": lambda: ak.stock_zh_a_hist_min_em(symbol="600519", period="60"),
    "fund_flow": lambda: ak.stock_individual_fund_flow(stock="600519", market="sh"),
    "fund_flow_rank": lambda: ak.stock_individual_fund_flow_rank(indicator="今日"),
    "comment": lambda: ak.stock_comment_em(),
    "comment_jgcyd": lambda: ak.stock_comment_detail_zlkp_jgcyd_em(symbol="600519"),
    "comment_focus": lambda: ak.stock_comment_detail_scrd_focus_em(symbol="600519"),
    "hot_rank": lambda: ak.stock_hot_rank_latest_em(symbol="SH600519"),
    "market_activity": lambda: ak.stock_market_activity_legu(),
    "zt_pool": lambda: ak.stock_zt_pool_em(
        date=(datetime.date.today() - datetime.timedelta(days=1)).strftime("%Y%m%d")),
    "code_name": lambda: ak.stock_info_a_code_name(),
}


def main() -> int:
    names = sys.argv[1:] or list(CASES)
    failed = []
    for name in names:
        print(f"\n=== {name} ===")
        try:
            df = CASES[name]()
            print(f"shape={df.shape}")
            print(f"columns={list(df.columns)}")
            print(df.head(2).to_string())
        except Exception as e:  # noqa: BLE001 冒烟脚本需要继续跑完所有接口
            failed.append(name)
            print(f"FAILED: {type(e).__name__}: {e}")
    print(f"\n{'ALL OK' if not failed else 'FAILED: ' + ', '.join(failed)}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
